import { useState, useEffect, useCallback } from 'react';
import type { SnoozedTab } from '@/lib/snooze';

interface SnoozedSectionProps {
  onWake: () => void;
}

function formatWakeTime(wakeAt: number): string {
  const diff = wakeAt - Date.now();
  if (diff <= 0) return 'waking up...';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `in ${days}d`;
}

export function SnoozedSection({ onWake }: SnoozedSectionProps) {
  const [snoozedTabs, setSnoozedTabs] = useState<SnoozedTab[]>([]);
  const [collapsed, setCollapsed] = useState(true);

  const fetchSnoozed = useCallback(async () => {
    const response = await chrome.runtime.sendMessage({ type: 'get-snoozed' });
    if (response?.snoozedTabs) {
      setSnoozedTabs(response.snoozedTabs);
    }
  }, []);

  useEffect(() => {
    fetchSnoozed();
  }, [fetchSnoozed]);

  const cancelSnooze = useCallback(async (url: string, wakeAt: number) => {
    const response = await chrome.runtime.sendMessage({ type: 'cancel-snooze', payload: { url, wakeAt } });
    if (response?.snoozedTabs) {
      setSnoozedTabs(response.snoozedTabs);
    }
    // Re-open the tab now
    await chrome.tabs.create({ url, active: false });
    onWake();
  }, [onWake]);

  if (snoozedTabs.length === 0) return null;

  return (
    <div className="border-t border-white/[0.06]">
      <button
        onClick={() => setCollapsed((prev) => !prev)}
        aria-expanded={!collapsed}
        aria-label="Snoozed tabs"
        className="w-full flex items-center gap-2 px-4 py-2 text-[11px] text-white/40 hover:text-white/60 transition-colors"
      >
        <svg
          className={`w-3 h-3 transition-transform ${collapsed ? '' : 'rotate-90'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <svg className="w-3 h-3 text-purple-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Snoozed ({snoozedTabs.length})</span>
      </button>

      {!collapsed && (
        <div className="pb-1">
          {snoozedTabs.map((tab, i) => (
            <div
              key={`${tab.url}-${tab.wakeAt}-${i}`}
              className="flex items-center gap-3 px-5 py-1.5 group hover:bg-white/[0.04]"
            >
              <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                {tab.faviconUrl ? (
                  <img src={tab.faviconUrl} alt="" className="w-4 h-4 rounded-sm" />
                ) : (
                  <div className="w-4 h-4 rounded-sm bg-purple-400/20 flex items-center justify-center text-[8px] text-purple-400">
                    Z
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[12px] text-white/50 truncate block">{tab.title}</span>
              </div>
              <span className="text-[10px] text-purple-400/50 shrink-0">
                {formatWakeTime(tab.wakeAt)}
              </span>
              <button
                onClick={() => cancelSnooze(tab.url, tab.wakeAt)}
                className="text-[10px] text-white/30 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                title="Wake now"
              >
                Wake
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
