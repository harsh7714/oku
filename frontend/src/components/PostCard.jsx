import React, { useState, useRef } from 'react';
import { Heart, MessageSquare, Send, Share2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import { formatRelativeTime } from '../utils/formatRelativeTime';
import { getMediaUrl, getAvatarUrl } from '../utils/mediaUrl';
import { renderPostContent } from '../utils/renderPostContent';
import ImageLightbox from './ImageLightbox';
import MentionInput from './MentionInput';
import ShareToChatModal from './ShareToChatModal';
import './PostCard.css';

const PostCard = ({ post, onDelete }) => {
  const { user } = useAuth();
  const { onlineUsers } = useSocket();
  const toast = useToast();
  const navigate = useNavigate();
  const [liked, setLiked] = useState(post.likes.includes(user?._id));
  const [likesCount, setLikesCount] = useState(post.likes.length);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [commentsCount, setCommentsCount] = useState(post.commentsCount || 0);
  const [likeJustPopped, setLikeJustPopped] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const mediaClickTimerRef = useRef(null);

  const handleLike = async () => {
    try {
      const { data } = await api.put(`/posts/${post._id}/like`);
      setLiked(data.liked);
      setLikesCount(data.likesCount);
      if (data.liked) {
        setLikeJustPopped(true);
        setTimeout(() => setLikeJustPopped(false), 400);
      }
    } catch (err) {
      console.error('Error liking post:', err);
      toast.error('Failed to update like');
    }
  };

  // Instagram-style double-tap: always shows the burst for feedback, but
  // only fires the API call if the post isn't already liked (never unlikes).
  const handleDoubleTapLike = () => {
    setShowHeartBurst(true);
    setTimeout(() => setShowHeartBurst(false), 700);
    if (!liked) handleLike();
  };

  // Distinguishes a single tap (open lightbox) from a double tap (like)
  // without relying on the browser's slower native dblclick event.
  const handleMediaClick = () => {
    if (mediaClickTimerRef.current) {
      clearTimeout(mediaClickTimerRef.current);
      mediaClickTimerRef.current = null;
      handleDoubleTapLike();
    } else {
      mediaClickTimerRef.current = setTimeout(() => {
        setLightboxOpen(true);
        mediaClickTimerRef.current = null;
      }, 220);
    }
  };

  const fetchComments = async () => {
    try {
      const { data } = await api.get(`/posts/${post._id}/comments`);
      setComments(data);
    } catch (err) {
      console.error('Error fetching comments:', err);
      toast.error('Failed to load comments');
    }
  };

  const toggleComments = () => {
    if (!showComments) {
      fetchComments();
    }
    setShowComments(!showComments);
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

  const isOwner = post.userId._id === user?._id;
  const isAuthorOnline = onlineUsers.includes(post.userId._id);

  return (
    <div className="post-card fade-in">
      <div className="post-header">
        <div className="conversation-avatar-wrap" onClick={() => navigate(`/profile/${post.userId.username}`)}>
          <img
            src={getAvatarUrl(post.userId)}
            alt="Avatar"
            className="avatar post-avatar"
            width="40"
            height="40"
          />
          {isAuthorOnline && <span className="presence-dot" />}
        </div>
        <div className="post-user-info" onClick={() => navigate(`/profile/${post.userId.username}`)}>
          <span className="post-username">{post.userId.username}</span>
          <span className="post-time">{formatRelativeTime(post.createdAt)}</span>
        </div>
        {isOwner && (
          <button className="btn-delete-post" onClick={() => onDelete(post._id)} title="Delete Post">
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div className="post-body">
        {post.content && (
          <div className="post-text-wrap">
            <p className={`post-text ${captionExpanded ? '' : 'clamped'}`}>
              {renderPostContent(post.content, navigate)}
            </p>
            {post.content.length > 220 && (
              <button className="post-text-toggle" onClick={() => setCaptionExpanded((e) => !e)}>
                {captionExpanded ? 'less' : 'more'}
              </button>
            )}
          </div>
        )}
        {post.media && post.mediaType === 'image' && (
          <div className="post-media-wrap">
            <img
              src={getMediaUrl(post.media)}
              alt="Post Attachment"
              className="post-media-img"
              onClick={handleMediaClick}
            />
            {showHeartBurst && <Heart className="heart-burst-icon" size={90} fill="white" />}
          </div>
        )}
        {post.media && post.mediaType === 'video' && (
          <video src={getMediaUrl(post.media)} controls className="post-media-video" />
        )}
      </div>

      <div className="post-actions">
        <button className={`action-btn like-btn ${liked ? 'active' : ''}`} onClick={handleLike}>
          <Heart size={18} fill={liked ? 'currentColor' : 'transparent'} className={likeJustPopped ? 'pop-glow' : ''} />
          <span>{likesCount}</span>
        </button>
        <button className={`action-btn comment-btn ${showComments ? 'active' : ''}`} onClick={toggleComments}>
          <MessageSquare size={18} />
          <span>{commentsCount}</span>
        </button>
        <button className="action-btn share-btn" onClick={() => setShowShareModal(true)} title="Share to chat">
          <Share2 size={18} />
        </button>
      </div>

      {showShareModal && <ShareToChatModal postId={post._id} onClose={() => setShowShareModal(false)} />}

      {lightboxOpen && post.media && (
        <ImageLightbox
          src={getMediaUrl(post.media)}
          alt="Post attachment enlarged"
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {showComments && (
        <div className="comments-section">
          <form className="comment-form" onSubmit={handleAddComment}>
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

          <div className="comments-list">
            {comments.length === 0 ? (
              <p className="no-comments">No comments yet. Start the conversation!</p>
            ) : (
              comments.map((comment) => (
                <div key={comment._id} className="comment-item">
                  <img
                    src={getAvatarUrl(comment.userId)}
                    alt="Avatar"
                    className="avatar comment-avatar"
                    onClick={() => navigate(`/profile/${comment.userId.username}`)}
                    width="30"
                    height="30"
                  />
                  <div className="comment-bubble">
                    <div className="comment-header">
                      <span className="comment-username" onClick={() => navigate(`/profile/${comment.userId.username}`)}>
                        {comment.userId.username}
                      </span>
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
        </div>
      )}
    </div>
  );
};

export default PostCard;
