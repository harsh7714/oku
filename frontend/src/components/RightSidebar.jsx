import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getMediaUrl } from '../utils/mediaUrl';
import SuggestionsCard from './SuggestionsCard';
import './RightSidebar.css';

const RightSidebar = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

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

      <SuggestionsCard />
    </aside>
  );
};

export default RightSidebar;
