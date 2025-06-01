import { Timeline, DataSet } from 'vis-timeline/standalone';
import 'vis-timeline/dist/vis-timeline-graph2d.css';
import { useEffect, useRef } from 'react';
import { useTimeline } from '../store';
import { format } from 'date-fns';
import { attachZoomShortcuts } from '../hooks/useZoom';

export default function DojoTimeline() {
  const container = useRef<HTMLDivElement>(null);
  const { items } = useTimeline();

  useEffect(() => {
    if (!container.current) return;

    // Map our TimelineItem[] → vis-timeline's DataSet format
    const ds = new DataSet(
      items.map((e) => ({
        id: e.id,
        content: e.title,
        start: e.start,
        end: e.end,
        className: e.status,   // "plan" vs "actual" → CSS colours
        title: `
          <b>${e.title}</b><br/>
          ${format(e.start, 'PPpp')}
          ${e.end ? ' – ' + format(e.end, 'PPpp') : ''}
        `,
      })),
    );

    const timeline = new Timeline(container.current, ds, {
      start: '2025-06-01',
      end:   '2030-06-01',
      editable: { add: true, updateTime: true, remove: true },
      zoomMin: 1000 * 60 * 15,               // 15 minutes in ms
      zoomMax: 1000 * 60 * 60 * 24 * 365 * 5, // 5 years in ms
      stack: false,
      tooltip: { followMouse: true },
    });

    attachZoomShortcuts(timeline);

    return () => timeline.destroy();
  }, [items]);

  return <div ref={container} className="h-[80vh] w-full" />;
} 