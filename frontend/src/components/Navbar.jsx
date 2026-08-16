import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMediaUrl } from '../utils/mediaUrl';
import './Navbar.css';

const Navbar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <header className="mobile-navbar glass">
      <div className="mobile-logo-group" onClick={() => navigate('/')}>
        <img src="/favicon.svg" alt="" className="mobile-logo-icon" width="26" height="26" />
        <h1 className="mobile-logo">Oku</h1>
      </div>
      <img
        src={user.profilePicture ? getMediaUrl(user.profilePicture) : 'https://api.dicebear.com/7.x/bottts/svg?seed=' + user.username}
        alt="Avatar"
        className="avatar mobile-avatar-img"
        onClick={() => navigate(`/profile/${user.username}`)}
        width="34"
        height="34"
      />
    </header>
  );
};

export default Navbar;
