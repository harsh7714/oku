import React from 'react';
import './EmptyState.css';

const EmptyState = ({ icon: Icon, title, subtitle }) => {
  return (
    <div className="empty-state glass fade-in">
      {Icon && (
        <div className="empty-state-icon-wrap">
          <Icon size={32} className="empty-state-icon" />
        </div>
      )}
      <h3>{title}</h3>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
};

export default EmptyState;
