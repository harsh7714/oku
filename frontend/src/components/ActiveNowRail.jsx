import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import { getMediaUrl } from '../utils/mediaUrl';
import './ActiveNowRail.css';

const avatarSrc = (u) =>
  u?.profilePicture
    ? getMediaUrl(u.profilePicture)
    : `https://api.dicebear.com/7.x/bottts/svg?seed=${u?.username}`;

// A horizontal rail of currently-online people the user follows — an
// original take on the "stories bar" pattern, surfacing live presence
// (built on the same onlineUsers signal used in Messages) instead of
// ephemeral posts.
const ActiveNowRail = () => {
  const { user } = useAuth();
  const { onlineUsers } = useSocket();
  const [following, setFollowing] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    api
      .get(`/users/profile/${user.username}`)
      .then(({ data }) => setFollowing(data.following || []))
      .catch((err) => console.error('Error loading active-now list:', err));
  }, [user]);

  const activeNow = following.filter((f) => onlineUsers.includes(f._id));

  if (activeNow.length === 0) return null;

  return (
    <div className="active-now-rail glass fade-in">
      <span className="active-now-label">Active now</span>
      <div className="active-now-scroller">
        {activeNow.map((person) => (
          <button
            key={person._id}
            className="active-now-item"
            onClick={() => navigate(`/messages?user=${person.username}`)}
            title={`Message @${person.username}`}
          >
            <span className="active-now-ring">
              <img src={avatarSrc(person)} alt="Avatar" className="avatar active-now-avatar" width="52" height="52" />
              <span className="active-now-pulse" />
            </span>
            <span className="active-now-username">{person.username}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ActiveNowRail;
