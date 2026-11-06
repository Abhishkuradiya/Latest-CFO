/**
 * Standardized Date Defaults for Virtual CFO Platform.
 * 
 * Rules:
 * 1. Default Period End Date (To Date / As-Of Date):
 *    End of the CURRENT month (e.g. 31 Oct 2026 when in October 2026, 30 Nov 2026 when in November 2026).
 * 
 * 2. Default Range Start Date (From Date):
 *    1st day of 6-month period ending in current month (e.g. 01 May 2026 for period May 2026 - Oct 2026).
 */

export function getDefaultDateRange(): { startDate: string; endDate: string; asOfDate: string } {
  const now = new Date();
  
  // End of current month (e.g. 31 Oct 2026 when in October 2026)
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const endY = currentMonthEnd.getFullYear();
  const endM = String(currentMonthEnd.getMonth() + 1).padStart(2, '0');
  const endD = String(currentMonthEnd.getDate()).padStart(2, '0');
  const endDate = `${endY}-${endM}-${endD}`;

  // Start of 6-month period ending at current month end (1st day of 5 months prior, e.g. 01 May 2026)
  const sixMonthStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const startY = sixMonthStart.getFullYear();
  const startM = String(sixMonthStart.getMonth() + 1).padStart(2, '0');
  const startD = String(sixMonthStart.getDate()).padStart(2, '0');
  const startDate = `${startY}-${startM}-${startD}`;

  return {
    startDate,
    endDate,
    asOfDate: endDate
  };
}
