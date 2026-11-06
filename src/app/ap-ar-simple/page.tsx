"use client";

import React, { useState, useEffect, useMemo } from 'react';

export default function APARClassicXeroReportPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<any>(null);

  // Filters
  const [asOnDate, setAsOnDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<'ALL' | 'AR' | 'AP' | 'OVERDUE'>('ALL');

  // Expanded Rows for Line Items
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/ap-ar-analytics?as_on_date=${asOnDate}&search=${encodeURIComponent(searchTerm)}`);
      if (!res.ok) throw new Error('Failed to fetch data');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [asOnDate]);

  const summary = data?.summary || { totalReceivables: 0, totalPayables: 0, netWorkingPosition: 0, week1CashIn: 0, week1CashOut: 0, week1NetCashFlow: 0, overdueARCount: 0, overdueAPCount: 0 };
  const contacts = data?.contacts || [];

  const filteredContacts = useMemo(() => {
    return contacts.filter((c: any) => {
      const matchesSearch = c.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.dueInvoices.some((inv: any) =>
          inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          inv.reference.toLowerCase().includes(searchTerm.toLowerCase())
        );

      let matchesType = true;
      if (filterType === 'AR') matchesType = c.totalReceivable > 0.001;
      else if (filterType === 'AP') matchesType = c.totalPayable > 0.001;
      else if (filterType === 'OVERDUE') matchesType = c.overdueCount > 0;

      return matchesSearch && matchesType;
    });
  }, [contacts, searchTerm, filterType]);

  const formatMoney = (val: number) => {
    if (val < 0) return `(£${Math.abs(val).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
    return `£${val.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div style={{ backgroundColor: '#ffffff', color: '#1f2937', minHeight: '100vh', width: '100vw', padding: '30px', fontFamily: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif', boxSizing: 'border-box' }}>
      
      {/* ========================================================================= */}
      {/* CLASSIC XERO REPORT HEADER */}
      {/* ========================================================================= */}
      <div style={{ borderBottom: '2px solid #e5e7eb', paddingBottom: '15px', marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, letterSpacing: '0.05em' }}>
          Xero Analytics Report
        </div>
        <h1 style={{ margin: '4px 0 0 0', fontSize: '24px', fontWeight: 800, color: '#111827' }}>
          Aged Payables & Receivables Summary (Unpaid Due Invoices)
        </h1>
        <div style={{ fontSize: '13px', color: '#4b5563', marginTop: '4px' }}>
          As at <strong>{formatDate(asOnDate)}</strong> • Showing ONLY active unpaid / authorised invoices (Fully paid invoices excluded).
        </div>
      </div>

      {/* ========================================================================= */}
      {/* REPORT CONTROLS & FILTERS TOOLBAR */}
      {/* ========================================================================= */}
      <div style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px 16px', marginBottom: '25px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '15px', fontSize: '13px' }}>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
          <span>Date:</span>
          <input
            type="date"
            value={asOnDate}
            onChange={(e) => setAsOnDate(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit' }}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
          <span>Search:</span>
          <input
            type="text"
            placeholder="Contact or invoice #"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', width: '220px', fontFamily: 'inherit' }}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
          <span>Filter:</span>
          <select
            value={filterType}
            onChange={(e: any) => setFilterType(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit' }}
          >
            <option value="ALL">All Contacts (AR + AP)</option>
            <option value="AR">Customers Only (AR)</option>
            <option value="AP">Vendors Only (AP)</option>
            <option value="OVERDUE">Overdue Only</option>
          </select>
        </label>

        <button
          onClick={fetchData}
          style={{ padding: '6px 16px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}
        >
          {loading ? 'Refreshing...' : 'Update Report'}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUMMARY SUMMARY KPI CARDS (LIGHT THEME) */}
      {/* ========================================================================= */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '15px', marginBottom: '25px' }}>
        
        {/* Receivables Card */}
        <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '15px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
            Total Receivables (AR)
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#14532d', marginTop: '4px' }}>
            {formatMoney(summary.totalReceivables)}
          </div>
          <div style={{ fontSize: '12px', color: '#15803d', marginTop: '6px' }}>
            {data?.meta?.totalActiveAR || 0} Unpaid Invoices ({summary.overdueARCount} Overdue)
          </div>
        </div>

        {/* Payables Card */}
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '15px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>
            Total Payables (AP)
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#7f1d1d', marginTop: '4px' }}>
            {formatMoney(summary.totalPayables)}
          </div>
          <div style={{ fontSize: '12px', color: '#b91c1c', marginTop: '6px' }}>
            {data?.meta?.totalActiveAP || 0} Unpaid Bills ({summary.overdueAPCount} Overdue)
          </div>
        </div>

        {/* Net Position Card */}
        <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '15px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
            Net Position (AR - AP)
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: summary.netWorkingPosition >= 0 ? '#15803d' : '#b91c1c', marginTop: '4px' }}>
            {formatMoney(summary.netWorkingPosition)}
          </div>
          <div style={{ fontSize: '12px', color: '#1d4ed8', marginTop: '6px' }}>
            {summary.netWorkingPosition >= 0 ? 'Positive Net Buffer' : 'Payables Exceed AR'}
          </div>
        </div>

        {/* 7-Day Cash Projection */}
        <div style={{ backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '8px', padding: '15px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b21a8', textTransform: 'uppercase' }}>
            7-Day Cash Forecast
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: summary.week1NetCashFlow >= 0 ? '#15803d' : '#b91c1c', marginTop: '4px' }}>
            {formatMoney(summary.week1NetCashFlow)}
          </div>
          <div style={{ fontSize: '12px', color: '#7e22ce', marginTop: '6px' }}>
            Cash In: {formatMoney(summary.week1CashIn)} | Out: {formatMoney(summary.week1CashOut)}
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* CLASSIC XERO REPORT DATA TABLE */}
      {/* ========================================================================= */}
      <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#ffffff' }}>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #d1d5db', color: '#374151', fontSize: '11px', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>
              <th style={{ padding: '12px 14px', width: '30px', textAlign: 'center' }}>#</th>
              <th style={{ padding: '12px 14px' }}>Contact Name</th>
              <th style={{ padding: '12px 14px' }}>Type</th>
              <th style={{ padding: '12px 14px' }}>Invoice / Bill #</th>
              <th style={{ padding: '12px 14px' }}>Reference</th>
              <th style={{ padding: '12px 14px' }}>Invoice Date</th>
              <th style={{ padding: '12px 14px' }}>Due Date</th>
              <th style={{ padding: '12px 14px' }}>Status</th>
              <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Amount</th>
              <th style={{ padding: '12px 14px', textAlign: 'right' }}>Amount Due</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} style={{ padding: '30px', textAlign: 'center', color: '#6b7280', fontWeight: 600 }}>
                  Loading Xero report data...
                </td>
              </tr>
            ) : filteredContacts.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: '30px', textAlign: 'center', color: '#6b7280', fontWeight: 600 }}>
                  No matching unpaid invoices found.
                </td>
              </tr>
            ) : (
              filteredContacts.map((c: any, cIdx: number) => {
                return (
                  <React.Fragment key={c.contactName}>
                    {/* Contact Group Header Row (Xero Style) */}
                    <tr style={{ backgroundColor: '#f9fafb', borderTop: '2px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', fontWeight: 700 }}>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#9ca3af' }}>{cIdx + 1}</td>
                      <td style={{ padding: '10px 14px', color: '#111827', fontSize: '14px' }}>
                        {c.contactName}
                        {c.overdueCount > 0 && (
                          <span style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#fee2e2', color: '#b91c1c', fontSize: '10px', fontWeight: 800 }}>
                            {c.overdueCount} Overdue
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#4b5563', fontSize: '11px' }}>
                        {c.contactType}
                      </td>
                      <td colSpan={3} style={{ padding: '10px 14px', color: '#4b5563', fontSize: '12px' }}>
                        AR: <span style={{ color: '#16a34a', fontWeight: 700 }}>{formatMoney(c.totalReceivable)}</span> | AP: <span style={{ color: '#dc2626', fontWeight: 700 }}>{formatMoney(c.totalPayable)}</span>
                      </td>
                      <td colSpan={2} style={{ padding: '10px 14px', fontSize: '12px' }}>
                        Net Balance: <strong>{formatMoney(c.netBalance)}</strong>
                      </td>
                      <td colSpan={2} style={{ padding: '10px 14px', textAlign: 'right', color: '#1d4ed8' }}>
                        {c.dueInvoices.length} Unpaid Invoices
                      </td>
                    </tr>

                    {/* Unpaid Invoices Rows under this Contact */}
                    {c.dueInvoices.map((inv: any) => {
                      const isOverdue = inv.daysOverdue > 0;
                      const isExpanded = expandedInvoice === inv.id;

                      return (
                        <React.Fragment key={inv.id}>
                          <tr style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: isExpanded ? '#eff6ff' : '#ffffff' }}>
                            <td style={{ padding: '10px 14px' }}></td>
                            <td style={{ padding: '10px 14px', paddingLeft: '24px', color: '#4b5563' }}>
                              ↳ {c.contactName}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                backgroundColor: inv.category === 'AR' ? '#dcfce7' : '#ffe4e6',
                                color: inv.category === 'AR' ? '#15803d' : '#be123c'
                              }}>
                                {inv.category === 'AR' ? 'Sales Invoice' : 'Vendor Bill'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', fontWeight: 800, color: '#2563eb' }}>
                              {inv.invoiceNumber}
                            </td>
        <td style={{ padding: '10px 14px', color: '#6b7280', fontFamily: 'var(--font-mono), ui-monospace, monospace' }}>
                              {inv.reference}
                            </td>
                            <td style={{ padding: '10px 14px', color: '#374151' }}>
                              {formatDate(inv.date)}
                            </td>
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: '#111827' }}>
                              {formatDate(inv.dueDate)}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              {isOverdue ? (
                                <span style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: '#fee2e2', color: '#b91c1c', fontSize: '11px', fontWeight: 800 }}>
                                  ⚠️ {inv.daysOverdue} Days Overdue
                                </span>
                              ) : (
                                <span style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#92400e', fontSize: '11px', fontWeight: 700 }}>
                                  ⏳ Due in {inv.daysUntilDue} Days
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', color: '#6b7280' }}>
                              {formatMoney(inv.total)}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, fontSize: '14px', color: inv.category === 'AR' ? '#15803d' : '#b91c1c' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                <span>{formatMoney(inv.amountDue)}</span>
                                {inv.lineItems && inv.lineItems.length > 0 && (
                                  <button
                                    onClick={() => setExpandedInvoice(isExpanded ? null : inv.id)}
                                    style={{ border: '1px solid #d1d5db', borderRadius: '4px', backgroundColor: '#f3f4f6', padding: '2px 6px', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}
                                  >
                                    {isExpanded ? 'Hide' : `${inv.lineItems.length} Items`}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Line Items Detail */}
                          {isExpanded && inv.lineItems && (
                            <tr style={{ backgroundColor: '#f0f9ff', borderBottom: '1px solid #bfdbfe' }}>
                              <td colSpan={10} style={{ padding: '12px 24px' }}>
                                <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '6px', color: '#1e40af' }}>
                                  Line Items Breakdown for Invoice #{inv.invoiceNumber}:
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1' }}>
                                  <thead>
                                    <tr style={{ backgroundColor: '#e2e8f0', textAlign: 'left', fontWeight: 700 }}>
                                      <th style={{ padding: '6px 10px' }}>Description</th>
                                      <th style={{ padding: '6px 10px' }}>Account Code</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'right' }}>Quantity</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'right' }}>Unit Price</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'right' }}>Line Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {inv.lineItems.map((li: any, idx: number) => (
                                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '6px 10px' }}>{li.description}</td>
        <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono), ui-monospace, monospace' }}>{li.accountCode || '—'}</td>
                                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>{li.quantity}</td>
                                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>{formatMoney(li.unitAmount)}</td>
                                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>{formatMoney(li.lineAmount)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
