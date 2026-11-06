"use client";
 
import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
 
function CashDebugContent() {
  const searchParams = useSearchParams();
  const fromDate = searchParams.get('from_date');
  const toDate = searchParams.get('to_date');
 
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
 
  useEffect(() => {
    const fetchDebugData = async () => {
      try {
        setLoading(true);
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
        if (!res.ok) {
          throw new Error(`API returned status ${res.status}`);
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
 
    fetchDebugData();
  }, [fromDate, toDate]);
 
  if (loading) {
    return (
      <div className="p-8 font-sans text-slate-600">
        <h2 className="text-lg font-bold text-slate-800 animate-pulse">Fetching Balance Sheet Debugging Information...</h2>
      </div>
    );
  }
 
  if (error) {
    return (
      <div className="p-8 font-sans text-rose-600 bg-rose-50 border border-rose-200 rounded-lg">
        <h2 className="text-lg font-bold">Error Loading Debugging Info</h2>
        <p className="mt-2 text-sm">{error}</p>
      </div>
    );
  }
 
  return (
    <div className="p-8 font-sans bg-slate-900 text-slate-100 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-slate-700 pb-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Balance Sheet Developer Panel</h1>
            <p className="text-slate-400 text-xs mt-1">Debugging cash balances, current assets, bank feeds, and parser mapping.</p>
          </div>
          <span className="bg-indigo-950 text-indigo-400 border border-indigo-900 text-xs px-2.5 py-1 rounded-full font-bold">
            Development Mode Only
          </span>
        </div>
 
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-800 border border-slate-700 p-5 rounded-lg">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Report Total Cash</h3>
            <p className="text-3xl font-extrabold mt-2 text-indigo-400">
              {data.currency || ""} {data.totalCash !== undefined ? new Intl.NumberFormat().format(data.totalCash) : "—"}
            </p>
          </div>
          <div className="bg-slate-800 border border-slate-700 p-5 rounded-lg">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Report Current Assets</h3>
            <p className="text-3xl font-extrabold mt-2 text-emerald-400">
              {data.currency || ""} {data.currentAssets !== undefined ? new Intl.NumberFormat().format(data.currentAssets) : "—"}
            </p>
          </div>
          <div className="bg-slate-800 border border-slate-700 p-5 rounded-lg">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bank Accounts Found</h3>
            <p className="text-3xl font-extrabold mt-2 text-amber-400">
              {data.bankAccounts?.length || 0} Accounts
            </p>
          </div>
        </div>
 
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-800 border border-slate-700 p-5 rounded-lg flex flex-col h-[500px]">
            <h3 className="text-sm font-bold border-b border-slate-700 pb-2 mb-3">Enterprise DTO Merged accounts</h3>
            <div className="flex-1 overflow-auto">
              <pre className="text-xs text-amber-300 font-mono bg-slate-850 p-3 rounded border border-slate-800">
                {JSON.stringify(data.bankAccounts, null, 2)}
              </pre>
            </div>
          </div>
 
          <div className="bg-slate-800 border border-slate-700 p-5 rounded-lg flex flex-col h-[500px]">
            <h3 className="text-sm font-bold border-b border-slate-700 pb-2 mb-3">Raw Balance Sheet Report Rows</h3>
            <div className="flex-1 overflow-auto">
              <pre className="text-xs text-emerald-400 font-mono bg-slate-850 p-3 rounded border border-slate-800">
                {JSON.stringify(data.rawBalanceSheet, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
 
export default function CashDebugPage() {
  return (
    <Suspense fallback={<div className="p-8 font-sans text-slate-600">Loading...</div>}>
      <CashDebugContent />
    </Suspense>
  );
}
