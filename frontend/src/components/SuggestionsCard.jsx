import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getAvatarUrl } from '../utils/mediaUrl';

const DEFAULT_VISIBLE = 3;

// "Who to Follow" card — used in the desktop RightSidebar and, on mobile
// (where the right sidebar is hidden), inline in the Home feed instead.
// Shows a handful of suggestions with a "View all" toggle, and disappears
// entirely once there's nothing left to suggest.
const SuggestionsCard = ({ className = '' }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const { user, setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const { data } = await api.get('/users/suggestions');
        setSuggestions(data);
      } catch (err) {
        console.error('Error fetching suggestions:', err);
      }
    };

    if (user) {
      fetchSuggestions();
    }
  }, [user]);

  const handleFollow = async (suggestedUserId) => {
    try {
      await api.put(`/users/${suggestedUserId}/follow`);

      setSuggestions((prev) => prev.filter((s) => s._id !== suggestedUserId));

      const updatedFollowing = [...user.following, suggestedUserId];
      const updatedUser = { ...user, following: updatedFollowing };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (err) {
      console.error('Follow error:', err);
      toast.error(err.response?.data?.message || 'Failed to follow user');
    }
  };

  if (suggestions.length === 0) return null;

  const visibleSuggestions = expanded ? suggestions : suggestions.slice(0, DEFAULT_VISIBLE);

  return (
    <div className={`suggestions-card glass ${className}`}>
      <h3 className="suggestions-title">Who to Follow</h3>
      <div className="suggestions-list">
        {visibleSuggestions.map((suggestedUser) => (
          <div key={suggestedUser._id} className="suggestion-item">
            <div className="suggestion-info" onClick={() => navigate(`/profile/${suggestedUser.username}`)}>
              <img
                src={getAvatarUrl(suggestedUser)}
                alt="Avatar"
                className="avatar"
                width="36"
                height="36"
              />
              <div className="suggestion-text">
                <p className="suggestion-username">{suggestedUser.username}</p>
                {suggestedUser.bio && <p className="suggestion-bio">{suggestedUser.bio}</p>}
              </div>
            </div>
            <button className="btn-follow btn btn-primary" onClick={() => handleFollow(suggestedUser._id)}>
              <UserPlus size={14} />
              <span>Follow</span>
            </button>
          </div>
        ))}
      </div>
      {suggestions.length > DEFAULT_VISIBLE && (
        <button className="btn-view-all-suggestions" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Show less' : `View all (${suggestions.length})`}
        </button>
      )}
    </div>
  );
};

export default SuggestionsCard;
