import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import './ToastContainer.css';

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const ToastContainer = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => {
        const Icon = ICONS[t.type] || Info;
        return (
          <div key={t.id} className={`toast-item toast-${t.type} fade-in`} role="alert">
            <Icon className="toast-icon" size={20} />
            <p className="toast-message">{t.message}</p>
            <button className="toast-close" onClick={() => onDismiss(t.id)} title="Dismiss">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ToastContainer;
