import React, { useEffect, useState } from 'react';
import PostCard from '../components/PostCard';
import api from '../services/api';
import { Search, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './ExplorePage.css';

const ExplorePage = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchVal, setSearchVal] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const navigate = useNavigate();

  const fetchExplorePosts = async () => {
    try {
      const { data } = await api.get('/posts/explore');
      setPosts(data);
    } catch (err) {
      console.error('Error fetching explore posts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExplorePosts();
  }, []);

  const handleMobileSearch = async (e) => {
    const val = e.target.value;
    setSearchVal(val);
    if (val.trim().length > 1) {
      try {
        const { data } = await api.get(`/users/search?q=${val}`);
        setSearchResults(data);
      } catch (err) {
        console.error('Mobile search error:', err);
      }
    } else {
      setSearchResults([]);
    }
  };

  const handleDeletePost = async (postId) => {
    try {
      await api.delete(`/posts/${postId}`);
      setPosts((prev) => prev.filter((p) => p._id !== postId));
    } catch (err) {
      console.error('Error deleting explore post:', err);
    }
  };

  return (
    <main className="explore-main fade-in">
      {/* Mobile Search Bar (only visible on mobile layout) */}
      <div className="mobile-search-wrapper glass">
        <Search className="search-icon" size={16} />
        <input
          type="text"
          placeholder="Search people..."
          value={searchVal}
          onChange={handleMobileSearch}
          className="search-input"
        />
        {searchResults.length > 0 && (
          <div className="mobile-search-dropdown glass">
            {searchResults.map((res) => (
              <div
                key={res._id}
                className="mobile-search-item"
                onClick={() => {
                  setSearchVal('');
                  setSearchResults([]);
                  navigate(`/profile/${res.username}`);
                }}
              >
                <img
                  src={res.profilePicture ? `http://localhost:5000${res.profilePicture}` : 'https://api.dicebear.com/7.x/bottts/svg?seed=' + res.username}
                  alt="Avatar"
                  className="avatar"
                  width="32"
                  height="32"
                />
                <div className="search-info">
                  <span className="search-name">@{res.username}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="explore-header glass">
        <h2 className="explore-title">Explore Oku</h2>
      </div>

      {loading ? (
        <div className="explore-loading">
          <Loader2 className="spinner" size={32} />
          <p>Discovering trending posts...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="explore-empty glass">
          <h3>No public posts found</h3>
          <p>Be the first to publish a post and start the conversation!</p>
        </div>
      ) : (
        <div className="explore-posts">
          {posts.map((post) => (
            <PostCard key={post._id} post={post} onDelete={handleDeletePost} />
          ))}
        </div>
      )}
    </main>
  );
};

export default ExplorePage;
