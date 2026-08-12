import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Send, Loader2, MessageCircle } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { formatRelativeTime } from '../utils/formatRelativeTime';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import './MessagesPage.css';

const avatarSrc = (u) =>
  u?.profilePicture
    ? `http://localhost:5000${u.profilePicture}`
    : `https://api.dicebear.com/7.x/bottts/svg?seed=${u?.username}`;

const roomFor = (idA, idB) => [idA, idB].sort().join('_');

const MessagesPage = ({ onOpen }) => {
  const { user } = useAuth();
  const { socket, onlineUsers } = useSocket();
  const [searchParams] = useSearchParams();

  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [activePartner, setActivePartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const activePartnerRef = useRef(null);

  useEffect(() => {
    activePartnerRef.current = activePartner;
  }, [activePartner]);

  useEffect(() => {
    if (onOpen) onOpen();
  }, [onOpen]);

  const fetchConversations = async () => {
    try {
      const { data } = await api.get('/messages/conversations/list');
      setConversations(data);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  const openConversation = async (partner) => {
    setActivePartner(partner);
    setMessages([]);
    setSearchQuery('');
    setSearchResults([]);
    setLoadingMessages(true);

    if (socket) {
      socket.emit('joinChat', roomFor(user._id, partner._id));
    }

    try {
      const { data } = await api.get(`/messages/${partner._id}`);
      setMessages(data);
      setConversations((prev) =>
        prev.map((c) =>
          c.user._id === partner._id
            ? { ...c, lastMessage: { ...c.lastMessage, isRead: true } }
            : c
        )
      );
    } catch (err) {
      console.error('Error fetching chat history:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Open a conversation directly via ?user=<username> (e.g. from a profile page link)
  useEffect(() => {
    const targetUsername = searchParams.get('user');
    if (!targetUsername || !user) return;

    const existing = conversations.find((c) => c.user.username === targetUsername);
    if (existing) {
      openConversation(existing.user);
      return;
    }

    if (!loadingConversations) {
      api
        .get(`/users/profile/${targetUsername}`)
        .then(({ data }) => openConversation(data))
        .catch((err) => console.error('Error opening direct conversation:', err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loadingConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPartnerTyping]);

  // Real-time incoming messages
  useEffect(() => {
    if (!socket) return;

    const handleReceive = (msg) => {
      const partner = activePartnerRef.current;
      if (partner && msg.senderId._id === partner._id) {
        setMessages((prev) => [...prev, msg]);
        setIsPartnerTyping(false);
      }

      setConversations((prev) => {
        const partnerId = msg.senderId._id;
        const existingIndex = prev.findIndex((c) => c.user._id === partnerId);
        const isOpen = activePartnerRef.current?._id === partnerId;
        const updatedEntry = {
          user: msg.senderId,
          lastMessage: {
            content: msg.content,
            createdAt: msg.createdAt,
            senderId: msg.senderId._id,
            isRead: isOpen,
          },
        };
        if (existingIndex === -1) return [updatedEntry, ...prev];
        const next = [...prev];
        next.splice(existingIndex, 1);
        return [updatedEntry, ...next];
      });
    };

    const handleTyping = (room) => {
      const partner = activePartnerRef.current;
      if (partner && room === roomFor(user._id, partner._id)) {
        setIsPartnerTyping(true);
      }
    };

    const handleStopTyping = (room) => {
      const partner = activePartnerRef.current;
      if (partner && room === roomFor(user._id, partner._id)) {
        setIsPartnerTyping(false);
      }
    };

    socket.on('receiveMessage', handleReceive);
    socket.on('typing', handleTyping);
    socket.on('stopTyping', handleStopTyping);

    return () => {
      socket.off('receiveMessage', handleReceive);
      socket.off('typing', handleTyping);
      socket.off('stopTyping', handleStopTyping);
    };
  }, [socket, user]);

  const handleDraftChange = (e) => {
    setDraft(e.target.value);
    if (!socket || !activePartner) return;

    const room = roomFor(user._id, activePartner._id);
    socket.emit('typing', room);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stopTyping', room);
    }, 1500);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!draft.trim() || !activePartner || sending) return;

    setSending(true);
    const content = draft.trim();
    setDraft('');

    if (socket) {
      socket.emit('stopTyping', roomFor(user._id, activePartner._id));
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    try {
      const { data } = await api.post('/messages', {
        receiverId: activePartner._id,
        content,
      });
      setMessages((prev) => [...prev, data]);
      setConversations((prev) => {
        const existingIndex = prev.findIndex((c) => c.user._id === activePartner._id);
        const updatedEntry = {
          user: activePartner,
          lastMessage: {
            content: data.content,
            createdAt: data.createdAt,
            senderId: user._id,
            isRead: true,
          },
        };
        if (existingIndex === -1) return [updatedEntry, ...prev];
        const next = [...prev];
        next.splice(existingIndex, 1);
        return [updatedEntry, ...next];
      });
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleSearchChange = async (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (val.trim().length > 1) {
      try {
        const { data } = await api.get(`/users/search?q=${val}`);
        setSearchResults(data.filter((u) => u._id !== user._id));
      } catch (err) {
        console.error('User search error:', err);
      }
    } else {
      setSearchResults([]);
    }
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  const formatConversationTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const isPartnerOnline = activePartner && onlineUsers.includes(activePartner._id);

  return (
    <main className="messages-main fade-in">
      <div className="messages-shell glass">
        {/* Conversations panel */}
        <aside className={`conversations-panel ${activePartner ? 'hide-on-mobile' : ''}`}>
          <div className="conversations-header">
            <h2>Messages</h2>
          </div>

          <div className="conversation-search">
            <Search className="search-icon" size={16} />
            <input
              type="text"
              placeholder="Search people to message..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="search-input"
            />
            {searchResults.length > 0 && (
              <div className="conversation-search-dropdown glass">
                {searchResults.map((res) => (
                  <div key={res._id} className="conversation-search-item" onClick={() => openConversation(res)}>
                    <img src={avatarSrc(res)} alt="Avatar" className="avatar" width="32" height="32" />
                    <span>@{res.username}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {loadingConversations ? (
            <div className="conversations-loading-list">
              <Skeleton variant="conversation" />
              <Skeleton variant="conversation" />
              <Skeleton variant="conversation" />
            </div>
          ) : conversations.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title="No conversations yet"
              subtitle="Search for someone to start a conversation."
            />
          ) : (
            <div className="conversations-list">
              {conversations.map((c) => {
                const unread = !c.lastMessage.isRead && String(c.lastMessage.senderId) !== String(user._id);
                return (
                  <div
                    key={c.user._id}
                    className={`conversation-item ${activePartner?._id === c.user._id ? 'active' : ''} ${unread ? 'unread' : ''}`}
                    onClick={() => openConversation(c.user)}
                  >
                    <div className="conversation-avatar-wrap">
                      <img src={avatarSrc(c.user)} alt="Avatar" className="avatar" width="44" height="44" />
                      {onlineUsers.includes(c.user._id) && <span className="presence-dot" />}
                    </div>
                    <div className="conversation-preview">
                      <div className="conversation-top-row">
                        <span className="conversation-username">@{c.user.username}</span>
                        <span className="conversation-time">{formatConversationTime(c.lastMessage.createdAt)}</span>
                      </div>
                      <p className="conversation-last-message">{c.lastMessage.content}</p>
                    </div>
                    {unread && <span className="unread-dot" />}
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        {/* Chat panel */}
        <section className={`chat-panel ${activePartner ? '' : 'hide-on-mobile'}`}>
          {!activePartner ? (
            <div className="chat-placeholder">
              <MessageCircle size={48} />
              <h3>Select a conversation</h3>
              <p>Choose someone from your conversations, or search to start a new chat.</p>
            </div>
          ) : (
            <>
              <div className="chat-header">
                <button className="btn-back-mobile" onClick={() => setActivePartner(null)}>
                  &larr;
                </button>
                <div className="conversation-avatar-wrap">
                  <img src={avatarSrc(activePartner)} alt="Avatar" className="avatar" width="38" height="38" />
                  {isPartnerOnline && <span className="presence-dot" />}
                </div>
                <div className="chat-header-info">
                  <span className="chat-header-username">@{activePartner.username}</span>
                  <span className={`chat-header-status ${isPartnerOnline ? 'online' : ''}`}>
                    {isPartnerOnline ? 'Online' : `Last seen ${formatRelativeTime(activePartner.lastSeen)}`}
                  </span>
                </div>
              </div>

              <div className="chat-messages">
                {loadingMessages ? (
                  <div className="chat-loading">
                    <Loader2 className="spinner" size={24} />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="chat-empty">
                    <p>No messages yet. Say hi to @{activePartner.username}!</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMine = m.senderId._id === user._id;
                    return (
                      <div key={m._id} className={`chat-bubble-row ${isMine ? 'mine' : ''}`}>
                        <div className="chat-bubble">
                          <p>{m.content}</p>
                          <span className="chat-bubble-time">{formatTime(m.createdAt)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
                {isPartnerTyping && (
                  <div className="chat-bubble-row">
                    <div className="chat-bubble typing-bubble">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <form className="chat-input-row" onSubmit={handleSend}>
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={draft}
                  onChange={handleDraftChange}
                  className="form-input chat-input"
                />
                <button type="submit" className="btn btn-primary btn-send-message" disabled={!draft.trim() || sending}>
                  <Send size={16} />
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
};

export default MessagesPage;
