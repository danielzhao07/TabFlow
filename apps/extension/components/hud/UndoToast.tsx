import { useState, useEffect, useRef } from 'react';

interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  duration?: number;
}

export function UndoToast({ message, onUndo, onDismiss, duration = 5000 }: UndoToastProps) {
  const [progress, setProgress] = useState(100);
  const [visible, setVisible] = useState(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });

    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        setVisible(false);
        setTimeout(() => onDismissRef.current(), 150);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [duration]); // onDismiss intentionally excluded — using ref to avoid timer restarts

  return (
    <div
      className="fixed left-1/2 flex items-center gap-3 px-4 py-2.5 rounded-2xl overflow-hidden"
      style={{
        // Sits above the bottom bar (~56px) with a small gap
        bottom: 72,
        zIndex: 2147483647,
        background: 'rgba(255,255,255,0.07)',
        border: '1px solid rgba(255,255,255,0.10)',
        backdropFilter: 'blur(20px) saturate(160%)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(8px)',
        transition: 'opacity 150ms ease-out, transform 150ms ease-out',
      }}
    >
      {/* Dismiss (X) button */}
      <button
        onClick={() => { setVisible(false); setTimeout(onDismiss, 150); }}
        className="w-5 h-5 flex items-center justify-center rounded text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors shrink-0"
        title="Dismiss"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <span className="text-[12px] text-white/55 whitespace-nowrap">{message}</span>

      <button
        onClick={() => {
          onUndo();
          setVisible(false);
          setTimeout(onDismiss, 150);
        }}
        className="text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors"
        style={{
          color: 'rgba(147,210,255,0.8)',
          background: 'rgba(147,210,255,0.08)',
          border: '1px solid rgba(147,210,255,0.15)',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(147,210,255,0.15)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(147,210,255,0.08)';
        }}
      >
        Undo
      </button>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full"
          style={{
            width: `${progress}%`,
            background: 'rgba(147,210,255,0.35)',
            transition: 'width 50ms linear',
          }}
        />
      </div>
    </div>
  );
}
