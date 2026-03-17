import { useState, useEffect, useRef } from 'react';

export interface ToastData {
  id: string;
  type: 'error' | 'success' | 'info';
  message: string;
}

interface ToastProps extends ToastData {
  index: number;
  onDismiss: (id: string) => void;
}

const TINT: Record<ToastData['type'], { border: string; bg: string; text: string }> = {
  error: {
    border: 'rgba(255,100,100,0.25)',
    bg: 'rgba(255,100,100,0.10)',
    text: 'rgba(255,160,160,0.85)',
  },
  success: {
    border: 'rgba(147,210,255,0.25)',
    bg: 'rgba(147,210,255,0.10)',
    text: 'rgba(147,210,255,0.85)',
  },
  info: {
    border: 'rgba(255,255,255,0.10)',
    bg: 'rgba(255,255,255,0.07)',
    text: 'rgba(255,255,255,0.55)',
  },
};

const AUTO_DISMISS_MS = 4000;

export function Toast({ id, type, message, index, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const idRef = useRef(id);
  idRef.current = id;

  useEffect(() => {
    // Slide-in on mount
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });

    // Auto-dismiss
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismissRef.current(idRef.current), 150);
    }, AUTO_DISMISS_MS);

    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tint = TINT[type];

  return (
    <div
      className="fixed left-1/2 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl"
      style={{
        bottom: 72 + index * 52,
        zIndex: 2147483647,
        background: tint.bg,
        border: `1px solid ${tint.border}`,
        backdropFilter: 'blur(20px) saturate(160%)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
        opacity: visible ? 1 : 0,
        transform: visible
          ? 'translateX(-50%) translateY(0)'
          : 'translateX(-50%) translateY(8px)',
        transition: 'opacity 150ms ease-out, transform 150ms ease-out',
        pointerEvents: 'auto',
      }}
    >
      {/* Dismiss (X) button */}
      <button
        onClick={() => {
          setVisible(false);
          setTimeout(() => onDismiss(id), 150);
        }}
        className="w-5 h-5 flex items-center justify-center rounded text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors shrink-0"
        title="Dismiss"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <span className="text-[12px] whitespace-nowrap" style={{ color: tint.text }}>
        {message}
      </span>
    </div>
  );
}
