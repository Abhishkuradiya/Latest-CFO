"use client";

import React from 'react';
import { HelpCircle, Mail, MessageSquare, ExternalLink, ShieldCheck, FileText } from 'lucide-react';

export default function SupportPage() {
  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8 font-sans">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
          <HelpCircle className="h-4 w-4" />
          <span>Help & Assistance</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
          Virtual CFO Support Center
        </h1>
        <p className="text-sm text-slate-500">
          Get in touch with our technical team or explore platform documentation.
        </p>
      </div>

      {/* Support Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1 */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm hover:shadow-md transition space-y-4">
          <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Mail className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 text-base">Email Support</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Reach out directly to our engineering team for technical or integration queries.
            </p>
          </div>
          <a
            href="mailto:support@exuberantglobal.co.uk"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition"
          >
            <span>Contact via Email</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Card 2 */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm hover:shadow-md transition space-y-4">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 text-base">Integration Guide</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Learn how to connect Xero, Amazon SP-API, Stripe, and eBay data sources.
            </p>
          </div>
          <a
            href="/data-sources"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition"
          >
            <span>Manage Connectors</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Card 3 */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm hover:shadow-md transition space-y-4">
          <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 text-base">Database Health</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Inspect database connection status, active tables, and sync metrics.
            </p>
          </div>
          <a
            href="/settings/db-management"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 hover:text-purple-700 transition"
          >
            <span>Database Status</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
