import type { Timeline } from 'vis-timeline/standalone';

/** 
 * Attach ⌘ + "=" to zoom in, ⌘ + "-" to zoom out. 
 */
export function attachZoomShortcuts(tl: Timeline) {
  window.addEventListener('keydown', (e) => {
    if (e.metaKey && e.key === '=') {
      tl.zoomIn(0.5);
    }
    if (e.metaKey && e.key === '-') {
      tl.zoomOut(0.5);
    }
  });
} 