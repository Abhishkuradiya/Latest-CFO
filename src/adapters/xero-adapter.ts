import { ConnectorAdapter } from './connector-adapter';
import { NormalizedTransaction, NormalizedCustomer } from '@/models/financials';

export interface XeroRawInvoice {
  InvoiceID: string;
  Total: number;
  CurrencyCode: string;
  DateString: string;
  Reference: string;
  Status: 'AUTHORISED' | 'PAID' | 'DELETED' | 'VOIDED' | 'DRAFT';
  Contact?: {
    ContactID: string;
    Name: string;
    EmailAddress?: string;
  };
}

export class XeroAdapter implements ConnectorAdapter<XeroRawInvoice, any> {
  adaptTransaction(raw: XeroRawInvoice, connectorId: string): NormalizedTransaction {
    return {
      id: raw.InvoiceID,
      sourceConnectorId: connectorId,
      sourceConnectorType: 'xero',
      amount: raw.Total,
      currency: raw.CurrencyCode.toUpperCase(),
      timestamp: new Date(raw.DateString).toISOString(),
      description: raw.Reference || `Xero Invoice ${raw.InvoiceID}`,
      status: this.mapStatus(raw.Status),
      category: 'Invoicing/Receivables',
    };
  }

  adaptCustomer(raw: any, connectorId: string): NormalizedCustomer {
    return {
      id: raw.ContactID,
      sourceConnectorId: connectorId,
      name: raw.Name,
      email: raw.EmailAddress,
      country: raw.Country,
      lifetimeValue: raw.TotalPaid || 0,
      createdAt: raw.CreatedDateUTC ? new Date(raw.CreatedDateUTC).toISOString() : new Date().toISOString(),
    };
  }

  private mapStatus(status: XeroRawInvoice['Status']): NormalizedTransaction['status'] {
    switch (status) {
      case 'PAID':
        return 'completed';
      case 'AUTHORISED':
        return 'pending';
      case 'DELETED':
      case 'VOIDED':
        return 'failed';
      case 'DRAFT':
      default:
        return 'pending';
    }
  }
}
