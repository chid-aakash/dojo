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
          ${format(e.start, 'PPP p')}
          ${e.end ? ' – ' + format(e.end, 'PPP p') : ''}
        `,
      })),
    );

    const timeline = new Timeline(container.current, ds, {
      start: '2025-01-01',    // Changed to January 2025
      end: '2031-01-01',      // Changed to January 2031
      
      // Enable horizontal scrolling/panning
      moveable: true,
      zoomable: true,
      
      // Editable options
      editable: { 
        add: true, 
        updateTime: true, 
        remove: true,
        updateGroup: false,
        overrideItems: false 
      },
      
      // Zoom limits
      zoomMin: 1000 * 60 * 15,                    // 15 minutes minimum
      zoomMax: 1000 * 60 * 60 * 24 * 365 * 6,    // 6 years maximum
      
      // Timeline behavior
      stack: false,
      tooltip: { followMouse: true },
      
      // Show current time as red line
      showCurrentTime: true,
      
      // Time formatting
      format: {
        minorLabels: {
          millisecond:'SSS',
          second:     's',
          minute:     'h:mm a',
          hour:       'h:mm a',
          weekday:    'ddd D',
          day:        'D',
          week:       'w',
          month:      'MMM',
          year:       'YYYY'
        },
        majorLabels: {
          millisecond:'h:mm:ss a',
          second:     'D MMMM h:mm a',
          minute:     'ddd D MMMM',
          hour:       'ddd D MMMM',
          weekday:    'MMMM YYYY',
          day:        'MMMM YYYY',
          week:       'MMMM YYYY',
          month:      'YYYY',
          year:       ''
        }
      },
      
      // Orientation
      orientation: 'top',
      
      // Mouse wheel behavior
      horizontalScroll: true,
      verticalScroll: false
    });

    attachZoomShortcuts(timeline);

    return () => timeline.destroy();
  }, [items]);

  return (
    <div className="w-full">
      <div className="mb-4 text-sm text-gray-600">
        <p>📌 <strong>Navigation:</strong> Drag to pan left/right • Mouse wheel to zoom • Cmd+/- for keyboard zoom</p>
        <p>✨ <strong>Add Events:</strong> Double-click anywhere on the timeline to create new events</p>
      </div>
      <div ref={container} className="h-[80vh] w-full border border-gray-300 rounded-lg" />
    </div>
  );
} 