export interface BalanceSheetAccountDTO {
  name: string;
  balance: number;
}

export class BalanceSheetParser {
  /**
   * Recursively finds a Section by title (case-insensitive).
   */
  static findSection(rows: any[], sectionName: string): any | null {
    if (!rows || !Array.isArray(rows)) return null;
    const target = sectionName.toLowerCase().trim();

    const recurse = (itemList: any[]): any | null => {
      for (const item of itemList) {
        if (!item) continue;
        if (item.RowType === 'Section' && item.Title) {
          const title = item.Title.toLowerCase().trim();
          if (title === target || title.includes(target)) {
            return item;
          }
        }
        if (item.Rows) {
          const found = recurse(item.Rows);
          if (found !== null) return found;
        }
      }
      return null;
    };

    return recurse(rows);
  }

  /**
   * Recursively finds a Row by label in Cells[0].
   */
  static findRow(rows: any[], rowLabel: string): any | null {
    if (!rows || !Array.isArray(rows)) return null;
    const target = rowLabel.toLowerCase().trim();

    const recurse = (itemList: any[]): any | null => {
      for (const item of itemList) {
        if (!item) continue;
        if (item.RowType === 'Row' || item.RowType === 'SummaryRow') {
          if (item.Cells && item.Cells.length > 0) {
            const label = (item.Cells[0].Value || "").toLowerCase().trim();
            if (label === target || label.includes(target)) {
              return item;
            }
          }
        }
        if (item.Rows) {
          const found = recurse(item.Rows);
          if (found !== null) return found;
        }
      }
      return null;
    };

    return recurse(rows);
  }

  /**
   * Recursively finds the value of a Summary row for a section.
   * Searches by section title, then by Summary label, then by row label.
   */
  static findSummary(rows: any[], sectionTitle: string): number | null {
    const section = this.findSection(rows, sectionTitle);
    if (section && section.Summary) {
      return this.extractCellValue(section.Summary);
    }

    // Check all sections whose Summary label matches the target
    // e.g., searching for "total cash at bank and in hand" matches a section
    // where Summary.Cells[0].Value = "Total Cash at bank and in hand"
    const target = sectionTitle.toLowerCase().trim();
    const searchSummaryLabels = (itemList: any[]): number | null => {
      if (!itemList || !Array.isArray(itemList)) return null;
      for (const item of itemList) {
        if (!item) continue;
        if (item.RowType === 'Section' && item.Summary) {
          const label = (item.Summary.Cells?.[0]?.Value || '').toLowerCase().trim();
          if (label === target) {
            return this.extractCellValue(item.Summary);
          }
        }
        if (item.Rows) {
          const found = searchSummaryLabels(item.Rows);
          if (found !== null) return found;
        }
      }
      return null;
    };
    const summaryVal = searchSummaryLabels(rows);
    if (summaryVal !== null) return summaryVal;

    // Alternate fallback check for standard row matches
    const labelRow = this.findRow(rows, sectionTitle);
    if (labelRow) {
      return this.extractCellValue(labelRow);
    }
    return null;
  }

  /**
   * Locates bank accounts recursively from the "Cash and Bank" or "Bank Accounts" sections.
   */
  /**
   * Locates bank accounts recursively from the "Cash and Bank" or "Bank Accounts" sections.
   * Scans all sections in the report and inverts values if they are in Liabilities/Creditors.
   */
  static findBankAccounts(rows: any[]): BalanceSheetAccountDTO[] {
    const accounts: BalanceSheetAccountDTO[] = [];
    if (!rows || !Array.isArray(rows)) return accounts;

    const recurse = (itemList: any[], inBankSection = false) => {
      for (const item of itemList) {
        if (!item) continue;

        let currentBankSection = inBankSection;
        if (item.RowType === 'Section' && item.Title) {
          const title = item.Title.toLowerCase().trim();
          if (
            title.includes('bank') || 
            title.includes('cash and bank') || 
            title.includes('cash at bank') ||
            title.includes('cash & bank')
          ) {
            currentBankSection = true;
          } else if (
            title.includes('liabilities') || 
            title.includes('creditors') || 
            title.includes('sales') || 
            title.includes('equity')
          ) {
            currentBankSection = false;
          }
        }

        if (item.RowType === 'Row' && item.Cells && item.Cells.length >= 2) {
          const name = (item.Cells[0].Value || "").trim();
          let balance = this.extractCellValue(item);
          if (name && balance !== null && !name.toLowerCase().includes('total') && currentBankSection) {
            accounts.push({ name, balance: Math.abs(balance) });
          }
        }

        if (item.Rows) {
          recurse(item.Rows, currentBankSection);
        }
      }
    };

    recurse(rows);
    return accounts;
  }

  /**
   * Finds the Total Cash sum from Balance Sheet report.
   */
  static findTotalCash(rows: any[]): number | null {
    // Try official Xero summaries first to match official Balance Sheet report
    const targets = [
      'total cash at bank and in hand',
      'total cash and bank',
      'total cash',
      'total bank accounts',
      'total bank balances',
      'cash and bank'
    ];

    for (const label of targets) {
      const val = this.findSummary(rows, label);
      if (val !== null) return val;
    }

    const accounts = this.findBankAccounts(rows);
    if (accounts.length > 0) {
      return accounts.reduce((sum, acc) => sum + (acc.balance > 0 ? acc.balance : 0), 0);
    }

    return null;
  }

  /**
   * Finds Total Current Assets from Balance Sheet report.
   */
  static findCurrentAssets(rows: any[]): number | null {
    for (const label of ['total current assets', 'current assets']) {
      const val = this.findSummary(rows, label);
      if (val !== null) return val;
    }
    return null;
  }

  /**
   * Finds Total Assets from Balance Sheet report.
   */
  static findTotalAssets(rows: any[]): number | null {
    for (const label of ['total assets', 'assets']) {
      const val = this.findSummary(rows, label);
      if (val !== null) return val;
    }
    return null;
  }

  /**
   * Finds Total Liabilities from Balance Sheet report.
   */
  static findTotalLiabilities(rows: any[]): number | null {
    for (const label of [
      'total liabilities',
      'liabilities',
      'total creditors: amounts falling due within one year',
      'creditors'
    ]) {
      const val = this.findSummary(rows, label);
      if (val !== null) return val;
    }
    return null;
  }

  /**
   * Finds Total Equity from Balance Sheet report.
   */
  static findTotalEquity(rows: any[]): number | null {
    for (const label of [
      'total equity',
      'equity',
      'total capital and reserves',
      'capital and reserves'
    ]) {
      const val = this.findSummary(rows, label);
      if (val !== null) return val;
    }
    return null;
  }

  /**
   * Finds Total Accounts Receivable (AR / Debtors) from Balance Sheet report.
   */
  static findTotalAR(rows: any[]): number | null {
    for (const label of [
      'total accounts receivable',
      'accounts receivable',
      'trade debtors',
      'debtors'
    ]) {
      const val = this.findSummary(rows, label);
      if (val !== null) return val;
    }
    return null;
  }

  /**
   * Finds Total Accounts Payable (AP / Creditors) from Balance Sheet report.
   */
  static findTotalAP(rows: any[]): number | null {
    for (const label of [
      'total accounts payable',
      'accounts payable',
      'trade creditors',
      'creditors'
    ]) {
      const val = this.findSummary(rows, label);
      if (val !== null) return val;
    }
    return null;
  }

  /**
   * Finds Total Current Liabilities from Balance Sheet report.
   */
  static findCurrentLiabilities(rows: any[]): number | null {
    for (const label of [
      'total current liabilities',
      'current liabilities',
      'creditors: amounts falling due within one year'
    ]) {
      const val = this.findSummary(rows, label);
      if (val !== null) return val;
    }
    return null;
  }

  /**
   * Finds Total Debit and Credit from Trial Balance report.
   */
  static findTrialBalanceTotals(rows: any[]): { debit: number; credit: number } {
    if (!rows || !Array.isArray(rows)) return { debit: 0, credit: 0 };
    
    // Find the row labeled "Total"
    const totalRow = this.findRow(rows, 'total');
    if (totalRow && totalRow.Cells && totalRow.Cells.length >= 3) {
      const debitStr = totalRow.Cells[1]?.Value || '';
      const creditStr = totalRow.Cells[2]?.Value || '';
      
      const debit = parseFloat(debitStr.replace(/,/g, '')) || 0;
      const credit = parseFloat(creditStr.replace(/,/g, '')) || 0;
      return { debit, credit };
    }
    
    return { debit: 0, credit: 0 };
  }

  static extractCellValue(row: any): number | null {
    if (!row || !row.Cells || !Array.isArray(row.Cells) || row.Cells.length < 2) return null;
    const valStr = row.Cells[1].Value;
    if (!valStr) return null;
    const parsed = parseFloat(valStr.replace(/,/g, ''));
    return isNaN(parsed) ? null : parsed;
  }
}
