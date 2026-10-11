import React from 'react';
import Icon from './Icon.jsx';
import { navigate } from '../lib/router.js';

function joinedText(iso) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

// The seller's public profile header, shown at the top of their shop page.
export default function ProfileHeader({ profile, isSeller, isOwnShop, onFollow, busy }) {
  const initial = (profile.shopName || '?').trim().charAt(0).toUpperCase();
  const joined = joinedText(profile.joined);
  return (
    <section className="profile-head">
      <div className="profile-avatar">
        {profile.avatar ? <img src={profile.avatar} alt={profile.shopName} /> : <span>{initial}</span>}
      </div>
      <div className="profile-main">
        <h1>{profile.shopName}</h1>
        <div className="profile-handle">@{profile.username}{joined ? ` · Joined ${joined}` : ''}</div>
        <div className="profile-stats">
          <span><b>{profile.productCount}</b> in stock</span>
          <span><b>{profile.followers}</b> {profile.followers === 1 ? 'follower' : 'followers'}</span>
          <span><b>{profile.totalLikes}</b> {profile.totalLikes === 1 ? 'like' : 'likes'}</span>
        </div>
        <div className="profile-actions">
          {isOwnShop ? (
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard')}>This is your shop · Edit profile</button>
          ) : !isSeller && (
            <button className={'btn btn-sm ' + (profile.following ? 'btn-ghost' : 'btn-primary')} disabled={busy} onClick={onFollow}>
              <Icon name={profile.following ? 'following' : 'follow'} size={15} /> {profile.following ? 'Following' : 'Follow'}
            </button>
          )}
          <a className="link-btn" href="#/"><Icon name="back" size={13} /> All shops</a>
        </div>
      </div>
    </section>
  );
}
