import { Timeline, DataSet } from 'vis-timeline/standalone';
import 'vis-timeline/dist/vis-timeline-graph2d.css';
import { useEffect, useRef, useState } from 'react';
import { useTimeline } from '../store';
import { format, getWeek, startOfWeek, endOfWeek, startOfMonth, endOfMonth, getYear, startOfYear, endOfYear, startOfDay, endOfDay, startOfHour, endOfHour, getISOWeek, startOfISOWeek, endOfISOWeek, addDays, differenceInDays, addWeeks, isSameMonth } from 'date-fns';
import { attachZoomShortcuts } from '../hooks/useZoom';

export default function DojoTimeline() {
  const container = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<Timeline | null>(null);
  const { items } = useTimeline();

  // Exact 5 zoom levels now
  const ZOOM_LEVELS = [
    { 
      name: 'Years', 
      level: 1,
      calculateRange: (centerTime: Date) => {
        // Show 2025-2031
        return {
          start: new Date('2025-01-01'),
          end: new Date('2031-01-01')
        };
      }
    },
    { 
      name: 'Year → Months', 
      level: 2,
      calculateRange: (centerTime: Date) => {
        // Show all months of the year containing centerTime
        const year = getYear(centerTime);
        return {
          start: startOfYear(new Date(year, 0, 1)),
          end: endOfYear(new Date(year, 0, 1))
        };
      }
    },
    { 
      name: 'Month → Days',
      level: 3,
      calculateRange: (centerTime: Date) => {
        // Show a two-week (14-day) window based on ISO weeks around centerTime
        const currentIsoWeekStart = startOfISOWeek(centerTime);
        // Ensure we get a full two-week span. If centerTime is in week N, show week N and week N+1.
        const endOfNextIsoWeek = endOfISOWeek(addWeeks(currentIsoWeekStart, 1)); 
        return {
          start: currentIsoWeekStart,
          end: endOfNextIsoWeek
        };
      }
    },
    { 
      name: 'Day → Hours', 
      level: 4, // Was 5
      calculateRange: (centerTime: Date) => {
        // Show 24 hours of the day containing centerTime
        return {
          start: startOfDay(centerTime),
          end: endOfDay(centerTime)
        };
      }
    },
    { 
      name: 'Hour → 15min', 
      level: 5, // Was 6
      calculateRange: (centerTime: Date) => {
        // Show 60 minutes of the hour containing centerTime
        return {
          start: startOfHour(centerTime),
          end: endOfHour(centerTime)
        };
      }
    }
  ];

  // Use refs instead of state to prevent timeline recreation
  const currentZoomIndexRef = useRef(0);
  const isZoomInProgressRef = useRef(false);
  const lastMousePositionRef = useRef<{ x: number, timelineTime: number } | null>(null);
  
  // State only for UI updates
  const [currentZoomIndex, setCurrentZoomIndex] = useState(0);
  const [isZoomInProgress, setIsZoomInProgress] = useState(false);

  const goToCurrentTime = () => {
    if (timelineRef.current) {
      const now = new Date();
      timelineRef.current.moveTo(now);
    }
  };

  // Convert mouse X position to timeline time
  const getTimeFromMouseX = (mouseX: number) => {
    if (!timelineRef.current || !container.current) return null;
    
    const timelineRect = container.current.getBoundingClientRect();
    const relativeX = mouseX - timelineRect.left;
    const timelineWidth = timelineRect.width;
    
    const currentRange = timelineRef.current.getWindow();
    const totalTime = currentRange.end.getTime() - currentRange.start.getTime();
    const timeAtMouse = currentRange.start.getTime() + (relativeX / timelineWidth) * totalTime;
    
    return timeAtMouse;
  };

  // Get timeline format configuration based on zoom level with context preservation
  const getTimelineFormat = (zoomIndex: number) => {
    const levelConfig = ZOOM_LEVELS[zoomIndex];
    
    switch(levelConfig.level) {
      case 1: // Years only
        return {
          minorLabels: { year: 'YYYY' },
          majorLabels: { year: '' }, 
          showMajorLabels: false 
        };
      
      case 2: // Year → Months
        return {
          minorLabels: { month: 'MMM' },
          majorLabels: { month: 'YYYY' },
          showMajorLabels: true
        };
      
      case 3: // New: Month → Days
        return {
          minorLabels: { 
            day: 'ddd D'
          },
          majorLabels: function(date: Date, scale: string, step: number) {
            const jsDate = new Date(date); 
            if (isNaN(jsDate.getTime())) return '';
            // Label should be "Month Year W#"
            // Uses the month/year of the Monday starting the week.
            return format(jsDate, 'MMMM yyyy') + ' W' + getISOWeek(jsDate);
          },
          showMajorLabels: true
        };
      
      case 4: // New: Day → Hours (Old Level 5)
        return {
          minorLabels: { hour: 'h a' },
          majorLabels: { hour: 'ddd, MMM D, YYYY' },
          showMajorLabels: true
        };
      
      case 5: // New: Hour → 15min
        return {
          // minorLabels is now a function that will be called for each 15-min interval
          minorLabels: function(date: Date, scale: string, step: number) {
            const jsDate = new Date(date);
            if (isNaN(jsDate.getTime())) return '';
            // Format as h:mm a
            return format(jsDate, 'h:mm a');
          }, 
          majorLabels: {
            // Major label at hour boundaries, showing hour and date context
            hour: 'h a, ddd MMM D'
          },
          showMajorLabels: true
        };
      
      default:
        return { 
          minorLabels: {},
          majorLabels: {}, 
          showMajorLabels: true 
        };
    }
  };

  // Enhanced zoom to level function without week info overlay
  const zoomToLevel = (targetIndex: number, centerTime?: number) => {
    if (!timelineRef.current || isZoomInProgressRef.current) return;
    
    isZoomInProgressRef.current = true;
    setIsZoomInProgress(true);
    
    let focusTime = centerTime;
    if (!focusTime && lastMousePositionRef.current) {
      focusTime = lastMousePositionRef.current.timelineTime;
    }
    if (!focusTime) {
      const currentRange = timelineRef.current.getWindow();
      focusTime = (currentRange.start.getTime() + currentRange.end.getTime()) / 2;
    }
    
    try {
      const centerDate = new Date(focusTime);
      const { start: newStart, end: newEnd } = ZOOM_LEVELS[targetIndex].calculateRange(centerDate);
      
      const minDate = new Date('2025-01-01');
      const maxDate = new Date('2031-01-01');
      
      const finalStart = newStart < minDate ? minDate : newStart;
      const finalEnd = newEnd > maxDate ? maxDate : newEnd;
      
      const timelineFormatOptions = getTimelineFormat(targetIndex);
      const newOptions: any = {
        format: {
          minorLabels: timelineFormatOptions.minorLabels,
          majorLabels: timelineFormatOptions.majorLabels,
        },
        showMajorLabels: timelineFormatOptions.showMajorLabels, // Apply showMajorLabels
        timeAxis: {}, // Initialize timeAxis
      };

      const currentLevelConfig = ZOOM_LEVELS[targetIndex];
      switch (currentLevelConfig.level) {
        case 1: // Years
          newOptions.timeAxis = { scale: 'year', step: 1 };
          break;
        case 2: // Year -> Months
          newOptions.timeAxis = { scale: 'month', step: 1 };
          break;
        case 3: // New: Month -> Days
          newOptions.timeAxis = { scale: 'day', step: 1 };
          break;
        case 4: // New: Day -> Hours
          newOptions.timeAxis = { scale: 'hour', step: 1 };
          break;
        case 5: // New: Hour -> 15min
          newOptions.timeAxis = { scale: 'minute', step: 15 };
          // The format object is now fully defined by getTimelineFormat,
          // so no need to override minorLabels.minute or majorLabels.minute here.
          break;
        default:
          break;
      }
      
      timelineRef.current.setOptions(newOptions);
      timelineRef.current.setWindow(finalStart, finalEnd);
      
      currentZoomIndexRef.current = targetIndex;
      setCurrentZoomIndex(targetIndex);
      
      console.log(`Zoomed to Level ${targetIndex + 1}: ${ZOOM_LEVELS[targetIndex].name}`);
    } catch (error) {
      console.error('Error during zoom:', error);
    }
    
    setTimeout(() => {
      isZoomInProgressRef.current = false;
      setIsZoomInProgress(false);
    }, 300);
  };

  // Zoom in/out by one level
  const performZoom = (direction: 'in' | 'out', centerTime?: number) => {
    if (isZoomInProgressRef.current) return;
    
    let newZoomIndex;
    if (direction === 'in') {
      newZoomIndex = Math.min(currentZoomIndexRef.current + 1, ZOOM_LEVELS.length - 1);
    } else {
      newZoomIndex = Math.max(currentZoomIndexRef.current - 1, 0);
    }
    
    if (newZoomIndex !== currentZoomIndexRef.current) {
      zoomToLevel(newZoomIndex, centerTime);
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

    const initialTimelineFormatConfig = getTimelineFormat(0); // Get Level 1 format config

    const timeline = new Timeline(container.current, ds, {
      // Date range: 2025-2031
      start: '2025-01-01',
      end: '2031-01-01',
      min: '2025-01-01',      // Prevent going before 2025
      max: '2031-01-01',      // Prevent going after 2031
      
      // Enable horizontal scrolling/panning only
      moveable: true,
      zoomable: false,        // Completely disable built-in zoom
      
      // Editable options
      editable: { 
        add: true, 
        updateTime: true, 
        remove: true,
        updateGroup: false,
        overrideItems: false 
      },
      
      // Timeline behavior
      stack: false,
      tooltip: { followMouse: true },
      
      // Show current time as red line
      showCurrentTime: true,
      
      // Time formatting - start with years view (Level 1)
      format: {
        minorLabels: initialTimelineFormatConfig.minorLabels,
        majorLabels: initialTimelineFormatConfig.majorLabels,
      },
      showMajorLabels: initialTimelineFormatConfig.showMajorLabels, // Correctly apply for Level 1
      timeAxis: { scale: 'year', step: 1 }, // Ensure timeAxis is set for Level 1 initially
      
      // Orientation
      orientation: 'top',
      
      // Completely disable all built-in scroll/zoom behavior
      horizontalScroll: false,
      verticalScroll: false
    });

    // Store timeline reference
    timelineRef.current = timeline;

    // Initialize with the years view (Level 1)
    const initializeView = () => {
      timeline.setWindow(new Date('2025-01-01'), new Date('2031-01-01'));
      // The constructor should have already set the correct options for Level 1.
      // We just ensure the window is set.
      console.log(`Initialized view: Level 1: ${ZOOM_LEVELS[0].name}`);
    };

    // Initialize the view
    initializeView();

    // Fixed scroll handling with proper state management
    let scrollAccumulator = 0;
    const SCROLL_THRESHOLD = 60; // Reduced for more responsiveness

    // Mouse move tracking for zoom centering
    const handleMouseMove = (event: MouseEvent) => {
      const timeAtMouse = getTimeFromMouseX(event.clientX);
      if (timeAtMouse) {
        lastMousePositionRef.current = {
          x: event.clientX,
          timelineTime: timeAtMouse
        };
      }
    };

    // Enhanced wheel handling with fixed state management
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      
      const deltaX = event.deltaX;
      const deltaY = event.deltaY;
      
      // Detect gesture type
      const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
      const isVertical = Math.abs(deltaY) > Math.abs(deltaX);
      
      if (isVertical) {
        // Get time at current mouse position for centering
        const centerTime = getTimeFromMouseX(event.clientX);
        
        // Accumulate vertical scroll for zoom
        scrollAccumulator += deltaY;
        
        // Check if we've accumulated enough to trigger zoom
        if (Math.abs(scrollAccumulator) >= SCROLL_THRESHOLD) {
          // Use ref values to avoid stale state
          const currentIndex = currentZoomIndexRef.current;
          const inProgress = isZoomInProgressRef.current;
          
          if (!inProgress) {
            if (scrollAccumulator > 0) {
              // Zoom out
              const newIndex = Math.max(currentIndex - 1, 0);
              if (newIndex !== currentIndex) {
                zoomToLevel(newIndex, centerTime || undefined);
              }
            } else {
              // Zoom in
              const newIndex = Math.min(currentIndex + 1, ZOOM_LEVELS.length - 1);
              if (newIndex !== currentIndex) {
                zoomToLevel(newIndex, centerTime || undefined);
              }
            }
          }
          scrollAccumulator = 0; // Reset accumulator
        }
      } else if (isHorizontal) {
        // Handle horizontal panning
        const range = timeline.getWindow();
        const interval = range.end.getTime() - range.start.getTime();
        const moveBy = interval * (deltaX > 0 ? 0.02 : -0.02);
        
        const newStart = new Date(range.start.getTime() + moveBy);
        const newEnd = new Date(range.end.getTime() + moveBy);
        
        timeline.setWindow(newStart, newEnd);
      }
    };

    // Add event listeners
    container.current.addEventListener('mousemove', handleMouseMove);
    container.current.addEventListener('wheel', handleWheel, { passive: false });

    attachZoomShortcuts(timeline);

    return () => {
      // Clean up event listeners
      if (container.current) {
        container.current.removeEventListener('mousemove', handleMouseMove);
        container.current.removeEventListener('wheel', handleWheel);
      }
      timelineRef.current = null;
      timeline.destroy();
    };
  }, [items]); // Removed problematic dependencies

  return (
    <div className="w-full h-full flex flex-col relative">
      {/* Controls Row */}
      <div className="flex justify-between items-center mb-4">
        {/* Simple Zoom Level Display (Slider Commented Out) */}
        <div className="text-sm text-gray-400">
          <span className="font-medium">Level {currentZoomIndex + 1}: {ZOOM_LEVELS[currentZoomIndex].name}</span>
          <span className="ml-2 text-xs">(Use mouse wheel or Cmd+/- to zoom)</span>
        </div>

        {/* Commented out slider for now
        <div className="flex items-center gap-3 bg-gray-900 rounded-xl p-2 shadow-lg border border-gray-700">
          ... slider code ...
        </div>
        */}

        {/* Go to Current Time Button */}
        <button
          onClick={goToCurrentTime}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-colors"
        >
          Go to Now
        </button>
      </div>
      
      {/* Timeline Container */}
      <div className="flex-1 bg-gray-900 rounded-lg shadow-xl">
        <div ref={container} className="h-full w-full" />
      </div>
    </div>
  );
} 