import { BalanceSheetAccountDTO } from './BalanceSheetParser';

export interface EnterpriseBankAccountDTO {
  accountId: string;
  accountName: string;
  accountCode: string;
  currency: string;
  balance: number | null; // null represents "—"
  status: string;
  type: string;
}

export class BankAccountMergeService {
  /**
   * Merges accounts metadata from Xero Accounts API and Balance Sheet report.
   * Strictly filters ONLY accounts that have BankAccountType or Type === 'BANK' | 'CREDITCARD' | 'PAYPAL'.
   */
  static mergeAccounts(
    accounts: any[], 
    balanceSheetAccounts: BalanceSheetAccountDTO[]
  ): EnterpriseBankAccountDTO[] {
    const results: EnterpriseBankAccountDTO[] = [];
    const matchedBsNames = new Set<string>();

    if (Array.isArray(accounts) && accounts.length > 0) {
      // Filter strictly by Xero BankAccountType / Type === 'BANK' / BankAccountNumber
      const bankAccounts = accounts.filter(acc => {
        const type = (acc.Type || acc.type || '').toUpperCase();
        const bankAccType = (acc.BankAccountType || acc.bankAccountType || '').toUpperCase();
        const hasAccountNum = Boolean(acc.BankAccountNumber || acc.bankAccountNumber);

        if (bankAccType || hasAccountNum) return true;
        if (type === 'BANK' || type === 'CREDITCARD' || type === 'PAYPAL') return true;
        
        return false;
      });

      bankAccounts.forEach(acc => {
        const normalizedName = (acc.Name || acc.accountName || '').toLowerCase().trim();
        
        const match = balanceSheetAccounts.find(bsAcc => {
          const bsName = bsAcc.name.toLowerCase().trim();
          return bsName === normalizedName || bsName.includes(normalizedName) || normalizedName.includes(bsName);
        });

        if (match) {
          matchedBsNames.add(match.name.toLowerCase().trim());
        }

        const rawBal = match ? match.balance : 0;
        const posBal = Math.abs(rawBal);

        results.push({
          accountId: acc.AccountID || acc.accountId || acc.Name,
          accountName: acc.Name || acc.accountName,
          accountCode: acc.Code || acc.accountCode || "",
          currency: acc.CurrencyCode || acc.currency || "GBP",
          balance: posBal,
          status: acc.Status || acc.status || "ACTIVE",
          type: acc.BankAccountType || acc.Type || "BANK"
        });
      });
    }

    return results;
  }
}
