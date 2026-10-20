import React from 'react';
import { LogoMark } from './Logo.jsx';

// Full-screen branded loading screen.
export function Splash({ label = 'Loading' }) {
  return (
    <div className="splash" role="status" aria-live="polite">
      <LogoMark size={76} animated />
      <div className="splash-name">Crafts ni Yukiii</div>
      <div className="splash-label">{label}<span className="dots" aria-hidden="true"><i /><i /><i /></span></div>
    </div>
  );
}

export function Spinner({ size = 18, className = '' }) {
  return <span className={'spinner ' + className} style={{ width: size, height: size }} role="status" aria-label="Loading" />;
}

// Inside a panel or page while data loads.
export function PanelLoader({ label = 'Loading…' }) {
  return <div className="panel-loader" role="status"><Spinner /> <span>{label}</span></div>;
}

export function SkeletonRows({ rows = 4 }) {
  return (
    <div className="skel-rows" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div className="skel-row" key={i}>
          <div className="skeleton skel-circle" />
          <div style={{ flex: 1 }}>
            <div className="skeleton skel-line" style={{ width: (60 - (i % 3) * 12) + '%' }} />
            <div className="skeleton skel-line sm" style={{ width: (38 + (i % 2) * 14) + '%' }} />
          </div>
          <div className="skeleton skel-line" style={{ width: 56 }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats({ n = 4 }) {
  return (
    <div className="stat-grid" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <div className="stat-card" key={i}>
          <div className="skeleton skel-line sm" style={{ width: '50%' }} />
          <div className="skeleton skel-line lg" style={{ width: '70%', marginTop: 12 }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonGrid({ n = 8 }) {
  return (
    <div className="store-grid" aria-hidden="true" role="status" aria-label="Loading products">
      {Array.from({ length: n }, (_, i) => (
        <div className="store-card skel-card" key={i}>
          <div className="skeleton skel-media" />
          <div className="store-info">
            <div className="skeleton skel-line" style={{ width: '75%' }} />
            <div className="skeleton skel-line sm" style={{ width: '40%', marginTop: 8 }} />
            <div className="skeleton skel-line" style={{ width: '30%', marginTop: 10 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
