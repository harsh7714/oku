import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider, useSocket } from './context/SocketContext';
import { CallProvider } from './context/CallContext';
import api from './services/api';
import { subscribeToPush } from './utils/push';

import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import RightSidebar from './components/RightSidebar';

import AuthPage from './pages/AuthPage';
import HomeFeedPage from './pages/HomeFeedPage';
import ExplorePage from './pages/ExplorePage';
import ReelsPage from './pages/ReelsPage';
import ProfilePage from './pages/ProfilePage';
import MessagesPage from './pages/MessagesPage';
import NotificationsPage from './pages/NotificationsPage';

import './App.css';

const AppContent = () => {
  const { user, loading } = useAuth();
  const { socket } = useSocket();
  const location = useLocation();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Load initial unread counts once authenticated
  useEffect(() => {
    if (!user) return;

    const loadCounts = async () => {
      try {
        const { data } = await api.get('/notifications');
        setUnreadNotifications(data.filter((n) => !n.isRead).length);
      } catch (err) {
        console.error('Error loading notification counts:', err);
      }

      try {
        const { data } = await api.get('/messages/conversations/list');
        const unread = data.filter(
          (c) => !c.lastMessage.isRead && String(c.lastMessage.senderId) !== String(user._id)
        ).length;
        setUnreadMessages(unread);
      } catch (err) {
        console.error('Error loading message counts:', err);
      }
    };

    loadCounts();
  }, [user]);

  // Push notifications are on by default: silently request permission and
  // subscribe as soon as a user is authenticated, rather than waiting for
  // them to find the toggle on the Notifications page. Notification.
  // requestPermission() is a no-op (resolves immediately, no prompt) once
  // the browser already has a decision on file, so this is safe to run on
  // every load — it only actually prompts the very first time.
  useEffect(() => {
    if (!user) return;
    subscribeToPush().catch((err) => {
      console.warn('Auto push subscription skipped:', err.message);
    });
  }, [user?._id]);

  // Live badge updates from socket events
  useEffect(() => {
    if (!socket) return;

    const handleNotification = () => setUnreadNotifications((n) => n + 1);
    const handleMessage = () => {
      if (location.pathname !== '/messages') {
        setUnreadMessages((n) => n + 1);
      }
    };

    socket.on('receiveNotification', handleNotification);
    socket.on('receiveMessage', handleMessage);

    return () => {
      socket.off('receiveNotification', handleNotification);
      socket.off('receiveMessage', handleMessage);
    };
  }, [socket, location.pathname]);

  if (loading) {
    return (
      <div className="app-loading-screen">
        <Loader2 className="spinner" size={40} />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  // Reels and Messages are immersive, fullscreen-on-mobile experiences —
  // no room for the right sidebar there.
  const isImmersivePage = location.pathname === '/messages' || location.pathname === '/reels';
  const showRightSidebar = !isImmersivePage;
  // The mobile top navbar (branding + notification bell) is only really
  // "home" for the app's own wordmark — every other page either has its
  // own page-specific header already or, on Reels/Messages, no room for
  // one at all — so it's restricted to the home feed instead of repeating
  // on every route.
  const showMobileNavbar = location.pathname === '/';

  return (
    <div className={`app-container ${!showRightSidebar ? 'no-right-sidebar' : ''}`}>
      {showMobileNavbar && <Navbar unreadNotifications={unreadNotifications} />}
      <Sidebar unreadNotifications={unreadNotifications} unreadMessages={unreadMessages} />

      <Routes>
        <Route path="/" element={<HomeFeedPage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/reels" element={<ReelsPage />} />
        <Route
          path="/messages"
          element={<MessagesPage onOpen={() => setUnreadMessages(0)} />}
        />
        <Route
          path="/notifications"
          element={<NotificationsPage onReadNotifications={() => setUnreadNotifications(0)} />}
        />
        <Route path="/profile/:username" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {showRightSidebar && <RightSidebar />}
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <CallProvider>
          <AppContent />
        </CallProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
