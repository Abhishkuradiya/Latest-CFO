import { ReadRepository } from './base-repository';
import { NormalizedTransaction } from '@/models/financials';
import { apiClient } from '@/api/clients/api-client';
import { StripeAdapter } from '@/adapters/stripe-adapter';
import { XeroAdapter } from '@/adapters/xero-adapter';

export class TransactionRepository implements ReadRepository<NormalizedTransaction> {
  private stripeAdapter = new StripeAdapter();
  private xeroAdapter = new XeroAdapter();

  async findById(id: string): Promise<NormalizedTransaction | null> {
    try {
      const response = await apiClient.get(`/transactions/${id}`);
      const raw = response.data;
      return this.normalize(raw);
    } catch (error) {
      console.error(`Failed to fetch transaction ${id}:`, error);
      return null;
    }
  }

  async findAll(filters?: Record<string, any>): Promise<NormalizedTransaction[]> {
    try {
      const response = await apiClient.get('/transactions', { params: filters });
      const items = Array.isArray(response.data) ? response.data : response.data.items || [];
      return items.map((item: any) => this.normalize(item)).filter(Boolean) as NormalizedTransaction[];
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      return [];
    }
  }

  private normalize(raw: any): NormalizedTransaction | null {
    if (!raw) return null;
    const connectorType = raw.connectorType || raw.sourceConnectorType;
    const connectorId = raw.connectorId || raw.sourceConnectorId || 'unknown';

    if (connectorType === 'stripe') {
      return this.stripeAdapter.adaptTransaction(raw, connectorId);
    } else if (connectorType === 'xero') {
      return this.xeroAdapter.adaptTransaction(raw, connectorId);
    }
    
    // Default fallback mapping for other connectors
    return {
      id: raw.id || raw.id,
      sourceConnectorId: connectorId,
      sourceConnectorType: connectorType || 'unknown',
      amount: Number(raw.amount) || 0,
      currency: (raw.currency || 'USD').toUpperCase(),
      timestamp: raw.timestamp || raw.created_at || new Date().toISOString(),
      description: raw.description || '',
      status: raw.status || 'completed',
      category: raw.category || 'General',
    };
  }
}
