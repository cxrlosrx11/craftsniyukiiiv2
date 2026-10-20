import React from 'react';
import Icon from './Icon.jsx';

// A friendlier "nothing here yet": icon, short title, one line of help, optional button.
export default function EmptyState({ icon = 'sparkles', title, children, action, onAction }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon name={icon} size={26} /></div>
      {title && <div className="empty-title">{title}</div>}
      {children && <p className="empty-text">{children}</p>}
      {action && <button className="btn btn-primary btn-sm" onClick={onAction}>{action}</button>}
    </div>
  );
}
