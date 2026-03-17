/**
 * Bridges toggle-hud / hide-hud messages between the content script (which loads
 * first) and the React HudOverlay component (which mounts asynchronously later).
 *
 * Without this, Alt+Q pressed during the gap between content script injection and
 * React mount is silently dropped — the background thinks the HUD is open but
 * React never received the message.
 *
 * Also shows an immediate frosted-glass loading overlay so the user gets instant
 * visual feedback even before React has mounted.
 */

let reactReady = false;
let pendingShow = false;
let loadingEl: HTMLElement | null = null;

function showLoadingOverlay(): void {
  if (loadingEl || typeof document === 'undefined') return;
  loadingEl = document.createElement('div');
  loadingEl.style.cssText =
    'position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;' +
    'justify-content:center;pointer-events:none;' +
    'background:rgba(0,0,0,0);backdrop-filter:blur(0px) saturate(100%);' +
    'transition:background 120ms ease-out,backdrop-filter 120ms ease-out';

  const spinner = document.createElement('div');
  spinner.style.cssText =
    'width:28px;height:28px;border-radius:50%;' +
    'border:2px solid rgba(255,255,255,0.08);border-top-color:rgba(255,255,255,0.4);' +
    'animation:_tf_spin 0.8s linear infinite';

  const css = document.createElement('style');
  css.textContent = '@keyframes _tf_spin{to{transform:rotate(360deg)}}';
  loadingEl.append(css, spinner);
  document.documentElement.appendChild(loadingEl);

  // Trigger the backdrop transition on the next frame
  requestAnimationFrame(() => {
    if (!loadingEl) return;
    loadingEl.style.background = 'rgba(0,0,0,0.45)';
    loadingEl.style.backdropFilter = 'blur(28px) saturate(180%)';
  });

  // Safety: auto-remove after 5s in case React never mounts (e.g. shadow DOM conflict)
  setTimeout(() => hideLoadingOverlay(), 5000);
}

export function hideLoadingOverlay(): void {
  loadingEl?.remove();
  loadingEl = null;
  // Also clean up the overlay injected from the background before the content script loaded
  document.getElementById('_tf_loading')?.remove();
}

/** Called by the early content-script listener. Buffers only while React isn't ready. */
export function handleEarlyToggle() {
  if (!reactReady) {
    pendingShow = !pendingShow;
    if (pendingShow) showLoadingOverlay();
    else hideLoadingOverlay();
  }
}

/** Called by the early content-script listener for hide-hud. */
export function handleEarlyHide() {
  if (!reactReady) {
    pendingShow = false;
    hideLoadingOverlay();
  }
}

/**
 * Called once by HudOverlay's mount useEffect.
 * Returns true if a toggle arrived before React was ready (HUD should open).
 * After this call, subsequent messages go directly to React's own listener.
 */
export function markReactReady(): boolean {
  reactReady = true;
  // Hand off: remove the loading overlay — the HUD's own backdrop fades in now.
  hideLoadingOverlay();
  const result = pendingShow;
  pendingShow = false;
  return result;
}
