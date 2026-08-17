import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff } from 'lucide-react';
import { getAvatarUrl } from '../utils/mediaUrl';
import './CallModal.css';

const formatDuration = (totalSeconds) => {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const CallModal = ({
  callStatus,
  callType,
  remoteUser,
  incomingCall,
  localStream,
  remoteStream,
  isMuted,
  isCameraOff,
  onAccept,
  onDecline,
  onEnd,
  onToggleMute,
  onToggleCamera,
}) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream || null;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream || null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream || null;
  }, [remoteStream]);

  useEffect(() => {
    if (callStatus !== 'connected') {
      setDuration(0);
      return;
    }
    const interval = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [callStatus]);

  if (callStatus === 'idle') return null;

  const isRinging = callStatus === 'ringing' && incomingCall;
  const displayUser = isRinging ? incomingCall.caller : remoteUser;
  const activeCallType = isRinging ? incomingCall.callType : callType;

  return (
    <div className="call-overlay fade-in">
      {callStatus === 'connected' ? (
        <div className="call-active">
          {activeCallType === 'video' ? (
            <>
              <video ref={remoteVideoRef} className="call-remote-video" autoPlay playsInline />
              <video ref={localVideoRef} className="call-local-video" autoPlay playsInline muted />
              {isCameraOff && (
                <div className="call-local-video-off">
                  <VideoOff size={16} />
                </div>
              )}
            </>
          ) : (
            <>
              <audio ref={remoteAudioRef} autoPlay />
              <div className="call-audio-avatar">
                <img src={getAvatarUrl(displayUser)} alt="" width="120" height="120" />
              </div>
            </>
          )}

          <div className="call-info-bar glass">
            <span className="call-username">{displayUser?.username}</span>
            <span className="call-duration">{formatDuration(duration)}</span>
          </div>

          <div className="call-controls">
            <button type="button" className="call-control-btn" onClick={onToggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            {activeCallType === 'video' && (
              <button
                type="button"
                className="call-control-btn"
                onClick={onToggleCamera}
                title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
              >
                {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
              </button>
            )}
            <button type="button" className="call-control-btn call-end-btn" onClick={onEnd} title="End call">
              <PhoneOff size={20} />
            </button>
          </div>
        </div>
      ) : (
        <div className="call-ringing glass glass-glow">
          <div className="call-ringing-avatar-wrap">
            <img src={getAvatarUrl(displayUser)} alt="" className="call-ringing-avatar" width="96" height="96" />
            <span className="call-ringing-pulse" />
          </div>
          <h3 className="call-ringing-username">{displayUser?.username}</h3>
          <p className="call-ringing-status">
            {isRinging
              ? `Incoming ${activeCallType === 'video' ? 'video' : 'voice'} call...`
              : `Calling${activeCallType === 'video' ? ' (video)' : ''}...`}
          </p>

          <div className="call-ringing-actions">
            {isRinging ? (
              <>
                <button type="button" className="call-control-btn call-end-btn" onClick={onDecline} title="Decline">
                  <PhoneOff size={22} />
                </button>
                <button type="button" className="call-control-btn call-accept-btn" onClick={onAccept} title="Accept">
                  <Phone size={22} />
                </button>
              </>
            ) : (
              <button type="button" className="call-control-btn call-end-btn" onClick={onEnd} title="Cancel">
                <PhoneOff size={22} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CallModal;
