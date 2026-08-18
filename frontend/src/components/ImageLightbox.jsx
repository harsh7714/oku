import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './ImageLightbox.css';

const ImageLightbox = ({ src, alt, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Portaled to <body> — see ConfirmDialog.jsx for why: rendered inline, a
  // `.fade-in`-animated ancestor traps this `position: fixed` overlay
  // against its own (possibly tall/scrolled) box instead of the viewport.
  return createPortal(
    <div className="modal-overlay lightbox-overlay fade-in" onClick={onClose}>
      <button className="btn-close-modal lightbox-close" onClick={onClose}>
        <X size={22} />
      </button>
      <img src={src} alt={alt} className="lightbox-image" onClick={(e) => e.stopPropagation()} />
    </div>,
    document.body
  );
};

export default ImageLightbox;
