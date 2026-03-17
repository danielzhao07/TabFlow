import { useState, useCallback, useMemo, useRef, useEffect, type Dispatch, type SetStateAction } from 'react';
import type { ToastData } from '@/components/hud/Toast';
import type { TabInfo, RecentTab, UndoRecord } from '@/lib/types';
import type { TabFlowSettings } from '@/lib/settings';
import { searchTabs } from '@/lib/fuse-search';
import { getSettings } from '@/lib/settings';
import { getFrecencyMap, computeScore } from '@/lib/frecency';
import type { TabBookmark } from '@/lib/bookmarks';
import { semanticSearch } from '@/lib/api-client';

export interface OtherWindow {
  windowId: number;
  tabCount: number;
  title: string;
  faviconUrl: string;
}

export interface HudState {
  // Visibility
  visible: boolean;
  setVisible: Dispatch<SetStateAction<boolean>>;
  animatingIn: boolean;
  setAnimatingIn: Dispatch<SetStateAction<boolean>>;
  hide: () => void;

  // Tabs
  tabs: TabInfo[];
  setTabs: Dispatch<SetStateAction<TabInfo[]>>;
  recentTabs: RecentTab[];
  setRecentTabs: Dispatch<SetStateAction<RecentTab[]>>;

  // Search + nav
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  selectedIndex: number;
  setSelectedIndex: Dispatch<SetStateAction<number>>;

  // Settings
  settings: TabFlowSettings | null;
  setSettings: Dispatch<SetStateAction<TabFlowSettings | null>>;

  // Window
  currentWindowId: number | undefined;
  setCurrentWindowId: Dispatch<SetStateAction<number | undefined>>;
  windowFilter: 'all' | 'current';
  setWindowFilter: Dispatch<SetStateAction<'all' | 'current'>>;
  otherWindows: OtherWindow[];
  setOtherWindows: Dispatch<SetStateAction<OtherWindow[]>>;

  // Multi-select
  selectedTabs: Set<number>;
  setSelectedTabs: Dispatch<SetStateAction<Set<number>>>;

  // Sort
  sortMode: 'mru' | 'domain' | 'title' | 'frecency';
  setSortMode: Dispatch<SetStateAction<'mru' | 'domain' | 'title' | 'frecency'>>;
  frecencyScores: Map<string, number>;
  setFrecencyScores: Dispatch<SetStateAction<Map<string, number>>>;

  // Bookmarks + notes
  bookmarkedUrls: Set<string>;
  setBookmarkedUrls: Dispatch<SetStateAction<Set<string>>>;
  notesMap: Map<string, string>;
  setNotesMap: Dispatch<SetStateAction<Map<string, string>>>;

  // UI state
  undoToast: { message: string } | null;
  setUndoToast: Dispatch<SetStateAction<{ message: string } | null>>;

  // Group filter (click a group pill to show only that group)
  groupFilter: Set<number>;
  setGroupFilter: Dispatch<SetStateAction<Set<number>>>;

  // Context menu
  contextMenu: { x: number; y: number; tabId: number } | null;
  setContextMenu: Dispatch<SetStateAction<{ x: number; y: number; tabId: number } | null>>;

  // Computed
  displayTabs: TabInfo[];
  duplicateMap: Map<string, number[]>;
  duplicateUrls: Set<string>;
  duplicateCount: number;
  isCommandMode: boolean;
  commandQuery: string;

  // Loading
  loading: boolean;
  setLoading: Dispatch<SetStateAction<boolean>>;

  // AI semantic search
  aiSearchLoading: boolean;

  // Thumbnails
  thumbnails: Map<number, string>;
  setThumbnails: Dispatch<SetStateAction<Map<number, string>>>;

  // Closing animation
  closingTabIds: Set<number>;
  setClosingTabIds: Dispatch<SetStateAction<Set<number>>>;

  // Undo stack
  undoStack: UndoRecord[];
  setUndoStack: Dispatch<SetStateAction<UndoRecord[]>>;

  // Fetch
  fetchTabs: () => Promise<void>;
  fetchRecentTabs: () => Promise<void>;
  loadUndoStack: () => void;
  // Deduplication ref: tracks tab IDs closed by the extension (so 'tab-removed' handler skips them)
  pendingExtensionCloseIdsRef: React.MutableRefObject<Set<number>>;

  // Generic toasts
  toasts: ToastData[];
  setToasts: Dispatch<SetStateAction<ToastData[]>>;
  addToast: (message: string, type?: 'error' | 'success' | 'info') => void;
}

export function useHudState(): HudState {
  const [visible, setVisible] = useState(false);
  const [animatingIn, setAnimatingIn] = useState(false);
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [settings, setSettings] = useState<TabFlowSettings | null>(null);
  const [recentTabs, setRecentTabs] = useState<RecentTab[]>([]);
  const [currentWindowId, setCurrentWindowId] = useState<number | undefined>();
  const [windowFilter, setWindowFilter] = useState<'all' | 'current'>('current');
  const [selectedTabs, setSelectedTabs] = useState<Set<number>>(new Set());
  const [sortMode, setSortMode] = useState<'mru' | 'domain' | 'title' | 'frecency'>('mru');
  const [frecencyScores, setFrecencyScores] = useState<Map<string, number>>(new Map());
  const [bookmarkedUrls, setBookmarkedUrls] = useState<Set<string>>(new Set());
  const [notesMap, setNotesMap] = useState<Map<string, string>>(new Map());
  const [undoToast, setUndoToast] = useState<{ message: string } | null>(null);
  const [otherWindows, setOtherWindows] = useState<OtherWindow[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: number } | null>(null);
  const [thumbnails, setThumbnails] = useState<Map<number, string>>(new Map());
  const [groupFilter, setGroupFilter] = useState<Set<number>>(new Set());
  const [closingTabIds, setClosingTabIds] = useState<Set<number>>(new Set());
  const [undoStack, setUndoStack] = useState<UndoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const pendingExtensionCloseIdsRef = useRef<Set<number>>(new Set());
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [aiSearchResults, setAiSearchResults] = useState<TabInfo[] | null>(null);
  const [aiSearchLoading, setAiSearchLoading] = useState(false);

  const addToast = useCallback((message: string, type: 'error' | 'success' | 'info' = 'info') => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    setToasts((prev) => [...prev.slice(-2), { id, type, message }]);
  }, []);

  // Track whether the initial storage load has completed so we don't overwrite
  // stored records with the empty initial state.
  const undoStackReady = useRef(false);

  const loadUndoStack = useCallback(() => {
    chrome.storage.local.get('tabflow_undo_stack').then((result) => {
      if (Array.isArray(result.tabflow_undo_stack)) {
        setUndoStack(result.tabflow_undo_stack as UndoRecord[]);
      }
      undoStackReady.current = true;
    }).catch(() => { undoStackReady.current = true; });
  }, []);

  // Load once on mount
  useEffect(() => { loadUndoStack(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist whenever the stack changes, but only after the initial load has completed
  // to avoid saving the empty initial state over real stored records.
  useEffect(() => {
    if (!undoStackReady.current) return;
    chrome.storage.local.set({ tabflow_undo_stack: undoStack }).catch(() => {});
  }, [undoStack]);


  const hide = useCallback(() => {
    setAnimatingIn(false);
    setContextMenu(null);
    setUndoToast(null);
    // Notify background IMMEDIATELY so the capture grace period starts at the
    // very beginning of the fade-out — prevents captureVisibleTab from ever
    // seeing the overlay, even during the 120ms CSS opacity transition.
    chrome.runtime.sendMessage({ type: 'hud-closed' }).catch(() => {});
    // Wait for the CSS fade-out to finish before removing the DOM
    setTimeout(() => {
      setVisible(false);
      setQuery('');
      setSelectedIndex(0);
      setSelectedTabs(new Set());
      setGroupFilter(new Set());
      setClosingTabIds(new Set());
    }, 120);
  }, []);

  const fetchTabs = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'get-tabs' });
      if (response?.tabs) setTabs(response.tabs);
      if (response?.currentWindowId) setCurrentWindowId(response.currentWindowId);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRecentTabs = useCallback(async () => {
    const response = await chrome.runtime.sendMessage({ type: 'get-recent' });
    if (response?.recentTabs) setRecentTabs(response.recentTabs);
  }, []);

  // Computed: window-filtered + sorted tabs
  const windowFilteredTabs = windowFilter === 'current' && currentWindowId
    ? tabs.filter((t) => t.windowId === currentWindowId)
    : tabs;

  const sortedTabs = useMemo(() => {
    const list = [...windowFilteredTabs];
    if (sortMode === 'domain') {
      list.sort((a, b) => {
        const da = domain(a.url);
        const db = domain(b.url);
        return da.localeCompare(db) || a.title.localeCompare(b.title);
      });
    } else if (sortMode === 'title') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortMode === 'frecency') {
      list.sort((a, b) => (frecencyScores.get(b.url) ?? 0) - (frecencyScores.get(a.url) ?? 0));
    }
    return list;
  }, [windowFilteredTabs, sortMode, frecencyScores]);

  // Duplicate detection
  const duplicateMap = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const tab of tabs) {
      if (!tab.url || tab.url === 'chrome://newtab/') continue;
      const existing = map.get(tab.url);
      if (existing) existing.push(tab.tabId);
      else map.set(tab.url, [tab.tabId]);
    }
    return map;
  }, [tabs]);

  const duplicateUrls = useMemo(() => {
    const set = new Set<string>();
    for (const [url, ids] of duplicateMap) {
      if (ids.length > 1) set.add(url);
    }
    return set;
  }, [duplicateMap]);

  const duplicateCount = useMemo(() => {
    let count = 0;
    for (const [, ids] of duplicateMap) {
      if (ids.length > 1) count += ids.length - 1;
    }
    return count;
  }, [duplicateMap]);

  const isCommandMode = query.startsWith('>');
  const commandQuery = isCommandMode ? query.slice(1).trim() : '';

  // Compute local Fuse.js results for use in the fallback check below
  const localResults = !query || isCommandMode
    ? sortedTabs
    : searchTabs(sortedTabs, query, settings?.searchThreshold, notesMap.size > 0 ? notesMap : undefined, duplicateUrls);

  // AI semantic search: auto-triggers as fallback when local search returns < 3 results
  // and the query is at least 3 characters. Debounced by 500ms to avoid spamming the API.
  useEffect(() => {
    const searchQuery = query.trim();
    // Only trigger semantic fallback when local results are sparse
    if (!searchQuery || searchQuery.length < 3 || isCommandMode || localResults.length >= 3) {
      setAiSearchResults(null);
      setAiSearchLoading(false);
      return;
    }
    setAiSearchLoading(true);
    const timer = setTimeout(() => {
      semanticSearch(searchQuery)
        .then((results) => {
          // Match semantic results against currently open tabs by URL
          const resultUrls = new Set(results.map((r) => r.url));
          const matched = tabs.filter((t) => resultUrls.has(t.url));
          // Sort matched tabs by the similarity order from the API
          const urlOrder = new Map(results.map((r, i) => [r.url, i]));
          matched.sort((a, b) => (urlOrder.get(a.url) ?? 999) - (urlOrder.get(b.url) ?? 999));
          setAiSearchResults(matched.length > 0 ? matched : null);
          setAiSearchLoading(false);
        })
        .catch(() => {
          setAiSearchResults(null);
          setAiSearchLoading(false);
        });
    }, 500);
    return () => clearTimeout(timer);
  }, [query, tabs, localResults.length, isCommandMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Merge: show local results, and if semantic search found extras, append them
  const filteredTabs = (() => {
    if (aiSearchResults && aiSearchResults.length > 0) {
      // Combine: local results first, then AI results not already in local
      const localIds = new Set(localResults.map((t) => t.tabId));
      const extras = aiSearchResults.filter((t) => !localIds.has(t.tabId));
      return [...localResults, ...extras];
    }
    return localResults;
  })();

  const groupFilteredTabs = groupFilter.size > 0
    ? filteredTabs.filter((t) => t.groupId != null && groupFilter.has(t.groupId))
    : filteredTabs;

  const displayTabs = settings?.maxResults
    ? groupFilteredTabs.slice(0, settings.maxResults)
    : groupFilteredTabs;

  return {
    visible, setVisible, animatingIn, setAnimatingIn, hide,
    tabs, setTabs, recentTabs, setRecentTabs,
    query, setQuery, selectedIndex, setSelectedIndex,
    settings, setSettings,
    currentWindowId, setCurrentWindowId,
    windowFilter, setWindowFilter,
    otherWindows, setOtherWindows,
    selectedTabs, setSelectedTabs,
    sortMode, setSortMode, frecencyScores, setFrecencyScores,
    bookmarkedUrls, setBookmarkedUrls,
    notesMap, setNotesMap,
    undoToast, setUndoToast,
    groupFilter, setGroupFilter,
    closingTabIds, setClosingTabIds,
    undoStack, setUndoStack,
    contextMenu, setContextMenu,
    thumbnails, setThumbnails,
    displayTabs, duplicateMap, duplicateUrls, duplicateCount,
    isCommandMode, commandQuery,
    fetchTabs, fetchRecentTabs, loadUndoStack,
    loading, setLoading,
    aiSearchLoading,
    pendingExtensionCloseIdsRef,
    toasts, setToasts, addToast,
  };
}

function domain(url: string): string {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
}

// Called once on open to load all async data — fires everything in parallel
export async function loadHudData(state: HudState) {
  try {
    const [settings, frecencyMap, bookmarksRes, notesRes, windowsRes] = await Promise.all([
      getSettings(),
      getFrecencyMap(),
      chrome.runtime.sendMessage({ type: 'get-bookmarks' }).catch(() => null),
      chrome.runtime.sendMessage({ type: 'get-notes' }).catch(() => null),
      chrome.runtime.sendMessage({ type: 'get-windows' }).catch(() => null),
    ]);
    state.setSettings(settings);
    const scores = new Map<string, number>();
    for (const [url, entry] of frecencyMap) scores.set(url, computeScore(entry));
    state.setFrecencyScores(scores);
    if (bookmarksRes?.bookmarks) {
      state.setBookmarkedUrls(new Set(bookmarksRes.bookmarks.map((b: TabBookmark) => b.url)));
    }
    if (notesRes?.notes) {
      state.setNotesMap(new Map(Object.entries(notesRes.notes)));
    }
    if (windowsRes?.windows) {
      state.setOtherWindows(windowsRes.windows);
    }
  } finally {
    state.setLoading(false);
  }
}
