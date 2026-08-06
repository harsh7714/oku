import React, { useState } from 'react';
import { Heart, MessageSquare, Trash2, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import './PostCard.css';

const PostCard = ({ post, onDelete }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [liked, setLiked] = useState(post.likes.includes(user?._id));
  const [likesCount, setLikesCount] = useState(post.likes.length);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [commentsCount, setCommentsCount] = useState(post.commentsCount || 0);

  const handleLike = async () => {
    try {
      const { data } = await api.put(`/posts/${post._id}/like`);
      setLiked(data.liked);
      setLikesCount(data.likesCount);
    } catch (err) {
      console.error('Error liking post:', err);
    }
  };

  const fetchComments = async () => {
    try {
      const { data } = await api.get(`/posts/${post._id}/comments`);
      setComments(data);
    } catch (err) {
      console.error('Error fetching comments:', err);
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
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await api.delete(`/posts/${post._id}/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c._id !== commentId));
      setCommentsCount((prev) => prev - 1);
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  const isOwner = post.userId._id === user?._id;

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="post-card glass fade-in">
      <div className="post-header">
        <img
          src={post.userId.profilePicture ? `http://localhost:5000${post.userId.profilePicture}` : 'https://api.dicebear.com/7.x/bottts/svg?seed=' + post.userId.username}
          alt="Avatar"
          className="avatar post-avatar"
          onClick={() => navigate(`/profile/${post.userId.username}`)}
          width="40"
          height="40"
        />
        <div className="post-user-info" onClick={() => navigate(`/profile/${post.userId.username}`)}>
          <span className="post-username">@{post.userId.username}</span>
          <span className="post-time">{formatDate(post.createdAt)}</span>
        </div>
        {isOwner && (
          <button className="btn-delete-post" onClick={() => onDelete(post._id)} title="Delete Post">
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div className="post-body">
        {post.content && <p className="post-text">{post.content}</p>}
        {post.media && post.mediaType === 'image' && (
          <img src={`http://localhost:5000${post.media}`} alt="Post Attachment" className="post-media-img" />
        )}
        {post.media && post.mediaType === 'video' && (
          <video src={`http://localhost:5000${post.media}`} controls className="post-media-video" />
        )}
      </div>

      <div className="post-actions">
        <button className={`action-btn like-btn ${liked ? 'active' : ''}`} onClick={handleLike}>
          <Heart size={18} fill={liked ? 'currentColor' : 'transparent'} />
          <span>{likesCount}</span>
        </button>
        <button className={`action-btn comment-btn ${showComments ? 'active' : ''}`} onClick={toggleComments}>
          <MessageSquare size={18} />
          <span>{commentsCount}</span>
        </button>
      </div>

      {showComments && (
        <div className="comments-section">
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

          <div className="comments-list">
            {comments.length === 0 ? (
              <p className="no-comments">No comments yet. Start the conversation!</p>
            ) : (
              comments.map((comment) => (
                <div key={comment._id} className="comment-item">
                  <img
                    src={comment.userId.profilePicture ? `http://localhost:5000${comment.userId.profilePicture}` : 'https://api.dicebear.com/7.x/bottts/svg?seed=' + comment.userId.username}
                    alt="Avatar"
                    className="avatar comment-avatar"
                    onClick={() => navigate(`/profile/${comment.userId.username}`)}
                    width="30"
                    height="30"
                  />
                  <div className="comment-bubble">
                    <div className="comment-header">
                      <span className="comment-username" onClick={() => navigate(`/profile/${comment.userId.username}`)}>
                        @{comment.userId.username}
                      </span>
                      <span className="comment-date">{formatDate(comment.createdAt)}</span>
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
