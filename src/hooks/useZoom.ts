import type { Timeline } from 'vis-timeline/standalone';

/**
 * Attach ⌘ + "=" to zoom in, ⌘ + "-" to zoom out with reduced sensitivity.
 * Returns cleanup function.
 */
export function attachZoomShortcuts(tl: Timeline, isDisabled?: () => boolean) {
  const handler = (e: KeyboardEvent) => {
    // Skip if disabled or modal is open
    if (isDisabled?.()) return;
    if (document.querySelector('[data-modal-open="true"]')) return;

    // Skip if typing in input/textarea/contenteditable
    const target = e.target as HTMLElement;
    const tag = target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;

    if (e.metaKey && e.key === '=') {
      tl.zoomIn(0.05);
    }
    if (e.metaKey && e.key === '-') {
      tl.zoomOut(0.05);
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
} 