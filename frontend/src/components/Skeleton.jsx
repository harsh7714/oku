import React from 'react';
import './Skeleton.css';

const Skeleton = ({ variant = 'post' }) => {
  if (variant === 'conversation') {
    return (
      <div className="skeleton-conversation">
        <div className="skeleton-block skeleton-avatar" />
        <div className="skeleton-conversation-text">
          <div className="skeleton-block skeleton-line" style={{ width: '55%' }} />
          <div className="skeleton-block skeleton-line" style={{ width: '80%' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="skeleton-post">
      <div className="skeleton-post-header">
        <div className="skeleton-block skeleton-avatar" />
        <div className="skeleton-conversation-text">
          <div className="skeleton-block skeleton-line" style={{ width: '35%' }} />
          <div className="skeleton-block skeleton-line" style={{ width: '20%', height: '10px' }} />
        </div>
      </div>
      <div className="skeleton-block skeleton-line" style={{ width: '100%' }} />
      <div className="skeleton-block skeleton-line" style={{ width: '70%' }} />
      <div className="skeleton-block skeleton-media" />
    </div>
  );
};

export default Skeleton;
