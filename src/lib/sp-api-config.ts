/**
 * Centralized Amazon SP-API Version Configuration
 * Enforces production-ready API versions across all modules.
 */

export const SP_API_VERSIONS = {
  ORDERS: 'v2026-01-01',
  FINANCES: 'v2024-06-19',
  CATALOG: 'v2022-04-01',
  PRODUCT_PRICING: 'v2022-05-01',
  PRODUCT_FEES: 'v0',
  REPORTS: 'v2021-06-30',
  FBA_INVENTORY: 'v1',
  FULFILLMENT_INBOUND: 'v2024-03-20',
  FULFILLMENT_OUTBOUND: 'v2020-07-01',
  LISTINGS_ITEMS: 'v2021-08-01',
  LISTINGS_RESTRICTIONS: 'v2021-08-01',
  PRODUCT_TYPE_DEFINITIONS: 'v2020-09-01'
} as const;

export interface CurrencyConversion {
  originalAmount: number;
  originalCurrency: string;
  reportingAmount: number;
  reportingCurrency: string;
  exchangeRate: number;
  exchangeRateDate: string;
  exchangeRateSource: 'AUTOMATIC' | 'MANUAL_OVERRIDE';
}

/**
 * Standard Exchange Rates against INR (Default base reporting currency)
 */
export const DEFAULT_FX_RATES: Record<string, number> = {
  INR: 1.0,
  USD: 83.50,
  EUR: 90.20,
  GBP: 106.10,
  JPY: 0.55,
  AUD: 55.40,
  CAD: 61.20
};

export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string = 'INR',
  manualRate?: number
): CurrencyConversion {
  const fromRate = DEFAULT_FX_RATES[fromCurrency.toUpperCase()] || 1.0;
  const toRate = DEFAULT_FX_RATES[toCurrency.toUpperCase()] || 1.0;

  const rate = manualRate !== undefined ? manualRate : fromRate / toRate;
  const reportingAmount = Math.round(amount * rate * 100) / 100;

  return {
    originalAmount: amount,
    originalCurrency: fromCurrency,
    reportingAmount,
    reportingCurrency: toCurrency,
    exchangeRate: rate,
    exchangeRateDate: new Date().toISOString(),
    exchangeRateSource: manualRate !== undefined ? 'MANUAL_OVERRIDE' : 'AUTOMATIC'
  };
}
