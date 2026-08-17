import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageSquare, Share2, Trash2, Send, X, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatRelativeTime } from '../utils/formatRelativeTime';
import { getMediaUrl, getAvatarUrl } from '../utils/mediaUrl';
import { renderPostContent } from '../utils/renderPostContent';
import MentionInput from './MentionInput';
import ShareToChatModal from './ShareToChatModal';
import './PostViewerModal.css';

// Fullscreen Instagram-style post viewer: media on one side, likes/comments
// on the other, with prev/next navigation across the list it was opened from.
const PostViewerModal = ({ posts, initialIndex, onClose, onDelete }) => {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [index, setIndex] = useState(initialIndex);
  const post = posts[index];

  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [comments, setComments] = useState([]);
  const [commentsCount, setCommentsCount] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const mediaClickTimerRef = useRef(null);

  // Reset per-post state whenever the viewer moves to a different post
  useEffect(() => {
    if (!post) return;
    setLiked(post.likes.includes(user?._id));
    setLikesCount(post.likes.length);
    setCommentsCount(post.commentsCount || 0);
    setComments([]);
    setCaptionExpanded(false);

    api
      .get(`/posts/${post._id}/comments`)
      .then(({ data }) => setComments(data))
      .catch((err) => console.error('Error fetching comments:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?._id]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(posts.length - 1, i + 1));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, posts.length]);

  if (!post) return null;

  const isOwner = post.userId._id === user?._id;

  const handleLike = async () => {
    try {
      const { data } = await api.put(`/posts/${post._id}/like`);
      setLiked(data.liked);
      setLikesCount(data.likesCount);
    } catch (err) {
      console.error('Error liking post:', err);
      toast.error('Failed to update like');
    }
  };

  const handleDoubleTapLike = () => {
    setShowHeartBurst(true);
    setTimeout(() => setShowHeartBurst(false), 700);
    if (!liked) handleLike();
  };

  const handleMediaClick = () => {
    if (mediaClickTimerRef.current) {
      clearTimeout(mediaClickTimerRef.current);
      mediaClickTimerRef.current = null;
      handleDoubleTapLike();
    } else {
      mediaClickTimerRef.current = setTimeout(() => {
        mediaClickTimerRef.current = null;
      }, 220);
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

  const handleDeletePost = async () => {
    try {
      await api.delete(`/posts/${post._id}`);
      toast.success('Post deleted');
      onDelete(post._id);
      if (posts.length <= 1) {
        onClose();
      } else {
        setIndex((i) => Math.min(i, posts.length - 2));
      }
    } catch (err) {
      console.error('Error deleting post:', err);
      toast.error('Failed to delete post');
    }
  };

  return (
    <div className="post-viewer-overlay fade-in" onClick={onClose}>
      <button className="btn-close-modal post-viewer-close" onClick={onClose}>
        <X size={22} />
      </button>

      {index > 0 && (
        <button
          className="post-viewer-nav post-viewer-nav-prev"
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => i - 1);
          }}
        >
          <ChevronLeft size={26} />
        </button>
      )}
      {index < posts.length - 1 && (
        <button
          className="post-viewer-nav post-viewer-nav-next"
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => i + 1);
          }}
        >
          <ChevronRight size={26} />
        </button>
      )}

      <div className="post-viewer-shell glass" onClick={(e) => e.stopPropagation()}>
        <div className="post-viewer-media" onClick={handleMediaClick}>
          {post.mediaType === 'video' ? (
            <video src={getMediaUrl(post.media)} controls autoPlay className="post-viewer-media-el" />
          ) : (
            <img src={getMediaUrl(post.media)} alt="Post attachment" className="post-viewer-media-el" />
          )}
          {showHeartBurst && <Heart className="heart-burst-icon" size={100} fill="white" />}
        </div>

        <div className="post-viewer-side">
          <div className="post-viewer-header">
            <div
              className="conversation-avatar-wrap"
              onClick={() => {
                onClose();
                navigate(`/profile/${post.userId.username}`);
              }}
            >
              <img
                src={getAvatarUrl(post.userId)}
                alt="Avatar"
                className="avatar"
                width="36"
                height="36"
              />
            </div>
            <div className="post-viewer-user-info">
              <span className="post-username">{post.userId.username}</span>
              <span className="post-time">{formatRelativeTime(post.createdAt)}</span>
            </div>
            {isOwner && (
              <button className="btn-delete-post" onClick={handleDeletePost} title="Delete Post">
                <Trash2 size={16} />
              </button>
            )}
          </div>

          {post.content && (
            <div className="post-viewer-caption-wrap">
              <p className={`post-viewer-caption ${captionExpanded ? '' : 'clamped'}`}>
                {renderPostContent(post.content, navigate)}
              </p>
              {post.content.length > 220 && (
                <button className="post-text-toggle" onClick={() => setCaptionExpanded((e) => !e)}>
                  {captionExpanded ? 'less' : 'more'}
                </button>
              )}
            </div>
          )}

          <div className="post-viewer-comments">
            {comments.length === 0 ? (
              <p className="no-comments">No comments yet. Start the conversation!</p>
            ) : (
              comments.map((comment) => (
                <div key={comment._id} className="comment-item">
                  <img
                    src={getAvatarUrl(comment.userId)}
                    alt="Avatar"
                    className="avatar comment-avatar"
                    width="30"
                    height="30"
                  />
                  <div className="comment-bubble">
                    <div className="comment-header">
                      <span className="comment-username">{comment.userId.username}</span>
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

          <div className="post-viewer-actions">
            <button className={`action-btn like-btn ${liked ? 'active' : ''}`} onClick={handleLike}>
              <Heart size={20} fill={liked ? 'currentColor' : 'transparent'} />
              <span>{likesCount}</span>
            </button>
            <div className="action-btn">
              <MessageSquare size={20} />
              <span>{commentsCount}</span>
            </div>
            <button className="action-btn share-btn" onClick={() => setShowShareModal(true)} title="Share to chat">
              <Share2 size={20} />
            </button>
          </div>

          {showShareModal && <ShareToChatModal postId={post._id} onClose={() => setShowShareModal(false)} />}

          <form className="comment-form post-viewer-comment-form" onSubmit={handleAddComment}>
            <MentionInput
              as="input"
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
      </div>
    </div>
  );
};

export default PostViewerModal;
