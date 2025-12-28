/**
 * CSV Export Utility
 * Converts data to CSV format and triggers download
 */

export interface ExportColumn<T> {
  key: keyof T | string;
  header: string;
  format?: (value: any, row: T) => string;
}

/**
 * Convert array of objects to CSV string
 */
export function toCSV<T>(
  data: T[],
  columns: ExportColumn<T>[]
): string {
  if (data.length === 0) {
    return '';
  }

  // Create header row
  const headers = columns.map(col => col.header);
  const headerRow = headers.map(h => escapeCSVValue(h)).join(',');

  // Create data rows
  const dataRows = data.map(row => {
    return columns.map(col => {
      const value = getNestedValue(row, col.key as string);
      const formatted = col.format ? col.format(value, row) : value;
      return escapeCSVValue(formatted);
    }).join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Escape CSV value (handle quotes, commas, newlines)
 */
function escapeCSVValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  const strValue = String(value);
  
  // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
    return `"${strValue.replace(/"/g, '""')}"`;
  }
  
  return strValue;
}

/**
 * Get nested value from object using dot notation
 * Example: getNestedValue({ user: { name: 'John' } }, 'user.name') => 'John'
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current?.[key];
  }, obj);
}

/**
 * Download CSV file
 */
export function downloadCSV(
  csvContent: string,
  filename: string
): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up the URL object
  URL.revokeObjectURL(url);
}

/**
 * Export data to CSV and download
 */
export function exportToCSV<T>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string
): void {
  const csv = toCSV(data, columns);
  downloadCSV(csv, filename);
}













