import { useEffect, useRef, useState } from 'react';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  action: () => void;
  danger?: boolean;
  divider?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

// ─── Icons — 15×15, 1.35px stroke, rounded caps ───────────────────────────
const Pin = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 2L13 6L8.5 10.5L7 14L1 8L5.5 6.5L9 2Z" />
    <line x1="7" y1="8" x2="1" y2="14" />
  </svg>
);

const Copy = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="5" width="8" height="8" rx="1.5" />
    <path d="M5 10H3A1.5 1.5 0 011.5 8.5V3A1.5 1.5 0 013 1.5H8.5A1.5 1.5 0 0110 3V5" />
  </svg>
);

const Window = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="9" height="8" rx="1.5" />
    <path d="M8 2H14V8" />
    <line x1="14" y1="2" x2="7.5" y2="8.5" />
  </svg>
);

const Reload = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1.5 7.5A6 6 0 0113 5" />
    <path d="M13.5 7.5A6 6 0 012 10" />
    <polyline points="10.5,2 13,5 10.5,8" />
    <polyline points="4.5,7 2,10 4.5,13" />
  </svg>
);

const X = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round">
    <line x1="3.5" y1="3.5" x2="11.5" y2="11.5" />
    <line x1="11.5" y1="3.5" x2="3.5" y2="11.5" />
  </svg>
);

const Grid = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="1" width="5" height="5" rx="1" />
    <rect x="9" y="1" width="5" height="5" rx="1" />
    <rect x="1" y="9" width="5" height="5" rx="1" />
    <rect x="9" y="9" width="5" height="5" rx="1" />
  </svg>
);

const Bookmark = ({ filled }: { filled?: boolean }) => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 2.5A1.5 1.5 0 014.5 1h6A1.5 1.5 0 0112 2.5v11l-4.5-2.5L3 13.5V2.5z" />
  </svg>
);

const Volume = ({ muted }: { muted?: boolean }) => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 5.5h2.5l3-3v10l-3-3H2V5.5z" />
    {muted ? (
      <>
        <line x1="10" y1="5" x2="14" y2="10" />
        <line x1="14" y1="5" x2="10" y2="10" />
      </>
    ) : (
      <>
        <path d="M10 4.5a5 5 0 010 6" />
        <path d="M12 2.5a8 8 0 010 10" />
      </>
    )}
  </svg>
);

export const MenuIcons = { Pin, Copy, Window, Reload, X, Grid, Bookmark, Volume };

// ─── Component ─────────────────────────────────────────────────────────────
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [origin, setOrigin] = useState('top left');

  // Close on outside click / Escape
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !e.composedPath().includes(ref.current as EventTarget)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  // Clamp to viewport, then set animation transform-origin to match the corner it grew from
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Cap maxHeight so the menu never exceeds the viewport
    el.style.maxHeight = `${vh - margin * 2}px`;

    const r = el.getBoundingClientRect();

    // Horizontal: open rightward, flip left if it would overflow
    let left = x;
    if (left + r.width > vw - margin) left = Math.max(margin, x - r.width);
    el.style.left = `${left}px`;

    // Vertical: open downward, flip upward if it would overflow; clamp to top margin
    let top = y;
    if (top + r.height > vh - margin) top = Math.max(margin, y - r.height);
    el.style.top = `${top}px`;

    setOrigin(`${top < y ? 'bottom' : 'top'} ${left < x ? 'right' : 'left'}`);
  }, [x, y]);

  // Build a flat item index that skips divider rows (for hover tracking + stagger delay)
  let flatIdx = -1;

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 2147483647,
        minWidth: 214,
        maxHeight: 'calc(90vh - 16px)',
        overflowY: 'auto',
        padding: '5px',
        borderRadius: 13,
        background: 'linear-gradient(155deg, rgba(28, 24, 52, 0.97) 0%, rgba(16, 14, 34, 0.97) 100%)',
        border: '1px solid rgba(255,255,255,0.13)',
        boxShadow: [
          '0 0 0 1px rgba(0,0,0,0.5)',
          '0 4px 16px rgba(0,0,0,0.45)',
          '0 28px 72px rgba(0,0,0,0.65)',
          'inset 0 1px 0 rgba(255,255,255,0.07)',
        ].join(', '),
        backdropFilter: 'blur(24px)',
        transformOrigin: origin,
        animation: 'contextMenuIn 150ms cubic-bezier(0.16, 1, 0.3, 1) both',
      }}
    >
      {items.map((item, i) => {
        flatIdx++;
        const fi = flatIdx;
        const isHover = active === fi;
        const isDanger = !!item.danger;

        return (
          <div key={i}>
            {item.divider && (
              <div style={{
                height: 1,
                margin: '4px 3px',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.09) 30%, rgba(255,255,255,0.09) 70%, transparent)',
              }} />
            )}

            <button
                onMouseEnter={() => setActive(fi)}
                onMouseLeave={() => setActive(null)}
                onClick={() => { item.action(); onClose(); }}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  height: 30,
                  // 15px left to leave room for the accent bar (3px) + space (9px) + icon
                  padding: '0 12px 0 15px',
                  borderRadius: 8,
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 13,
                  fontWeight: 440,
                  letterSpacing: '-0.013em',
                  fontFamily: 'inherit',
                  background: isHover
                    ? (isDanger
                        ? 'linear-gradient(90deg, rgba(255,75,65,0.14), rgba(255,75,65,0.08))'
                        : 'linear-gradient(90deg, rgba(140,120,255,0.10), rgba(255,255,255,0.05))')
                    : 'transparent',
                  color: isHover
                    ? (isDanger ? 'rgb(255, 110, 100)' : 'rgba(255,255,255,0.95)')
                    : (isDanger ? 'rgba(255, 100, 90, 0.65)' : 'rgba(255,255,255,0.56)'),
                  transition: 'background 110ms ease, color 110ms ease',
                  animation: `menuItemIn 160ms ease-out ${fi * 24}ms both`,
                }}
              >
                {/* Left accent bar — appears on hover */}
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: 4,
                    top: '20%',
                    bottom: '20%',
                    width: 3,
                    borderRadius: 2,
                    background: isDanger
                      ? 'rgba(255, 90, 80, 0.85)'
                      : 'rgba(160, 140, 255, 0.75)',
                    opacity: isHover ? 1 : 0,
                    transition: 'opacity 110ms ease',
                  }}
                />

                {/* Icon with glow on hover */}
                {item.icon && (
                  <span style={{
                    width: 15,
                    height: 15,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: isHover
                      ? (isDanger ? 'rgb(255,110,100)' : 'rgba(200,185,255,0.95)')
                      : 'currentColor',
                    opacity: isHover ? (isDanger ? 0.95 : 0.9) : 0.35,
                    transition: 'opacity 110ms ease, color 110ms ease, filter 110ms ease',
                    filter: isHover
                      ? (isDanger
                          ? 'drop-shadow(0 0 5px rgba(255,100,90,0.55))'
                          : 'drop-shadow(0 0 5px rgba(160,140,255,0.55))')
                      : 'none',
                  }}>
                    {item.icon}
                  </span>
                )}

                {item.label}
              </button>
          </div>
        );
      })}
    </div>
  );
}
