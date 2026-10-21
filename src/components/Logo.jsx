import React, { useId } from 'react';

// The Crafts ni Yukiii mark: a stitched heart patch with a sparkle.
export function LogoMark({ size = 32, animated = false, className = '' }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className={'logo-mark ' + className + (animated ? ' is-animated' : '')} width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Crafts ni Yukiii">
      <defs>
        <linearGradient id={'g' + id} x1="8" y1="4" x2="58" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F472B6" /><stop offset="0.55" stopColor="#EC4899" /><stop offset="1" stopColor="#BE185D" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#g${id})`} />
      <circle cx="54" cy="8" r="22" fill="#fff" opacity=".1" />
      <g transform="translate(32 35) scale(0.86) translate(-32 -31)">
        <path d="M32 50C14 38 10 27 10 21C10 15 14.5 11.5 20 11.5C25 11.5 29.5 14 32 19C34.5 14 39 11.5 44 11.5C49.5 11.5 54 15 54 21C54 27 50 38 32 50Z" fill="#fff" />
        <path className="logo-stitch" transform="translate(32 29.5) scale(0.72) translate(-32 -29.5)" d="M32 50C14 38 10 27 10 21C10 15 14.5 11.5 20 11.5C25 11.5 29.5 14 32 19C34.5 14 39 11.5 44 11.5C49.5 11.5 54 15 54 21C54 27 50 38 32 50Z" fill="none" stroke="#EC4899" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="4.6 4.2" />
      </g>
      <path className="logo-spark" d="M51.5 9L53.1 13.1L57.2 14.7L53.1 16.3L51.5 20.4L49.9 16.3L45.8 14.7L49.9 13.1Z" fill="#fff" />
    </svg>
  );
}

// Mark + wordmark. `href` makes the whole logo a link.
export default function Logo({ size = 34, text = true, href, className = '' }) {
  const inner = (
    <>
      <LogoMark size={size} />
      {text && <span className="logo-word"><b>Crafts</b> ni Yukiii</span>}
    </>
  );
  return href
    ? <a className={'logo ' + className} href={href} aria-label="Crafts ni Yukiii home">{inner}</a>
    : <span className={'logo ' + className}>{inner}</span>;
}
