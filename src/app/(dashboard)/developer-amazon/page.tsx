'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, Database, ShoppingBag, Package, DollarSign, Layers, Server } from 'lucide-react';

interface DeveloperData {
  connected: boolean;
  credentials: {
    sellerId: string;
    region: string;
    marketplaceId: string;
    lastSynced: string | null;
  };
  tables: {
    amazon_orders: any[];
    amazon_order_items: any[];
    amazon_settlements: any[];
    amazon_products: any[];
    amazon_inventory: any[];
  };
}

export default function DeveloperAmazonPage() {
  const [data, setData] = useState<DeveloperData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'items' | 'settlements' | 'products' | 'inventory'>('orders');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchRawData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/amazon/raw-data');
      if (!res.ok) throw new Error('Failed to fetch raw database content');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error loading PostgreSQL data' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRawData();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/amazon/sync', { method: 'POST' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Sync failed');
      setMessage({ type: 'success', text: result.message || 'Amazon SP-API live sync completed successfully!' });
      await fetchRawData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to sync with Amazon SP-API' });
    } finally {
      setSyncing(false);
    }
  };

  const tables = data?.tables || {
    amazon_orders: [],
    amazon_order_items: [],
    amazon_settlements: [],
    amazon_products: [],
    amazon_inventory: []
  };

  return (
    <div style={{ padding: '24px', fontFamily: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif', color: '#1f2937', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', backgroundColor: '#ffffff', padding: '20px 24px', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Server style={{ width: '24px', height: '24px', color: '#2563eb' }} />
            Amazon SP-API & PostgreSQL Data Inspector
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
            Direct normalization pipeline and live table storage inspection from Amazon Selling Partner API.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={fetchRawData}
            disabled={loading}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: '#ffffff',
              color: '#374151',
              fontSize: '13px',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw style={{ width: '14px', height: '14px', animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh Tables
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: syncing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw style={{ width: '14px', height: '14px', animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
            {syncing ? 'Syncing SP-API...' : 'Trigger SP-API Sync'}
          </button>
        </div>
      </div>

      {/* Connection Metadata Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>Connection Status</div>
          <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px', color: data?.connected ? '#16a34a' : '#dc2626' }}>
            {data?.connected ? <CheckCircle2 style={{ width: '16px', height: '16px' }} /> : <AlertTriangle style={{ width: '16px', height: '16px' }} />}
            {data?.connected ? 'Connected (Live / Sandbox)' : 'Not Connected'}
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>Seller ID</div>
          <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '4px', color: '#111827' }}>
            {data?.credentials.sellerId || '—'}
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>Region / Marketplace</div>
          <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '4px', color: '#111827' }}>
            {data?.credentials.region || 'eu-west-1'} ({data?.credentials.marketplaceId || 'Default'})
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>Last Synced At</div>
          <div style={{ fontSize: '14px', fontWeight: 500, marginTop: '4px', color: '#4b5563' }}>
            {data?.credentials.lastSynced ? new Date(data.credentials.lastSynced).toLocaleString() : 'Never'}
          </div>
        </div>
      </div>

      {/* System Toast / Alert */}
      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '6px',
          marginBottom: '24px',
          fontSize: '14px',
          backgroundColor: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          color: message.type === 'success' ? '#166534' : '#991b1b'
        }}>
          {message.text}
        </div>
      )}

      {/* Tabs Header */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: '20px', gap: '8px', backgroundColor: '#ffffff', padding: '8px 12px 0 12px', borderRadius: '8px 8px 0 0' }}>
        <button
          onClick={() => setActiveTab('orders')}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderBottom: activeTab === 'orders' ? '2px solid #2563eb' : '2px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'orders' ? '#2563eb' : '#4b5563',
            fontWeight: activeTab === 'orders' ? 600 : 400,
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <ShoppingBag style={{ width: '16px', height: '16px' }} />
          amazon_orders ({tables.amazon_orders.length})
        </button>

        <button
          onClick={() => setActiveTab('items')}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderBottom: activeTab === 'items' ? '2px solid #2563eb' : '2px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'items' ? '#2563eb' : '#4b5563',
            fontWeight: activeTab === 'items' ? 600 : 400,
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Layers style={{ width: '16px', height: '16px' }} />
          amazon_order_items ({tables.amazon_order_items.length})
        </button>

        <button
          onClick={() => setActiveTab('settlements')}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderBottom: activeTab === 'settlements' ? '2px solid #2563eb' : '2px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'settlements' ? '#2563eb' : '#4b5563',
            fontWeight: activeTab === 'settlements' ? 600 : 400,
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <DollarSign style={{ width: '16px', height: '16px' }} />
          amazon_settlements ({tables.amazon_settlements.length})
        </button>

        <button
          onClick={() => setActiveTab('products')}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderBottom: activeTab === 'products' ? '2px solid #2563eb' : '2px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'products' ? '#2563eb' : '#4b5563',
            fontWeight: activeTab === 'products' ? 600 : 400,
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Package style={{ width: '16px', height: '16px' }} />
          amazon_products ({tables.amazon_products.length})
        </button>

        <button
          onClick={() => setActiveTab('inventory')}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderBottom: activeTab === 'inventory' ? '2px solid #2563eb' : '2px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'inventory' ? '#2563eb' : '#4b5563',
            fontWeight: activeTab === 'inventory' ? 600 : 400,
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Database style={{ width: '16px', height: '16px' }} />
          amazon_inventory ({tables.amazon_inventory.length})
        </button>

        <button
          onClick={() => setActiveTab('financial_events' as any)}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderBottom: (activeTab as string) === 'financial_events' ? '2px solid #2563eb' : '2px solid transparent',
            backgroundColor: 'transparent',
            color: (activeTab as string) === 'financial_events' ? '#2563eb' : '#4b5563',
            fontWeight: (activeTab as string) === 'financial_events' ? 600 : 400,
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <DollarSign style={{ width: '16px', height: '16px' }} />
          amazon_financial_events ({(tables as any).amazon_financial_events?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('waterfall' as any)}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderBottom: (activeTab as string) === 'waterfall' ? '2px solid #2563eb' : '2px solid transparent',
            backgroundColor: 'transparent',
            color: (activeTab as string) === 'waterfall' ? '#2563eb' : '#4b5563',
            fontWeight: (activeTab as string) === 'waterfall' ? 600 : 400,
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Layers style={{ width: '16px', height: '16px' }} />
          amazon_waterfall_summary ({(tables as any).amazon_waterfall_summary?.length || 0})
        </button>
      </div>

      {/* Table Data View */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb', overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
            Loading PostgreSQL records...
          </div>
        ) : (
          <>
            {activeTab === 'orders' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>
                    <th style={{ padding: '12px 16px' }}>Amazon Order ID</th>
                    <th style={{ padding: '12px 16px' }}>Purchase Date</th>
                    <th style={{ padding: '12px 16px' }}>Status</th>
                    <th style={{ padding: '12px 16px' }}>Fulfillment</th>
                    <th style={{ padding: '12px 16px' }}>Total</th>
                    <th style={{ padding: '12px 16px' }}>Buyer Name</th>
                    <th style={{ padding: '12px 16px' }}>Fees</th>
                    <th style={{ padding: '12px 16px' }}>Refunds</th>
                  </tr>
                </thead>
                <tbody>
                  {tables.amazon_orders.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>
                        No records found in amazon_orders table. Click "Trigger SP-API Sync" to pull live data.
                      </td>
                    </tr>
                  ) : (
                    tables.amazon_orders.map((row: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1d4ed8' }}>{row.amazon_order_id}</td>
                        <td style={{ padding: '12px 16px', color: '#4b5563' }}>{row.purchase_date ? new Date(row.purchase_date).toLocaleString() : 'N/A'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, backgroundColor: row.order_status === 'Shipped' ? '#dcfce7' : '#fef3c7', color: row.order_status === 'Shipped' ? '#15803d' : '#b45309' }}>
                            {row.order_status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#4b5563' }}>{row.fulfillment_channel || 'AFN'}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.currency} {parseFloat(row.order_total_amount || 0).toFixed(2)}</td>
                        <td style={{ padding: '12px 16px', color: '#4b5563' }}>{row.buyer_name || 'N/A'}</td>
                        <td style={{ padding: '12px 16px', color: '#dc2626' }}>{row.currency} {parseFloat(row.amazon_fees || 0).toFixed(2)}</td>
                        <td style={{ padding: '12px 16px', color: '#dc2626' }}>{row.currency} {parseFloat(row.refund_amount || 0).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'items' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>
                    <th style={{ padding: '12px 16px' }}>Order Item ID</th>
                    <th style={{ padding: '12px 16px' }}>Amazon Order ID</th>
                    <th style={{ padding: '12px 16px' }}>ASIN</th>
                    <th style={{ padding: '12px 16px' }}>SKU</th>
                    <th style={{ padding: '12px 16px' }}>Title</th>
                    <th style={{ padding: '12px 16px' }}>Qty Ordered</th>
                    <th style={{ padding: '12px 16px' }}>Item Price</th>
                  </tr>
                </thead>
                <tbody>
                  {tables.amazon_order_items.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>
                        No records found in amazon_order_items table.
                      </td>
                    </tr>
                  ) : (
                    tables.amazon_order_items.map((row: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.order_item_id}</td>
                        <td style={{ padding: '12px 16px', color: '#1d4ed8' }}>{row.amazon_order_id}</td>
                        <td style={{ padding: '12px 16px', color: '#4b5563' }}>{row.asin}</td>
                        <td style={{ padding: '12px 16px', color: '#4b5563' }}>{row.seller_sku}</td>
                        <td style={{ padding: '12px 16px', color: '#111827', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.title}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.quantity_ordered}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.currency} {parseFloat(row.item_price || 0).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'settlements' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>
                    <th style={{ padding: '12px 16px' }}>Event Group ID</th>
                    <th style={{ padding: '12px 16px' }}>Settlement ID</th>
                    <th style={{ padding: '12px 16px' }}>Processing Status</th>
                    <th style={{ padding: '12px 16px' }}>Transfer Status</th>
                    <th style={{ padding: '12px 16px' }}>Total Amount</th>
                    <th style={{ padding: '12px 16px' }}>Start Date</th>
                    <th style={{ padding: '12px 16px' }}>End Date</th>
                  </tr>
                </thead>
                <tbody>
                  {tables.amazon_settlements.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>
                        No records found in amazon_settlements table.
                      </td>
                    </tr>
                  ) : (
                    tables.amazon_settlements.map((row: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1d4ed8' }}>{row.financial_event_group_id}</td>
                        <td style={{ padding: '12px 16px', color: '#4b5563' }}>{row.settlement_id || 'N/A'}</td>
                        <td style={{ padding: '12px 16px' }}>{row.processing_status}</td>
                        <td style={{ padding: '12px 16px' }}>{row.fund_transfer_status}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#16a34a' }}>{row.currency} {parseFloat(row.original_total_amount || 0).toFixed(2)}</td>
                        <td style={{ padding: '12px 16px', color: '#4b5563' }}>{row.start_date ? new Date(row.start_date).toLocaleDateString() : 'N/A'}</td>
                        <td style={{ padding: '12px 16px', color: '#4b5563' }}>{row.end_date ? new Date(row.end_date).toLocaleDateString() : 'N/A'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'products' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>
                    <th style={{ padding: '12px 16px' }}>ASIN</th>
                    <th style={{ padding: '12px 16px' }}>SKU</th>
                    <th style={{ padding: '12px 16px' }}>Title</th>
                    <th style={{ padding: '12px 16px' }}>Brand</th>
                    <th style={{ padding: '12px 16px' }}>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {tables.amazon_products.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>
                        No records found in amazon_products table.
                      </td>
                    </tr>
                  ) : (
                    tables.amazon_products.map((row: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1d4ed8' }}>{row.asin}</td>
                        <td style={{ padding: '12px 16px', color: '#4b5563' }}>{row.seller_sku}</td>
                        <td style={{ padding: '12px 16px', color: '#111827' }}>{row.title}</td>
                        <td style={{ padding: '12px 16px', color: '#4b5563' }}>{row.brand}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.currency} {parseFloat(row.price || 0).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'inventory' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>
                    <th style={{ padding: '12px 16px' }}>SKU</th>
                    <th style={{ padding: '12px 16px' }}>ASIN</th>
                    <th style={{ padding: '12px 16px' }}>Fulfillable Qty</th>
                    <th style={{ padding: '12px 16px' }}>Inbound Qty</th>
                    <th style={{ padding: '12px 16px' }}>Reserved Qty</th>
                    <th style={{ padding: '12px 16px' }}>Warehouse Location</th>
                  </tr>
                </thead>
                <tbody>
                  {tables.amazon_inventory.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>
                        No records found in amazon_inventory table.
                      </td>
                    </tr>
                  ) : (
                    tables.amazon_inventory.map((row: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.seller_sku}</td>
                        <td style={{ padding: '12px 16px', color: '#1d4ed8' }}>{row.asin}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#16a34a' }}>{row.fulfillable_quantity}</td>
                        <td style={{ padding: '12px 16px', color: '#4b5563' }}>{row.inbound_working_quantity + row.inbound_shipped_quantity}</td>
                        <td style={{ padding: '12px 16px', color: '#b45309' }}>{row.reserved_quantity}</td>
                        <td style={{ padding: '12px 16px', color: '#4b5563' }}>{row.warehouse_location || 'Amazon FBA Hub'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
