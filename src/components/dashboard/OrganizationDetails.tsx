"use client";

import React from 'react';
import { MoreVertical, ExternalLink, Globe, Landmark, Calendar, DollarSign, Fingerprint } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OrganisationInfo {
  Name: string;
  OrganisationStatus: string;
  BaseCurrency: string;
  CountryCode: string;
  OrganisationID: string;
  FinancialYearEndDay?: number;
  FinancialYearEndMonth?: number;
}

export interface OrganizationDetailsProps {
  organisation: OrganisationInfo | null;
  lastSync: string | null;
  loading: boolean;
}

export default function OrganizationDetails({ organisation, lastSync, loading }: OrganizationDetailsProps) {
  // Mapping Country codes to Country Names
  const getCountryName = (code?: string) => {
    if (!code) return '—';
    const countries: Record<string, string> = {
      'IN': 'India',
      'US': 'United States',
      'UK': 'United Kingdom',
      'GB': 'United Kingdom',
      'AU': 'Australia',
      'NZ': 'New Zealand',
      'SG': 'Singapore',
      'CA': 'Canada'
    };
    return countries[code.toUpperCase()] || code;
  };

  // Deriving Financial Year
  const getFinancialYearRange = (endDay?: number, endMonth?: number) => {
    if (!endMonth) return 'Apr 2024 - Mar 2025'; // Fallback to standard Indian FY
    
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    
    const endMonthName = months[endMonth - 1];
    const startMonthIndex = endMonth === 12 ? 0 : endMonth;
    const startMonthName = months[startMonthIndex];
    
    const currentYear = new Date().getFullYear();
    if (endMonth === 12) {
      return `Jan ${currentYear} - Dec ${currentYear}`;
    }
    return `${startMonthName} ${currentYear} - ${endMonthName} ${currentYear + 1}`;
  };

  // Time format
  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return 'Never synced';
    const date = new Date(dateStr);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    return date.toLocaleDateString();
  };

  // Loading state skeleton
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4 animate-pulse select-none min-h-[380px] flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="h-4 w-32 bg-slate-100 rounded" />
          <div className="h-4 w-4 bg-slate-100 rounded" />
        </div>
        <div className="space-y-3 flex-1 pt-2">
          <div className="h-5 w-44 bg-slate-100 rounded" />
          <div className="space-y-2 pt-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex justify-between">
                <div className="h-3 w-20 bg-slate-100 rounded" />
                <div className="h-3 w-24 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-slate-100 pt-3">
          <div className="h-9 bg-slate-100 rounded-lg" />
        </div>
      </div>
    );
  }

  // Empty state
  if (!organisation) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col items-center justify-center text-center select-none min-h-[380px] hover:shadow-sm transition">
        <div className="h-11 w-11 rounded-full bg-slate-50 border border-slate-150 shadow-3xs flex items-center justify-center text-slate-400 mb-3.5">
          <Globe className="h-5 w-5 stroke-[1.5]" />
        </div>
        <h4 className="text-[12.5px] font-bold text-slate-700 mb-0.5">No Organization Linked</h4>
        <p className="text-[10.5px] text-slate-400 max-w-[200px] mb-4">
          Connect your Xero account to display business registration parameters.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs hover:shadow-sm transition duration-300 flex flex-col justify-between select-none min-h-[380px]">
      {/* Header Block */}
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <Globe className="h-4 w-4 text-blue-600" />
          <h3 className="text-[13.5px] font-bold text-slate-800">Organization Details</h3>
        </div>
        <button className="text-slate-400 hover:text-slate-600 transition p-1 rounded-md hover:bg-slate-50 outline-none">
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Main Branding Information */}
      <div className="pt-3 pb-4 shrink-0 flex items-center justify-between gap-3">
        <h4 className="font-extrabold text-slate-800 text-[14.5px] leading-tight truncate flex-1" title={organisation.Name}>
          {organisation.Name}
        </h4>
        <span className={cn(
          "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase leading-none shrink-0 border select-none",
          organisation.OrganisationStatus === 'ACTIVE'
            ? "bg-emerald-50 text-emerald-700 border-emerald-200/50"
            : "bg-amber-50 text-amber-700 border-amber-200/50"
        )}>
          {organisation.OrganisationStatus || 'ACTIVE'}
        </span>
      </div>

      {/* Structured Parameters Grid */}
      <div className="flex-1 space-y-3.5 pt-1">
        <div className="flex justify-between items-center text-[11px] min-h-[22px]">
          <span className="text-slate-400 font-semibold flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 stroke-[1.8]" />
            <span>Base Currency</span>
          </span>
          <span className="font-bold text-slate-700 uppercase">{organisation.BaseCurrency || 'USD'}</span>
        </div>

        <div className="flex justify-between items-center text-[11px] min-h-[22px]">
          <span className="text-slate-400 font-semibold flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 stroke-[1.8]" />
            <span>Financial Year</span>
          </span>
          <span className="font-bold text-slate-700">
            {getFinancialYearRange(organisation.FinancialYearEndDay, organisation.FinancialYearEndMonth)}
          </span>
        </div>

        <div className="flex justify-between items-center text-[11px] min-h-[22px]">
          <span className="text-slate-400 font-semibold flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 stroke-[1.8]" />
            <span>Country</span>
          </span>
          <span className="font-bold text-slate-700">{getCountryName(organisation.CountryCode)}</span>
        </div>

        <div className="flex justify-between items-center text-[11px] min-h-[22px]">
          <span className="text-slate-400 font-semibold flex items-center gap-1.5">
            <Fingerprint className="h-3.5 w-3.5 stroke-[1.8]" />
            <span>Organization ID</span>
          </span>
          <span className="font-bold text-slate-700 text-[10px] select-all truncate max-w-[120px]" title={organisation.OrganisationID}>
            {organisation.OrganisationID}
          </span>
        </div>

        <div className="flex justify-between items-center text-[11px] min-h-[22px]">
          <span className="text-slate-400 font-semibold flex items-center gap-1.5">
            <Landmark className="h-3.5 w-3.5 stroke-[1.8]" />
            <span>Last Sync</span>
          </span>
          <span className="font-bold text-slate-700">{formatTimeAgo(lastSync)}</span>
        </div>
      </div>

      {/* Button Block */}
      <div className="mt-4 shrink-0">
        <a
          href="https://my.xero.com"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition select-none shadow-3xs"
        >
          <span>View Organization</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
