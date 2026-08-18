import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import './ConfirmDialog.css';

const ConfirmDialog = ({
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) => {
  // Portaled to <body> — rendered inline, a `position: fixed` overlay gets
  // trapped by whichever `.fade-in`-animated page wrapper happens to be its
  // ancestor (an animation's transform, even a finished one with
  // fill-mode: forwards, creates a containing block for fixed descendants),
  // so it ends up positioned against that tall, scrollable page instead of
  // the actual viewport — e.g. centering itself far down a long page
  // instead of over what's currently on screen.
  return createPortal(
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-dialog glass glass-glow fade-in" onClick={(e) => e.stopPropagation()}>
        <div className={`confirm-dialog-icon ${danger ? 'danger' : ''}`}>
          <AlertTriangle size={22} />
        </div>
        <h3 className="confirm-dialog-title">{title}</h3>
        {message && <p className="confirm-dialog-message">{message}</p>}
        <div className="confirm-dialog-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmDialog;
