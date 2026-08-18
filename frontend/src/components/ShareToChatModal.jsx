import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Check, Send } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getAvatarUrl } from '../utils/mediaUrl';
import './ShareToChatModal.css';

// Lets a user send a post/reel into an existing DM (or a freshly searched
// person) without leaving the feed. Stays open after each send so sharing
// to several people in a row doesn't require reopening it each time.
const ShareToChatModal = ({ postId, onClose }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [sendingTo, setSendingTo] = useState(null);
  const [sentTo, setSentTo] = useState(() => new Set());

  useEffect(() => {
    api
      .get('/messages/conversations/list')
      .then(({ data }) => setConversations(data.map((c) => c.user)))
      .catch((err) => console.error('Error loading conversations for share:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleSearchChange = async (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (val.trim().length > 1) {
      try {
        const { data } = await api.get(`/users/search?q=${val}`);
        setSearchResults(data.filter((u) => u._id !== user._id));
      } catch (err) {
        console.error('Share search error:', err);
      }
    } else {
      setSearchResults([]);
    }
  };

  const handleShare = async (recipient) => {
    setSendingTo(recipient._id);
    try {
      const formData = new FormData();
      formData.append('receiverId', recipient._id);
      formData.append('content', '');
      formData.append('sharedPostId', postId);
      await api.post('/messages', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSentTo((prev) => new Set(prev).add(recipient._id));
      toast.success(`Shared with ${recipient.username}`);
    } catch (err) {
      console.error('Error sharing post:', err);
      toast.error('Failed to share');
    } finally {
      setSendingTo(null);
    }
  };

  const searching = searchQuery.trim().length > 1;
  const list = searching ? searchResults : conversations;

  // Portaled to <body> — see ConfirmDialog.jsx for why: rendered inline, a
  // `.fade-in`-animated ancestor (e.g. this can open from a post deep in a
  // scrolled feed) traps this `position: fixed` overlay against its own
  // box instead of the viewport.
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content fade-in share-to-chat-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Share to</h3>
          <button className="btn-close-modal" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="share-search-box">
          <Search size={15} className="share-search-icon" />
          <input
            type="text"
            placeholder="Search people..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="share-search-input"
          />
        </div>

        <div className="share-list-scroll">
          {loading ? (
            <p className="share-list-empty-text">Loading...</p>
          ) : list.length === 0 ? (
            <p className="share-list-empty-text">
              {searching ? 'No matches found.' : 'Start a conversation first to share here.'}
            </p>
          ) : (
            list.map((person) => {
              const isSending = sendingTo === person._id;
              const isSent = sentTo.has(person._id);
              return (
                <div key={person._id} className="share-list-item">
                  <div className="share-list-user">
                    <img src={getAvatarUrl(person)} alt="" className="avatar" width="40" height="40" />
                    <span className="share-list-username">{person.username}</span>
                  </div>
                  <button
                    type="button"
                    className={`btn share-send-btn ${isSent ? 'sent' : 'btn-primary'}`}
                    disabled={isSending || isSent}
                    onClick={() => handleShare(person)}
                  >
                    {isSent ? <Check size={15} /> : <Send size={14} />}
                    <span>{isSent ? 'Sent' : 'Send'}</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ShareToChatModal;
