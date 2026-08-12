import React, { useCallback } from 'react';
import CreatePostBox from '../components/CreatePostBox';
import PostCard from '../components/PostCard';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import ActiveNowRail from '../components/ActiveNowRail';
import api from '../services/api';
import { Loader2, Compass } from 'lucide-react';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import './HomeFeedPage.css';

const FEED_PAGE_SIZE = 10;

const HomeFeedPage = () => {
  const fetchFeedPage = useCallback(async (page) => {
    const { data } = await api.get(`/posts/feed?page=${page}&limit=${FEED_PAGE_SIZE}`);
    return data;
  }, []);

  const { items: posts, setItems: setPosts, loading, hasMore, sentinelRef } = useInfiniteScroll(fetchFeedPage);

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

      <ActiveNowRail />

      <CreatePostBox onPostCreated={handlePostCreated} />

      {loading && posts.length === 0 ? (
        <div className="feed-posts-list">
          <Skeleton variant="post" />
          <Skeleton variant="post" />
          <Skeleton variant="post" />
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={Compass}
          title="Your feed is quiet"
          subtitle="No posts yet! Share what's happening or check the Explore tab to find and follow other users."
        />
      ) : (
        <div className="feed-posts-list">
          {posts.map((post) => (
            <PostCard key={post._id} post={post} onDelete={handleDeletePost} />
          ))}
          {hasMore && (
            <div ref={sentinelRef} className="feed-load-more-sentinel">
              {loading && <Loader2 className="spinner" size={24} />}
            </div>
          )}
        </div>
      )}
    </main>
  );
};

export default HomeFeedPage;
