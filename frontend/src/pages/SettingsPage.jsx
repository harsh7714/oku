import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, LogOut, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import ConfirmDialog from '../components/ConfirmDialog';
import { getAvatarUrl } from '../utils/mediaUrl';
import './SettingsPage.css';

const SettingsPage = ({ embedded = false }) => {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFinalDeleteConfirm, setShowFinalDeleteConfirm] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    await logout();
    navigate('/login', { replace: true });
  };

  const closeFinalDeleteConfirm = () => {
    if (deleting) return;
    setShowFinalDeleteConfirm(false);
    setDeletePhrase('');
  };

  const handleDeleteAccount = async () => {
    if (deletePhrase !== 'DELETE' || deleting) return;

    setDeleting(true);
    try {
      await api.delete('/users/account');
      setShowFinalDeleteConfirm(false);
      toast.success('Your account has been deleted.');
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Delete account error:', err);
      toast.error(err.response?.data?.message || 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  const SettingsWrapper = embedded ? 'div' : 'main';

  return (
    <SettingsWrapper className={`settings-main fade-in ${embedded ? 'settings-main-embedded' : ''}`}>
      <header className="settings-header">
        <h2>{embedded ? 'Account settings' : 'Settings'}</h2>
        <p>Manage your account access and important account actions.</p>
      </header>

      <section className="settings-section" aria-labelledby="settings-account-title">
        <h3 id="settings-account-title" className="settings-section-title">Account</h3>
        <div className="settings-account-row">
          <img
            src={getAvatarUrl(user)}
            alt=""
            className="avatar settings-avatar"
            width="48"
            height="48"
          />
          <div className="settings-account-info">
            <strong>{user.username}</strong>
            <span>Personal Oku profile</span>
          </div>
          <Link className="settings-profile-link" to={`/profile/${user.username}`}>
            <span>View profile</span>
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-session-title">
        <div className="settings-action-row">
          <div className="settings-action-copy">
            <h3 id="settings-session-title" className="settings-section-title">Sign out</h3>
            <p>End your Oku session on this device. You can sign back in at any time.</p>
          </div>
          <button
            type="button"
            className="btn btn-secondary settings-action-button"
            onClick={() => setShowLogoutConfirm(true)}
          >
            <LogOut size={16} />
            <span>Log out</span>
          </button>
        </div>
      </section>

      <section className="settings-section settings-danger-section" aria-labelledby="settings-danger-title">
        <div className="settings-action-row">
          <div className="settings-action-copy">
            <h3 id="settings-danger-title" className="settings-section-title">Delete account</h3>
            <p>Permanently delete your profile, posts, comments, messages, and followers. This cannot be undone.</p>
          </div>
          <button
            type="button"
            className="btn btn-danger settings-action-button settings-delete-button"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 size={16} />
            <span>Delete account</span>
          </button>
        </div>
      </section>

      {showLogoutConfirm && (
        <ConfirmDialog
          title="Log out of Oku?"
          message="You will need to sign in again to use this account on this device."
          confirmLabel="Log out"
          cancelLabel="Stay signed in"
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Start account deletion?"
          message="Your profile and account data will be permanently removed. Continue to the final confirmation only if you are sure."
          confirmLabel="Continue"
          cancelLabel="Keep account"
          danger={true}
          onConfirm={() => {
            setShowDeleteConfirm(false);
            setDeletePhrase('');
            setShowFinalDeleteConfirm(true);
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {showFinalDeleteConfirm && createPortal(
        <div className="modal-overlay" onClick={closeFinalDeleteConfirm}>
          <section
            className="modal-content settings-delete-modal fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="final-delete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h3 id="final-delete-title">Confirm account deletion</h3>
              <button
                type="button"
                className="btn-close-modal"
                onClick={closeFinalDeleteConfirm}
                aria-label="Close confirmation"
                disabled={deleting}
              >
                <X size={18} />
              </button>
            </div>

            <div className="settings-delete-warning">
              <AlertTriangle size={19} />
              <p>This permanently erases your account and cannot be reversed.</p>
            </div>

            <label className="form-label" htmlFor="delete-account-phrase">
              Type <strong>DELETE</strong> to confirm
            </label>
            <input
              id="delete-account-phrase"
              className="form-input settings-delete-input"
              type="text"
              autoComplete="off"
              spellCheck="false"
              maxLength={6}
              value={deletePhrase}
              onChange={(event) => setDeletePhrase(event.target.value.toUpperCase())}
              placeholder="DELETE"
              disabled={deleting}
            />

            <div className="settings-delete-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeFinalDeleteConfirm}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteAccount}
                disabled={deletePhrase !== 'DELETE' || deleting}
              >
                {deleting ? 'Deleting…' : 'Permanently delete'}
              </button>
            </div>
          </section>
        </div>,
        document.body
      )}
    </SettingsWrapper>
  );
};

export default SettingsPage;
