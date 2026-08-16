import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Compass, Film, MessageCircle, Bell, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getMediaUrl } from '../utils/mediaUrl';
import './Sidebar.css';

const Sidebar = ({ unreadNotifications = 0, unreadMessages = 0 }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <aside className="sidebar glass">
      <div className="logo-section">
        <img src="/favicon.svg" alt="" className="logo-icon" width="32" height="32" />
        <h1 className="logo-text">Oku</h1>
      </div>

      <nav className="nav-menu">
        <NavLink
          to="/"
          end
          title="Home"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Home className="nav-icon" size={22} />
          <span className="nav-label">Home</span>
        </NavLink>

        <NavLink
          to="/explore"
          title="Explore"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Compass className="nav-icon" size={22} />
          <span className="nav-label">Explore</span>
        </NavLink>

        <NavLink
          to="/reels"
          title="Reels"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Film className="nav-icon" size={22} />
          <span className="nav-label">Reels</span>
        </NavLink>

        <NavLink
          to="/messages"
          title="Messages"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <div className="icon-wrapper">
            <MessageCircle className="nav-icon" size={22} />
            {unreadMessages > 0 && <span className="nav-badge badge">{unreadMessages}</span>}
          </div>
          <span className="nav-label">Messages</span>
        </NavLink>

        <NavLink
          to="/notifications"
          title="Notifications"
          className={({ isActive }) => `nav-item nav-item-notifications ${isActive ? 'active' : ''}`}
        >
          <div className="icon-wrapper">
            <Bell className="nav-icon" size={22} />
            {unreadNotifications > 0 && <span className="nav-badge badge">{unreadNotifications}</span>}
          </div>
          <span className="nav-label">Notifications</span>
        </NavLink>

        <NavLink
          to={`/profile/${user.username}`}
          title="Profile"
          className={({ isActive }) => `nav-item nav-item-profile ${isActive ? 'active' : ''}`}
        >
          <img
            src={user.profilePicture ? getMediaUrl(user.profilePicture) : 'https://api.dicebear.com/7.x/bottts/svg?seed=' + user.username}
            alt=""
            className="nav-profile-avatar"
            width="22"
            height="22"
          />
          <span className="nav-label">Profile</span>
        </NavLink>
      </nav>

      <div className="user-profile-summary">
        <img 
          src={user.profilePicture ? getMediaUrl(user.profilePicture) : 'https://api.dicebear.com/7.x/bottts/svg?seed=' + user.username}
          alt="Avatar" 
          className="avatar" 
          width="40" 
          height="40" 
        />
        <div className="user-details">
          <p className="username-label">@{user.username}</p>
        </div>
        <button className="btn-logout" onClick={handleLogout} title="Log Out">
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
