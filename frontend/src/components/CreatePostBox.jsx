import React, { useState, useRef, useEffect } from 'react';
import { Image, X, Send } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getAvatarUrl } from '../utils/mediaUrl';
import { readLocalMediaDimensions } from '../utils/mediaMetadata';
import MentionInput from './MentionInput';
import './CreatePostBox.css';

const CreatePostBox = ({ onPostCreated }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [content, setContent] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [mediaType, setMediaType] = useState('none');
  const [mediaDimensions, setMediaDimensions] = useState(null);
  const [readingDimensions, setReadingDimensions] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const metadataRequestRef = useRef(0);

  const handleMediaChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const requestId = ++metadataRequestRef.current;
    const nextType = file.type.startsWith('video/') ? 'video' : 'image';
    setMediaFile(file);
    setMediaType(nextType);
    setMediaDimensions(null);
    setReadingDimensions(true);

    // Object URLs are cheap references to the in-memory file, unlike
    // FileReader.readAsDataURL, which base64-encodes the whole file into a
    // giant string and reliably hangs/crashes the tab on multi-MB videos.
    setMediaPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });

    try {
      const dimensions = await readLocalMediaDimensions(file, nextType);
      if (requestId === metadataRequestRef.current) setMediaDimensions(dimensions);
    } catch (error) {
      if (requestId === metadataRequestRef.current) {
        console.error('Unable to read selected media dimensions:', error);
        toast.error('Could not read this image or video. Please choose another file.');
        removeMedia();
      }
    } finally {
      if (requestId === metadataRequestRef.current) setReadingDimensions(false);
    }
  };

  const removeMedia = () => {
    metadataRequestRef.current += 1;
    setMediaFile(null);
    setMediaDimensions(null);
    setReadingDimensions(false);
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
      if (mediaDimensions) {
        formData.append('width', String(mediaDimensions.width));
        formData.append('height', String(mediaDimensions.height));
        formData.append('aspectRatio', String(mediaDimensions.aspectRatio));
        formData.append('orientation', mediaDimensions.orientation);
      }
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
            src={getAvatarUrl(user)}
            alt="Avatar"
            className="avatar"
            width="42"
            height="42"
          />
          <MentionInput
            as="textarea"
            aria-label="Post content"
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
            disabled={loading || readingDimensions || (!content.trim() && !mediaFile)}
          >
            {loading ? 'Posting...' : readingDimensions ? 'Reading media...' : 'Post'}
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreatePostBox;
