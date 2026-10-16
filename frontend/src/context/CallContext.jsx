import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { useToast } from './ToastContext';
import CallModal from '../components/CallModal';
import api from '../services/api';

const CallContext = createContext();

// STUN alone frequently isn't enough — mobile/cellular connections in
// particular sit behind carrier-grade NAT that STUN can't punch through, so
// two phones (or a phone + a network with a strict firewall) often can't
// find a direct path to each other at all. OpenRelay's public TURN servers
// (metered.ca/tools/openrelay) are free, require no signup, and relay the
// media when a direct connection isn't possible — meant for exactly this
// kind of small-scale/testing use, not heavy production traffic; a
// growing app would want a paid TURN provider or self-hosted coturn instead.
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const RING_TIMEOUT_MS = 30_000;

export const CallProvider = ({ children }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const toast = useToast();

  // 'idle' | 'calling' (outgoing, ringing) | 'ringing' (incoming) | 'connected'
  const [callStatus, setCallStatus] = useState('idle');
  const [callType, setCallType] = useState('audio');
  const [remoteUser, setRemoteUser] = useState(null); // { _id, username, profilePicture }
  const [incomingCall, setIncomingCall] = useState(null); // { from, offer, callType, caller }
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  // Refs hold the imperative WebRTC state (peer connection, local media
  // stream, who we're calling). They're the source of truth for cleanup and
  // signaling handlers, which otherwise risk closing over stale state from
  // whichever render they were created in. The matching useState copies
  // exist purely to drive the CallModal UI.
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const remoteUserIdRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const callStatusRef = useRef('idle');
  const ringTimeoutRef = useRef(null);
  const callStartedAtRef = useRef(null);
  const callLoggedRef = useRef(false);

  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  const cleanup = useCallback(() => {
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    remoteUserIdRef.current = null;
    callStartedAtRef.current = null;
    callLoggedRef.current = false;
    pendingCandidatesRef.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setRemoteUser(null);
    setIncomingCall(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setCallStatus('idle');
  }, []);

  const createPeerConnection = useCallback(
    (targetUserId, iceServers = ICE_SERVERS) => {
      const pc = new RTCPeerConnection({ iceServers });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('iceCandidate', { to: targetUserId, candidate: event.candidate });
        }
      };

      pc.onicecandidateerror = (event) => {
        console.warn('WebRTC ICE candidate error:', event.errorCode, event.errorText);
      };

      pc.ontrack = (event) => {
        // Some browsers do not populate event.streams even though the track
        // is valid. Keep one stream and add both audio/video tracks to it.
        const stream = event.streams?.[0] || remoteStreamRef.current || new MediaStream();
        if (!stream.getTracks().some((track) => track.id === event.track.id)) {
          stream.addTrack(event.track);
        }
        remoteStreamRef.current = stream;
        setRemoteStream(stream);
      };

      // Only 'failed' is treated as a definitive end — 'disconnected' is
      // often a transient ICE blip that recovers on its own, and 'closed'
      // is just the echo of calling cleanup() ourselves.
      pc.onconnectionstatechange = () => {
        console.log('WebRTC connection state:', pc.connectionState);
        if (pc.connectionState === 'failed') {
          toast.error('Call connection failed');
          cleanup();
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('WebRTC ICE state:', pc.iceConnectionState);
      };

      pcRef.current = pc;
      return pc;
    },
    [socket, toast, cleanup]
  );

  const getMedia = async (type) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video' ? { width: 640, height: 480 } : false,
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  };

  const getIceServers = async () => {
    try {
      const { data } = await api.get('/turn/ice-servers');
      return [...ICE_SERVERS, ...(Array.isArray(data.iceServers) ? data.iceServers : [])];
    } catch (error) {
      // TURN is a fallback. Calls can still work peer-to-peer using STUN.
      console.warn(
        'TURN configuration unavailable; using STUN only',
        error.response?.data?.message || error.message
      );
      return ICE_SERVERS;
    }
  };

  const startCall = async (partner, type) => {
    if (!socket || !user || callStatusRef.current !== 'idle') return;

    try {
      const [stream, iceServers] = await Promise.all([getMedia(type), getIceServers()]);
      setRemoteUser(partner);
      setCallType(type);
      remoteUserIdRef.current = partner._id;

      const pc = createPeerConnection(partner._id, iceServers);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('callUser', {
        to: partner._id,
        offer,
        callType: type,
        caller: { _id: user._id, username: user.username, profilePicture: user.profilePicture },
      });

      setCallStatus('calling');
    } catch (err) {
      console.error('Error starting call:', err);
      toast.error(
        err.name === 'NotAllowedError'
          ? 'Camera/microphone permission is required to call'
          : 'Could not start the call'
      );
      cleanup();
    }
  };

  const acceptCall = async () => {
    if (!incomingCall || !socket) return;
    const { from, offer, callType: incomingType, caller } = incomingCall;

    try {
      const [stream, iceServers] = await Promise.all([getMedia(incomingType), getIceServers()]);
      setRemoteUser(caller);
      setCallType(incomingType);
      remoteUserIdRef.current = from;

      const pc = createPeerConnection(from, iceServers);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('answerCall', { to: from, answer });

      callStartedAtRef.current = Date.now();
      setIncomingCall(null);
      setCallStatus('connected');
    } catch (err) {
      console.error('Error accepting call:', err);
      toast.error(
        err.name === 'NotAllowedError'
          ? 'Camera/microphone permission is required to answer'
          : 'Could not answer the call'
      );
      socket.emit('rejectCall', { to: from });
      cleanup();
    }
  };

  const declineCall = () => {
    const declinedCall = incomingCall;
    if (incomingCall && socket) {
      socket.emit('rejectCall', { to: incomingCall.from });
    }
    if (declinedCall) {
      logCall(declinedCall.from, declinedCall.callType, 'declined');
    }
    cleanup();
  };

  const logCall = useCallback(async (receiverId, type, status) => {
    if (!receiverId || !type || callLoggedRef.current) return;
    callLoggedRef.current = true;
    const duration = callStartedAtRef.current
      ? Math.max(0, Math.round((Date.now() - callStartedAtRef.current) / 1000))
      : 0;
    try {
      await api.post('/messages/call-log', {
        receiverId,
        callType: type,
        callStatus: status,
        duration,
      });
    } catch (error) {
      console.error('Could not save call history:', error);
    }
  }, []);

  const endCall = useCallback((statusOverride) => {
    const target = remoteUserIdRef.current || incomingCall?.from;
    const status = statusOverride || (callStartedAtRef.current ? 'completed' : 'canceled');
    if (target && socket) {
      socket.emit('endCall', { to: target });
    }
    if (target) logCall(target, callType, status);
    cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, incomingCall, callType, cleanup, logCall]);

  useEffect(() => {
    if (callStatus !== 'calling' && callStatus !== 'ringing') return undefined;

    ringTimeoutRef.current = setTimeout(() => {
      if (callStatusRef.current === 'calling' || callStatusRef.current === 'ringing') {
        toast.info('Call timed out');
        endCall();
      }
    }, RING_TIMEOUT_MS);

    return () => {
      if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
      }
    };
  }, [callStatus, endCall, toast]);

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = isMuted;
    });
    setIsMuted((m) => !m);
  };

  const toggleCamera = () => {
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = isCameraOff;
    });
    setIsCameraOff((c) => !c);
  };

  // App-wide signaling listeners — a call can arrive while the user is on
  // any page, not just Messages, so this lives at the provider level.
  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = ({ from, offer, callType: incomingType, caller }) => {
      // Already on/making a call — silently reject rather than interrupting.
      if (callStatusRef.current !== 'idle') {
        socket.emit('rejectCall', { to: from });
        return;
      }
      setIncomingCall({ from, offer, callType: incomingType, caller });
      setCallStatus('ringing');
    };

    const handleCallAnswered = async ({ answer }) => {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current = [];
      callStartedAtRef.current = Date.now();
      setCallStatus('connected');
    };

    const handleIceCandidate = async ({ candidate }) => {
      const pc = pcRef.current;
      if (!candidate) return;
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    };

    const handleCallRejected = () => {
      toast.info('Call declined');
      cleanup();
    };

    const handleCallUnavailable = () => {
      toast.info('That user is unavailable');
      logCall(remoteUserIdRef.current, callType, 'missed');
      cleanup();
    };

    const handleCallEnded = () => {
      cleanup();
    };

    const handleSocketDisconnect = () => {
      if (callStatusRef.current !== 'idle') {
        toast.info('Call ended because the connection was lost');
        cleanup();
      }
    };

    socket.on('incomingCall', handleIncomingCall);
    socket.on('callAnswered', handleCallAnswered);
    socket.on('iceCandidate', handleIceCandidate);
    socket.on('callRejected', handleCallRejected);
    socket.on('callUnavailable', handleCallUnavailable);
    socket.on('callEnded', handleCallEnded);
    socket.on('disconnect', handleSocketDisconnect);

    return () => {
      socket.off('incomingCall', handleIncomingCall);
      socket.off('callAnswered', handleCallAnswered);
      socket.off('iceCandidate', handleIceCandidate);
      socket.off('callRejected', handleCallRejected);
      socket.off('callUnavailable', handleCallUnavailable);
      socket.off('callEnded', handleCallEnded);
      socket.off('disconnect', handleSocketDisconnect);
    };
  }, [socket, toast, cleanup, logCall, callType]);

  useEffect(() => () => cleanup(), [cleanup]);

  return (
    <CallContext.Provider
      value={{ callStatus, callType, remoteUser, incomingCall, startCall, acceptCall, declineCall, endCall }}
    >
      {children}
      <CallModal
        callStatus={callStatus}
        callType={callType}
        remoteUser={remoteUser}
        incomingCall={incomingCall}
        localStream={localStream}
        remoteStream={remoteStream}
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        onAccept={acceptCall}
        onDecline={declineCall}
        onEnd={endCall}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
      />
    </CallContext.Provider>
  );
};

export const useCall = () => useContext(CallContext);
