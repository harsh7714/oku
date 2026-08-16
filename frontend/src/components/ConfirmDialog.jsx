import React from 'react';
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
  return (
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
    </div>
  );
};

export default ConfirmDialog;
