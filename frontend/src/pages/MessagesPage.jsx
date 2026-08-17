import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Send, Loader2, MessageCircle, Image, X, Trash2, Phone, Video, Reply, Play, MoreVertical } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import { useCall } from '../context/CallContext';
import { formatRelativeTime } from '../utils/formatRelativeTime';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import ImageLightbox from '../components/ImageLightbox';
import ConfirmDialog from '../components/ConfirmDialog';
import { getMediaUrl, getAvatarUrl } from '../utils/mediaUrl';
import './MessagesPage.css';

const roomFor = (idA, idB) => [idA, idB].sort().join('_');

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const lastMessagePreview = (lastMessage) => {
  if (lastMessage.sharedPost) return '🔗 Shared a post';
  if (lastMessage.content) return lastMessage.content;
  if (lastMessage.mediaType === 'video') return '🎥 Video';
  if (lastMessage.mediaType === 'image') return '📷 Photo';
  return '';
};

const replyPreviewText = (msg) => {
  if (!msg) return '';
  if (msg.content) return msg.content;
  if (msg.sharedPost) return '🔗 Shared post';
  if (msg.mediaType === 'video') return '🎥 Video';
  if (msg.mediaType === 'image') return '📷 Photo';
  return '';
};

// Collapses a flat reactions[{userId, emoji}] array into { emoji: [userId, ...] }
// so each distinct emoji renders as a single pill with a count.
const groupReactions = (reactions) => {
  const groups = {};
  (reactions || []).forEach((r) => {
    const uid = typeof r.userId === 'string' ? r.userId : r.userId?._id || r.userId;
    if (!groups[r.emoji]) groups[r.emoji] = [];
    groups[r.emoji].push(uid);
  });
  return groups;
};

const MessagesPage = ({ onOpen }) => {
  const { user } = useAuth();
  const { socket, onlineUsers } = useSocket();
  const { startCall } = useCall();
  const toast = useToast();
  const navigate = useNavigate();
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
  const [replyingTo, setReplyingTo] = useState(null);
  // Message id whose reply/react/delete menu is open — opened via the
  // always-visible "more" button on desktop, or a long-press on mobile
  // (there's no hover state to reveal icons on touch devices).
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const fileInputRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const activePartnerRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const longPressFiredRef = useRef(false);

  const startLongPress = (messageId) => {
    longPressFiredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setMenuOpenFor(messageId);
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Close the menu on any click/tap outside it, and on Escape.
  useEffect(() => {
    if (!menuOpenFor) return;

    const handleOutside = (e) => {
      if (!e.target.closest('.chat-action-menu') && !e.target.closest('.chat-more-btn')) {
        setMenuOpenFor(null);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setMenuOpenFor(null);
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpenFor]);

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
    setReplyingTo(null);
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
            mediaType: msg.mediaType,
            sharedPost: !!msg.sharedPost,
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

    const handleReactionUpdate = ({ messageId, reactions }) => {
      setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...m, reactions } : m)));
    };

    socket.on('receiveMessage', handleReceive);
    socket.on('typing', handleTyping);
    socket.on('stopTyping', handleStopTyping);
    socket.on('messageDeleted', handleDeleted);
    socket.on('conversationDeleted', handleConversationDeleted);
    socket.on('messageReaction', handleReactionUpdate);

    return () => {
      socket.off('receiveMessage', handleReceive);
      socket.off('typing', handleTyping);
      socket.off('stopTyping', handleStopTyping);
      socket.off('messageDeleted', handleDeleted);
      socket.off('conversationDeleted', handleConversationDeleted);
      socket.off('messageReaction', handleReactionUpdate);
    };
  }, [socket, user]);

  const handleMediaChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setMediaFile(file);
    setMediaType(file.type.split('/')[0] === 'video' ? 'video' : 'image');

    // Object URLs are cheap references to the in-memory file, unlike
    // FileReader.readAsDataURL, which base64-encodes the whole file into a
    // giant string and reliably hangs/crashes the tab on multi-MB videos.
    setMediaPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
    setMediaType('none');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Release the object URL if the user navigates away with a preview active
  useEffect(() => {
    return () => {
      if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    };
  }, [mediaPreview]);

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
    const replyToId = replyingTo?._id;
    setDraft('');
    removeMedia();
    setReplyingTo(null);

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
    if (replyToId) {
      formData.append('replyTo', replyToId);
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
            sharedPost: !!data.sharedPost,
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
      toast.error(err.response?.data?.message || 'Failed to send message');
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

  const handleReact = async (messageId, emoji) => {
    setMenuOpenFor(null);
    try {
      const { data } = await api.put(`/messages/${messageId}/react`, { emoji });
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, reactions: data.reactions } : m))
      );
    } catch (err) {
      console.error('Error reacting to message:', err);
      toast.error('Failed to react');
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
                    <img src={getAvatarUrl(res)} alt="Avatar" className="avatar" width="32" height="32" />
                    <span>{res.username}</span>
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
                      <img src={getAvatarUrl(c.user)} alt="Avatar" className="avatar" width="44" height="44" />
                      {onlineUsers.includes(c.user._id) && <span className="presence-dot" />}
                    </div>
                    <div className="conversation-preview">
                      <div className="conversation-top-row">
                        <span className="conversation-username">{c.user.username}</span>
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
                  <img src={getAvatarUrl(activePartner)} alt="Avatar" className="avatar" width="38" height="38" />
                  {isPartnerOnline && <span className="presence-dot" />}
                </div>
                <div className="chat-header-info">
                  <span className="chat-header-username">{activePartner.username}</span>
                  <span className={`chat-header-status ${isPartnerOnline ? 'online' : ''}`}>
                    {isPartnerOnline ? 'Online' : `Last seen ${formatRelativeTime(activePartner.lastSeen)}`}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-call"
                  onClick={() => startCall(activePartner, 'audio')}
                  title="Voice call"
                >
                  <Phone size={18} />
                </button>
                <button
                  type="button"
                  className="btn-call"
                  onClick={() => startCall(activePartner, 'video')}
                  title="Video call"
                >
                  <Video size={18} />
                </button>
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
                    <p>No messages yet. Say hi to {activePartner.username}!</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMine = m.senderId._id === user._id;
                    const reactionGroups = groupReactions(m.reactions);
                    const isSharedReel = m.sharedPost && m.sharedPost.mediaType === 'video';
                    const isMediaOnly = (!m.content && !m.sharedPost && m.media) || (!m.content && isSharedReel);
                    return (
                      <div key={m._id} className={`chat-bubble-row ${isMine ? 'mine' : ''}`}>
                        {/* Desktop: always-visible "more" button. Mobile: no
                            visible trigger — the same menu opens on a
                            long-press of the bubble instead (see the
                            onTouchStart/onTouchEnd handlers below). */}
                        <button
                          type="button"
                          className="chat-more-btn"
                          onClick={() => setMenuOpenFor(menuOpenFor === m._id ? null : m._id)}
                          title="More"
                        >
                          <MoreVertical size={14} />
                        </button>

                        {menuOpenFor === m._id && (
                          <div className="chat-action-menu glass">
                            <div className="chat-action-menu-reactions">
                              {QUICK_REACTIONS.map((emoji) => (
                                <button key={emoji} type="button" onClick={() => handleReact(m._id, emoji)}>
                                  {emoji}
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              className="chat-action-menu-item"
                              onClick={() => {
                                setReplyingTo(m);
                                setMenuOpenFor(null);
                              }}
                            >
                              <Reply size={14} />
                              <span>Reply</span>
                            </button>
                            {isMine && (
                              <button
                                type="button"
                                className="chat-action-menu-item danger"
                                onClick={() => {
                                  handleDeleteMessage(m._id);
                                  setMenuOpenFor(null);
                                }}
                              >
                                <Trash2 size={14} />
                                <span>Delete</span>
                              </button>
                            )}
                          </div>
                        )}

                        <div
                          className={`chat-bubble ${isMediaOnly ? 'media-only' : ''}`}
                          onTouchStart={() => startLongPress(m._id)}
                          onTouchEnd={cancelLongPress}
                          onTouchMove={cancelLongPress}
                          onContextMenu={(e) => e.preventDefault()}
                        >
                          {m.replyTo && (
                            <div className="chat-reply-quote">
                              <span className="chat-reply-quote-author">
                                {m.replyTo.senderId?.username || 'a deleted message'}
                              </span>
                              <span className="chat-reply-quote-text">{replyPreviewText(m.replyTo)}</span>
                            </div>
                          )}

                          {m.sharedPost && isSharedReel ? (
                            // Shared reels render as a plain, borderless video
                            // preview — no card chrome — and open the Reels
                            // feed on click rather than the sharer's profile.
                            <div className="chat-shared-reel-wrap" onClick={() => navigate('/reels')}>
                              <video
                                src={getMediaUrl(m.sharedPost.media)}
                                className="chat-bubble-media chat-shared-reel-media"
                                muted
                                loop
                              />
                              <span className="chat-shared-reel-play">
                                <Play size={20} fill="white" />
                              </span>
                            </div>
                          ) : (
                            m.sharedPost && (
                              <div
                                className="chat-shared-post"
                                onClick={() => navigate(`/profile/${m.sharedPost.userId.username}`)}
                              >
                                {m.sharedPost.media && m.sharedPost.mediaType === 'image' && (
                                  <img src={getMediaUrl(m.sharedPost.media)} alt="" className="chat-shared-post-media" />
                                )}
                                <div className="chat-shared-post-info">
                                  <span className="chat-shared-post-author">{m.sharedPost.userId.username}</span>
                                  {m.sharedPost.content && (
                                    <p className="chat-shared-post-caption">{m.sharedPost.content}</p>
                                  )}
                                </div>
                              </div>
                            )
                          )}

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
                            <span className="chat-bubble-time">{formatTime(m.createdAt)}</span>
                          </div>
                        </div>

                        {Object.keys(reactionGroups).length > 0 && (
                          <div className="chat-reactions-row">
                            {Object.entries(reactionGroups).map(([emoji, uids]) => (
                              <button
                                key={emoji}
                                type="button"
                                className={`chat-reaction-pill ${uids.includes(user._id) ? 'mine' : ''}`}
                                onClick={() => handleReact(m._id, emoji)}
                              >
                                <span>{emoji}</span>
                                {uids.length > 1 && <span className="chat-reaction-count">{uids.length}</span>}
                              </button>
                            ))}
                          </div>
                        )}
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

              {replyingTo && (
                <div className="chat-reply-preview">
                  <div className="chat-reply-preview-content">
                    <span className="chat-reply-preview-label">
                      Replying to {replyingTo.senderId._id === user._id ? 'yourself' : activePartner.username}
                    </span>
                    <span className="chat-reply-preview-text">{replyPreviewText(replyingTo)}</span>
                  </div>
                  <button type="button" className="chat-reply-preview-close" onClick={() => setReplyingTo(null)}>
                    <X size={14} />
                  </button>
                </div>
              )}

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
          message={`Delete your entire conversation with ${activePartner?.username}? This cannot be undone.`}
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
