/**
 * Smart date parser for quick timeline navigation
 *
 * Supported formats:
 * - "2025" → year only → Level 1 (Years)
 * - "feb2025", "022025", "02/2025" → month+year → Level 2 (Months)
 * - "02feb2025", "20feb2025", "02/02/2025", "2feb2025" → day+month+year → Level 3 (Days)
 * - "20feb2025 5pm", "20feb2025 17:00" → with time → Level 4 (Hours) or Level 5 (Minutes)
 */

const MONTH_NAMES: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

export interface ParsedDateResult {
  date: Date;
  level: number; // 0=years, 1=months, 2=days, 3=hours, 4=minutes
}

/**
 * Round time to nearest 15-minute mark
 */
function roundTo15Min(date: Date): Date {
  const minutes = date.getMinutes();
  const roundedMinutes = Math.round(minutes / 15) * 15;
  const result = new Date(date);
  result.setMinutes(roundedMinutes);
  result.setSeconds(0);
  result.setMilliseconds(0);
  return result;
}

/**
 * Parse time string like "5pm", "5:30pm", "17:00", "1730"
 */
function parseTime(timeStr: string): { hours: number; minutes: number } | null {
  const str = timeStr.toLowerCase().trim();

  // Handle "5pm", "5am", "12pm"
  const ampmMatch = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const isPm = ampmMatch[3].toLowerCase() === 'pm';

    if (hours === 12) {
      hours = isPm ? 12 : 0;
    } else if (isPm) {
      hours += 12;
    }

    return { hours, minutes };
  }

  // Handle "17:00", "9:30"
  const colonMatch = str.match(/^(\d{1,2}):(\d{2})$/);
  if (colonMatch) {
    return {
      hours: parseInt(colonMatch[1], 10),
      minutes: parseInt(colonMatch[2], 10),
    };
  }

  // Handle "1730", "0930"
  const militaryMatch = str.match(/^(\d{2})(\d{2})$/);
  if (militaryMatch) {
    return {
      hours: parseInt(militaryMatch[1], 10),
      minutes: parseInt(militaryMatch[2], 10),
    };
  }

  // Handle just hour "17", "9"
  const hourOnlyMatch = str.match(/^(\d{1,2})$/);
  if (hourOnlyMatch) {
    const hours = parseInt(hourOnlyMatch[1], 10);
    if (hours >= 0 && hours <= 23) {
      return { hours, minutes: 0 };
    }
  }

  return null;
}

/**
 * Parse a date input string and return the date and appropriate zoom level
 */
export function parseDateInput(input: string): ParsedDateResult | null {
  const str = input.toLowerCase().trim();
  if (!str) return null;

  // Split by space to check for time component
  const parts = str.split(/\s+/);
  const datePart = parts[0];
  const timePart = parts.length > 1 ? parts.slice(1).join(' ') : null;

  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;
  let hasTime = false;
  let hours = 12; // Default to noon
  let minutes = 0;

  // Parse time if present
  if (timePart) {
    const parsedTime = parseTime(timePart);
    if (parsedTime) {
      hasTime = true;
      hours = parsedTime.hours;
      minutes = parsedTime.minutes;
    }
  }

  // Pattern: just year "2025"
  const yearOnly = datePart.match(/^(\d{4})$/);
  if (yearOnly) {
    year = parseInt(yearOnly[1], 10);
    if (year >= 1999 && year <= 2099) {
      const date = new Date(year, 0, 1, hours, minutes);
      return { date: hasTime ? roundTo15Min(date) : date, level: hasTime ? 3 : 0 };
    }
  }

  // Pattern: "feb2025" or "february2025"
  const monthYear1 = datePart.match(/^([a-z]+)(\d{4})$/);
  if (monthYear1) {
    const monthName = monthYear1[1];
    if (monthName in MONTH_NAMES) {
      month = MONTH_NAMES[monthName];
      year = parseInt(monthYear1[2], 10);
      if (year >= 1999 && year <= 2099) {
        const date = new Date(year, month, 1, hours, minutes);
        return { date: hasTime ? roundTo15Min(date) : date, level: hasTime ? 3 : 1 };
      }
    }
  }

  // Pattern: "022025" (MMYYYY)
  const mmyyyy = datePart.match(/^(\d{2})(\d{4})$/);
  if (mmyyyy) {
    month = parseInt(mmyyyy[1], 10) - 1; // 0-indexed
    year = parseInt(mmyyyy[2], 10);
    if (month >= 0 && month <= 11 && year >= 1999 && year <= 2099) {
      const date = new Date(year, month, 1, hours, minutes);
      return { date: hasTime ? roundTo15Min(date) : date, level: hasTime ? 3 : 1 };
    }
  }

  // Pattern: "02/2025" or "02-2025"
  const mmSlashYyyy = datePart.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (mmSlashYyyy) {
    month = parseInt(mmSlashYyyy[1], 10) - 1;
    year = parseInt(mmSlashYyyy[2], 10);
    if (month >= 0 && month <= 11 && year >= 1999 && year <= 2099) {
      const date = new Date(year, month, 1, hours, minutes);
      return { date: hasTime ? roundTo15Min(date) : date, level: hasTime ? 3 : 1 };
    }
  }

  // Pattern: "02feb2025", "2feb2025"
  const dayMonthYear1 = datePart.match(/^(\d{1,2})([a-z]+)(\d{4})$/);
  if (dayMonthYear1) {
    day = parseInt(dayMonthYear1[1], 10);
    const monthName = dayMonthYear1[2];
    if (monthName in MONTH_NAMES && day >= 1 && day <= 31) {
      month = MONTH_NAMES[monthName];
      year = parseInt(dayMonthYear1[3], 10);
      if (year >= 1999 && year <= 2099) {
        const date = new Date(year, month, day, hours, minutes);
        const level = hasTime ? (minutes !== 0 ? 4 : 3) : 2;
        return { date: hasTime ? roundTo15Min(date) : date, level };
      }
    }
  }

  // Pattern: "feb02,2025" or "feb2,2025"
  const monthDayYear = datePart.match(/^([a-z]+)(\d{1,2}),?(\d{4})$/);
  if (monthDayYear) {
    const monthName = monthDayYear[1];
    day = parseInt(monthDayYear[2], 10);
    year = parseInt(monthDayYear[3], 10);
    if (monthName in MONTH_NAMES && day >= 1 && day <= 31 && year >= 1999 && year <= 2099) {
      month = MONTH_NAMES[monthName];
      const date = new Date(year, month, day, hours, minutes);
      const level = hasTime ? (minutes !== 0 ? 4 : 3) : 2;
      return { date: hasTime ? roundTo15Min(date) : date, level };
    }
  }

  // Pattern: "02/02/2025" or "02-02-2025" (DD/MM/YYYY)
  const ddmmyyyy = datePart.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    day = parseInt(ddmmyyyy[1], 10);
    month = parseInt(ddmmyyyy[2], 10) - 1;
    year = parseInt(ddmmyyyy[3], 10);
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && year >= 1999 && year <= 2099) {
      const date = new Date(year, month, day, hours, minutes);
      const level = hasTime ? (minutes !== 0 ? 4 : 3) : 2;
      return { date: hasTime ? roundTo15Min(date) : date, level };
    }
  }

  // Pattern: "02022025" (DDMMYYYY)
  const ddmmyyyyNoSep = datePart.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (ddmmyyyyNoSep) {
    day = parseInt(ddmmyyyyNoSep[1], 10);
    month = parseInt(ddmmyyyyNoSep[2], 10) - 1;
    year = parseInt(ddmmyyyyNoSep[3], 10);
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && year >= 1999 && year <= 2099) {
      const date = new Date(year, month, day, hours, minutes);
      const level = hasTime ? (minutes !== 0 ? 4 : 3) : 2;
      return { date: hasTime ? roundTo15Min(date) : date, level };
    }
  }

  // Pattern: Short year variants "feb25" → February 2025
  const monthShortYear = datePart.match(/^([a-z]+)(\d{2})$/);
  if (monthShortYear) {
    const monthName = monthShortYear[1];
    if (monthName in MONTH_NAMES) {
      month = MONTH_NAMES[monthName];
      const shortYear = parseInt(monthShortYear[2], 10);
      year = shortYear >= 0 && shortYear <= 50 ? 2000 + shortYear : 1900 + shortYear;
      if (year >= 1999 && year <= 2099) {
        const date = new Date(year, month, 1, hours, minutes);
        return { date: hasTime ? roundTo15Min(date) : date, level: hasTime ? 3 : 1 };
      }
    }
  }

  // Pattern: "02feb25", "2feb25" → day + month + short year
  const dayMonthShortYear = datePart.match(/^(\d{1,2})([a-z]+)(\d{2})$/);
  if (dayMonthShortYear) {
    day = parseInt(dayMonthShortYear[1], 10);
    const monthName = dayMonthShortYear[2];
    if (monthName in MONTH_NAMES && day >= 1 && day <= 31) {
      month = MONTH_NAMES[monthName];
      const shortYear = parseInt(dayMonthShortYear[3], 10);
      year = shortYear >= 0 && shortYear <= 50 ? 2000 + shortYear : 1900 + shortYear;
      if (year >= 1999 && year <= 2099) {
        const date = new Date(year, month, day, hours, minutes);
        const level = hasTime ? (minutes !== 0 ? 4 : 3) : 2;
        return { date: hasTime ? roundTo15Min(date) : date, level };
      }
    }
  }

  return null;
}
