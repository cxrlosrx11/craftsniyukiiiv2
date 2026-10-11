import React from 'react';
import Icon from './Icon.jsx';

// Heart + count. `overlay` places it on top of a product photo.
export default function LikeButton({ liked, count, onClick, overlay = false, disabled = false }) {
  return (
    <button
      type="button"
      className={'like-btn' + (liked ? ' liked' : '') + (overlay ? ' overlay' : '')}
      aria-pressed={liked}
      aria-label={liked ? 'Unlike this product' : 'Like this product'}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick && onClick(e); }}
    >
      <Icon name="heart" size={16} fill={liked ? 'currentColor' : 'none'} />
      <span>{count || 0}</span>
    </button>
  );
}
