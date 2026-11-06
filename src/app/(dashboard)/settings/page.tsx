"use client";

import React from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/common/page-container';
import { SectionHeader } from '@/components/common/section-header';
import { Layers, Activity, Database, ArrowRight, ShieldCheck } from 'lucide-react';
import { useFeaturePermissions } from '@/hooks/use-feature-permissions';

export default function SettingsPage() {
  const { isHealthScoreEnabled } = useFeaturePermissions();

  return (
    <PageContainer>
      <SectionHeader
        title="Corporate Settings Cockpit"
        description="Configure accounting mappings, business health targets, and data storage settings."
      />
      
      <div className={`grid grid-cols-1 ${isHealthScoreEnabled ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-6 mt-6`}>
        {/* Account Mappings Card */}
        <Link 
          href="/settings/account-mappings"
          className="group bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/50 rounded-lg text-blue-600 dark:text-blue-400">
                <Layers className="w-6 h-6" />
              </div>
              <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                Active
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 transition-colors">
              Account Mappings (Chart of Accounts)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Review and confirm tenant-isolated Xero general ledger classifications, subcategories, and CFO analytical tags.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 mt-6 group-hover:translate-x-1 transition-transform">
            <span>Configure Mappings</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        {/* Business Health Score Card (Only rendered when enabled by Admin) */}
        {isHealthScoreEnabled && (
          <Link 
            href="/settings/business-health-score"
            className="group bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg text-emerald-600 dark:text-emerald-400">
                  <Activity className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 transition-colors">
                Business Health Score Targets
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Customize profit margin thresholds, liquidity target ratios, and solvency weights for health score evaluation.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-6 group-hover:translate-x-1 transition-transform">
              <span>Configure Targets</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        )}

        {/* Database & Sync Management Card */}
        <Link 
          href="/settings/db-management"
          className="group bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-purple-500 dark:hover:border-purple-500 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-50 dark:bg-purple-950/50 rounded-lg text-purple-600 dark:text-purple-400">
                <Database className="w-6 h-6" />
              </div>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-purple-600 transition-colors">
              Database & Cache Management
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Verify PostgreSQL table records, check report sync freshness, and purge cached report summaries.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-purple-600 dark:text-purple-400 mt-6 group-hover:translate-x-1 transition-transform">
            <span>Inspect Database</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>
      </div>
    </PageContainer>
  );
}
