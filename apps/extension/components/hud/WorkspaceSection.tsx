import { useState, useRef, useEffect } from 'react';
import { getWorkspaces, saveWorkspace, updateWorkspace, deleteWorkspace, type Workspace } from '@/lib/workspaces';
import { useDragContext } from '@/lib/hooks/useDragContext';
import type { TabInfo } from '@/lib/types';
import type { TokenSet } from '@/lib/auth';

interface WorkspaceSectionProps {
  tabs: TabInfo[];
  onRestore?: () => void;
  authUser: TokenSet | null;
  onRequestSignIn?: () => void;
  addToast?: (message: string, type?: 'error' | 'success' | 'info') => void;
}

export function WorkspaceSection({ tabs, onRestore, authUser, onRequestSignIn, addToast }: WorkspaceSectionProps) {
  const drag = useDragContext();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [saving, setSaving] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dropWorkspaceId, setDropWorkspaceId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authUser) return;
    getWorkspaces().then(setWorkspaces).catch(() => {});
  }, [authUser]);

  useEffect(() => {
    if (showInput) inputRef.current?.focus();
  }, [showInput]);

  const buildTabData = (): Workspace['tabs'] =>
    tabs
      .filter((t) => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('about:'))
      .map((t) => ({ url: t.url, title: t.title, faviconUrl: t.faviconUrl ?? '', groupTitle: t.groupTitle, groupColor: t.groupColor }));

  const handleSave = async () => {
    const name = nameInput.trim();
    if (!name) return;
    setSaving(true);
    try {
      const ws = await saveWorkspace(name, buildTabData());
      setWorkspaces((prev) => [ws, ...prev]);
      setNameInput('');
      setShowInput(false);
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    const updated = await updateWorkspace(id, buildTabData()).catch(() => null);
    if (updated) setWorkspaces((prev) => prev.map((w) => w.id === id ? updated : w));
  };

  const handleRestore = (ws: Workspace) => {
    setRestoringId(ws.id);
    const urls = ws.tabs
      .map((t) => t.url)
      .filter((u) => u && !u.startsWith('chrome://') && !u.startsWith('chrome-extension://') && !u.startsWith('about:'));
    if (urls.length > 0) {
      chrome.runtime.sendMessage({ type: 'restore-workspace', urls, groups: ws.tabs });
    }
    if (onRestore) onRestore();
    setRestoringId(null);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await deleteWorkspace(id).catch(() => {});
    setWorkspaces((prev) => prev.filter((w) => w.id !== id));
    setDeletingId(null);
  };

  if (!authUser) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-1.5 shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.18)' }}
      >
        <span className="text-[9px] text-white/20 uppercase tracking-wider shrink-0 mr-1">Workspaces</span>
        <button
          onClick={onRequestSignIn}
          className="flex items-center gap-1.5 transition-colors"
          style={{ color: 'rgba(255,255,255,0.22)', outline: 'none' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.22)'; }}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <span className="text-[10px]">Sign in to save and restore workspaces</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 shrink-0 overflow-x-auto"
      style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.18)' }}
    >
      <span className="text-[9px] text-white/20 uppercase tracking-wider shrink-0 mr-1">Workspaces</span>

      {/* Workspace chips */}
      {workspaces.map((ws) => {
        const isHovered = hoveredId === ws.id;
        const isDragOver = dropWorkspaceId === ws.id;
        return (
          <div
            key={ws.id}
            className="flex items-stretch shrink-0 rounded-md overflow-hidden"
            style={{
              height: 26,
              background: isDragOver ? 'rgba(147,210,255,0.15)' : isHovered ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${isDragOver ? 'rgba(147,210,255,0.5)' : isHovered ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.08)'}`,
              boxShadow: isDragOver ? '0 0 16px rgba(147,210,255,0.45), 0 0 32px rgba(147,210,255,0.2)' : undefined,
              transform: isDragOver ? 'scale(1.06)' : undefined,
              transition: 'background 200ms, border-color 200ms, box-shadow 200ms, transform 200ms',
            }}
            onMouseEnter={() => setHoveredId(ws.id)}
            onMouseLeave={() => setHoveredId(null)}
            onDragOver={(e) => { e.preventDefault(); setDropWorkspaceId(ws.id); }}
            onDragLeave={() => setDropWorkspaceId(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDropWorkspaceId(null);
              if (drag.dragTabId != null) {
                const ids = drag.dragTabIds.length > 0 ? drag.dragTabIds : [drag.dragTabId];
                const tabsToAdd = ids.map((id) => tabs.find((t) => t.tabId === id)).filter(Boolean);
                if (tabsToAdd.length > 0) {
                  const newTabs = tabsToAdd.map((t) => ({
                    url: t!.url,
                    title: t!.title,
                    faviconUrl: t!.faviconUrl ?? '',
                    groupTitle: t!.groupTitle,
                    groupColor: t!.groupColor,
                  }));
                  const mergedTabs = [...ws.tabs, ...newTabs];
                  updateWorkspace(ws.id, mergedTabs)
                    .then((result) => {
                      if (result) {
                        setWorkspaces((prev) => prev.map((w) => w.id === ws.id ? result : w));
                        addToast?.(`Added ${tabsToAdd.length} tab${tabsToAdd.length > 1 ? 's' : ''} to "${ws.name}"`, 'success');
                      }
                    })
                    .catch(() => {
                      addToast?.('Failed to add to workspace', 'error');
                    });
                }
              }
            }}
          >
            {/* Restore button */}
            <button
              className="flex items-center gap-2 px-2.5"
              style={{ outline: 'none', cursor: 'pointer', opacity: restoringId === ws.id ? 0.5 : 1 }}
              onClick={() => handleRestore(ws)}
              disabled={restoringId === ws.id}
              title={`Restore "${ws.name}" (${ws.tabs.length} tabs)`}
            >
              {restoringId === ws.id ? (
                <div className="w-3 h-3 border border-white/20 border-t-white/50 rounded-full"
                     style={{ animation: 'spin 0.7s linear infinite' }} />
              ) : (
                /* Favicon stack */
                <div className="flex -space-x-1 shrink-0">
                  {ws.tabs.slice(0, 3).map((t, i) => (
                    <div key={i} className="w-3 h-3 rounded-sm bg-white/10 border border-white/[0.06] overflow-hidden shrink-0">
                      {t.faviconUrl && <img src={t.faviconUrl} alt="" className="w-full h-full object-cover" />}
                    </div>
                  ))}
                </div>
              )}
              <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>{ws.name}</span>
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{ws.tabs.length}</span>
            </button>

            {/* Update button */}
            <button
              className="flex items-center justify-center px-1.5"
              style={{
                borderLeft: '1px solid rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.2)',
                outline: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#81c995'; (e.currentTarget as HTMLElement).style.background = 'rgba(129,201,149,0.12)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              onClick={() => handleUpdate(ws.id)}
              title={`Update "${ws.name}" with current tabs`}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
            </button>

            {/* Delete button */}
            <button
              className="flex items-center justify-center px-1.5"
              style={{
                borderLeft: '1px solid rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.2)',
                outline: 'none',
                cursor: 'pointer',
                opacity: deletingId === ws.id ? 0.5 : 1,
              }}
              onMouseEnter={(e) => { if (deletingId !== ws.id) { (e.currentTarget as HTMLElement).style.color = '#f28b82'; (e.currentTarget as HTMLElement).style.background = 'rgba(242,139,130,0.12)'; } }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              onClick={() => handleDelete(ws.id)}
              disabled={deletingId === ws.id}
              title={`Delete "${ws.name}"`}
            >
              {deletingId === ws.id ? (
                <div className="w-3 h-3 border border-white/20 border-t-white/50 rounded-full"
                     style={{ animation: 'spin 0.7s linear infinite' }} />
              ) : (
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              )}
            </button>
          </div>
        );
      })}

      {/* Save / Input */}
      {showInput ? (
        <div className="flex items-center gap-1 shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') { setShowInput(false); setNameInput(''); }
            }}
            data-no-hud-escape="true"
            placeholder="Name…"
            className="bg-white/[0.08] border border-white/[0.14] rounded-md px-2 text-[11px] text-white/80 placeholder-white/25 outline-none"
            style={{ height: 26, width: 90 }}
          />
          <button
            onClick={handleSave}
            disabled={saving || !nameInput.trim()}
            className="px-2 rounded-md bg-white/[0.08] border border-white/[0.12] text-[10px] text-white/50 hover:bg-white/[0.12] disabled:opacity-40 transition-colors"
            style={{ height: 26 }}
          >
            {saving ? '…' : 'Save'}
          </button>
          <button
            onClick={() => { setShowInput(false); setNameInput(''); }}
            className="text-white/25 hover:text-white/50 text-[10px]"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          className="flex items-center justify-center rounded-md text-[13px] text-white/25 hover:text-white/55 transition-colors shrink-0"
          style={{
            height: 26,
            width: 26,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
          onClick={() => setShowInput(true)}
          title="Save current tabs as workspace"
        >
          +
        </button>
      )}
    </div>
  );
}
