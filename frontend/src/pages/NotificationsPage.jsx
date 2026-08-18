import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import { Bell, Heart, MessageSquare, UserPlus, CheckCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import { getAvatarUrl } from '../utils/mediaUrl';
import './NotificationsPage.css';

const NotificationsPage = ({ onReadNotifications }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const toast = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data);
      // Automatically trigger callback to clear the unread counter in main App
      if (onReadNotifications) {
        onReadNotifications();
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  // Hook up real-time socket notifications
  useEffect(() => {
    if (socket) {
      socket.on('receiveNotification', (newNotif) => {
        setNotifications((prev) => [newNotif, ...prev]);
        if (onReadNotifications) {
          onReadNotifications();
        }
      });
    }

    return () => {
      if (socket) {
        socket.off('receiveNotification');
      }
    };
  }, [socket]);

  const handleMarkAsRead = async () => {
    try {
      await api.put('/notifications/read');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Error marking notifications as read:', err);
      toast.error('Failed to mark notifications as read');
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'like':
        return <Heart className="notif-icon like" size={18} fill="currentColor" />;
      case 'comment':
        return <MessageSquare className="notif-icon comment" size={18} />;
      case 'follow':
        return <UserPlus className="notif-icon follow" size={18} />;
      default:
        return <Bell className="notif-icon default" size={18} />;
    }
  };

  const formatNotifText = (notif) => {
    const sender = notif.senderId.username;
    switch (notif.type) {
      case 'like':
        return <span><strong>{sender}</strong> liked your post</span>;
      case 'comment':
        return (
          <span>
            <strong>{sender}</strong> commented on your post: <span className="notif-post-snippet">"{notif.postId?.content}"</span>
          </span>
        );
      case 'follow':
        return <span><strong>{sender}</strong> started following you</span>;
      default:
        return <span>Action by <strong>{sender}</strong></span>;
    }
  };

  const handleNotifClick = (notif) => {
    if (notif.postId) {
      navigate(`/profile/${user.username}`);
    } else {
      navigate(`/profile/${notif.senderId.username}`);
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const hasUnread = notifications.some((n) => !n.isRead);

  return (
    <main className="notifications-main fade-in">
      <div className="notifications-header glass">
        <h2 className="notifications-title">Notifications</h2>
        <div className="notifications-header-actions">
          {hasUnread && (
            <button className="btn btn-secondary btn-mark-read" onClick={handleMarkAsRead}>
              <CheckCircle size={14} />
              <span>Mark all read</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="notifications-loading">
          <Loader2 className="spinner" size={32} />
          <p>Checking your notifications...</p>
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          subtitle="Activities like followers, comments, and likes on your posts will appear here."
        />
      ) : (
        <div className="notifications-list">
          {notifications.map((notif) => (
            <div
              key={notif._id}
              className={`notification-item glass ${notif.isRead ? '' : 'unread'}`}
              onClick={() => handleNotifClick(notif)}
            >
              <div className="notif-details">
                {getNotificationIcon(notif.type)}
                <img
                  src={getAvatarUrl(notif.senderId)}
                  alt="Avatar"
                  className="avatar notif-avatar"
                  width="36"
                  height="36"
                />
                <div className="notif-text-container">
                  <p className="notif-text">{formatNotifText(notif)}</p>
                  <p className="notif-date">{formatDate(notif.createdAt)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
};

export default NotificationsPage;
