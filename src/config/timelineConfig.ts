import {
  format,
  getYear,
  startOfYear,
  endOfYear,
  startOfDay,
  endOfDay,
  startOfHour,
  endOfHour,
  getISOWeek,
  startOfISOWeek,
  endOfISOWeek,
  addWeeks,
} from "date-fns";

// Each zoom level definition used by the Dojo timeline
export const ZOOM_LEVELS = [
  {
    name: "years",
    level: 1,
    calculateRange: (_centerTime: Date) => ({
      start: new Date("1999-01-01T00:00:00"),
      end: new Date("2099-12-31T23:59:59"),
    }),
  },
  {
    name: "months",
    level: 2,
    calculateRange: (centerTime: Date) => {
      const year = getYear(centerTime);
      return {
        start: startOfYear(new Date(year, 0, 1)),
        end: endOfYear(new Date(year, 0, 1)),
      };
    },
  },
  {
    name: "days",
    level: 3,
    calculateRange: (centerTime: Date) => {
      const currentIsoWeekStart = startOfISOWeek(centerTime);
      const endOfNextIsoWeek = endOfISOWeek(addWeeks(currentIsoWeekStart, 1));
      return {
        start: currentIsoWeekStart,
        end: endOfNextIsoWeek,
      };
    },
  },
  {
    name: "hours",
    level: 4,
    calculateRange: (centerTime: Date) => ({
      start: startOfDay(centerTime),
      end: endOfDay(centerTime),
    }),
  },
  {
    name: "minutes",
    level: 5,
    calculateRange: (centerTime: Date) => ({
      start: startOfHour(centerTime),
      end: endOfHour(centerTime),
    }),
  },
];

// Configure vis-timeline label formats for each zoom level
export const getTimelineFormat = (zoomIndex: number) => {
  const levelConfig = ZOOM_LEVELS[zoomIndex];

  switch (levelConfig.level) {
    case 1: // Years only
      return {
        minorLabels: { year: "YYYY" },
        majorLabels: { year: "" },
        showMajorLabels: false,
      };

    case 2: // Year → Months
      return {
        minorLabels: { month: "MMM" },
        majorLabels: { month: "YYYY" },
        showMajorLabels: true,
      };

    case 3: // Month → Days (display ISO week in major label)
      return {
        minorLabels: { day: "ddd D" },
        majorLabels: function (date: Date) {
          const jsDate = new Date(date);
          if (isNaN(jsDate.getTime())) return "";
          return format(jsDate, "MMMM yyyy") + " W" + getISOWeek(jsDate);
        },
        showMajorLabels: true,
      };

    case 4: // Day → Hours
      return {
        minorLabels: { hour: "h a" },
        majorLabels: { hour: "ddd, MMM D, YYYY" },
        showMajorLabels: true,
      };

    case 5: // Hour → 15min
      return {
        minorLabels: function (date: Date) {
          const jsDate = new Date(date);
          if (isNaN(jsDate.getTime())) return "";
          return format(jsDate, "h:mm a");
        },
        majorLabels: { hour: "h a, ddd MMM D" },
        showMajorLabels: true,
      };

    default:
      return { minorLabels: {}, majorLabels: {}, showMajorLabels: true };
  }
};
