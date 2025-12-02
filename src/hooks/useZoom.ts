import type { Timeline } from 'vis-timeline/standalone';

/**
 * Attach ⌘ + "=" to zoom in, ⌘ + "-" to zoom out with reduced sensitivity.
 * Returns cleanup function.
 */
export function attachZoomShortcuts(tl: Timeline, isDisabled?: () => boolean) {
  const handler = (e: KeyboardEvent) => {
    // Skip if disabled or modal is open
    if (isDisabled?.()) {
      console.log('[useZoom] blocked by isDisabled');
      return;
    }
    if (document.querySelector('[data-modal-open="true"]')) {
      console.log('[useZoom] blocked by data-modal-open');
      return;
    }

    // Skip if typing in input/textarea
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      console.log('[useZoom] blocked by input/textarea');
      return;
    }

    if (e.metaKey && e.key === '=') {
      console.log('[useZoom] PROCESSING zoom in');
      tl.zoomIn(0.05);
    }
    if (e.metaKey && e.key === '-') {
      console.log('[useZoom] PROCESSING zoom out');
      tl.zoomOut(0.05);
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
} 