import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <header className="mobile-navbar glass">
      <h1 className="mobile-logo" onClick={() => navigate('/')}>Oku</h1>
      <img
        src={user.profilePicture ? `http://localhost:5000${user.profilePicture}` : 'https://api.dicebear.com/7.x/bottts/svg?seed=' + user.username}
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
