import { useState } from 'react';
import type { RecentTab } from '@/lib/types';

interface RecentlyClosedSectionProps {
  recentTabs: RecentTab[];
  onRestore: (sessionId: string) => void;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function domainColor(domain: string): string {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360}, 60%, 65%)`;
}

function RecentTabItem({ tab, onRestore }: { tab: RecentTab; onRestore: (sessionId: string) => void }) {
  const [faviconError, setFaviconError] = useState(false);
  const domain = getDomain(tab.url);
  const color = domainColor(domain);

  return (
    <div
      className="group flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-white/[0.06] transition-colors"
      onClick={() => onRestore(tab.sessionId)}
    >
      <div className="w-6 h-6 shrink-0 flex items-center justify-center opacity-50">
        {tab.faviconUrl && !faviconError ? (
          <img
            src={tab.faviconUrl}
            alt=""
            className="w-4 h-4 rounded-sm"
            onError={() => setFaviconError(true)}
          />
        ) : (
          <div
            className="w-4 h-4 rounded-sm flex items-center justify-center text-[9px] font-bold"
            style={{ backgroundColor: color + '25', color }}
          >
            {domain.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-white/50 truncate">{tab.title}</div>
        <div className="text-[10px] text-white/25 truncate">{domain}</div>
      </div>

      <svg
        className="w-3.5 h-3.5 shrink-0 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" />
      </svg>
    </div>
  );
}

export function RecentlyClosedSection({ recentTabs, onRestore }: RecentlyClosedSectionProps) {
  const [expanded, setExpanded] = useState(false);

  if (recentTabs.length === 0) return null;

  return (
    <div className="border-t border-white/10">
      <button
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-label={`Recently closed tabs, ${recentTabs.length} items`}
        className="w-full flex items-center gap-2 px-5 py-2 text-[11px] text-white/40 hover:text-white/60 transition-colors"
      >
        <svg
          className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span>Recently closed ({recentTabs.length})</span>
        <span className="ml-auto text-[10px] font-mono">^⇧T restore</span>
      </button>

      {expanded && (
        <div className="pb-1">
          {recentTabs.map((tab) => (
            <RecentTabItem key={tab.sessionId} tab={tab} onRestore={onRestore} />
          ))}
        </div>
      )}
    </div>
  );
}
