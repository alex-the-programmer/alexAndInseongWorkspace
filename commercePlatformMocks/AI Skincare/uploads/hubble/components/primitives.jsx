/* Hubble — shared UI primitives shared across screens */

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ─────────────────────────────────────────────────────────────
// Logo
function HubbleLogo({ size = 28, color }) {
  const c = color || 'currentColor';
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="15" stroke={c} strokeWidth="1.5" />
      <circle cx="16" cy="16" r="6" fill={c} />
      <circle cx="22" cy="10" r="2" fill="var(--coral)" />
    </svg>
  );
}

function HubbleWordmark({ height = 22, light = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <HubbleLogo size={height} color={light ? 'var(--ink)' : 'var(--paper)'} />
      <span className="font-display" style={{
        fontSize: height * 1.1, lineHeight: 1, letterSpacing: '-0.03em',
        color: light ? 'var(--ink)' : 'var(--paper)',
      }}>hubble</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Chat-bubble Avatar (the AI's "face")
function HubbleAvatar({ size = 32, mood = 'idle' }) {
  // Animated little orb
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'radial-gradient(circle at 35% 30%, var(--lime) 0%, var(--coral) 60%, var(--lilac) 100%)',
      position: 'relative', flexShrink: 0,
      boxShadow: mood === 'thinking' ? '0 0 24px var(--coral)' : '0 0 0 1px rgba(255,255,255,0.06)',
      animation: mood === 'thinking' ? 'orbpulse 1.4s ease-in-out infinite' : 'none',
    }}>
      <style>{`
        @keyframes orbpulse {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50%      { transform: scale(1.08); filter: brightness(1.2); }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Skin-tone-friendly product placeholder (no real images)
function ProductImage({ name, brand, tone = 'coral', size = 'md' }) {
  const toneMap = {
    coral:  ['#FFD4C8', '#FF6B47'],
    lime:   ['#EAFFA1', '#9BD132'],
    lilac:  ['#E4DCFE', '#A78BFA'],
    rose:   ['#FFD4DE', '#F08CA0'],
    sand:   ['#F0E6D2', '#C9B690'],
    sage:   ['#D6E8D4', '#84A87C'],
  };
  const [light, dark] = toneMap[tone] || toneMap.coral;
  const dims = size === 'sm' ? { w: 64, h: 80 } :
               size === 'lg' ? { w: 200, h: 240 } :
                               { w: 120, h: 150 };
  return (
    <div style={{
      width: dims.w, height: dims.h, borderRadius: 12,
      background: `linear-gradient(135deg, ${light} 0%, ${dark} 100%)`,
      position: 'relative', overflow: 'hidden', flexShrink: 0,
    }}>
      {/* fake bottle silhouette */}
      <div style={{
        position: 'absolute', left: '50%', top: '12%',
        transform: 'translateX(-50%)',
        width: dims.w * 0.45, height: dims.h * 0.75,
        background: 'rgba(255,255,255,0.18)',
        borderRadius: '8px 8px 6px 6px',
        backdropFilter: 'blur(2px)',
      }} />
      <div style={{
        position: 'absolute', left: '50%', top: '8%',
        transform: 'translateX(-50%)',
        width: dims.w * 0.22, height: dims.h * 0.06,
        background: 'rgba(0,0,0,0.2)', borderRadius: '4px 4px 0 0',
      }} />
      {brand && (
        <div className="font-mono" style={{
          position: 'absolute', bottom: 8, left: 8, right: 8,
          fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'rgba(0,0,0,0.65)', textAlign: 'center',
        }}>
          {brand}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Typing indicator
function TypingDots() {
  return (
    <div style={{ display: 'inline-flex', gap: 4, padding: '8px 4px' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--fg-dim)',
          animation: `bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
        }} />
      ))}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%           { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Star rating
function Stars({ value = 5, size = 12 }) {
  return (
    <div style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 16 16" fill={i <= value ? 'var(--coral)' : 'var(--ink-4)'}>
          <path d="M8 1l2.09 4.26L15 6l-3.5 3.4.83 4.85L8 12l-4.33 2.27L4.5 9.4 1 6l4.91-.74L8 1z" />
        </svg>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Icon set (minimal, drawn in SVG)
const Icon = ({ name, size = 16, color = 'currentColor', stroke = 1.6 }) => {
  const paths = {
    spark: <><path d="M12 2v6M12 16v6M2 12h6M16 12h6" /><path d="M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3" /></>,
    chat:  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
    user:  <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a7 7 0 0 1 16 0v1" /></>,
    plus:  <><path d="M12 5v14M5 12h14" /></>,
    arrow: <><path d="M5 12h14M13 5l7 7-7 7" /></>,
    arrowDown: <path d="M6 9l6 6 6-6" />,
    check: <path d="M5 13l4 4L19 7" />,
    x:     <><path d="M6 6l12 12M18 6L6 18" /></>,
    send:  <><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></>,
    cart:  <><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" /></>,
    heart: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
    bag:   <><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></>,
    chart: <><path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 5-5" /></>,
    grid:  <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></>,
    bot:   <><rect x="3" y="8" width="18" height="12" rx="2" /><circle cx="9" cy="14" r="1" /><circle cx="15" cy="14" r="1" /><path d="M12 2v6M9 4h6" /></>,
    tag:   <><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><circle cx="7" cy="7" r="1" fill="currentColor" /></>,
    survey: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 8h7M9 12h7M9 16h4" /></>,
    home:  <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-4v-8h-6v8H5a2 2 0 0 1-2-2z" /></>,
    menu:  <><path d="M3 6h18M3 12h18M3 18h18" /></>,
    sliders: <><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></>,
    sparkle: <path d="M12 2l1.6 4.6L18 8l-4.4 1.4L12 14l-1.6-4.6L6 8l4.4-1.4L12 2z" />,
    eye:   <><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></>,
    drop:  <path d="M12 2.5S5 10 5 14a7 7 0 0 0 14 0c0-4-7-11.5-7-11.5z" />,
    lock:  <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
    mail:  <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 7l10 7 10-7" /></>,
    google: <><path d="M22 12c0-.7-.06-1.36-.18-2H12v3.8h5.6c-.24 1.3-.97 2.4-2.06 3.14v2.6h3.34C20.84 17.74 22 15.1 22 12z" fill="#4285F4" stroke="none"/><path d="M12 22c2.7 0 4.96-.9 6.62-2.44l-3.34-2.6c-.93.62-2.12.99-3.28.99-2.52 0-4.66-1.7-5.42-4H3.13v2.5A10 10 0 0 0 12 22z" fill="#34A853" stroke="none"/><path d="M6.58 13.95A6 6 0 0 1 6.27 12c0-.68.12-1.34.31-1.95V7.55H3.13A10 10 0 0 0 2 12c0 1.62.39 3.15 1.13 4.5l3.45-2.55z" fill="#FBBC05" stroke="none"/><path d="M12 5.86c1.42 0 2.7.49 3.71 1.45l2.78-2.78A10 10 0 0 0 12 2 10 10 0 0 0 3.13 7.5l3.45 2.55c.76-2.3 2.9-4 5.42-4z" fill="#EA4335" stroke="none"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────
// Chip / Pill button
function Chip({ children, active, onClick, icon }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '8px 14px', borderRadius: 999,
      border: `1px solid ${active ? 'var(--coral)' : 'var(--border-2)'}`,
      background: active ? 'var(--coral)' : 'transparent',
      color: active ? 'var(--ink)' : 'var(--fg)',
      fontSize: 13, fontWeight: 500,
      transition: 'all .15s ease',
    }}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </button>
  );
}

// Expose globals
Object.assign(window, {
  HubbleLogo, HubbleWordmark, HubbleAvatar, ProductImage,
  TypingDots, Stars, Icon, Chip,
});
