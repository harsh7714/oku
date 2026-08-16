import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Send, Loader2, MessageCircle, Image, X, Trash2 } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import { formatRelativeTime } from '../utils/formatRelativeTime';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import ImageLightbox from '../components/ImageLightbox';
import ConfirmDialog from '../components/ConfirmDialog';
import { getMediaUrl } from '../utils/mediaUrl';
import './MessagesPage.css';

const avatarSrc = (u) =>
  u?.profilePicture
    ? getMediaUrl(u.profilePicture)
    : `https://api.dicebear.com/7.x/bottts/svg?seed=${u?.username}`;

const roomFor = (idA, idB) => [idA, idB].sort().join('_');

const lastMessagePreview = (lastMessage) => {
  if (lastMessage.content) return lastMessage.content;
  if (lastMessage.mediaType === 'video') return '🎥 Video';
  if (lastMessage.mediaType === 'image') return '📷 Photo';
  return '';
};

const MessagesPage = ({ onOpen }) => {
  const { user } = useAuth();
  const { socket, onlineUsers } = useSocket();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [activePartner, setActivePartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [mediaType, setMediaType] = useState('none');
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = useRef(null);

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
      toast.error('Failed to load conversations');
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
      toast.error('Failed to load conversation');
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
        .catch((err) => {
          console.error('Error opening direct conversation:', err);
          toast.error('Could not open that conversation');
        });
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

    const handleDeleted = ({ messageId }) => {
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    };

    const handleConversationDeleted = ({ partnerId }) => {
      setConversations((prev) => prev.filter((c) => c.user._id !== partnerId));
      if (activePartnerRef.current?._id === partnerId) {
        setMessages([]);
        setActivePartner(null);
      }
    };

    socket.on('receiveMessage', handleReceive);
    socket.on('typing', handleTyping);
    socket.on('stopTyping', handleStopTyping);
    socket.on('messageDeleted', handleDeleted);
    socket.on('conversationDeleted', handleConversationDeleted);

    return () => {
      socket.off('receiveMessage', handleReceive);
      socket.off('typing', handleTyping);
      socket.off('stopTyping', handleStopTyping);
      socket.off('messageDeleted', handleDeleted);
      socket.off('conversationDeleted', handleConversationDeleted);
    };
  }, [socket, user]);

  const handleMediaChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setMediaFile(file);
    setMediaType(file.type.split('/')[0] === 'video' ? 'video' : 'image');

    const reader = new FileReader();
    reader.onloadend = () => setMediaPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaPreview('');
    setMediaType('none');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
    if ((!draft.trim() && !mediaFile) || !activePartner || sending) return;

    setSending(true);
    const content = draft.trim();
    const attachedMedia = mediaFile;
    setDraft('');
    removeMedia();

    if (socket) {
      socket.emit('stopTyping', roomFor(user._id, activePartner._id));
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    const formData = new FormData();
    formData.append('receiverId', activePartner._id);
    formData.append('content', content);
    if (attachedMedia) {
      formData.append('media', attachedMedia);
    }

    try {
      const { data } = await api.post('/messages', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessages((prev) => [...prev, data]);
      setConversations((prev) => {
        const existingIndex = prev.findIndex((c) => c.user._id === activePartner._id);
        const updatedEntry = {
          user: activePartner,
          lastMessage: {
            content: data.content,
            mediaType: data.mediaType,
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
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await api.delete(`/messages/${messageId}`);
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    } catch (err) {
      console.error('Error deleting message:', err);
      toast.error('Failed to delete message');
    }
  };

  const handleDeleteConversation = () => {
    if (!activePartner) return;
    setShowDeleteConfirm(true);
  };

  const confirmDeleteConversation = async () => {
    setShowDeleteConfirm(false);
    try {
      await api.delete(`/messages/conversation/${activePartner._id}`);
      setConversations((prev) => prev.filter((c) => c.user._id !== activePartner._id));
      setMessages([]);
      setActivePartner(null);
      toast.success('Conversation deleted');
    } catch (err) {
      console.error('Error deleting conversation:', err);
      toast.error('Failed to delete conversation');
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
        toast.error('Search failed, try again');
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
                      <p className="conversation-last-message">{lastMessagePreview(c.lastMessage)}</p>
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
                <button
                  type="button"
                  className="btn-delete-conversation"
                  onClick={handleDeleteConversation}
                  title="Delete conversation"
                >
                  <Trash2 size={17} />
                </button>
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
                          {m.media && m.mediaType === 'image' && (
                            <img
                              src={getMediaUrl(m.media)}
                              alt="Attachment"
                              className="chat-bubble-media"
                              onClick={() => setLightboxSrc(getMediaUrl(m.media))}
                            />
                          )}
                          {m.media && m.mediaType === 'video' && (
                            <video src={getMediaUrl(m.media)} controls className="chat-bubble-media" />
                          )}
                          {m.content && <p>{m.content}</p>}
                          <div className="chat-bubble-footer">
                            {isMine && (
                              <button
                                type="button"
                                className="btn-delete-message"
                                onClick={() => handleDeleteMessage(m._id)}
                                title="Delete message"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                            <span className="chat-bubble-time">{formatTime(m.createdAt)}</span>
                          </div>
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

              {mediaPreview && (
                <div className="chat-media-preview-container">
                  <button type="button" className="btn-remove-media glass" onClick={removeMedia}>
                    <X size={16} />
                  </button>
                  {mediaType === 'image' ? (
                    <img src={mediaPreview} alt="Preview" className="chat-media-preview" />
                  ) : (
                    <video src={mediaPreview} controls className="chat-media-preview" />
                  )}
                </div>
              )}

              <form className="chat-input-row" onSubmit={handleSend}>
                <button
                  type="button"
                  className="chat-attach-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Add Image or Video"
                >
                  <Image size={18} />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleMediaChange}
                  accept="image/*,video/*"
                  style={{ display: 'none' }}
                />
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={draft}
                  onChange={handleDraftChange}
                  className="form-input chat-input"
                />
                <button
                  type="submit"
                  className="btn btn-primary btn-send-message"
                  disabled={(!draft.trim() && !mediaFile) || sending}
                >
                  <Send size={16} />
                </button>
              </form>
            </>
          )}
        </section>
      </div>

      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} alt="Chat attachment enlarged" onClose={() => setLightboxSrc(null)} />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete conversation?"
          message={`Delete your entire conversation with @${activePartner?.username}? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={confirmDeleteConversation}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </main>
  );
};

export default MessagesPage;
