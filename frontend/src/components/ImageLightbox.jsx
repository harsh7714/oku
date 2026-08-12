import React, { useEffect } from 'react';
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

  return (
    <div className="modal-overlay lightbox-overlay fade-in" onClick={onClose}>
      <button className="btn-close-modal lightbox-close" onClick={onClose}>
        <X size={22} />
      </button>
      <img src={src} alt={alt} className="lightbox-image" onClick={(e) => e.stopPropagation()} />
    </div>
  );
};

export default ImageLightbox;
