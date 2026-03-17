import { useEffect, useMemo, useRef, useState } from 'react';
import type { TabInfo } from '@/lib/types';
import type { TabActions } from '@/lib/hooks/useTabActions';
import type { SmartSuggestion, GroupAddSuggestion } from '@/lib/group-utils';
import { getDomain, getGroupTitle, getSmartSuggestions, getGroupAddSuggestions } from '@/lib/group-utils';
import { useDragContext } from '@/lib/hooks/useDragContext';

const GROUP_COLORS: Record<string, string> = {
  blue: '#8ab4f8', cyan: '#78d9ec', green: '#81c995', yellow: '#fdd663',
  orange: '#fcad70', red: '#f28b82', pink: '#ff8bcb', purple: '#c58af9',
  grey: '#9aa0a6',
};

function colorNameFromHex(hex: string): string {
  for (const [name, value] of Object.entries(GROUP_COLORS)) {
    if (value === hex) return name;
  }
  return 'grey';
}

interface GroupSuggestionsProps {
  tabs: TabInfo[];
  actions: TabActions;
  selectedTabs?: Set<number>;
  groupFilter?: Set<number>;
  onGroupFilterToggle?: (groupId: number) => void;
}

export function GroupSuggestions({
  tabs, actions, selectedTabs, groupFilter, onGroupFilterToggle,
}: GroupSuggestionsProps) {
  const drag = useDragContext();
  const [hoveredId, setHoveredId] = useState<number | string | null>(null);
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [addSuggestions, setAddSuggestions] = useState<GroupAddSuggestion[]>([]);
  const descCacheRef = useRef<Record<number, string>>({});

  // Compute suggestions: first from titles only, then enhanced with descriptions
  useEffect(() => {
    const existingTitles = new Set<string>();
    for (const tab of tabs) {
      if (tab.groupId && tab.groupTitle) existingTitles.add(tab.groupTitle.toLowerCase());
    }
    const ungrouped = tabs.filter((t) => !t.groupId);
    const grouped = tabs.filter((t) => !!t.groupId);

    // Phase 1: immediate title-based suggestions
    setSuggestions(getSmartSuggestions(ungrouped, existingTitles));
    setAddSuggestions(getGroupAddSuggestions(ungrouped, grouped));

    // Phase 2: fetch descriptions and re-compute with richer context
    if (ungrouped.length < 2 && grouped.length === 0) return;
    const allTabIds = tabs.map((t) => t.tabId);
    // Only fetch descriptions for tabs we haven't cached yet
    const uncachedIds = allTabIds.filter((id) => !(id in descCacheRef.current));
    if (uncachedIds.length === 0) {
      // All cached — re-run with full descriptions immediately
      setSuggestions(getSmartSuggestions(ungrouped, existingTitles, descCacheRef.current));
      setAddSuggestions(getGroupAddSuggestions(ungrouped, grouped, descCacheRef.current));
      return;
    }
    let cancelled = false;
    chrome.runtime.sendMessage({ type: 'get-tab-descriptions', payload: { tabIds: uncachedIds } })
      .then((res) => {
        if (cancelled) return;
        const fetched: Record<number, string> = res?.descriptions ?? {};
        Object.assign(descCacheRef.current, fetched);
        setSuggestions(getSmartSuggestions(ungrouped, existingTitles, descCacheRef.current));
        setAddSuggestions(getGroupAddSuggestions(ungrouped, grouped, descCacheRef.current));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [tabs]);

  const existingGroups = useMemo(() => {
    const groups = new Map<number, { groupId: number; title: string; color: string; count: number }>();
    for (const tab of tabs) {
      if (!tab.groupId || !tab.groupColor) continue;
      const existing = groups.get(tab.groupId);
      if (existing) existing.count++;
      else groups.set(tab.groupId, {
        groupId: tab.groupId,
        title: tab.groupTitle || getDomain(tab.url),
        color: GROUP_COLORS[tab.groupColor] ?? '#9aa0a6',
        count: 1,
      });
    }
    return [...groups.values()].slice(0, 6);
  }, [tabs]);

  // Use intersection with current tabs — avoids stale IDs from closed tabs inflating the count
  const effectiveSelectedCount = tabs.filter((t) => selectedTabs?.has(t.tabId)).length;
  const hasMultiSelect = effectiveSelectedCount > 1;
  const hasGroupedInSelection = hasMultiSelect && tabs.some((t) => selectedTabs!.has(t.tabId) && !!t.groupId);

  if (suggestions.length === 0 && existingGroups.length === 0 && addSuggestions.length === 0 && !hasMultiSelect) return null;

  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 shrink-0 overflow-x-auto"
      style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.18)' }}
    >
      <span className="text-[9px] text-white/20 uppercase tracking-wider shrink-0 mr-1">Groups</span>

      {/* Existing groups */}
      {existingGroups.map((g) => {
        const isActive = groupFilter?.has(g.groupId) ?? false;
        const isHovered = hoveredId === g.groupId;

        return (
          <div
            key={g.groupId}
            className="flex items-stretch shrink-0 rounded-md overflow-hidden"
            style={{
              height: 26,
              background: isHovered || isActive ? g.color + '18' : g.color + '0c',
              border: `1px solid ${isActive ? g.color + '55' : isHovered ? g.color + '40' : g.color + '22'}`,
              boxShadow: isHovered ? `0 0 10px ${g.color}35` : 'none',
              transition: 'background 150ms, border-color 150ms, box-shadow 150ms',
            }}
            onMouseEnter={() => setHoveredId(g.groupId)}
            onMouseLeave={() => setHoveredId(null)}
            onDragOver={(e) => { e.preventDefault(); setHoveredId(g.groupId); }}
            onDragLeave={() => setHoveredId(null)}
            onDrop={(e) => {
              e.preventDefault();
              setHoveredId(null);
              if (drag.dragTabId != null) {
                const ids = drag.dragTabIds.length > 0 ? drag.dragTabIds : [drag.dragTabId];
                actions.addToGroup(ids, g.groupId, g.title, colorNameFromHex(g.color));
              }
            }}
          >
            {/* Colored left bar */}
            <div style={{ width: 3, background: g.color, opacity: isActive ? 1 : 0.7, flexShrink: 0 }} />

            {/* Filter button */}
            <button
              className="flex items-center gap-2 px-2.5"
              style={{ outline: 'none', cursor: 'pointer' }}
              onClick={() => onGroupFilterToggle?.(g.groupId)}
              title={isActive ? `Clear filter` : `Show only "${g.title}" tabs`}
            >
              <span className="text-[11px] font-medium" style={{ color: isActive ? g.color : 'rgba(255,255,255,0.65)' }}>
                {g.title}
              </span>
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                {g.count}
              </span>
            </button>

            {/* Dissolve button */}
            <button
              className="flex items-center justify-center px-2 transition-colors"
              style={{
                borderLeft: '1px solid rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.2)',
                outline: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#f28b82'; (e.currentTarget as HTMLElement).style.background = 'rgba(242,139,130,0.12)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              onClick={() => actions.dissolveGroup(g.groupId)}
              title={`Ungroup all "${g.title}" tabs`}
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}

      {/* Add-to-group suggestions */}
      {addSuggestions.length > 0 && existingGroups.length > 0 && (
        <div className="w-px h-3.5 bg-white/10 shrink-0 mx-0.5" />
      )}
      {addSuggestions.map((sg) => {
        const color = GROUP_COLORS[sg.groupColor] ?? '#9aa0a6';
        const isHovered = hoveredId === `add-${sg.groupId}`;
        return (
          <button
            key={`add-${sg.groupId}`}
            className="flex items-center gap-2 px-2.5 shrink-0 rounded-md transition-all"
            style={{
              height: 26,
              border: `1px solid ${isHovered ? color + '40' : color + '22'}`,
              background: isHovered ? color + '18' : color + '0c',
              boxShadow: isHovered ? `0 0 8px ${color}30` : 'none',
              transition: 'background 150ms, border-color 150ms, box-shadow 150ms',
              outline: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={() => setHoveredId(`add-${sg.groupId}`)}
            onMouseLeave={() => setHoveredId(null)}
            onDragOver={(e) => { e.preventDefault(); setHoveredId(`add-${sg.groupId}`); }}
            onDragLeave={() => setHoveredId(null)}
            onDrop={(e) => {
              e.preventDefault();
              setHoveredId(null);
              if (drag.dragTabId != null) {
                const ids = drag.dragTabIds.length > 0 ? drag.dragTabIds : [drag.dragTabId];
                actions.addToGroup(ids, sg.groupId, sg.groupTitle, sg.groupColor);
              }
            }}
            onClick={() => actions.addToGroup(sg.tabIds, sg.groupId, sg.groupTitle, sg.groupColor)}
            title={`Add ${sg.tabIds.length} tab${sg.tabIds.length > 1 ? 's' : ''} to "${sg.groupTitle}"`}
          >
            <span className="text-[11px] font-medium" style={{ color: isHovered ? color : 'rgba(255,255,255,0.55)' }}>
              + {sg.groupTitle}
            </span>
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {sg.tabIds.length}
            </span>
          </button>
        );
      })}

      {/* Divider */}
      {(existingGroups.length > 0 || addSuggestions.length > 0) && (suggestions.length > 0 || hasMultiSelect) && (
        <div className="w-px h-3.5 bg-white/10 shrink-0 mx-0.5" />
      )}

      {/* Multi-select actions */}
      {hasMultiSelect && (
        <>
          <button
            className="flex items-center gap-1.5 px-2.5 shrink-0 rounded-md transition-all"
            style={{
              height: 26,
              border: '1px solid rgba(255,255,255,0.10)',
              background: hoveredId === 'group-sel' ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)',
              boxShadow: hoveredId === 'group-sel' ? '0 0 8px rgba(255,255,255,0.08)' : 'none',
              transition: 'background 150ms, box-shadow 150ms',
              outline: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={() => setHoveredId('group-sel')}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => actions.groupSelectedTabs()}
            title={`Group ${effectiveSelectedCount} selected tabs`}
          >
            <span className="text-[11px] text-white/50">Group {effectiveSelectedCount}</span>
          </button>

          {hasGroupedInSelection && (
            <button
              className="flex items-center gap-1.5 px-2.5 shrink-0 rounded-md transition-all"
              style={{
                height: 26,
                border: '1px solid rgba(255,255,255,0.10)',
                background: hoveredId === 'ungroup-sel' ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)',
                boxShadow: hoveredId === 'ungroup-sel' ? '0 0 8px rgba(255,255,255,0.08)' : 'none',
                transition: 'background 150ms, box-shadow 150ms',
                outline: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={() => setHoveredId('ungroup-sel')}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => actions.ungroupSelectedTabs()}
              title={`Ungroup ${effectiveSelectedCount} selected tabs`}
            >
              <span className="text-[11px] text-white/50">Ungroup</span>
            </button>
          )}
        </>
      )}

      {/* Smart suggestions */}
      {suggestions.map((sg) => (
        <button
          key={sg.label}
          className="flex items-center gap-2 px-2.5 shrink-0 rounded-md transition-all"
          style={{
            height: 26,
            border: '1px solid rgba(255,255,255,0.07)',
            background: hoveredId === sg.label ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)',
            boxShadow: hoveredId === sg.label ? '0 0 8px rgba(255,255,255,0.06)' : 'none',
            transition: 'background 150ms, box-shadow 150ms',
            outline: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={() => setHoveredId(sg.label)}
          onMouseLeave={() => setHoveredId(null)}
          onDragOver={(e) => { e.preventDefault(); setHoveredId(sg.label); }}
          onDragLeave={() => setHoveredId(null)}
          onDrop={(e) => {
            e.preventDefault();
            setHoveredId(null);
            if (drag.dragTabId != null) {
              const ids = drag.dragTabIds.length > 0 ? drag.dragTabIds : [drag.dragTabId];
              const allIds = [...new Set([...sg.tabIds, ...ids])];
              actions.groupSuggestionTabs(allIds, sg.label);
            }
          }}
          onClick={() => actions.groupSuggestionTabs(sg.tabIds, sg.label)}
          title={`Group ${sg.tabIds.length} tabs → "${sg.label}"`}
        >
          <span className="text-[11px] text-white/35">{sg.label}</span>
          <span className="text-[10px] text-white/20">{sg.tabIds.length}</span>
        </button>
      ))}
    </div>
  );
}
