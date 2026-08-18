import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import PostCard from '../components/PostCard';
import CreatePostBox from '../components/CreatePostBox';
import FollowListModal from '../components/FollowListModal';
import PostViewerModal from '../components/PostViewerModal';
import EmptyState from '../components/EmptyState';
import api from '../services/api';
import { Edit2, Loader2, Camera, X, MessageCircle, LayoutGrid, List, Film, FileText, Link as LinkIcon, Grid3x3, Image as ImageIcon } from 'lucide-react';
import { getMediaUrl, getAvatarUrl } from '../utils/mediaUrl';
import { toSafeHref } from '../utils/toSafeHref';
import './ProfilePage.css';

const ProfilePage = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, setUser: setCurrentUser } = useAuth();
  const toast = useToast();
  const [profileUser, setProfileUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [followModalTab, setFollowModalTab] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [mediaFilter, setMediaFilter] = useState('all');
  const [viewerIndex, setViewerIndex] = useState(null);
  
  // Edit Form State
  const [editBio, setEditBio] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [profilePicFile, setProfilePicFile] = useState(null);
  const [profilePicPreview, setProfilePicPreview] = useState('');
  const [coverPicFile, setCoverPicFile] = useState(null);
  const [coverPicPreview, setCoverPicPreview] = useState('');
  
  const [saving, setSaving] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      // Fetch user profile
      const userRes = await api.get(`/users/profile/${username}`);
      setProfileUser(userRes.data);
      setEditBio(userRes.data.bio || '');
      setEditWebsite(userRes.data.website || '');

      // Fetch user's posts
      const postsRes = await api.get(`/posts/user/${username}`);
      setPosts(postsRes.data);
    } catch (err) {
      console.error('Error fetching profile data:', err);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    setMediaFilter('all');
  }, [username]);

  const filteredPosts =
    mediaFilter === 'all' ? posts : posts.filter((p) => p.mediaType === mediaFilter);

  // The grid tile viewer only makes sense for posts with actual media — a
  // text-only post would have nothing to show, so it's excluded from
  // navigation and just falls back to list view when tapped.
  const mediaPosts = filteredPosts.filter((p) => p.mediaType !== 'none');

  const MEDIA_FILTERS = [
    { key: 'all', label: 'Posts', icon: Grid3x3 },
    { key: 'image', label: 'Photos', icon: ImageIcon },
    { key: 'video', label: 'Videos', icon: Film },
  ];

  const isOwnProfile = currentUser?.username === username;
  const isFollowing = profileUser?.followers?.some((f) => f._id === currentUser?._id);

  // Generalized follow/unfollow handler used by the main profile button
  // and by the followers/following list modal.
  const handleFollowToggle = async (targetId = profileUser?._id, currentlyFollowing = isFollowing) => {
    if (!targetId) return;
    try {
      if (currentlyFollowing) {
        await api.put(`/users/${targetId}/unfollow`);
      } else {
        await api.put(`/users/${targetId}/follow`);
      }

      // Update auth user's following list
      const updatedFollowing = currentlyFollowing
        ? currentUser.following.filter((id) => id !== targetId)
        : [...currentUser.following, targetId];
      const updatedAuthUser = { ...currentUser, following: updatedFollowing };
      setCurrentUser(updatedAuthUser);
      localStorage.setItem('user', JSON.stringify(updatedAuthUser));

      // Keep the viewed profile's follower list in sync when it's the target
      if (targetId === profileUser._id) {
        setProfileUser((prev) => ({
          ...prev,
          followers: currentlyFollowing
            ? prev.followers.filter((f) => f._id !== currentUser._id)
            : [...prev.followers, currentUser],
        }));
      }

      // If unfollowing someone from my own "following" list, drop them from it
      if (isOwnProfile && currentlyFollowing) {
        setProfileUser((prev) => ({
          ...prev,
          following: prev.following.filter((f) => f._id !== targetId),
        }));
      }
    } catch (err) {
      console.error('Follow toggle error:', err);
      toast.error(err.response?.data?.message || 'Failed to update follow status');
    }
  };

  const handleProfileFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePicFile(file);
      setProfilePicPreview(URL.createObjectURL(file));
    }
  };

  const handleCoverFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCoverPicFile(file);
      setCoverPicPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    const formData = new FormData();
    formData.append('bio', editBio);
    formData.append('website', editWebsite);
    if (profilePicFile) {
      formData.append('profilePicture', profilePicFile);
    }
    if (coverPicFile) {
      formData.append('coverPicture', coverPicFile);
    }

    try {
      const { data } = await api.put('/users/profile', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Update states
      setCurrentUser(data);
      setProfileUser(data);
      const token = localStorage.getItem('token');
      localStorage.setItem('user', JSON.stringify({ ...data, token }));
      
      // Close modal and clean previews
      setShowEditModal(false);
      setProfilePicFile(null);
      setProfilePicPreview('');
      setCoverPicFile(null);
      setCoverPicPreview('');
      toast.success('Profile updated');
    } catch (err) {
      console.error('Save profile error:', err);
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePostCreated = (newPost) => {
    setPosts((prev) => [newPost, ...prev]);
  };

  const handleDeletePost = async (postId) => {
    try {
      await api.delete(`/posts/${postId}`);
      setPosts((prev) => prev.filter((p) => p._id !== postId));
      toast.success('Post deleted');
    } catch (err) {
      console.error('Error deleting user post:', err);
      toast.error(err.response?.data?.message || 'Failed to delete post');
    }
  };

  if (loading) {
    return (
      <div className="profile-loading">
        <Loader2 className="spinner" size={32} />
        <p>Opening profile...</p>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="profile-error glass">
        <h3>User not found</h3>
        <p>The profile you are looking for does not exist on Oku.</p>
      </div>
    );
  }

  return (
    <main className="profile-main-content fade-in">
      <div className="profile-card-container glass">
        {/* Cover Photo */}
        <div className="profile-cover-section">
          {profileUser.coverPicture ? (
            <img src={getMediaUrl(profileUser.coverPicture)} alt="Cover" className="cover-img" />
          ) : (
            <div className="cover-placeholder" />
          )}
        </div>

        {/* Profile Details Container */}
        <div className="profile-meta-details">
          <div className="profile-avatar-row">
            <img
              src={getAvatarUrl(profileUser)}
              alt="Avatar"
              className="profile-avatar avatar"
              width="100"
              height="100"
            />
            <div className="profile-action-btns">
              {isOwnProfile ? (
                <button className="btn btn-secondary btn-edit-profile" onClick={() => setShowEditModal(true)}>
                  <Edit2 size={14} />
                  <span>Edit Profile</span>
                </button>
              ) : (
                <>
                  <button className="btn btn-secondary btn-message-user" onClick={() => navigate(`/messages?user=${profileUser.username}`)}>
                    <MessageCircle size={14} />
                    <span>Message</span>
                  </button>
                  <button
                    className={`btn follow-toggle-btn ${isFollowing ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={() => handleFollowToggle()}
                  >
                    {isFollowing ? 'Unfollow' : 'Follow'}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="profile-text-details">
            <h2 className="profile-username">{profileUser.username}</h2>
            {profileUser.bio && <p className="profile-bio">{profileUser.bio}</p>}
            {profileUser.website && toSafeHref(profileUser.website) && (
              <a
                href={toSafeHref(profileUser.website)}
                target="_blank"
                rel="noopener noreferrer"
                className="profile-website-link"
              >
                <LinkIcon size={14} />
                <span>{profileUser.website}</span>
              </a>
            )}

            <div className="profile-stats">
              <button className="stat-item stat-item-btn" onClick={() => setFollowModalTab('following')}>
                <span className="stat-count">{profileUser.following.length}</span>
                <span className="stat-label">Following</span>
              </button>
              <button className="stat-item stat-item-btn" onClick={() => setFollowModalTab('followers')}>
                <span className="stat-count">{profileUser.followers.length}</span>
                <span className="stat-label">{profileUser.followers.length === 1 ? 'Follower' : 'Followers'}</span>
              </button>
              <div className="stat-item">
                <span className="stat-count">{posts.length}</span>
                <span className="stat-label">{posts.length === 1 ? 'Post' : 'Posts'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isOwnProfile && <CreatePostBox onPostCreated={handlePostCreated} />}

      {/* User Posts list */}
      <div className="profile-posts-header">
        <h3 className="profile-posts-title">Posts by {profileUser.username}</h3>
        {posts.length > 0 && (
          <div className="profile-view-toggle">
            <button
              className={`profile-view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <List size={16} />
            </button>
            <button
              className={`profile-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        )}
      </div>

      {posts.length > 0 && (
        <div className="profile-media-tabs">
          {MEDIA_FILTERS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`profile-media-tab ${mediaFilter === key ? 'active' : ''}`}
              onClick={() => setMediaFilter(key)}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}

      {posts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No posts yet"
          subtitle={isOwnProfile ? "Share your first post to get started." : `${profileUser.username} hasn't posted anything yet.`}
        />
      ) : filteredPosts.length === 0 ? (
        <EmptyState
          icon={mediaFilter === 'image' ? ImageIcon : Film}
          title={`No ${mediaFilter === 'image' ? 'photos' : 'videos'} yet`}
          subtitle={
            isOwnProfile
              ? `Posts with a ${mediaFilter === 'image' ? 'photo' : 'video'} will show up here.`
              : `${profileUser.username} hasn't posted any ${mediaFilter === 'image' ? 'photos' : 'videos'} yet.`
          }
        />
      ) : viewMode === 'list' ? (
        <div className="profile-posts-list">
          {filteredPosts.map((post) => (
            <PostCard key={post._id} post={post} onDelete={handleDeletePost} />
          ))}
        </div>
      ) : (
        <div className="profile-posts-grid">
          {filteredPosts.map((post) => (
            <button
              key={post._id}
              className="profile-grid-tile"
              onClick={() => {
                if (post.mediaType === 'none') {
                  setViewMode('list');
                } else {
                  setViewerIndex(mediaPosts.findIndex((p) => p._id === post._id));
                }
              }}
            >
              {post.mediaType === 'image' ? (
                <img src={getMediaUrl(post.media)} alt="Post thumbnail" className="profile-grid-media" />
              ) : post.mediaType === 'video' ? (
                <>
                  <video src={getMediaUrl(post.media)} className="profile-grid-media" muted preload="metadata" />
                  <Film className="profile-grid-video-icon" size={16} />
                </>
              ) : (
                <div className="profile-grid-placeholder profile-grid-text">
                  <FileText size={18} className="profile-grid-text-icon" />
                  <p>{post.content}</p>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {viewerIndex !== null && (
        <PostViewerModal
          posts={mediaPosts}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onDelete={(postId) => {
            handleDeletePost(postId);
            setViewerIndex(null);
          }}
        />
      )}

      {/* Edit Profile Modal — portaled to <body>. Rendered inline, this
          `position: fixed` overlay gets trapped by the `.fade-in`
          animation on this page's own root <main> (an animation's
          transform, even finished with fill-mode: forwards, creates a
          containing block for fixed descendants), so it ends up centered
          against that long, scrollable profile page instead of the actual
          viewport — it could open seemingly "at the bottom" of the page
          rather than in front of whatever the user was looking at. */}
      {showEditModal && createPortal(
        <div className="modal-overlay">
          <div className="modal-content fade-in">
            <div className="modal-header">
              <h3>Edit Profile</h3>
              <button className="btn-close-modal" onClick={() => setShowEditModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="profile-edit-form">
              {/* Cover input preview */}
              <div className="edit-cover-preview">
                {coverPicPreview ? (
                  <img src={coverPicPreview} alt="Cover Preview" className="cover-img-preview" />
                ) : profileUser.coverPicture ? (
                  <img src={getMediaUrl(profileUser.coverPicture)} alt="Cover" className="cover-img-preview" />
                ) : (
                  <div className="cover-preview-placeholder" />
                )}
                <label className="btn-upload-cover attach-btn">
                  <Camera size={16} />
                  <span>Change Cover</span>
                  <input type="file" onChange={handleCoverFileChange} accept="image/*" style={{ display: 'none' }} />
                </label>
              </div>

              {/* Avatar input preview */}
              <div className="edit-avatar-section">
                <div className="avatar-preview-wrapper">
                  <img
                    src={profilePicPreview ? profilePicPreview : getAvatarUrl(profileUser)}
                    alt="Avatar Preview"
                    className="avatar avatar-img-preview"
                    width="80"
                    height="80"
                  />
                  <label className="btn-upload-avatar glass">
                    <Camera size={14} />
                    <input type="file" onChange={handleProfileFileChange} accept="image/*" style={{ display: 'none' }} />
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Bio</label>
                <textarea
                  placeholder="Tell us about yourself..."
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="form-input edit-bio-textarea"
                  maxLength={160}
                />
                <span className="char-count">{editBio.length}/160</span>
              </div>

              <div className="form-group">
                <label className="form-label">Website</label>
                <input
                  type="text"
                  placeholder="yoursite.com"
                  value={editWebsite}
                  onChange={(e) => setEditWebsite(e.target.value)}
                  className="form-input"
                  maxLength={100}
                />
              </div>

              <button type="submit" className="btn btn-primary btn-save-profile" disabled={saving}>
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Followers / Following Modal */}
      {followModalTab && (
        <FollowListModal
          activeTab={followModalTab}
          followers={profileUser.followers}
          following={profileUser.following}
          currentUser={currentUser}
          onClose={() => setFollowModalTab(null)}
          onFollowToggle={handleFollowToggle}
          profileUsername={profileUser.username}
        />
      )}
    </main>
  );
};

export default ProfilePage;
