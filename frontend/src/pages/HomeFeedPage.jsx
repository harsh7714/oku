import React, { useEffect, useState } from 'react';
import CreatePostBox from '../components/CreatePostBox';
import PostCard from '../components/PostCard';
import api from '../services/api';
import { Loader2 } from 'lucide-react';
import './HomeFeedPage.css';

const HomeFeedPage = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFeed = async () => {
    try {
      const { data } = await api.get('/posts/feed');
      setPosts(data);
    } catch (err) {
      console.error('Error fetching feed posts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, []);

  const handlePostCreated = (newPost) => {
    setPosts((prev) => [newPost, ...prev]);
  };

  const handleDeletePost = async (postId) => {
    try {
      await api.delete(`/posts/${postId}`);
      setPosts((prev) => prev.filter((p) => p._id !== postId));
    } catch (err) {
      console.error('Error deleting post:', err);
    }
  };

  return (
    <main className="feed-main-content fade-in">
      <div className="feed-header glass">
        <h2 className="feed-title">Home Feed</h2>
      </div>

      <CreatePostBox onPostCreated={handlePostCreated} />

      {loading ? (
        <div className="feed-loading-state">
          <Loader2 className="spinner" size={32} />
          <p>Retrieving your Oku feed...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="feed-empty-state glass">
          <h3>Your feed is quiet</h3>
          <p>No posts yet! Share what's happening or check the **Explore** tab to find and follow other users.</p>
        </div>
      ) : (
        <div className="feed-posts-list">
          {posts.map((post) => (
            <PostCard key={post._id} post={post} onDelete={handleDeletePost} />
          ))}
        </div>
      )}
    </main>
  );
};

export default HomeFeedPage;
