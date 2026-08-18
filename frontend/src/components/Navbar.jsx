import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = ({ unreadNotifications = 0 }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <header className="mobile-navbar">
      <div className="mobile-logo-group" onClick={() => navigate('/')}>
        <img src="/favicon.svg" alt="" className="mobile-logo-icon" width="26" height="26" />
        <h1 className="mobile-logo">Oku</h1>
      </div>
      <button
        className="mobile-notification-btn"
        onClick={() => navigate('/notifications')}
        title="Notifications"
      >
        <Bell size={22} />
        {unreadNotifications > 0 && <span className="nav-badge badge mobile-notification-badge">{unreadNotifications}</span>}
      </button>
    </header>
  );
};

export default Navbar;
