import { NormalizedTransaction, NormalizedCustomer } from '@/models/financials';

export interface ConnectorAdapter<TRawTransaction = any, TRawCustomer = any> {
  adaptTransaction(raw: TRawTransaction, connectorId: string): NormalizedTransaction;
  adaptCustomer(raw: TRawCustomer, connectorId: string): NormalizedCustomer;
}
