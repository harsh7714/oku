import React, { useCallback, useState } from 'react';
import EmptyState from '../components/EmptyState';
import PostViewerModal from '../components/PostViewerModal';
import api from '../services/api';
import { Search, Loader2, SearchX, TrendingUp, Clock, X, Film } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useToast } from '../context/ToastContext';
import { getMediaUrl, getAvatarUrl } from '../utils/mediaUrl';
import './ExplorePage.css';

const EXPLORE_PAGE_SIZE = 24;

const ExplorePage = () => {
  const toast = useToast();
  const [searchVal, setSearchVal] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewerIndex, setViewerIndex] = useState(null);

  const sort = searchParams.get('sort') === 'trending' ? 'trending' : 'latest';
  const tag = searchParams.get('tag') || '';

  const fetchExplorePage = useCallback(
    async (page) => {
      const params = new URLSearchParams({ page, limit: EXPLORE_PAGE_SIZE, sort });
      if (tag) params.set('tag', tag);
      const { data } = await api.get(`/posts/explore?${params.toString()}`);
      return data;
    },
    [sort, tag]
  );

  const {
    items: posts,
    setItems: setPosts,
    loading,
    hasMore,
    sentinelRef,
  } = useInfiniteScroll(fetchExplorePage, [sort, tag]);

  const setSort = (nextSort) => {
    const next = new URLSearchParams(searchParams);
    if (nextSort === 'latest') next.delete('sort');
    else next.set('sort', nextSort);
    setSearchParams(next);
  };

  const clearTag = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('tag');
    setSearchParams(next);
  };

  const handleMobileSearch = async (e) => {
    const val = e.target.value;
    setSearchVal(val);
    if (val.trim().length > 1) {
      try {
        const { data } = await api.get(`/users/search?q=${val}`);
        setSearchResults(data);
      } catch (err) {
        console.error('Mobile search error:', err);
        toast.error('Search failed, try again');
      }
    } else {
      setSearchResults([]);
    }
  };

  const handleDeletePost = (postId) => {
    setPosts((prev) => prev.filter((p) => p._id !== postId));
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
                  src={getAvatarUrl(res)}
                  alt="Avatar"
                  className="avatar"
                  width="32"
                  height="32"
                />
                <div className="search-info">
                  <span className="search-name">{res.username}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="explore-header glass">
        <h2 className="explore-title">Explore Oku</h2>
        <div className="explore-sort-tabs">
          <button
            className={`explore-sort-tab ${sort === 'latest' ? 'active' : ''}`}
            onClick={() => setSort('latest')}
          >
            <Clock size={14} />
            <span>Latest</span>
          </button>
          <button
            className={`explore-sort-tab ${sort === 'trending' ? 'active' : ''}`}
            onClick={() => setSort('trending')}
          >
            <TrendingUp size={14} />
            <span>Trending</span>
          </button>
        </div>
      </div>

      {tag && (
        <div className="explore-tag-chip glass fade-in">
          <span>#{tag}</span>
          <button onClick={clearTag} title="Clear tag filter">
            <X size={14} />
          </button>
        </div>
      )}

      {loading && posts.length === 0 ? (
        <div className="explore-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton-block explore-grid-skeleton" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={tag ? `No posts tagged #${tag}` : 'No media posts found'}
          subtitle="Posts with a photo or video will show up here."
        />
      ) : (
        <>
          <div className="explore-grid">
            {posts.map((post, i) => (
              <button key={post._id} className="explore-grid-tile" onClick={() => setViewerIndex(i)}>
                {post.mediaType === 'video' ? (
                  <>
                    <video src={getMediaUrl(post.media)} className="explore-grid-media" muted preload="metadata" />
                    <Film className="explore-grid-video-icon" size={16} />
                  </>
                ) : (
                  <img src={getMediaUrl(post.media)} alt="" className="explore-grid-media" loading="lazy" />
                )}
              </button>
            ))}
          </div>
          {hasMore && (
            <div ref={sentinelRef} className="explore-load-more-sentinel">
              {loading && <Loader2 className="spinner" size={24} />}
            </div>
          )}
        </>
      )}

      {viewerIndex !== null && (
        <PostViewerModal
          posts={posts}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onDelete={(postId) => {
            handleDeletePost(postId);
            setViewerIndex(null);
          }}
        />
      )}
    </main>
  );
};

export default ExplorePage;
