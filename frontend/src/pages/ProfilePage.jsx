import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PostCard from '../components/PostCard';
import api from '../services/api';
import { Edit2, Loader2, Camera, X, MessageCircle } from 'lucide-react';
import './ProfilePage.css';

const ProfilePage = () => {
  const { username } = useParams();
  const { user: currentUser, setUser: setCurrentUser } = useAuth();
  const [profileUser, setProfileUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Edit Form State
  const [editBio, setEditBio] = useState('');
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

      // Fetch user's posts
      const postsRes = await api.get(`/posts/user/${username}`);
      setPosts(postsRes.data);
    } catch (err) {
      console.error('Error fetching profile data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [username]);

  const isOwnProfile = currentUser?.username === username;
  const isFollowing = profileUser?.followers?.some((f) => f._id === currentUser?._id);

  const handleFollowToggle = async () => {
    if (!profileUser) return;
    try {
      if (isFollowing) {
        await api.put(`/users/${profileUser._id}/unfollow`);
        // Update local state
        setProfileUser((prev) => ({
          ...prev,
          followers: prev.followers.filter((f) => f._id !== currentUser._id),
        }));
        // Update auth user following count
        const updatedFollowing = currentUser.following.filter((id) => id !== profileUser._id);
        const updatedAuthUser = { ...currentUser, following: updatedFollowing };
        setCurrentUser(updatedAuthUser);
        localStorage.setItem('user', JSON.stringify(updatedAuthUser));
      } else {
        await api.put(`/users/${profileUser._id}/follow`);
        // Update local state
        setProfileUser((prev) => ({
          ...prev,
          followers: [...prev.followers, currentUser],
        }));
        // Update auth user following count
        const updatedFollowing = [...currentUser.following, profileUser._id];
        const updatedAuthUser = { ...currentUser, following: updatedFollowing };
        setCurrentUser(updatedAuthUser);
        localStorage.setItem('user', JSON.stringify(updatedAuthUser));
      }
    } catch (err) {
      console.error('Follow toggle error:', err);
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
    } catch (err) {
      console.error('Save profile error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePost = async (postId) => {
    try {
      await api.delete(`/posts/${postId}`);
      setPosts((prev) => prev.filter((p) => p._id !== postId));
    } catch (err) {
      console.error('Error deleting user post:', err);
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
            <img src={`http://localhost:5000${profileUser.coverPicture}`} alt="Cover" className="cover-img" />
          ) : (
            <div className="cover-placeholder" />
          )}
        </div>

        {/* Profile Details Container */}
        <div className="profile-meta-details">
          <div className="profile-avatar-row">
            <img
              src={profileUser.profilePicture ? `http://localhost:5000${profileUser.profilePicture}` : 'https://api.dicebear.com/7.x/bottts/svg?seed=' + profileUser.username}
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
                    onClick={handleFollowToggle}
                  >
                    {isFollowing ? 'Unfollow' : 'Follow'}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="profile-text-details">
            <h2 className="profile-username">@{profileUser.username}</h2>
            {profileUser.bio && <p className="profile-bio">{profileUser.bio}</p>}
            
            <div className="profile-stats">
              <div className="stat-item">
                <span className="stat-count">{profileUser.following.length}</span>
                <span className="stat-label">Following</span>
              </div>
              <div className="stat-item">
                <span className="stat-count">{profileUser.followers.length}</span>
                <span className="stat-label">{profileUser.followers.length === 1 ? 'Follower' : 'Followers'}</span>
              </div>
              <div className="stat-item">
                <span className="stat-count">{posts.length}</span>
                <span className="stat-label">{posts.length === 1 ? 'Post' : 'Posts'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User Posts list */}
      <h3 className="profile-posts-title">Posts by @{profileUser.username}</h3>
      {posts.length === 0 ? (
        <div className="profile-posts-empty glass">
          <p>No posts published yet.</p>
        </div>
      ) : (
        <div className="profile-posts-list">
          {posts.map((post) => (
            <PostCard key={post._id} post={post} onDelete={handleDeletePost} />
          ))}
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-content glass glass-glow fade-in">
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
                  <img src={`http://localhost:5000${profileUser.coverPicture}`} alt="Cover" className="cover-img-preview" />
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
                    src={profilePicPreview ? profilePicPreview : profileUser.profilePicture ? `http://localhost:5000${profileUser.profilePicture}` : 'https://api.dicebear.com/7.x/bottts/svg?seed=' + profileUser.username}
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

              <button type="submit" className="btn btn-primary btn-save-profile" disabled={saving}>
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};

export default ProfilePage;
