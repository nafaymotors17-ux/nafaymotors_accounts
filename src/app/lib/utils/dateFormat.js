/**
 * Format date consistently for server and client
 * Returns format: MM/DD/YYYY
 */
export function formatDate(date) {
  if (!date) return "N/A";
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return "N/A";
  
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const year = d.getFullYear();
  
  return `${month}/${day}/${year}`;
}

/**
 * Format date with time consistently
 * Returns format: MM/DD/YYYY HH:MM
 */
export function formatDateTime(date) {
  if (!date) return "N/A";
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return "N/A";
  
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  
  return `${month}/${day}/${year} ${hours}:${minutes}`;
}
