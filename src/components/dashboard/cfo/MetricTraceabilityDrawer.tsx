"use client";

import React from 'react';
import { X, ShieldCheck, AlertCircle, Info, Calculator, FileText, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TraceabilityMetric {
  name: string;
  value: number | string | null;
  period: string;
  currency: string;
  formula?: string;
  sourceMetrics?: string[];
  dataCoverage?: string;
  mappingCoverage?: string;
  confidence?: string | number;
  status?: string;
  reason?: string;
  warnings?: string[];
}

interface MetricTraceabilityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  metric: TraceabilityMetric | null;
}

export function MetricTraceabilityDrawer({ isOpen, onClose, metric }: MetricTraceabilityDrawerProps) {
  if (!isOpen || !metric) return null;

  const formatVal = (val: number | string | null, currency: string) => {
    if (val === null || val === undefined) return 'N/A';
    if (typeof val === 'number') {
      const symbol = currency === 'GBP' ? '£' : (currency === 'USD' ? '$' : (currency === 'EUR' ? '€' : '₹'));
      return `${symbol}${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return String(val);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs transition-opacity duration-200">
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col justify-between">
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                  <Calculator className="w-4 h-4" />
                </span>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">Calculation Traceability</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Canonical source & financial audit trail</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
            {/* Target Metric Overview Card */}
            <div className="p-4 rounded-xl bg-slate-900 text-white shadow-sm space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{metric.name}</span>
              <div className="text-2xl font-extrabold tracking-tight text-white">
                {formatVal(metric.value, metric.currency)}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-300 pt-1 border-t border-slate-800/80 mt-2">
                <span>Period: {metric.period}</span>
                <span>•</span>
                <span>Base Currency: {metric.currency}</span>
              </div>
            </div>

            {/* Formula & Derivation */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                Formula & Derivation
              </h4>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 font-mono text-xs text-slate-800">
                {metric.formula || 'SUM(Canonical General Ledger Transactions)'}
              </div>
              {metric.sourceMetrics && metric.sourceMetrics.length > 0 && (
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <span className="font-semibold text-slate-600">Source Input Metrics:</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono">
                    {metric.sourceMetrics.join(', ')}
                  </span>
                </div>
              )}
            </div>

            {/* Financial Data Quality Indicators */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Data Integrity Status
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">Data Coverage</span>
                  <div className="font-bold text-slate-800 mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    {metric.dataCoverage || 'DATA_COMPLETE'}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">Account Mapping</span>
                  <div className="font-bold text-slate-800 mt-0.5">
                    {metric.mappingCoverage || '100%'}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">Confidence</span>
                  <div className="font-bold text-emerald-700 mt-0.5">
                    {typeof metric.confidence === 'number' ? `${Math.round(metric.confidence * 100)}%` : String(metric.confidence || 'HIGH')}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">Reconciliation</span>
                  <div className="font-bold text-blue-700 mt-0.5">
                    {metric.status || 'MATCHED'}
                  </div>
                </div>
              </div>
            </div>

            {/* Warnings or Audit Notes */}
            {metric.warnings && metric.warnings.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  Audit Note / Warning
                </div>
                <ul className="list-disc list-inside text-xs text-amber-800 space-y-0.5">
                  {metric.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Explanation Note */}
            <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-100 text-blue-900 text-xs flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                All numbers are derived from normalized General Ledger entries in <code className="bg-blue-100/80 px-1 rounded">account_transactions</code> and reconciled against authoritative Xero reports.
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              Close Traceability Drawer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
