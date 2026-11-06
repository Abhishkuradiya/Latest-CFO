import { fetchXeroReport } from '../xero';
import { BalanceSheetParser, BalanceSheetAccountDTO } from './BalanceSheetParser';
 
export interface BalanceSheetSummary {
  totalCash: number;
  currentAssets: number;
  bankAccounts: BalanceSheetAccountDTO[];
  rawReport: any;
}
 
export class BalanceSheetService {
  /**
   * Fetches the Balance Sheet report from Xero and parses total cash & bank accounts.
   */
  static async getBalanceSheetSummary(
    accessToken: string, 
    xeroTenantId: string, 
    dateStr?: string
  ): Promise<BalanceSheetSummary> {
    const queryParams = dateStr ? `date=${dateStr}` : undefined;
    const report = await fetchXeroReport(accessToken, xeroTenantId, 'BalanceSheet', queryParams);
    
    if (!report || !report.Rows || !Array.isArray(report.Rows)) {
      return {
        totalCash: 0,
        currentAssets: 0,
        bankAccounts: [],
        rawReport: report
      };
    }
 
    const totalCash = BalanceSheetParser.findTotalCash(report.Rows) || 0;
    const currentAssets = BalanceSheetParser.findCurrentAssets(report.Rows) || 0;
    const bankAccounts = BalanceSheetParser.findBankAccounts(report.Rows);
 
    return {
      totalCash,
      currentAssets,
      bankAccounts,
      rawReport: report
    };
  }
}
