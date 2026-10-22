import React, { useEffect, useRef, useState } from 'react';
import { MoreVertical, Trash2 } from 'lucide-react';
import './PostOptionsMenu.css';

const PostOptionsMenu = ({
  onDelete,
  deleteLabel = 'Delete post',
  optionsLabel = 'Post options',
  className = '',
  triggerClassName = '',
}) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const closeOutside = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className={`post-options-menu ${className}`.trim()} ref={menuRef}>
      <button
        type="button"
        className={`post-options-trigger ${triggerClassName}`.trim()}
        aria-label={optionsLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        <MoreVertical size={17} aria-hidden="true" />
      </button>
      {open && (
        <div className="post-options-dropdown" role="menu">
          <button
            type="button"
            className="post-options-delete"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            <Trash2 size={14} aria-hidden="true" />
            <span>{deleteLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default PostOptionsMenu;
