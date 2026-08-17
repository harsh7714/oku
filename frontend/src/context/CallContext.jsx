import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { useToast } from './ToastContext';
import CallModal from '../components/CallModal';

const CallContext = createContext();

// Free public STUN servers — enough to discover a peer's reachable address
// behind most home/office NATs. There's no TURN relay configured, so calls
// across very restrictive/symmetric NATs or corporate firewalls may fail to
// connect; a production deployment would add a TURN provider here too.
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

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
  const remoteUserIdRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const callStatusRef = useRef('idle');

  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    remoteUserIdRef.current = null;
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
    (targetUserId) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('iceCandidate', { to: targetUserId, candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      // Only 'failed' is treated as a definitive end — 'disconnected' is
      // often a transient ICE blip that recovers on its own, and 'closed'
      // is just the echo of calling cleanup() ourselves.
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          toast.error('Call connection failed');
          cleanup();
        }
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

  const startCall = async (partner, type) => {
    if (!socket || !user || callStatusRef.current !== 'idle') return;

    try {
      const stream = await getMedia(type);
      setRemoteUser(partner);
      setCallType(type);
      remoteUserIdRef.current = partner._id;

      const pc = createPeerConnection(partner._id);
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
      const stream = await getMedia(incomingType);
      setRemoteUser(caller);
      setCallType(incomingType);
      remoteUserIdRef.current = from;

      const pc = createPeerConnection(from);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('answerCall', { to: from, answer });

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
    if (incomingCall && socket) {
      socket.emit('rejectCall', { to: incomingCall.from });
    }
    setIncomingCall(null);
    setCallStatus('idle');
  };

  const endCall = useCallback(() => {
    const target = remoteUserIdRef.current || incomingCall?.from;
    if (target && socket) {
      socket.emit('endCall', { to: target });
    }
    cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, incomingCall, cleanup]);

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

    const handleCallEnded = () => {
      cleanup();
    };

    socket.on('incomingCall', handleIncomingCall);
    socket.on('callAnswered', handleCallAnswered);
    socket.on('iceCandidate', handleIceCandidate);
    socket.on('callRejected', handleCallRejected);
    socket.on('callEnded', handleCallEnded);

    return () => {
      socket.off('incomingCall', handleIncomingCall);
      socket.off('callAnswered', handleCallAnswered);
      socket.off('iceCandidate', handleIceCandidate);
      socket.off('callRejected', handleCallRejected);
      socket.off('callEnded', handleCallEnded);
    };
  }, [socket, toast, cleanup]);

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
