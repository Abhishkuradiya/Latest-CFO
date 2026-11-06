"use client";
 
import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
 
function RevenueDebugContent() {
  const searchParams = useSearchParams();
  const fromDate = searchParams.get('from_date');
  const toDate = searchParams.get('to_date');
 
  const [loading, setLoading] = useState(true);
  const [debugData, setDebugData] = useState<any>(null);
 
  useEffect(() => {
    const fetchDebug = async () => {
      try {
        let url = '/api/xero/dashboard';
        const params = new URLSearchParams();
        if (fromDate && toDate) {
          params.set('from_date', fromDate);
          params.set('to_date', toDate);
        }
        const queryString = params.toString();
        if (queryString) {
          url += `?${queryString}`;
        }
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          setDebugData(json);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDebug();
  }, [fromDate, toDate]);
 
  const rawUrl = `/api/xero/dashboard${fromDate || toDate ? '?' : ''}${fromDate ? `from_date=${fromDate}` : ''}${fromDate && toDate ? '&' : ''}${toDate ? `to_date=${toDate}` : ''}`;
 
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6 text-slate-805 font-sans">
      <div className="border-b border-slate-100 pb-4">
        <h1 className="text-xl font-bold text-slate-900">Revenue Card Debugging & Development Page</h1>
        <p className="text-xs text-slate-500 mt-1">Inspection panel for accounting sales and Profit & Loss report mapping.</p>
      </div>
 
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Requests metadata */}
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-150">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Request Information</h3>
            <div className="space-y-2 text-xs">
              <div>
                <span className="font-bold text-slate-600 block">Raw API URL:</span>
                <code className="bg-slate-200 text-slate-805 px-1.5 py-0.5 rounded break-all block mt-1">{rawUrl}</code>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <span className="font-bold text-slate-600">Start Date:</span>
                  <p className="text-slate-800 font-semibold mt-0.5">{fromDate || 'Not provided (Default fallback 6M)'}</p>
                </div>
                <div>
                  <span className="font-bold text-slate-600">End Date:</span>
                  <p className="text-slate-800 font-semibold mt-0.5">{toDate || 'Not provided (Default fallback 6M)'}</p>
                </div>
              </div>
            </div>
          </div>
 
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-150 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Extracted Report Metrics</h3>
            {loading ? (
              <p className="text-xs text-slate-500 font-semibold">Loading data...</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white p-3 rounded border border-slate-100">
                  <span className="text-slate-400 font-bold block">Sales (P&L Revenue)</span>
                  <span className="text-base font-extrabold text-slate-800">${debugData?.plRevenue || 0}</span>
                </div>
                <div className="bg-white p-3 rounded border border-slate-100">
                  <span className="text-slate-400 font-bold block">Invoice Sales (Operational)</span>
                  <span className="text-base font-extrabold text-slate-800">${debugData?.invoiceRevenueMTD || 0}</span>
                </div>
                <div className="bg-white p-3 rounded border border-slate-100">
                  <span className="text-slate-400 font-bold block">Gross Profit</span>
                  <span className="text-base font-extrabold text-slate-800">${debugData?.grossProfit || 0}</span>
                </div>
                <div className="bg-white p-3 rounded border border-slate-100">
                  <span className="text-slate-400 font-bold block">Operating Expenses</span>
                  <span className="text-base font-extrabold text-slate-800">${debugData?.expenses || 0}</span>
                </div>
                <div className="bg-white p-3 rounded border border-slate-100 col-span-2">
                  <span className="text-slate-400 font-bold block">Net Profit</span>
                  <span className="text-base font-extrabold text-[#4f46e5]">${debugData?.netProfit || 0}</span>
                </div>
              </div>
            )}
          </div>
        </div>
 
        {/* Right Column: JSON Response code block */}
        <div className="flex flex-col bg-slate-900 text-slate-100 p-4 rounded-lg border border-slate-800 overflow-hidden min-h-[300px]">
          <span className="text-[10px] font-bold text-slate-505 uppercase tracking-widest mb-2 select-none">Response Summary JSON</span>
          <pre className="text-[11px] font-mono overflow-auto flex-1 p-2 bg-slate-950 rounded border border-slate-850 max-h-[400px]">
            {loading ? 'Fetching api response payload...' : JSON.stringify(debugData, null, 2)}
          </pre>
        </div>
      </div>
 
      <div className="bg-indigo-50/50 p-4 rounded-lg border border-indigo-100 text-xs text-indigo-950 space-y-2">
        <h4 className="font-bold">Enterprise P&L Parsing Strategy Information</h4>
        <p className="leading-relaxed font-semibold">
          The <code className="bg-indigo-100 px-1 rounded">ProfitAndLossService</code> maps accounting figures from the recursive <code className="bg-indigo-100 px-1 rounded">XeroReportParser</code>.
          Revenue matches the <code className="bg-indigo-150 px-1.5 rounded">Total Income</code> or <code className="bg-indigo-150 px-1.5 rounded">Sales</code> summary cell in the Xero visual row matrix hierarchy.
        </p>
      </div>
    </div>
  );
}
 
export default function RevenueDebugPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm font-semibold text-slate-400">Loading debugging panel...</div>}>
      <RevenueDebugContent />
    </Suspense>
  );
}
