import React, { useState, useRef, useEffect } from 'react';
import { Image, Video, X, Send } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getMediaUrl } from '../utils/mediaUrl';
import './CreatePostBox.css';

const CreatePostBox = ({ onPostCreated }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [content, setContent] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [mediaType, setMediaType] = useState('none');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleMediaChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setMediaFile(file);

    // Determine type
    const fileType = file.type.split('/')[0];
    if (fileType === 'video') {
      setMediaType('video');
    } else {
      setMediaType('image');
    }

    // Object URLs are cheap references to the in-memory file, unlike
    // FileReader.readAsDataURL, which base64-encodes the whole file into a
    // giant string and reliably hangs/crashes the tab on multi-MB videos.
    setMediaPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
    setMediaType('none');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Release the object URL if the user navigates away with a preview active
  useEffect(() => {
    return () => {
      if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    };
  }, [mediaPreview]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() && !mediaFile) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('content', content);
    if (mediaFile) {
      formData.append('media', mediaFile);
    }

    try {
      const { data } = await api.post('/posts', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setContent('');
      removeMedia();
      if (onPostCreated) {
        onPostCreated(data);
      }
      toast.success('Post created!');
    } catch (err) {
      console.error('Error creating post:', err);
      toast.error(err.response?.data?.message || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-post-box glass fade-in">
      <form onSubmit={handleSubmit}>
        <div className="post-input-row">
          <img
            src={user?.profilePicture ? getMediaUrl(user.profilePicture) : 'https://api.dicebear.com/7.x/bottts/svg?seed=' + user?.username}
            alt="Avatar"
            className="avatar"
            width="42"
            height="42"
          />
          <textarea
            placeholder="What's happening on Oku?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="post-textarea"
          />
        </div>

        {/* Media Preview Box */}
        {mediaPreview && (
          <div className="media-preview-container">
            <button type="button" className="btn-remove-media glass" onClick={removeMedia}>
              <X size={16} />
            </button>
            {mediaType === 'image' ? (
              <img src={mediaPreview} alt="Preview" className="media-preview" />
            ) : (
              <video src={mediaPreview} controls className="media-preview" />
            )}
          </div>
        )}

        <div className="post-footer-row">
          <div className="attachment-options">
            <button
              type="button"
              className="attach-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Add Image or Video"
            >
              <Image size={18} />
              <span>Media</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleMediaChange}
              accept="image/*,video/*"
              style={{ display: 'none' }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary post-submit-btn"
            disabled={loading || (!content.trim() && !mediaFile)}
          >
            {loading ? 'Posting...' : 'Post'}
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreatePostBox;
