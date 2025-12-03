import { useEffect, useRef, useState } from "react";
import { useTimeline } from "../store";
import { format } from "date-fns";
import { ZOOM_LEVELS, getTimelineFormat } from "../config/timelineConfig";
import { attachZoomShortcuts } from "../hooks/useZoom";
import TimelineContextBulletin from "./TimelineContextBulletin";
import type { TimelineItem } from "../types";
import { useTasks } from "../storeTasks";
import type { TaskItem } from "../storeTasks";
import "vis-timeline/dist/vis-timeline-graph2d.css";

// Start preloading vis-timeline immediately when module loads
const timelinePromise = import("vis-timeline/standalone");

interface DojoTimelineProps {
  onOpenDiary?: (id: string) => void;
  disableShortcuts?: boolean;
}

export default function DojoTimeline({ onOpenDiary, disableShortcuts }: DojoTimelineProps) {
  const container = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<any>(null);
  const { items } = useTimeline();
  const { tasks } = useTasks();
  // Keep original items ref for aggregation
  const itemsRef = useRef<TimelineItem[]>(items);
  const [isTimelineReady, setIsTimelineReady] = useState(false);

  // Ref to track disableShortcuts for event handlers
  const disableShortcutsRef = useRef(disableShortcuts);
  disableShortcutsRef.current = disableShortcuts;

  // ZOOM_LEVELS definition moved to src/config/timelineConfig.ts

  // Use refs instead of state to prevent timeline recreation
  const currentZoomIndexRef = useRef(0);
  const isZoomInProgressRef = useRef(false);
  const syncWithStoreRef = useRef<(() => void) | null>(null);
  const lastMousePositionRef = useRef<{
    x: number;
    timelineTime: number;
  } | null>(null);

  // State only for UI updates
  const [currentZoomIndex, setCurrentZoomIndex] = useState(0);
  const [zoomLocked, setZoomLocked] = useState(false);
  const zoomLockedRef = useRef(false);
  // Keep ref in sync with state
  zoomLockedRef.current = zoomLocked;

  const [visibleTasks, setVisibleTasks] = useState<TaskItem[]>([]);
  const [edgeZone, setEdgeZone] = useState<'left' | 'right' | null>(null);
  const [edgeIntensity, setEdgeIntensity] = useState(0);
  const [pressedButton, setPressedButton] = useState<string | null>(null);

  // Flash button press feedback
  const flashButton = (buttonId: string) => {
    setPressedButton(buttonId);
    setTimeout(() => setPressedButton(null), 100);
  };

  const refreshVisibleTasks = () => {
    if (!timelineRef.current) return;
    const win = timelineRef.current.getWindow();
    const start = win.start as Date;
    const end = win.end as Date;
    const filtered = tasks.filter(
      (t) =>
        t.date.getTime() >= start.getTime() && t.date.getTime() <= end.getTime()
    );
    setVisibleTasks(filtered);
  };

  const goToCurrentTime = () => {
    if (timelineRef.current) {
      const now = new Date();
      timelineRef.current.moveTo(now);
    }
  };

  // Refresh diary entries from API
  const refreshFromApi = async () => {
    try {
      const res = await fetch("/api/dd");
      if (!res.ok) return;
      const json = await res.json();
      const data: { id: string; timestamp: string; content: string }[] =
        json.entries || json;

      const upsert = useTimeline.getState().upsert;
      data.forEach((note) => {
        upsert({
          id: `dd-${note.id}`,
          title: "📔",
          start: new Date(note.id),
          status: "diary" as const,
          notes: note.content,
        });
      });
      console.log('[Timeline] Refreshed from API, entries:', data.length);
    } catch {
      console.log('[Timeline] Failed to refresh from API');
    }
  };

  // Min/max visible range per zoom level (in milliseconds)
  // Constrained so labels stay readable at all zoom levels
  const LEVEL_ZOOM_BOUNDS = {
    1: { min: 3 * 365 * 24 * 60 * 60 * 1000, max: 20 * 365 * 24 * 60 * 60 * 1000 },   // years: 3yrs - 20yrs
    2: { min: 3 * 30 * 24 * 60 * 60 * 1000, max: 18 * 30 * 24 * 60 * 60 * 1000 },     // months: 3mo - 18mo
    3: { min: 3 * 24 * 60 * 60 * 1000, max: 30 * 24 * 60 * 60 * 1000 },               // days: 3days - 30days
    4: { min: 3 * 60 * 60 * 1000, max: 48 * 60 * 60 * 1000 },                         // hours: 3hrs - 48hrs
    5: { min: 45 * 60 * 1000, max: 6 * 60 * 60 * 1000 },                              // minutes: 45min - 6hrs
  };

  // Smooth freeform zoom (for scroll when locked)
  const smoothZoomLevel = (factor: number, centerTime?: number) => {
    if (!timelineRef.current) return;
    const win = timelineRef.current.getWindow();
    const center = centerTime ?? (win.start.getTime() + win.end.getTime()) / 2;
    const range = win.end.getTime() - win.start.getTime();
    const level = currentZoomIndexRef.current + 1;
    const bounds = LEVEL_ZOOM_BOUNDS[level as keyof typeof LEVEL_ZOOM_BOUNDS];
    const newRange = Math.max(bounds.min, Math.min(range * factor, bounds.max));
    const minDate = new Date("1999-01-01T00:00:00").getTime();
    const maxDate = new Date("2099-12-31T23:59:59").getTime();
    let newStart = center - newRange / 2;
    let newEnd = center + newRange / 2;
    if (newStart < minDate) { newStart = minDate; newEnd = minDate + newRange; }
    if (newEnd > maxDate) { newEnd = maxDate; newStart = maxDate - newRange; }
    timelineRef.current.setWindow(new Date(newStart), new Date(newEnd), { animation: false });
  };
  const smoothZoomLevelRef = useRef(smoothZoomLevel);
  smoothZoomLevelRef.current = smoothZoomLevel;

  // Zoom in/out - behavior depends on lock state
  // Always centers on the middle of the visible timeline (not mouse position)
  const zoomInLevel = () => {
    if (!timelineRef.current) return;
    const win = timelineRef.current.getWindow();
    const windowCenter = (win.start.getTime() + win.end.getTime()) / 2;

    if (zoomLockedRef.current) {
      // Locked: zoom within level
      smoothZoomLevel(0.5, windowCenter);
    } else {
      // Unlocked: change to next level
      const newIndex = Math.min(currentZoomIndexRef.current + 1, ZOOM_LEVELS.length - 1);
      if (newIndex !== currentZoomIndexRef.current) {
        zoomToLevel(newIndex, windowCenter);
      }
    }
  };

  const zoomOutLevel = () => {
    if (!timelineRef.current) return;
    const win = timelineRef.current.getWindow();
    const windowCenter = (win.start.getTime() + win.end.getTime()) / 2;

    if (zoomLockedRef.current) {
      // Locked: zoom within level
      smoothZoomLevel(2, windowCenter);
    } else {
      // Unlocked: change to previous level
      const newIndex = Math.max(currentZoomIndexRef.current - 1, 0);
      if (newIndex !== currentZoomIndexRef.current) {
        zoomToLevel(newIndex, windowCenter);
      }
    }
  };


  const toggleZoomLock = () => {
    setZoomLocked((prev) => !prev);
  };

  // Convert mouse X position to timeline time
  const getTimeFromMouseX = (mouseX: number) => {
    if (!timelineRef.current || !container.current) return null;

    const timelineRect = container.current.getBoundingClientRect();
    const relativeX = mouseX - timelineRect.left;
    const timelineWidth = timelineRect.width;

    const currentRange = timelineRef.current.getWindow();
    const totalTime = currentRange.end.getTime() - currentRange.start.getTime();
    const timeAtMouse =
      currentRange.start.getTime() + (relativeX / timelineWidth) * totalTime;

    return timeAtMouse;
  };

  // getTimelineFormat moved to src/config/timelineConfig.ts

  // Enhanced zoom to level function without week info overlay
  const zoomToLevel = (targetIndex: number, centerTime?: number) => {
    if (!timelineRef.current || isZoomInProgressRef.current) return;

    isZoomInProgressRef.current = true;

    let focusTime = centerTime;
    if (!focusTime && lastMousePositionRef.current) {
      focusTime = lastMousePositionRef.current.timelineTime;
    }
    if (!focusTime) {
      const currentRange = timelineRef.current.getWindow();
      focusTime =
        (currentRange.start.getTime() + currentRange.end.getTime()) / 2;
    }

    try {
      const centerDate = new Date(focusTime);
      const level = targetIndex + 1;
      const bounds = LEVEL_ZOOM_BOUNDS[level as keyof typeof LEVEL_ZOOM_BOUNDS];

      // Calculate range but clamp to level bounds for readability
      let { start: newStart, end: newEnd } =
        ZOOM_LEVELS[targetIndex].calculateRange(centerDate);

      let range = newEnd.getTime() - newStart.getTime();
      // Clamp range to bounds
      if (range > bounds.max) {
        range = bounds.max;
        newStart = new Date(focusTime - range / 2);
        newEnd = new Date(focusTime + range / 2);
      } else if (range < bounds.min) {
        range = bounds.min;
        newStart = new Date(focusTime - range / 2);
        newEnd = new Date(focusTime + range / 2);
      }

      const minDate = new Date("1999-01-01T00:00:00");
      const maxDate = new Date("2099-12-31T23:59:59");

      let finalStart = newStart < minDate ? minDate : newStart;
      let finalEnd = newEnd > maxDate ? maxDate : newEnd;

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
          newOptions.timeAxis = { scale: "year", step: 1 };
          break;
        case 2: // Year -> Months
          newOptions.timeAxis = { scale: "month", step: 1 };
          break;
        case 3: // New: Month -> Days
          newOptions.timeAxis = { scale: "day", step: 1 };
          break;
        case 4: // New: Day -> Hours
          newOptions.timeAxis = { scale: "hour", step: 1 };
          break;
        case 5: // New: Hour -> 15min
          newOptions.timeAxis = { scale: "minute", step: 15 };
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

      // Re-aggregate items for new zoom level
      if (syncWithStoreRef.current) {
        syncWithStoreRef.current();
      }

      console.log(
        `Zoomed to Level ${targetIndex + 1}: ${ZOOM_LEVELS[targetIndex].name}`
      );
    } catch (error) {
      console.error("Error during zoom:", error);
    }

    setTimeout(() => {
      isZoomInProgressRef.current = false;
    }, 300);
  };


  // Helper to aggregate diary items based on zoom level
  function getAggregatedItems(zoomIndex: number) {
    const all = itemsRef.current;
    const result: TimelineItem[] = [];
    const diaryMap: Record<string, TimelineItem> = {};

    const getKey = (date: Date, id: string) => {
      const y = date.getFullYear();
      const m = date.getMonth();
      switch (zoomIndex) {
        case 0: // years => one per year
          return `${y}`;
        case 1: // months => one per month
          return `${y}-${m}`;
        default: // days and below => show all (unique by id)
          return id;
      }
    };

    all.forEach((item) => {
      if (item.status === "diary") {
        const key = getKey(item.start, item.id);
        // keep the first diary in bucket
        if (!diaryMap[key]) diaryMap[key] = item;
      } else {
        result.push(item);
      }
    });

    // include aggregated diaries
    Object.values(diaryMap).forEach((it) => result.push(it));
    console.log('[Timeline] getAggregatedItems zoomIndex:', zoomIndex, 'input:', all.length, 'output:', result.length, 'diaries:', Object.keys(diaryMap).length);
    return result;
  }

  useEffect(() => {
    if (!container.current) return;

    let timeline: any = null;
    let mounted = true;
    let handleMouseMove: ((event: MouseEvent) => void) | null = null;
    let handleWheel: ((event: WheelEvent) => void) | null = null;

    const initTimeline = async () => {
      // Use the preloaded timeline module
      const { Timeline, DataSet } = await timelinePromise;
      
      if (!mounted || !container.current) return;

      // Use latest items from store (not stale closure value)
      // The update effect keeps itemsRef.current in sync
      const latestItems = useTimeline.getState().items;
      itemsRef.current = latestItems;

      // Map our TimelineItem[] → vis-timeline's DataSet format
      const ds = new DataSet(
        getAggregatedItems(0).map((e) => ({
          id: e.id,
          content: e.title,
          start: e.start,
          end: e.end,
          className: e.status, // "plan" vs "actual" → CSS colours
          title: `
            <b>${e.title}</b><br/>
            ${format(e.start, "PPP p")}
            ${e.end ? " – " + format(e.end, "PPP p") : ""}
          `,
        }))
      );

      const initialTimelineFormatConfig = getTimelineFormat(0); // Get Level 1 format config

      timeline = new Timeline(container.current, ds, {
      // Date range: 1999-2099 (the whole 21st century and then some)
      start: "1999-01-01T00:00:00",
      end: "2099-12-31T23:59:59",
      min: "1999-01-01T00:00:00",
      max: "2099-12-31T23:59:59",

      // Enable horizontal scrolling/panning only
      moveable: true,
      zoomable: false, // Completely disable built-in zoom

      // Editable options
      editable: {
        add: true,
        updateTime: true,
        remove: true,
        updateGroup: false,
        overrideItems: false,
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
      timeAxis: { scale: "year", step: 1 }, // Ensure timeAxis is set for Level 1 initially

      // Orientation
      orientation: "top",

      // Completely disable all built-in scroll/zoom behavior
      horizontalScroll: false,
      verticalScroll: false,
    });

      // Store timeline reference
      timelineRef.current = timeline;
      setIsTimelineReady(true);

      // Function to sync timeline with store
      const syncWithStore = () => {
        if (!timeline || !mounted) return;
        const currentItems = useTimeline.getState().items;
        itemsRef.current = currentItems;
        const updatedDs = new DataSet(
          getAggregatedItems(currentZoomIndexRef.current).map((e) => ({
            id: e.id,
            content: e.title,
            start: e.start,
            end: e.end,
            className: e.status,
            title: `<b>${e.title}</b><br/>${format(e.start, "PPP p")}${e.end ? " – " + format(e.end, "PPP p") : ""}`,
          }))
        );
        timeline.setItems(updatedDs);
        console.log('[Timeline] Synced with store, items:', currentItems.length);
      };

      // Store sync function in ref so zoomToLevel can call it
      syncWithStoreRef.current = syncWithStore;

      // Subscribe to store changes
      const unsubscribe = useTimeline.subscribe(syncWithStore);
      (timeline as any).__unsubscribeStore = unsubscribe;

      // Also sync immediately in case items were already loaded
      syncWithStore();

      // Initial task filtering
      refreshVisibleTasks();

      // Update tasks whenever the visible range changes
      (timeline as any).on("rangechanged", () => {
        refreshVisibleTasks();
      });

      // Initialize with the years view (Level 1) - respecting zoom bounds
      const initializeView = () => {
        // Center on current year, show max readable range for level 1 (20 years)
        const now = new Date();
        const tenYears = 10 * 365 * 24 * 60 * 60 * 1000;
        const start = new Date(now.getTime() - tenYears);
        const end = new Date(now.getTime() + tenYears);
        timeline.setWindow(start, end);
        console.log(`Initialized view: Level 1: ${ZOOM_LEVELS[0].name}`);
      };

      // Initialize the view
      initializeView();

    // Fixed scroll handling with proper state management
    let scrollAccumulator = 0;
    const SCROLL_THRESHOLD = 12; // Very sensitive for trackpad pinch

    // Edge panning state
    let edgePanDirection = 0; // -1 left, 0 none, 1 right
    let edgePanSpeed = 0;
    let edgePanAnimationId: number | null = null;

    const MIN_DATE = new Date("1999-01-01T00:00:00").getTime();
    const MAX_DATE = new Date("2099-12-31T23:59:59").getTime();

    const edgePanLoop = () => {
      if (edgePanDirection !== 0 && timeline) {
        const win = timeline.getWindow();
        const range = win.end.getTime() - win.start.getTime();
        const easedSpeed = edgePanSpeed * edgePanSpeed * edgePanSpeed;

        // Check current boundary state
        const atLeftBoundary = win.start.getTime() <= MIN_DATE;
        const atRightBoundary = win.end.getTime() >= MAX_DATE;
        const atBoundary = (edgePanDirection === -1 && atLeftBoundary) || (edgePanDirection === 1 && atRightBoundary);

        if (atBoundary) {
          // At boundary - show boundary indicator
          setEdgeZone(edgePanDirection === -1 ? 'left' : 'right');
          setEdgeIntensity(-1); // -1 = boundary indicator (|< or >|)
        } else {
          // Not at boundary - normal panning + show speed indicator
          const moveBy = range * (0.001 + easedSpeed * 0.05) * edgePanDirection;
          const newStart = new Date(win.start.getTime() + moveBy);
          const newEnd = new Date(win.end.getTime() + moveBy);
          timeline.setWindow(newStart, newEnd, { animation: false });
          // Update speed indicator
          setEdgeZone(edgePanDirection === -1 ? 'left' : 'right');
          setEdgeIntensity(edgePanSpeed);
        }
      } else if (edgePanDirection === 0) {
        // Not in edge zone - clear indicator
        setEdgeZone(null);
        setEdgeIntensity(0);
      }
      edgePanAnimationId = requestAnimationFrame(edgePanLoop);
    };
    edgePanAnimationId = requestAnimationFrame(edgePanLoop);

    // Mouse move tracking for zoom centering and edge panning
    handleMouseMove = (event: MouseEvent) => {
      const timeAtMouse = getTimeFromMouseX(event.clientX);
      if (timeAtMouse) {
        lastMousePositionRef.current = {
          x: event.clientX,
          timelineTime: timeAtMouse,
        };
      }

      // Edge panning detection - in timeline area (top portion)
      if (container.current && timeline) {
        const rect = container.current.getBoundingClientRect();
        const relativeX = event.clientX - rect.left;
        const relativeY = event.clientY - rect.top;

        // Get actual timeline height from vis-timeline element
        const visTimeline = container.current.querySelector('.vis-timeline');
        const timelineHeight = visTimeline ? visTimeline.getBoundingClientRect().height : 60;

        // Only enable edge panning in timeline area
        if (relativeY <= timelineHeight) {
          const edgeZoneWidth = rect.width * 0.10; // 10% edge zone

          if (relativeX < edgeZoneWidth) {
            // Left edge - pan left (animation loop handles indicator)
            edgePanDirection = -1;
            edgePanSpeed = 1 - (relativeX / edgeZoneWidth);
          } else if (relativeX > rect.width - edgeZoneWidth) {
            // Right edge - pan right (animation loop handles indicator)
            edgePanDirection = 1;
            edgePanSpeed = (relativeX - (rect.width - edgeZoneWidth)) / edgeZoneWidth;
          } else {
            // Not in edge zone
            edgePanDirection = 0;
            edgePanSpeed = 0;
          }
        } else {
          // Outside timeline area - disable edge panning
          edgePanDirection = 0;
          edgePanSpeed = 0;
        }
      }
    };

    // Stop edge panning when mouse leaves (animation loop will clear indicator)
    const handleMouseLeave = () => {
      edgePanDirection = 0;
      edgePanSpeed = 0;
    };
    container.current.addEventListener("mouseleave", handleMouseLeave);

    // Store refs for cleanup
    (timeline as any).__edgePanAnimationId = edgePanAnimationId;
    (timeline as any).__handleMouseLeave = handleMouseLeave;

    // Enhanced wheel handling with fixed state management
    handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();

      // Disable zoom when edge panning is active AND actually moving (not at boundary)
      if (edgePanDirection !== 0 && timeline) {
        const win = timeline.getWindow();
        const atLeftBoundary = win.start.getTime() <= MIN_DATE;
        const atRightBoundary = win.end.getTime() >= MAX_DATE;
        const atBoundary = (edgePanDirection === -1 && atLeftBoundary) || (edgePanDirection === 1 && atRightBoundary);

        // Only block zoom if we're NOT at the boundary (i.e., actually scrolling)
        if (!atBoundary) {
          return;
        }
      }

      const deltaY = event.deltaY;
      const deltaX = event.deltaX;
      const centerTime = getTimeFromMouseX(event.clientX);

      console.log('[wheel] locked:', zoomLockedRef.current, 'deltaY:', deltaY, 'deltaX:', deltaX);

      // When locked: ALL scroll = freeform zoom only (no panning)
      if (zoomLockedRef.current) {
        // Use combined delta for zoom (both X and Y contribute)
        const delta = Math.abs(deltaY) > Math.abs(deltaX) ? deltaY : deltaX;
        if (delta !== 0) {
          const factor = delta > 0 ? 1.08 : 0.92; // More responsive for trackpad pinch
          // Always zoom from window center (not mouse) to prevent drift
          const win = timeline.getWindow();
          const windowCenter = (win.start.getTime() + win.end.getTime()) / 2;
          smoothZoomLevelRef.current(factor, windowCenter);
        }
        return;
      }

      // Unlocked: vertical scroll changes levels, horizontal pans
      const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
      const isVertical = Math.abs(deltaY) > Math.abs(deltaX);

      if (isVertical) {
        scrollAccumulator += deltaY;

        if (Math.abs(scrollAccumulator) >= SCROLL_THRESHOLD) {
          const currentIndex = currentZoomIndexRef.current;
          const inProgress = isZoomInProgressRef.current;

          if (!inProgress) {
            if (scrollAccumulator > 0) {
              const newIndex = Math.max(currentIndex - 1, 0);
              if (newIndex !== currentIndex) {
                zoomToLevel(newIndex, centerTime || undefined);
              }
            } else {
              const newIndex = Math.min(currentIndex + 1, ZOOM_LEVELS.length - 1);
              if (newIndex !== currentIndex) {
                zoomToLevel(newIndex, centerTime || undefined);
              }
            }
          }
          scrollAccumulator = 0;
        }
      } else if (isHorizontal) {
        // Velocity-sensitive horizontal panning - harder swipe = faster pan
        const range = timeline.getWindow();
        const interval = range.end.getTime() - range.start.getTime();
        // deltaX is proportional to swipe speed, scale it appropriately
        const moveBy = interval * (deltaX / 500); // 500 is sensitivity factor
        const newStart = new Date(range.start.getTime() + moveBy);
        const newEnd = new Date(range.end.getTime() + moveBy);
        timeline.setWindow(newStart, newEnd, { animation: false });
      }

      // Also allow horizontal panning even with some vertical movement (for natural swipe)
      if (Math.abs(deltaX) > 5 && !isVertical) {
        const range = timeline.getWindow();
        const interval = range.end.getTime() - range.start.getTime();
        const moveBy = interval * (deltaX / 500);
        const newStart = new Date(range.start.getTime() + moveBy);
        const newEnd = new Date(range.end.getTime() + moveBy);
        timeline.setWindow(newStart, newEnd, { animation: false });
      }
    };

    // Add event listeners
    container.current.addEventListener("mousemove", handleMouseMove);
    container.current.addEventListener("wheel", handleWheel, {
      passive: false,
    });

    // Click handler for diary items
    (timeline as any).on("click", (props: any) => {
      if (
        props.item &&
        typeof props.item === "string" &&
        props.item.startsWith("dd-")
      ) {
        const id = props.item.slice(3);
        onOpenDiary && onOpenDiary(id);
      }
    });

      // Attach zoom shortcuts with cleanup and disabled check
      const cleanupZoom = attachZoomShortcuts(timeline, () => disableShortcutsRef.current ?? false);

      // Store cleanup in a way we can access it
      (timeline as any).__cleanupZoom = cleanupZoom;
    };

    initTimeline();

    // Store cleanup refs on timeline object
    let edgePanCleanup: (() => void) | null = null;

    // Wait for initTimeline to set up cleanup
    const setupCleanup = () => {
      if ((timeline as any)?.__edgePanAnimationId) {
        edgePanCleanup = () => {
          cancelAnimationFrame((timeline as any).__edgePanAnimationId);
          if (container.current && (timeline as any).__handleMouseLeave) {
            container.current.removeEventListener("mouseleave", (timeline as any).__handleMouseLeave);
          }
        };
      }
    };
    setTimeout(setupCleanup, 100);

    return () => {
      mounted = false;
      // Clean up event listeners
      if (container.current && handleMouseMove && handleWheel) {
        container.current.removeEventListener("mousemove", handleMouseMove);
        container.current.removeEventListener("wheel", handleWheel);
      }
      if (edgePanCleanup) edgePanCleanup();
      if (timeline) {
        // Cleanup store subscription
        if ((timeline as any).__unsubscribeStore) {
          (timeline as any).__unsubscribeStore();
        }
        // Cleanup zoom shortcuts
        if ((timeline as any).__cleanupZoom) {
          (timeline as any).__cleanupZoom();
        }
        // Cleanup edge pan
        if ((timeline as any).__edgePanAnimationId) {
          cancelAnimationFrame((timeline as any).__edgePanAnimationId);
        }
        if (timeline.destroy) {
          timelineRef.current = null;
          timeline.destroy();
        }
      }
    };
  }, []); // Only run once on mount

  // Update timeline items when they change
  useEffect(() => {
    // Always update itemsRef so it has latest data for when timeline is ready
    itemsRef.current = items;

    if (!timelineRef.current || !isTimelineReady) {
      console.log('[Timeline] Items changed but timeline not ready yet. Count:', items.length);
      return;
    }

    console.log('[Timeline] Items changed, updating. Count:', items.length, items.filter(i => i.status === 'diary').length, 'diaries');

    const updateTimelineItems = async () => {
      const { DataSet } = await timelinePromise;

      const ds = new DataSet(
        getAggregatedItems(currentZoomIndexRef.current).map((e) => ({
          id: e.id,
          content: e.title,
          start: e.start,
          end: e.end,
          className: e.status,
          title: `
            <b>${e.title}</b><br/>
            ${format(e.start, "PPP p")}
            ${e.end ? " – " + format(e.end, "PPP p") : ""}
          `,
        }))
      );

      timelineRef.current.setItems(ds);
    };

    updateTimelineItems();
  }, [items, isTimelineReady]);

  // Also refresh visible tasks whenever the task list itself updates
  useEffect(() => {
    refreshVisibleTasks();
  }, [tasks]);

  // locate after refreshVisibleTasks effect add

  useEffect(() => {
    const handler = (ev: any) => {
      const { date, level } = ev.detail || {};
      if (!date) return;
      const lvl = typeof level === "number" ? level : 0;
      zoomToLevel(lvl, new Date(date).getTime());
      timelineRef.current?.moveTo(date);
    };
    window.addEventListener("dojo:goto", handler as EventListener);
    return () =>
      window.removeEventListener("dojo:goto", handler as EventListener);
  }, []);

  // Pause timeline when modal is open to prevent background processing
  useEffect(() => {
    if (!timelineRef.current) return;

    if (disableShortcuts) {
      // Hide current time indicator to stop its internal timer
      timelineRef.current.setOptions({ showCurrentTime: false });
    } else {
      // Resume current time indicator
      timelineRef.current.setOptions({ showCurrentTime: true });
    }
  }, [disableShortcuts]);

  // Disable timeline panning when zoom is locked
  useEffect(() => {
    if (!timelineRef.current) return;
    timelineRef.current.setOptions({ moveable: !zoomLocked });
  }, [zoomLocked]);

  // Keyboard shortcuts for zoom levels (1-5) and now (n)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable all shortcuts when modal is open
      if (disableShortcuts) return;

      // Also check for modal via data attribute (backup check)
      if (document.querySelector('[data-modal-open="true"]')) return;

      // Ignore if user is typing in an input/textarea or contenteditable
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;

      // 1-5 for zoom levels
      if (e.key >= "1" && e.key <= "5") {
        const level = parseInt(e.key) - 1;
        if (level < ZOOM_LEVELS.length) {
          flashButton(`level-${level}`);
          zoomToLevel(level);
        }
      }
      // n for now
      if (e.key === "n" || e.key === "N") {
        flashButton("now");
        goToCurrentTime();
      }
      // r for refresh
      if (e.key === "r" || e.key === "R") {
        flashButton("refresh");
        refreshFromApi();
      }
      // +/= for zoom in, - for zoom out (within level)
      if (e.key === "=" || e.key === "+") {
        flashButton("plus");
        zoomInLevel();
      }
      if (e.key === "-" || e.key === "_") {
        flashButton("minus");
        zoomOutLevel();
      }
      // l for lock toggle
      if (e.key === "l" || e.key === "L") {
        flashButton("lock");
        toggleZoomLock();
      }
      // Arrow keys for panning (left/right) and zooming (up/down)
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (!timelineRef.current) return;
        const win = timelineRef.current.getWindow();
        const range = win.end.getTime() - win.start.getTime();
        const moveBy = range * 0.1; // Move by 10% of visible range
        const direction = e.key === "ArrowLeft" ? -1 : 1;
        const newStart = new Date(win.start.getTime() + moveBy * direction);
        const newEnd = new Date(win.end.getTime() + moveBy * direction);
        timelineRef.current.setWindow(newStart, newEnd, { animation: false });
      }
      // Up arrow = zoom in, Down arrow = zoom out
      if (e.key === "ArrowUp") {
        flashButton("plus");
        zoomInLevel();
      }
      if (e.key === "ArrowDown") {
        flashButton("minus");
        zoomOutLevel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disableShortcuts]);

  return (
    <div className="w-full h-full flex flex-col relative">
      {/* Controls Row */}
      <div className="flex items-center gap-3 mb-3 font-mono text-xs">
        {/* All buttons in one row */}
        <div className="flex items-center">
          {ZOOM_LEVELS.map((level, index) => (
            <button
              key={level.level}
              onClick={() => { flashButton(`level-${index}`); zoomToLevel(index); }}
              className={`w-5 h-5 flex items-center justify-center transition-all duration-75 ${
                pressedButton === `level-${index}`
                  ? "text-white scale-110"
                  : currentZoomIndex === index
                  ? "text-emerald-500"
                  : "text-gray-600 hover:text-white active:text-white active:scale-110"
              }`}
              title={level.name}
            >
              {currentZoomIndex === index || pressedButton === `level-${index}` ? `[${level.level}]` : level.level}
            </button>
          ))}
          <button
            onClick={() => { flashButton("minus"); zoomOutLevel(); }}
            className={`w-5 h-5 flex items-center justify-center transition-all duration-75 ${
              pressedButton === "minus"
                ? "text-white scale-110"
                : "text-gray-600 hover:text-white active:text-white active:scale-110"
            }`}
            title="zoom out (-)"
          >
            {pressedButton === "minus" ? "[-]" : "-"}
          </button>
          <button
            onClick={() => { flashButton("plus"); zoomInLevel(); }}
            className={`w-5 h-5 flex items-center justify-center transition-all duration-75 ${
              pressedButton === "plus"
                ? "text-white scale-110"
                : "text-gray-600 hover:text-white active:text-white active:scale-110"
            }`}
            title="zoom in (+)"
          >
            {pressedButton === "plus" ? "[+]" : "+"}
          </button>
          <button
            onClick={() => { flashButton("lock"); toggleZoomLock(); }}
            className={`w-5 h-5 flex items-center justify-center transition-all duration-75 ${
              pressedButton === "lock"
                ? "text-white scale-110"
                : zoomLocked ? "text-emerald-500" : "text-gray-600 hover:text-white active:text-white active:scale-110"
            }`}
            title="lock zoom to level (l)"
          >
            {zoomLocked || pressedButton === "lock" ? "[*]" : "*"}
          </button>
          <button
            onClick={() => { flashButton("now"); goToCurrentTime(); }}
            className={`w-5 h-5 flex items-center justify-center transition-all duration-75 ${
              pressedButton === "now"
                ? "text-emerald-500 scale-110"
                : "text-gray-600 hover:text-emerald-500 active:text-emerald-500 active:scale-110"
            }`}
            title="go to now (n)"
          >
            {pressedButton === "now" ? "[@]" : "@"}
          </button>
          <button
            onClick={() => { flashButton("refresh"); refreshFromApi(); }}
            className={`w-5 h-5 flex items-center justify-center transition-all duration-75 ${
              pressedButton === "refresh"
                ? "text-emerald-500 scale-110"
                : "text-gray-600 hover:text-emerald-500 active:text-emerald-500 active:scale-110"
            }`}
            title="refresh from API (r)"
          >
            {pressedButton === "refresh" ? "[r]" : "r"}
          </button>
        </div>
        {/* Level label */}
        <span className="text-gray-600">
          {ZOOM_LEVELS[currentZoomIndex].name}
        </span>
      </div>

      {/* Timeline Container */}
      <div className="flex-1 bg-gray-900 rounded-lg shadow-xl relative overflow-hidden">
        <div
          ref={container}
          className="h-full w-full"
          style={{ opacity: isTimelineReady ? 1 : 0, transition: 'opacity 0.3s ease-in-out' }}
        />
        {!isTimelineReady && (
          <div className="absolute inset-0 bg-gray-900 rounded-lg">
            {/* Skeleton Timeline UI */}
            <div className="h-full flex flex-col">
              {/* Timeline header skeleton */}
              <div className="h-12 border-b border-gray-800 flex items-center px-4">
                <div className="flex gap-4">
                  <div className="h-4 w-16 bg-gray-800 rounded animate-pulse"></div>
                  <div className="h-4 w-16 bg-gray-800 rounded animate-pulse"></div>
                  <div className="h-4 w-16 bg-gray-800 rounded animate-pulse"></div>
                  <div className="h-4 w-16 bg-gray-800 rounded animate-pulse"></div>
                  <div className="h-4 w-16 bg-gray-800 rounded animate-pulse"></div>
                </div>
              </div>
              {/* Timeline body skeleton */}
              <div className="flex-1 relative">
                {/* Center line */}
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-800"></div>
                {/* Loading indicator */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex items-center gap-3 bg-gray-800/50 px-4 py-2 rounded-lg">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm text-gray-400">Loading timeline data...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {isTimelineReady && (
          <TimelineContextBulletin
            lines={visibleTasks.map(
              (t) => `${format(t.date, "PPP")}: ${t.title}`
            )}
          />
        )}
        {/* Edge pan indicator - below the timeline axis */}
        {edgeZone && (
          <div
            className={`absolute top-14 pointer-events-none font-mono text-xs text-emerald-500 ${
              edgeZone === 'left' ? 'left-4' : 'right-4'
            }`}
          >
            {edgeIntensity === -1
              ? (edgeZone === 'left' ? '|<' : '>|')
              : edgeZone === 'left'
                ? (edgeIntensity < 0.33 ? '<' : edgeIntensity < 0.66 ? '<<' : '<<<')
                : (edgeIntensity < 0.33 ? '>' : edgeIntensity < 0.66 ? '>>' : '>>>')}
          </div>
        )}
      </div>
    </div>
  );
}
