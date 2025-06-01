import { Timeline, DataSet } from 'vis-timeline/standalone';
import 'vis-timeline/dist/vis-timeline-graph2d.css';
import { useEffect, useRef } from 'react';
import { useTimeline } from '../store';
import { format } from 'date-fns';
import { attachZoomShortcuts } from '../hooks/useZoom';

export default function DojoTimeline() {
  const container = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<Timeline | null>(null);
  const { items } = useTimeline();

  const goToCurrentTime = () => {
    if (timelineRef.current) {
      const now = new Date();
      timelineRef.current.moveTo(now);
    }
  };

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
      // Strict date range: 2025-2030 only
      start: '2025-01-01',
      end: '2030-12-31',
      min: '2025-01-01',      // Prevent going before 2025
      max: '2030-12-31',      // Prevent going after 2030
      
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
      
      // Mouse wheel behavior - disable built-in to use custom
      horizontalScroll: false,
      verticalScroll: false
    });

    // Store timeline reference
    timelineRef.current = timeline;

    // Custom mouse wheel handling for better control
    container.current.addEventListener('wheel', (event) => {
      event.preventDefault();
      event.stopPropagation();
      
      const deltaX = event.deltaX;
      const deltaY = event.deltaY;
      
      // Determine if this is primarily horizontal or vertical movement
      const isHorizontalScroll = Math.abs(deltaX) > Math.abs(deltaY);
      
      if (isHorizontalScroll) {
        // Horizontal scrolling - pan left/right
        const range = timeline.getWindow();
        const interval = range.end.getTime() - range.start.getTime();
        const moveBy = interval * (deltaX > 0 ? 0.1 : -0.1);
        
        const newStart = new Date(range.start.getTime() + moveBy);
        const newEnd = new Date(range.end.getTime() + moveBy);
        
        timeline.setWindow(newStart, newEnd);
      } else {
        // Vertical scrolling - zoom in/out
        const zoomFactor = 0.1;
        if (deltaY > 0) {
          timeline.zoomOut(zoomFactor);
        } else {
          timeline.zoomIn(zoomFactor);
        }
      }
    }, { passive: false });

    attachZoomShortcuts(timeline);

    return () => {
      timelineRef.current = null;
      timeline.destroy();
    };
  }, [items]);

  return (
    <div className="w-full h-full flex flex-col">
      {/* Go to Current Time Button - Outside timeline */}
      <div className="flex justify-end mb-4">
        <button
          onClick={goToCurrentTime}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-colors"
        >
          Go to Now
        </button>
      </div>
      
      {/* Timeline Container */}
      <div className="flex-1">
        <div ref={container} className="h-full w-full" />
      </div>
    </div>
  );
} 