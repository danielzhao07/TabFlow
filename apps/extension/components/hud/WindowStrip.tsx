import { useState } from 'react';
import type { OtherWindow } from '@/lib/hooks/useHudState';
import type { TabActions } from '@/lib/hooks/useTabActions';
import { useDragContext } from '@/lib/hooks/useDragContext';

interface WindowStripProps {
  windows: OtherWindow[];
  currentWindowId: number | undefined;
  actions: TabActions;
}

export function WindowStrip({ windows, currentWindowId, actions }: WindowStripProps) {
  const drag = useDragContext();
  const [dropWindowId, setDropWindowId] = useState<number | null>(null);

  // Only show strip when there are multiple windows
  if (windows.length <= 1) return null;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 border-t border-white/[0.06] overflow-x-auto shrink-0"
      style={{ background: 'rgba(0,0,0,0.25)' }}
    >
      {windows.map((w) => {
        const isCurrent = w.windowId === currentWindowId;
        const isDropTarget = dropWindowId === w.windowId;
        return (
          <button
            key={w.windowId}
            onClick={() => {
              if (!isCurrent) {
                chrome.runtime.sendMessage({ type: 'focus-window', payload: { windowId: w.windowId } });
              }
            }}
            onDragOver={(e) => { e.preventDefault(); setDropWindowId(w.windowId); }}
            onDragLeave={() => setDropWindowId(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDropWindowId(null);
              if (drag.dragTabId != null && !isCurrent) {
                const ids = drag.dragTabIds.length > 0 ? drag.dragTabIds : [drag.dragTabId];
                for (const id of ids) {
                  actions.moveToWindow(id, w.windowId);
                }
              }
            }}
            aria-label={`Window: ${w.title}, ${w.tabCount} tabs${isCurrent ? ', current window' : ''}`}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg shrink-0 border transition-colors ${
              isCurrent
                ? 'bg-cyan-400/10 border-cyan-400/25 text-white/70 cursor-default'
                : 'bg-white/[0.04] border-white/[0.07] text-white/35 hover:bg-white/[0.08] hover:text-white/60 hover:border-white/[0.15]'
            }`}
            style={{
              boxShadow: isDropTarget ? '0 0 12px rgba(120,217,236,0.5)' : undefined,
              borderColor: isDropTarget
                ? 'rgba(120,217,236,0.6)'
                : undefined,
            }}
          >
            {w.faviconUrl ? (
              <img src={w.faviconUrl} alt="" className="w-3.5 h-3.5 rounded-sm shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div className="w-3.5 h-3.5 rounded-sm bg-white/15 shrink-0" />
            )}
            <span className="text-[11px] truncate max-w-[140px]">{w.title}</span>
            <span className="text-[10px] text-white/20 shrink-0 ml-0.5">{w.tabCount}</span>
            {isCurrent && (
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 shrink-0" />
            )}
          </button>
        );
      })}
    </div>
  );
}
