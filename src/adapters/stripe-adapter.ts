import { ConnectorAdapter } from './connector-adapter';
import { NormalizedTransaction, NormalizedCustomer } from '@/models/financials';

export interface StripeRawCharge {
  id: string;
  amount: number; // in cents
  currency: string;
  created: number; // unix timestamp
  description: string;
  status: 'succeeded' | 'failed' | 'pending';
  billing_details?: {
    name?: string;
    email?: string;
  };
}

export class StripeAdapter implements ConnectorAdapter<StripeRawCharge, any> {
  adaptTransaction(raw: StripeRawCharge, connectorId: string): NormalizedTransaction {
    return {
      id: raw.id,
      sourceConnectorId: connectorId,
      sourceConnectorType: 'stripe',
      amount: raw.amount / 100, // convert cents to standard decimal float
      currency: raw.currency.toUpperCase(),
      timestamp: new Date(raw.created * 1000).toISOString(),
      description: raw.description || 'Stripe Charge',
      status: this.mapStatus(raw.status),
      category: 'Sales/Revenue',
    };
  }

  adaptCustomer(raw: any, connectorId: string): NormalizedCustomer {
    return {
      id: raw.id,
      sourceConnectorId: connectorId,
      name: raw.name || raw.email || 'Stripe Customer',
      email: raw.email,
      country: raw.address?.country,
      lifetimeValue: (raw.total_spent || 0) / 100,
      createdAt: new Date((raw.created || Date.now() / 1000) * 1000).toISOString(),
    };
  }

  private mapStatus(status: StripeRawCharge['status']): NormalizedTransaction['status'] {
    switch (status) {
      case 'succeeded':
        return 'completed';
      case 'failed':
        return 'failed';
      case 'pending':
      default:
        return 'pending';
    }
  }
}
