export class XeroReportParser {
  /**
   * Recursively finds the value of a Row or SummaryRow whose label matches any of the targetLabels.
   * Returns the parsed number, or null if not found.
   */
  static findRowValue(rows: any[], targetLabels: string[]): number | null {
    if (!rows || !Array.isArray(rows)) return null;

    for (const target of targetLabels) {
      const normalizedTarget = target.toLowerCase().trim();

      const recurse = (itemList: any[]): number | null => {
        for (const item of itemList) {
          if (!item) continue;

          // 1. If it's a Section row type, examine its Title and nested rows
          if (item.RowType === 'Section') {
            if (item.Title) {
              const title = item.Title.toLowerCase().trim();
              // If the section title matches, look if it has a Summary row
              if (title === normalizedTarget && item.Summary) {
                const val = this.extractCellValue(item.Summary);
                if (val !== null) return val;
              }
            }

            // 1b. Check if the Section's Summary label itself matches the target
            // e.g., Section title = "Turnover", Summary.Cells[0] = "Total Turnover"
            if (item.Summary) {
              const summaryLabel = this.extractCellLabel(item.Summary);
              if (summaryLabel === normalizedTarget) {
                const val = this.extractCellValue(item.Summary);
                if (val !== null) return val;
              }
            }

            if (item.Rows) {
              const res = recurse(item.Rows);
              if (res !== null) return res;
            }
          }

          // 2. If it's a standard Row or SummaryRow, inspect the label in Cell 0
          if (item.RowType === 'Row' || item.RowType === 'SummaryRow') {
            const label = this.extractCellLabel(item);
            if (label === normalizedTarget) {
              const val = this.extractCellValue(item);
              if (val !== null) return val;
            }
          }

          // 3. Fallback check for any other nested rows
          if (item.Rows) {
            const res = recurse(item.Rows);
            if (res !== null) return res;
          }
        }
        return null;
      };

      const foundVal = recurse(rows);
      if (foundVal !== null) {
        return foundVal;
      }
    }

    return null;
  }
 
  static extractCellLabel(row: any): string | null {
    if (!row || !row.Cells || !Array.isArray(row.Cells) || row.Cells.length < 1) return null;
    return (row.Cells[0].Value || "").trim().toLowerCase();
  }
 
  static extractCellValue(row: any): number | null {
    if (!row || !row.Cells || !Array.isArray(row.Cells) || row.Cells.length < 2) return null;
    const valStr = row.Cells[1].Value;
    if (!valStr) return null;
    const parsed = parseFloat(valStr.replace(/,/g, ''));
    return isNaN(parsed) ? null : parsed;
  }
}
