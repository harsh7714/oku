import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, Check } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getMediaUrl } from '../utils/mediaUrl';
import './RightSidebar.css';

const RightSidebar = () => {
  const [suggestions, setSuggestions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
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

  const handleSearchChange = async (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (val.trim().length > 1) {
      try {
        const { data } = await api.get(`/users/search?q=${val}`);
        setSearchResults(data);
      } catch (err) {
        console.error('Search error:', err);
        toast.error('Search failed, try again');
      }
    } else {
      setSearchResults([]);
    }
  };

  const handleFollow = async (suggestedUserId) => {
    try {
      await api.put(`/users/${suggestedUserId}/follow`);
      
      // Update local suggestion state (remove the followed user or mark as followed)
      setSuggestions(prev => prev.filter(s => s._id !== suggestedUserId));
      
      // Update global context user following count
      const updatedFollowing = [...user.following, suggestedUserId];
      const updatedUser = { ...user, following: updatedFollowing };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (err) {
      console.error('Follow error:', err);
      toast.error(err.response?.data?.message || 'Failed to follow user');
    }
  };

  const selectUser = (username) => {
    setSearchQuery('');
    setSearchResults([]);
    navigate(`/profile/${username}`);
  };

  if (!user) return null;

  return (
    <aside className="right-sidebar">
      {/* Search Bar */}
      <div className="search-container glass">
        <Search className="search-icon" size={18} />
        <input
          type="text"
          placeholder="Search Oku users..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="search-input"
        />
        {searchResults.length > 0 && (
          <div className="search-dropdown glass">
            {searchResults.map((res) => (
              <div 
                key={res._id} 
                className="search-result-item" 
                onClick={() => selectUser(res.username)}
              >
                <img 
                  src={res.profilePicture ? getMediaUrl(res.profilePicture) : 'https://api.dicebear.com/7.x/bottts/svg?seed=' + res.username}
                  alt="Avatar" 
                  className="avatar" 
                  width="32" 
                  height="32" 
                />
                <div className="search-result-details">
                  <p className="search-username">@{res.username}</p>
                  {res.bio && <p className="search-bio">{res.bio}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Suggested Users Card */}
      <div className="suggestions-card glass">
        <h3 className="suggestions-title">Who to Follow</h3>
        <div className="suggestions-list">
          {suggestions.length === 0 ? (
            <p className="no-suggestions">No suggestions available</p>
          ) : (
            suggestions.map((suggestedUser) => (
              <div key={suggestedUser._id} className="suggestion-item">
                <div 
                  className="suggestion-info"
                  onClick={() => navigate(`/profile/${suggestedUser.username}`)}
                >
                  <img
                    src={suggestedUser.profilePicture ? getMediaUrl(suggestedUser.profilePicture) : 'https://api.dicebear.com/7.x/bottts/svg?seed=' + suggestedUser.username}
                    alt="Avatar"
                    className="avatar"
                    width="36"
                    height="36"
                  />
                  <div className="suggestion-text">
                    <p className="suggestion-username">@{suggestedUser.username}</p>
                    {suggestedUser.bio && <p className="suggestion-bio">{suggestedUser.bio}</p>}
                  </div>
                </div>
                <button 
                  className="btn-follow btn btn-primary"
                  onClick={() => handleFollow(suggestedUser._id)}
                >
                  <UserPlus size={14} />
                  <span>Follow</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
};

export default RightSidebar;
