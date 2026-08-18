import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, UserPlus, UserCheck, Search, Users } from 'lucide-react';
import { getAvatarUrl } from '../utils/mediaUrl';
import './FollowListModal.css';

const FollowListModal = ({ activeTab, followers, following, currentUser, onClose, onFollowToggle, profileUsername }) => {
  const [tab, setTab] = useState(activeTab);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const list = tab === 'followers' ? followers : following;
  const filtered = list.filter((u) => u.username.toLowerCase().includes(query.trim().toLowerCase()));

  const goToProfile = (username) => {
    onClose();
    navigate(`/profile/${username}`);
  };

  // Portaled to <body> — see ConfirmDialog.jsx for why: rendered inline, a
  // `.fade-in`-animated ancestor (ProfilePage's root) traps this
  // `position: fixed` overlay against its own (possibly tall) box instead
  // of the viewport.
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content fade-in follow-list-modal" onClick={(e) => e.stopPropagation()}>
        <div className="follow-modal-header">
          <div className="follow-tabs">
            <button
              className={`follow-tab-btn ${tab === 'followers' ? 'active' : ''}`}
              onClick={() => setTab('followers')}
            >
              Followers <span className="tab-count">{followers.length}</span>
            </button>
            <button
              className={`follow-tab-btn ${tab === 'following' ? 'active' : ''}`}
              onClick={() => setTab('following')}
            >
              Following <span className="tab-count">{following.length}</span>
            </button>
          </div>
          <button className="btn-close-modal" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="follow-search-box">
          <Search size={15} className="follow-search-icon" />
          <input
            type="text"
            placeholder={`Search ${tab}...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="follow-search-input"
          />
        </div>

        <div className="follow-list-scroll">
          {filtered.length === 0 ? (
            <div className="follow-list-empty">
              <Users size={28} className="follow-list-empty-icon" />
              <p>
                {list.length === 0
                  ? tab === 'followers'
                    ? `${profileUsername} has no followers yet.`
                    : `${profileUsername} isn't following anyone yet.`
                  : 'No matches found.'}
              </p>
            </div>
          ) : (
            filtered.map((u) => {
              const isSelf = u._id === currentUser?._id;
              const isFollowing = currentUser?.following?.includes(u._id);
              return (
                <div key={u._id} className="follow-list-item">
                  <div className="follow-list-user" onClick={() => goToProfile(u.username)}>
                    <img
                      src={getAvatarUrl(u)}
                      alt="Avatar"
                      className="avatar"
                      width="44"
                      height="44"
                    />
                    <div className="follow-list-text">
                      <p className="follow-list-username">{u.username}</p>
                      {u.bio && <p className="follow-list-bio">{u.bio}</p>}
                    </div>
                  </div>
                  {!isSelf && (
                    <button
                      className={`btn follow-list-action-btn ${isFollowing ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={() => onFollowToggle(u._id, isFollowing)}
                    >
                      {isFollowing ? <UserCheck size={14} /> : <UserPlus size={14} />}
                      <span>{isFollowing ? 'Following' : 'Follow'}</span>
                    </button>
                  )}
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

export default FollowListModal;
