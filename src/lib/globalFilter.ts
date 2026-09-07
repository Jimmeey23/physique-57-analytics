import type { FlexTable } from "./sessions";
import type { FilterState } from "../components/Filters";
import { presetRange } from "../components/Filters";

/**
 * Parse date string from various formats commonly found in Google Sheets
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Try ISO format first (YYYY-MM-DD)
  let match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  }

  // Try DD/MM/YYYY or MM/DD/YYYY format
  match = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (match) {
    const d = parseInt(match[1]);
    const m = parseInt(match[2]);
    const y = parseInt(match[3]);
    // Assume DD/MM/YYYY if day > 12, otherwise MM/DD/YYYY
    if (d > 12) {
      return new Date(y, m - 1, d);
    } else {
      return new Date(y, d - 1, m);
    }
  }

  // Try Month Year format (e.g., "Feb-2024", "February 2024")
  match = dateStr.match(/([A-Za-z]+)[\s\-](\d{4})/);
  if (match) {
    const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const monthStr = match[1].toLowerCase().substring(0, 3);
    const monthIndex = monthNames.indexOf(monthStr);
    if (monthIndex >= 0) {
      return new Date(parseInt(match[2]), monthIndex, 1);
    }
  }

  // Try parsing as timestamp
  const timestamp = Date.parse(dateStr);
  if (!isNaN(timestamp)) {
    return new Date(timestamp);
  }

  return null;
}

/**
 * Get date field name from FlexTable based on common date column names
 */
function getDateField(headers: string[]): string | null {
  const dateFields = [
    "First Visit Date",
    "Created At",
    "Session Date",
    "Churned Date",
    "Most Recent Visit Date",
    "Purchase Date",
    "Month Year",
    "Payment Date",
    "Date",
    "first visit date",
    "created at",
    "session date",
    "churned date",
    "month year",
    "payment date",
    "date",
  ];

  for (const field of dateFields) {
    if (headers.includes(field)) {
      return field;
    }
    // Case-insensitive search
    const lowerField = field.toLowerCase();
    const found = headers.find(h => h.toLowerCase() === lowerField);
    if (found) return found;
  }

  return null;
}

/**
 * Filter FlexTable rows by date range
 */
export function filterFlexTableByDate(
  table: FlexTable,
  filterState: FilterState,
  maxDate: Date
): FlexTable {
  if (!table.rows.length) return table;

  // Get date range from filter
  const [fromDate, toDate] = presetRange(filterState.preset, filterState.from, filterState.to, maxDate);

  // If no date filter, return all rows
  if (!fromDate && !toDate) return table;

  // Find date field
  const dateField = getDateField(table.headers);
  if (!dateField) return table; // No date field found, return all rows

  // Filter rows
  const filteredRows = table.rows.filter(row => {
    const dateStr = row[dateField];
    const rowDate = parseDate(dateStr);

    if (!rowDate) return true; // Keep rows without dates

    if (fromDate && rowDate < fromDate) return false;
    if (toDate && rowDate > toDate) return false;

    return true;
  });

  return {
    headers: table.headers,
    rows: filteredRows,
  };
}

/**
 * Get location field name from FlexTable
 */
function getLocationField(headers: string[]): string | null {
  const locationFields = [
    "Home Location",
    "First Visit Location",
    "Location",
    "Primary Location",
    "Location Name",
    "home location",
    "first visit location",
    "location",
    "primary location",
  ];

  for (const field of locationFields) {
    if (headers.includes(field)) {
      return field;
    }
    const lowerField = field.toLowerCase();
    const found = headers.find(h => h.toLowerCase() === lowerField);
    if (found) return found;
  }

  return null;
}

/**
 * Filter FlexTable rows by location
 */
export function filterFlexTableByLocation(
  table: FlexTable,
  locations: string[]
): FlexTable {
  if (!locations.length) return table; // No location filter, return all
  if (!table.rows.length) return table;

  const locationField = getLocationField(table.headers);
  if (!locationField) return table;

  const filteredRows = table.rows.filter(row => {
    const rowLocation = row[locationField];
    return locations.includes(rowLocation);
  });

  return {
    headers: table.headers,
    rows: filteredRows,
  };
}

/**
 * Apply global filters (date + location) to FlexTable
 */
export function applyGlobalFiltersToFlexTable(
  table: FlexTable,
  filterState: FilterState,
  maxDate: Date
): FlexTable {
  let filtered = table;

  // Apply date filter
  filtered = filterFlexTableByDate(filtered, filterState, maxDate);

  // Apply location filter
  filtered = filterFlexTableByLocation(filtered, filterState.locations);

  return filtered;
}
