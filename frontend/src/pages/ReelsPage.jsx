import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageSquare, Trash2, Send, Volume2, VolumeX, X, Film } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { formatRelativeTime } from '../utils/formatRelativeTime';
import { getMediaUrl } from '../utils/mediaUrl';
import { renderPostContent } from '../utils/renderPostContent';
import EmptyState from '../components/EmptyState';
import './ReelsPage.css';

const REELS_PAGE_SIZE = 5;

const ReelItem = ({ post, active, muted, onToggleMute, onDelete, registerRef }) => {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const tapTimerRef = useRef(null);

  const [liked, setLiked] = useState(post.likes.includes(user?._id));
  const [likesCount, setLikesCount] = useState(post.likes.length);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount || 0);
  const [newComment, setNewComment] = useState('');
  const [captionExpanded, setCaptionExpanded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [active]);

  const isOwner = post.userId._id === user?._id;

  const handleLike = async () => {
    try {
      const { data } = await api.put(`/posts/${post._id}/like`);
      setLiked(data.liked);
      setLikesCount(data.likesCount);
    } catch (err) {
      console.error('Error liking reel:', err);
      toast.error('Failed to update like');
    }
  };

  const handleDoubleTapLike = () => {
    setShowHeartBurst(true);
    setTimeout(() => setShowHeartBurst(false), 700);
    if (!liked) handleLike();
  };

  const handleVideoTap = () => {
    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      handleDoubleTapLike();
      return;
    }
    tapTimerRef.current = setTimeout(() => {
      tapTimerRef.current = null;
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) video.play().catch(() => {});
      else video.pause();
    }, 220);
  };

  const openComments = async () => {
    setShowComments(true);
    if (comments.length === 0) {
      try {
        const { data } = await api.get(`/posts/${post._id}/comments`);
        setComments(data);
      } catch (err) {
        console.error('Error fetching comments:', err);
        toast.error('Failed to load comments');
      }
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      const { data } = await api.post(`/posts/${post._id}/comments`, { content: newComment });
      setComments((prev) => [data, ...prev]);
      setNewComment('');
      setCommentsCount((prev) => prev + 1);
    } catch (err) {
      console.error('Error adding comment:', err);
      toast.error('Failed to post comment');
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await api.delete(`/posts/${post._id}/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c._id !== commentId));
      setCommentsCount((prev) => prev - 1);
    } catch (err) {
      console.error('Error deleting comment:', err);
      toast.error('Failed to delete comment');
    }
  };

  const handleDeleteReel = async () => {
    try {
      await api.delete(`/posts/${post._id}`);
      toast.success('Reel deleted');
      onDelete(post._id);
    } catch (err) {
      console.error('Error deleting reel:', err);
      toast.error('Failed to delete reel');
    }
  };

  return (
    <div className="reel-item" data-post-id={post._id} ref={registerRef}>
      <video
        ref={videoRef}
        src={getMediaUrl(post.media)}
        className="reel-video"
        loop
        playsInline
        muted={muted}
        onClick={handleVideoTap}
      />
      {showHeartBurst && <Heart className="heart-burst-icon reel-heart-burst" size={100} fill="white" />}

      <button className="reel-mute-btn" onClick={onToggleMute} title={muted ? 'Unmute' : 'Mute'}>
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>

      <div className="reel-overlay-bottom">
        <div className="reel-caption-col">
          <div
            className="reel-user-row"
            onClick={() => navigate(`/profile/${post.userId.username}`)}
          >
            <img
              src={
                post.userId.profilePicture
                  ? getMediaUrl(post.userId.profilePicture)
                  : 'https://api.dicebear.com/7.x/bottts/svg?seed=' + post.userId.username
              }
              alt="Avatar"
              className="avatar"
              width="34"
              height="34"
            />
            <span className="reel-username">@{post.userId.username}</span>
          </div>
          {post.content && (
            <div className="reel-caption-wrap">
              <p className={`reel-caption ${captionExpanded ? '' : 'clamped'}`}>
                {renderPostContent(post.content, navigate)}
              </p>
              {post.content.length > 100 && (
                <button
                  className="reel-caption-toggle"
                  onClick={() => setCaptionExpanded((e) => !e)}
                >
                  {captionExpanded ? 'less' : 'more'}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="reel-actions-col">
          <button className={`reel-action-btn ${liked ? 'active' : ''}`} onClick={handleLike}>
            <Heart size={26} fill={liked ? 'currentColor' : 'transparent'} />
            <span>{likesCount}</span>
          </button>
          <button className="reel-action-btn" onClick={openComments}>
            <MessageSquare size={26} />
            <span>{commentsCount}</span>
          </button>
          {isOwner && (
            <button className="reel-action-btn" onClick={handleDeleteReel} title="Delete reel">
              <Trash2 size={22} />
            </button>
          )}
        </div>
      </div>

      {showComments && (
        <div className="reel-comments-panel glass fade-in" onClick={(e) => e.stopPropagation()}>
          <div className="reel-comments-header">
            <h3>Comments</h3>
            <button className="btn-close-modal" onClick={() => setShowComments(false)}>
              <X size={18} />
            </button>
          </div>
          <div className="comments-list reel-comments-list">
            {comments.length === 0 ? (
              <p className="no-comments">No comments yet. Start the conversation!</p>
            ) : (
              comments.map((comment) => (
                <div key={comment._id} className="comment-item">
                  <img
                    src={
                      comment.userId.profilePicture
                        ? getMediaUrl(comment.userId.profilePicture)
                        : 'https://api.dicebear.com/7.x/bottts/svg?seed=' + comment.userId.username
                    }
                    alt="Avatar"
                    className="avatar comment-avatar"
                    width="30"
                    height="30"
                  />
                  <div className="comment-bubble">
                    <div className="comment-header">
                      <span className="comment-username">@{comment.userId.username}</span>
                      <span className="comment-date">{formatRelativeTime(comment.createdAt)}</span>
                    </div>
                    <p className="comment-text">{comment.content}</p>
                  </div>
                  {(comment.userId._id === user?._id || isOwner) && (
                    <button className="btn-delete-comment" onClick={() => handleDeleteComment(comment._id)}>
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
          <form className="comment-form" onSubmit={handleAddComment}>
            <input
              type="text"
              placeholder="Write a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="form-input comment-input"
            />
            <button type="submit" className="btn btn-primary btn-comment-send">
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

const ReelsPage = () => {
  const containerRef = useRef(null);
  const itemElsRef = useRef(new Map());
  const [activeId, setActiveId] = useState(null);
  const [muted, setMuted] = useState(true);

  const fetchReelsPage = useCallback(async (page) => {
    const { data } = await api.get(`/posts/reels?page=${page}&limit=${REELS_PAGE_SIZE}`);
    return data;
  }, []);

  const {
    items: reels,
    setItems: setReels,
    loading,
    hasMore,
    sentinelRef,
  } = useInfiniteScroll(fetchReelsPage);

  useEffect(() => {
    if (!activeId && reels.length > 0) {
      setActiveId(reels[0]._id);
    }
  }, [reels, activeId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.dataset.postId);
          }
        });
      },
      { root: container, threshold: 0.75 }
    );

    itemElsRef.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [reels]);

  const registerRef = (id) => (el) => {
    if (el) itemElsRef.current.set(id, el);
    else itemElsRef.current.delete(id);
  };

  const handleDeleteReel = (postId) => {
    setReels((prev) => prev.filter((p) => p._id !== postId));
  };

  if (!loading && reels.length === 0) {
    return (
      <main className="reels-main fade-in">
        <EmptyState icon={Film} title="No reels yet" subtitle="Videos people post will show up here." />
      </main>
    );
  }

  return (
    <main className="reels-main fade-in">
      <div className="reels-feed" ref={containerRef}>
        {reels.map((post) => (
          <ReelItem
            key={post._id}
            post={post}
            active={activeId === post._id}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
            onDelete={handleDeleteReel}
            registerRef={registerRef(post._id)}
          />
        ))}
        {hasMore && <div ref={sentinelRef} className="reels-sentinel" />}
      </div>
    </main>
  );
};

export default ReelsPage;
