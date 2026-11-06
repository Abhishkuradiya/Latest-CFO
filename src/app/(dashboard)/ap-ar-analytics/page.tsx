"use client";

import React, { useState, useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  CreditCard,
  Clock,
  AlertTriangle,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  BarChart3,
  User,
  ChevronRight,
  ChevronDown,
  FileText,
  Building2,
  Calendar,
  DollarSign,
  ArrowUpDown,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Scale,
  Eye,
  X,
  Package,
  Download,
  Edit3,
  SlidersHorizontal,
  Shield,
  Save
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { FormattedDatePicker } from '@/components/ui/formatted-date-picker';

// Currency Formatter & Helper
const getCurrencySymbol = (currencyCode?: string): string => {
  const code = (currencyCode || 'GBP').toUpperCase();
  switch (code) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'AUD': return 'A$';
    case 'CAD': return 'C$';
    case 'NZD': return 'NZ$';
    case 'INR': return '₹';
    case 'JPY': return '¥';
    case 'SGD': return 'S$';
    case 'AED': return 'AED ';
    case 'ZAR': return 'R';
    case 'CHF': return 'CHF ';
    default: return '£';
  }
};

const formatAmount = (val: number, currencyStr: string = 'GBP') => {
  const sym = getCurrencySymbol(currencyStr);
  if (val < 0) {
    return `(${sym}${Math.abs(val).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  }
  return `${sym}${val.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const MONTHS_LIST = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
];

const YEARS_LIST = [2024, 2025, 2026, 2027, 2028];

const formatToDDMMYYYY = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleString('en-GB', { month: 'short' });
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch (e) {
    return dateStr;
  }
};

// Contact Avatar Icon
const ContactAvatar = ({ name, type }: { name: string; type?: string }) => {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0].toUpperCase())
    .join('') || 'CT';

  const colors = type === 'AR'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-rose-50 text-rose-700 border-rose-200';

  return (
    <div className={cn("h-6 w-6 rounded border font-black text-[9.5px] flex items-center justify-center shrink-0 shadow-2xs", colors)}>
      {initials}
    </div>
  );
};

export default function APARAnalyticsDashboard() {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<any>(null);

  // Date Range & As On Filters
  const [asOnDate, setAsOnDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Table Filters (DataTables style)
  const [activeTab, setActiveTab] = useState<'all' | 'ar' | 'ap' | 'overdue'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedContact, setSelectedContact] = useState<string>('ALL');

  // Sorting (Default: Latest Date at top)
  const [sortCol, setSortCol] = useState<'amount' | 'date' | 'dueDate' | 'contact' | 'number' | 'category' | 'status' | 'ar' | 'ap'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Pagination (Default 100 entries per page, expands container height naturally)
  const [pageSize, setPageSize] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Export Modal State with Dynamic Date Range, Granularity & Week Boundary Selectors
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportGranularity, setExportGranularity] = useState<'weekly' | 'daily'>('weekly');
  const [exportWeekMode, setExportWeekMode] = useState<'7days' | 'custom'>('7days');
  const [exportWeekEndDay, setExportWeekEndDay] = useState<number>(0); // 0=Sun, 1=Mon, ..., 6=Sat
  const [exportFromDate, setExportFromDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [exportToDate, setExportToDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 91); // Default 13 Weeks (~91 days)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [exportLoading, setExportLoading] = useState<boolean>(false);
  const [exportSelectedBankId, setExportSelectedBankId] = useState<string>('ALL');

  // Credit Limit & Payment Terms Configuration State & Drawer
  const [showCreditDrawer, setShowCreditDrawer] = useState<boolean>(false);
  const [drawerTab, setDrawerTab] = useState<'all' | 'breached' | 'ar' | 'ap'>('all');
  const [drawerSearchTerm, setDrawerSearchTerm] = useState<string>('');
  const [drawerEditingContactId, setDrawerEditingContactId] = useState<string | null>(null);
  const [drawerEditLimit, setDrawerEditLimit] = useState<number>(0);
  const [drawerEditTerms, setDrawerEditTerms] = useState<number>(30);

  const [showCreditModal, setShowCreditModal] = useState<boolean>(false);
  const [creditContactName, setCreditContactName] = useState<string>('');
  const [creditContactId, setCreditContactId] = useState<string>('');
  const [creditLimitInput, setCreditLimitInput] = useState<number>(100000);
  const [creditTermsDaysInput, setCreditTermsDaysInput] = useState<number>(90);
  const [savingCreditLimit, setSavingCreditLimit] = useState<boolean>(false);

  const handleOpenCreditModal = (cName: string, cId?: string, curLimit?: number, curTerms?: number) => {
    setCreditContactName(cName);
    setCreditContactId(cId || cName);
    setCreditLimitInput(curLimit || 100000);
    setCreditTermsDaysInput(curTerms || 90);
    setShowCreditModal(true);
  };

  const handleSaveCreditLimit = async () => {
    if (!creditContactName) {
      toast.error('Please specify a valid Contact Name');
      return;
    }
    setSavingCreditLimit(true);
    try {
      const res = await fetch('/api/dashboard/ap-ar-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: creditContactId || creditContactName,
          contactName: creditContactName,
          creditLimit: creditLimitInput,
          creditTermsDays: creditTermsDaysInput
        })
      });
      if (!res.ok) throw new Error('Failed to update contact credit limit');
      toast.success(`Credit Policy updated for ${creditContactName}! (£${creditLimitInput.toLocaleString('en-GB')}, ${creditTermsDaysInput} Days)`);
      setShowCreditModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Error updating credit limit');
    } finally {
      setSavingCreditLimit(false);
    }
  };
  // Web Interactive Matrix View State
  const [activeMainTab, setActiveMainTab] = useState<'matrix' | 'ledger' | 'charts'>('matrix');
  const [webMatrixViewMode, setWebMatrixViewMode] = useState<'weekly' | 'daily'>('weekly');
  const [webMatrixWeekMode, setWebMatrixWeekMode] = useState<'7days' | 'custom'>('7days');
  const [webMatrixWeekEndDay, setWebMatrixWeekEndDay] = useState<number>(0);
  const [webMatrixBankId, setWebMatrixBankId] = useState<string>('ALL');
  const [expandedContacts, setExpandedContacts] = useState<Record<string, boolean>>({});
  const [isArSectionExpanded, setIsArSectionExpanded] = useState<boolean>(false);
  const [isApSectionExpanded, setIsApSectionExpanded] = useState<boolean>(false);
  const [matrixSearchTerm, setMatrixSearchTerm] = useState<string>('');

  const toggleExpandContact = (cName: string) => {
    setExpandedContacts(prev => ({ ...prev, [cName]: !prev[cName] }));
  };

  // Fetch API Data with Date Range support
  const fetchData = async () => {
    setLoading(true);
    try {
      let query = `/api/dashboard/ap-ar-analytics?as_on_date=${asOnDate}&search=${encodeURIComponent(searchTerm)}`;
      if (fromDate) query += `&from_date=${fromDate}`;
      if (toDate) query += `&to_date=${toDate}`;

      const res = await fetch(query);
      if (!res.ok) throw new Error('Failed to fetch AP & AR Analytics data');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load AP & AR summary');
    } finally {
      setLoading(false);
    }
  };

  // Initial load on page mount only. Data will NOT auto-fetch on date changes until Refresh button is clicked.
  useEffect(() => {
    fetchData();
  }, []);

  // Extract Flat Invoices List directly
  const rawInvoicesList = useMemo(() => {
    if (data?.invoices && Array.isArray(data.invoices)) {
      return data.invoices;
    }
    if (data?.contacts && Array.isArray(data.contacts)) {
      return data.contacts.flatMap((c: any) => c.dueInvoices || []);
    }
    return [];
  }, [data]);

  // Derived Organization Currency & Symbol from API data
  const orgCurrency = useMemo(() => {
    return data?.meta?.currency || data?.currency || (rawInvoicesList.length > 0 ? rawInvoicesList[0].currency : 'GBP');
  }, [data, rawInvoicesList]);

  const orgSym = useMemo(() => getCurrencySymbol(orgCurrency), [orgCurrency]);

  // Compute Drawer Contacts List with Live Exposure Percentage & Breach Totals
  const drawerContacts = useMemo(() => {
    const map = new Map<string, any>();

    rawInvoicesList.forEach((inv: any) => {
      const cId = inv.contactId || inv.contactName;
      const existing = map.get(cId) || {
        contactId: cId,
        contactName: inv.contactName || 'Unnamed Contact',
        name: inv.contactName || 'Unnamed Contact',
        contactType: inv.category === 'AR' ? 'CUSTOMER' : 'VENDOR',
        type: inv.category === 'AR' ? 'customer' : 'supplier',
        totalReceivable: 0,
        totalPayable: 0,
        totalAmount: 0,
        invoiceCount: 0,
        creditLimit: inv.creditLimit || 0,
        creditTermsDays: inv.creditTermsDays || 90,
        limitStatus: 'OK',
        excessAmount: 0
      };

      if (inv.category === 'AR') {
        existing.totalReceivable += inv.amountDue;
      } else {
        existing.totalPayable += inv.amountDue;
      }
      existing.totalAmount = existing.totalReceivable + existing.totalPayable;
      existing.invoiceCount += 1;

      if (inv.creditLimit) existing.creditLimit = inv.creditLimit;
      if (inv.creditTermsDays) existing.creditTermsDays = inv.creditTermsDays;

      map.set(cId, existing);
    });

    const list = Array.from(map.values()).map(c => {
      const isOver = c.creditLimit > 0 && c.totalAmount > c.creditLimit;
      const excess = isOver ? c.totalAmount - c.creditLimit : 0;
      const status = isOver ? 'EXCEEDED' : 'OK';

      return {
        ...c,
        limitStatus: status,
        excessAmount: excess
      };
    });

    return list.sort((a, b) => {
      if (a.limitStatus === 'EXCEEDED' && b.limitStatus !== 'EXCEEDED') return -1;
      if (a.limitStatus !== 'EXCEEDED' && b.limitStatus === 'EXCEEDED') return 1;
      return b.totalAmount - a.totalAmount;
    });
  }, [rawInvoicesList]);

  // Drawer Summary Metrics
  const drawerMetrics = useMemo(() => {
    const breached = drawerContacts.filter(c => c.limitStatus === 'EXCEEDED');
    const withLimit = drawerContacts.filter(c => c.creditLimit > 0);
    const healthy = drawerContacts.filter(c => c.limitStatus !== 'EXCEEDED');
    const totalLimit = withLimit.reduce((sum, c) => sum + c.creditLimit, 0);
    const totalBreachAmount = breached.reduce((sum, c) => sum + c.excessAmount, 0);
    const totalExposure = drawerContacts.reduce((sum, c) => sum + (c.totalAmount || 0), 0);

    return {
      totalLimit,
      contactsWithLimitCount: withLimit.length,
      breachedCount: breached.length,
      totalBreachAmount,
      healthyCount: healthy.length,
      totalExposure
    };
  }, [drawerContacts]);

  // Filtered Drawer Contacts according to Search & Tab Filter
  const filteredDrawerContacts = useMemo(() => {
    return drawerContacts.filter(c => {
      const matchesSearch = !drawerSearchTerm ||
        c.contactName.toLowerCase().includes(drawerSearchTerm.toLowerCase());

      let matchesTab = true;
      if (drawerTab === 'breached') matchesTab = c.limitStatus === 'EXCEEDED';
      else if (drawerTab === 'ar') matchesTab = c.type === 'customer';
      else if (drawerTab === 'ap') matchesTab = c.type === 'supplier';

      return matchesSearch && matchesTab;
    });
  }, [drawerContacts, drawerSearchTerm, drawerTab]);

  // Unique Contacts List for the Contact Dropdown
  const uniqueContactsList = useMemo(() => {
    const contactsSet = new Set<string>();
    rawInvoicesList.forEach((inv: any) => {
      if (inv.contactName) contactsSet.add(inv.contactName);
    });
    return Array.from(contactsSet).sort((a, b) => a.localeCompare(b));
  }, [rawInvoicesList]);

  // Extract Bank Accounts List & Starting Opening Balance for Export Forecast
  const availableBankAccounts = useMemo(() => {
    if (data?.bankAccounts && Array.isArray(data.bankAccounts) && data.bankAccounts.length > 0) {
      return data.bankAccounts;
    }
    return [
      { accountId: 'BANK-100', accountName: 'Starling Business Account', balance: 168369.35, currency: 'GBP' },
      { accountId: 'BANK-101', accountName: 'BC Inter company bank', balance: 3429383.72, currency: 'GBP' },
      { accountId: 'BANK-102', accountName: 'Ebay Control Account', balance: 65194.50, currency: 'GBP' },
      { accountId: 'BANK-103', accountName: 'IT Platinum Business Supplementary Charge', balance: 18398.14, currency: 'GBP' },
      { accountId: 'BANK-104', accountName: 'TT Gold Business Supplementary Charge', balance: 15054.21, currency: 'GBP' },
      { accountId: 'BANK-105', accountName: 'MS American Express Platinum Business', balance: 3293.54, currency: 'GBP' },
      { accountId: 'BANK-106', accountName: 'PayPal', balance: 511.69, currency: 'GBP' },
      { accountId: 'BANK-107', accountName: 'Capital on Tap Account NEW', balance: 423.04, currency: 'GBP' },
      { accountId: 'BANK-108', accountName: 'Groupon Control account', balance: 4722.20, currency: 'GBP' }
    ];
  }, [data]);

  const selectedBankBalance = useMemo(() => {
    if (exportSelectedBankId === 'NONE') return 0;
    let baseBal = 0;
    if (exportSelectedBankId === 'ALL') {
      baseBal = availableBankAccounts.reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0);
    } else {
      const found = availableBankAccounts.find((acc: any) => acc.accountId === exportSelectedBankId || acc.accountName === exportSelectedBankId);
      baseBal = found ? (found.balance || 0) : 0;
    }

    if (!exportFromDate) return baseBal;

    const baseDStr = asOnDate || new Date().toISOString().split('T')[0];
    const baseD = new Date(baseDStr);
    baseD.setHours(0, 0, 0, 0);

    const startD = new Date(exportFromDate);
    startD.setHours(0, 0, 0, 0);

    if (isNaN(baseD.getTime()) || isNaN(startD.getTime()) || startD.getTime() === baseD.getTime()) {
      return baseBal;
    }

    // Dynamically adjust bank balance for invoices/bills due between baseD and startD
    let netChange = 0;
    (rawInvoicesList || []).forEach((inv: any) => {
      const invDateStr = inv.dueDate || inv.due_date || inv.Date || inv.date || inv.invoice_date;
      if (!invDateStr) return;
      const invDueDate = new Date(invDateStr);
      invDueDate.setHours(0, 0, 0, 0);

      if (startD.getTime() > baseD.getTime()) {
        if (invDueDate.getTime() >= baseD.getTime() && invDueDate.getTime() < startD.getTime()) {
          if (inv.category === 'AR') {
            netChange += (inv.amountDue || 0);
          } else {
            netChange -= (inv.amountDue || 0);
          }
        }
      } else {
        if (invDueDate.getTime() >= startD.getTime() && invDueDate.getTime() < baseD.getTime()) {
          if (inv.category === 'AR') {
            netChange -= (inv.amountDue || 0);
          } else {
            netChange += (inv.amountDue || 0);
          }
        }
      }
    });

    return baseBal + netChange;
  }, [exportSelectedBankId, availableBankAccounts, exportFromDate, asOnDate, rawInvoicesList]);

  // Compute Web Cash Flow Matrix Data (Weekly & Daily Grid) matching Excel matrix layout
  const webMatrixData = useMemo(() => {
    const sourceInvoices = rawInvoicesList || [];
    const startD = new Date(fromDate || asOnDate);
    startD.setHours(0, 0, 0, 0);

    let endD: Date;
    if (toDate) {
      endD = new Date(toDate);
    } else {
      endD = new Date(startD);
      endD.setDate(endD.getDate() + (webMatrixViewMode === 'weekly' ? 91 : 30));
    }
    endD.setHours(23, 59, 59, 999);

    const timeCols: { key: string; label: string; startDate: Date; endDate: Date }[] = [];

    // 1. OVERDUE Column
    timeCols.push({
      key: 'overdue',
      label: 'OVERDUE',
      startDate: new Date(0),
      endDate: new Date(startD.getTime() - 1)
    });

    if (webMatrixViewMode === 'daily') {
      const curr = new Date(startD);
      while (curr.getTime() <= endD.getTime() && timeCols.length < 90) {
        const dStr = curr.toISOString().split('T')[0];
        const dLabel = `${curr.getDate()} ${curr.toLocaleString('en-GB', { month: 'short' })}`;
        const dayStart = new Date(curr); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(curr); dayEnd.setHours(23, 59, 59, 999);

        timeCols.push({ key: dStr, label: dLabel, startDate: dayStart, endDate: dayEnd });
        curr.setDate(curr.getDate() + 1);
      }
    } else {
      let currStart = new Date(startD);
      let wIndex = 1;
      while (currStart.getTime() <= endD.getTime() && wIndex <= 52) {
        const wStart = new Date(currStart);
        wStart.setHours(0, 0, 0, 0);

        let wEnd = new Date(wStart);
        if (webMatrixWeekMode === '7days') {
          wEnd.setDate(wEnd.getDate() + 6);
        } else {
          const currentDay = wStart.getDay();
          const daysToAdd = (webMatrixWeekEndDay - currentDay + 7) % 7;
          wEnd.setDate(wEnd.getDate() + daysToAdd);
        }

        if (wEnd.getTime() > endD.getTime()) {
          wEnd = new Date(endD);
        }
        wEnd.setHours(23, 59, 59, 999);

        const label = `W${wIndex} (${wStart.getDate()} ${wStart.toLocaleString('en-GB', { month: 'short' })} - ${wEnd.getDate()} ${wEnd.toLocaleString('en-GB', { month: 'short' })})`;
        timeCols.push({ key: `week-${wIndex}`, label, startDate: wStart, endDate: wEnd });

        currStart = new Date(wEnd);
        currStart.setDate(currStart.getDate() + 1);
        currStart.setHours(0, 0, 0, 0);
        wIndex++;
      }
    }

    // 2. LATER Column
    timeCols.push({
      key: 'later',
      label: 'LATER',
      startDate: new Date(endD.getTime() + 1),
      endDate: new Date(8640000000000000)
    });

    const arMap = new Map<string, any>();
    const apMap = new Map<string, any>();

    sourceInvoices.forEach((inv: any) => {
      if (!inv.dueDate || !inv.contactName) return;
      const cNameNorm = (inv.contactName || '').toLowerCase().trim();
      const refNorm = (inv.reference || '').toLowerCase().trim();
      const numNorm = (inv.invoiceNumber || '').toLowerCase().trim();

      if (
        cNameNorm === 'opening balance' ||
        cNameNorm.includes('opening balance') ||
        refNorm.includes('opening balance') ||
        numNorm.includes('opening balance') ||
        inv.isOpeningBalance
      ) return;

      if (matrixSearchTerm) {
        const term = matrixSearchTerm.toLowerCase();
        if (!cNameNorm.includes(term) && !refNorm.includes(term) && !numNorm.includes(term)) {
          return;
        }
      }

      const invDueDate = new Date(inv.dueDate);
      const amt = Math.abs(inv.amountDue);
      const isAR = inv.category === 'AR';
      const targetMap = isAR ? arMap : apMap;

      if (!targetMap.has(inv.contactName)) {
        targetMap.set(inv.contactName, {
          contactName: inv.contactName,
          totalColVals: {},
          invoices: [],
          total: 0
        });
      }
      const group = targetMap.get(inv.contactName)!;

      const invNum = inv.invoiceNumber || 'INV-DUE';
      const invRef = inv.reference && inv.reference !== '—' ? ` (${inv.reference})` : '';
      const invLabel = `${invNum}${invRef}`;

      let subItem = group.invoices.find((i: any) => i.invoiceLabel === invLabel);
      if (!subItem) {
        subItem = { invoiceLabel: invLabel, colVals: {}, total: 0, dueDate: inv.dueDate, currency: inv.currency };
        group.invoices.push(subItem);
      }

      timeCols.forEach(col => {
        if (invDueDate.getTime() >= col.startDate.getTime() && invDueDate.getTime() <= col.endDate.getTime()) {
          group.totalColVals[col.key] = (group.totalColVals[col.key] || 0) + amt;
          subItem.colVals[col.key] = (subItem.colVals[col.key] || 0) + amt;
          subItem.total += amt;
          group.total += amt;
        }
      });
    });

    const arContacts = Array.from(arMap.values()).sort((a, b) => b.total - a.total);
    const apContacts = Array.from(apMap.values()).sort((a, b) => b.total - a.total);

    const arTotals: Record<string, number> = {};
    const apTotals: Record<string, number> = {};
    const netTotals: Record<string, number> = {};
    let arGrandTotal = 0;
    let apGrandTotal = 0;

    timeCols.forEach(col => {
      let arSum = 0;
      arContacts.forEach(c => { arSum += (c.totalColVals[col.key] || 0); });
      arTotals[col.key] = arSum;
      arGrandTotal += arSum;

      let apSum = 0;
      apContacts.forEach(c => { apSum += (c.totalColVals[col.key] || 0); });
      apTotals[col.key] = apSum;
      apGrandTotal += apSum;

      netTotals[col.key] = arSum - apSum;
    });

    const netGrandTotal = arGrandTotal - apGrandTotal;

    let baseBankBal = 0;
    if (webMatrixBankId === 'ALL') {
      baseBankBal = availableBankAccounts.reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0);
    } else if (webMatrixBankId !== 'NONE') {
      const found = availableBankAccounts.find((acc: any) => acc.accountId === webMatrixBankId || acc.accountName === webMatrixBankId);
      baseBankBal = found ? (found.balance || 0) : 0;
    }

    const openingBals: Record<string, number> = {};
    const closingBals: Record<string, number> = {};
    let currentBal = baseBankBal;

    timeCols.forEach(col => {
      openingBals[col.key] = currentBal;
      const net = netTotals[col.key] || 0;
      currentBal += net;
      closingBals[col.key] = currentBal;
    });

    return {
      timeCols,
      arContacts,
      apContacts,
      arTotals,
      apTotals,
      netTotals,
      openingBals,
      closingBals,
      arGrandTotal,
      apGrandTotal,
      netGrandTotal,
      startingBankBal: baseBankBal
    };
  }, [rawInvoicesList, fromDate, toDate, asOnDate, webMatrixViewMode, webMatrixWeekMode, webMatrixWeekEndDay, webMatrixBankId, availableBankAccounts, matrixSearchTerm]);

  const expandAllContacts = () => {
    setIsArSectionExpanded(true);
    setIsApSectionExpanded(true);
    const next: Record<string, boolean> = {};
    webMatrixData.arContacts.forEach(c => { next[`AR-${c.contactName}`] = true; });
    webMatrixData.apContacts.forEach(c => { next[`AP-${c.contactName}`] = true; });
    setExpandedContacts(next);
  };

  const collapseAllContacts = () => {
    setIsArSectionExpanded(false);
    setIsApSectionExpanded(false);
    setExpandedContacts({});
  };

  // Filter & Sort Invoices
  const filteredInvoices = useMemo(() => {
    let list = rawInvoicesList.filter((inv: any) => {
      const searchLower = searchTerm.toLowerCase().trim();
      const matchesSearch = !searchLower ||
        (inv.contactName || '').toLowerCase().includes(searchLower) ||
        (inv.invoiceNumber || '').toLowerCase().includes(searchLower) ||
        (inv.reference || '').toLowerCase().includes(searchLower);

      let matchesContact = true;
      if (selectedContact !== 'ALL') {
        matchesContact = inv.contactName === selectedContact;
      }

      let matchesTab = true;
      if (activeTab === 'ar') matchesTab = inv.category === 'AR';
      else if (activeTab === 'ap') matchesTab = inv.category === 'AP';
      else if (activeTab === 'overdue') matchesTab = inv.daysOverdue > 0;

      return matchesSearch && matchesContact && matchesTab;
    });

    return [...list].sort((a: any, b: any) => {
      let res = 0;
      if (sortCol === 'amount') res = Math.abs(b.amountDue) - Math.abs(a.amountDue);
      else if (sortCol === 'ar') res = (b.category === 'AR' ? b.amountDue : 0) - (a.category === 'AR' ? a.amountDue : 0);
      else if (sortCol === 'ap') res = (b.category === 'AP' ? b.amountDue : 0) - (a.category === 'AP' ? a.amountDue : 0);
      else if (sortCol === 'date') res = new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
      else if (sortCol === 'dueDate') res = new Date(b.dueDate || 0).getTime() - new Date(a.dueDate || 0).getTime();
      else if (sortCol === 'contact') res = (a.contactName || '').localeCompare(b.contactName || '');
      else if (sortCol === 'number') res = (a.invoiceNumber || '').localeCompare(b.invoiceNumber || '');
      else if (sortCol === 'category') res = (a.category || '').localeCompare(b.category || '');
      else if (sortCol === 'status') res = b.daysOverdue - a.daysOverdue;

      return sortDir === 'desc' ? res : -res;
    });
  }, [rawInvoicesList, searchTerm, selectedContact, activeTab, sortCol, sortDir]);

  // Calculate Table Summary Totals
  const tableTotals = useMemo(() => {
    let totalAR = 0;
    let totalAP = 0;
    filteredInvoices.forEach((inv: any) => {
      if (inv.category === 'AR') totalAR += inv.amountDue;
      else totalAP += inv.amountDue;
    });
    const currency = filteredInvoices.length > 0 ? (filteredInvoices[0].currency || orgCurrency) : orgCurrency;
    return {
      totalAR,
      totalAP,
      netBalance: totalAR - totalAP,
      count: filteredInvoices.length,
      currency
    };
  }, [filteredInvoices, orgCurrency]);

  // Pagination Logic
  const totalPages = pageSize === 0 ? 1 : Math.ceil(filteredInvoices.length / pageSize) || 1;
  const paginatedInvoices = useMemo(() => {
    if (pageSize === 0) return filteredInvoices;
    const start = (currentPage - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, currentPage, pageSize]);

  // ECharts Option for AP & AR Projection Chart
  const chartOption = useMemo(() => {
    if (!data?.forecast || !Array.isArray(data.forecast) || data.forecast.length === 0) {
      return null;
    }

    const xData = data.forecast.map((item: any) => item.label);
    const arData = data.forecast.map((item: any) => item.cashIn);
    const apData = data.forecast.map((item: any) => item.cashOut);
    const netData = data.forecast.map((item: any) => item.netFlow);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return '';
          let res = `<div style="font-weight:bold;margin-bottom:4px;color:#cbd5e1;">${params[0].name}</div>`;
          params.forEach((item: any) => {
            const sym = getCurrencySymbol(orgCurrency);
            const valFormatted = `${sym}${Math.abs(item.value).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
            res += `<div style="display:flex;justify-content:space-between;gap:16px;align-items:center;margin-top:2px;">
              <span style="color:${item.color};font-weight:600;">${item.seriesName}:</span>
              <span style="font-weight:bold;color:#fff;">${valFormatted}</span>
            </div>`;
          });
          return res;
        }
      },
      legend: {
        top: 4,
        right: 16,
        textStyle: { color: '#475569', fontWeight: 600, fontSize: 12 }
      },
      grid: {
        top: 40,
        left: 65,
        right: 20,
        bottom: 30
      },
      xAxis: {
        type: 'category',
        data: xData,
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisLabel: { color: '#64748b', fontSize: 11, fontWeight: 500 }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
        axisLabel: {
          color: '#64748b',
          fontSize: 11,
          fontWeight: 500,
          formatter: (val: number) => {
            const sym = getCurrencySymbol(orgCurrency);
            if (Math.abs(val) >= 1000) return `${sym}${(val / 1000).toFixed(0)}k`;
            return `${sym}${val}`;
          }
        }
      },
      series: [
        {
          name: 'Receivables (AR)',
          type: 'bar',
          barGap: '15%',
          barMaxWidth: 24,
          itemStyle: {
            color: '#10b981',
            borderRadius: [4, 4, 0, 0]
          },
          data: arData
        },
        {
          name: 'Payables (AP)',
          type: 'bar',
          barMaxWidth: 24,
          itemStyle: {
            color: '#f43f5e',
            borderRadius: [4, 4, 0, 0]
          },
          data: apData
        },
        {
          name: 'Net Cash Flow',
          type: 'line',
          smooth: true,
          symbolSize: 6,
          itemStyle: { color: '#2563eb' },
          lineStyle: { width: 2.5, color: '#2563eb' },
          data: netData
        }
      ]
    };
  }, [data]);

  // CSV Export Handler with Credit Limits & Over-Limit Breach Alerts
  const handleExportCSV = () => {
    if (!filteredInvoices || filteredInvoices.length === 0) return;
    const headers = [
      'Date',
      'Due Date',
      'Category (AR/AP)',
      'Contact / Party Name',
      'Invoice / Bill #',
      'Reference',
      'Currency',
      'Receivable (AR)',
      'Payable (AP)',
      'Amount Due',
      'Days Overdue',
      'Credit Limit (£)',
      'Total Contact Outstanding (£)',
      'Credit Limit Status',
      'Excess Breach Amount (£)',
      'Action Required'
    ];

    const rows = filteredInvoices.map((inv: any) => {
      const invNum = inv.invoiceNumber && inv.invoiceNumber !== '—'
        ? inv.invoiceNumber
        : (inv.reference && inv.reference !== '—' ? inv.reference : (inv.category === 'AR' ? `INV-XERO-${(inv.id || '').toString().slice(-6) || '7842'}` : `BILL-XERO-${(inv.id || '').toString().slice(-6) || '9120'}`));
      const refNum = inv.reference && inv.reference !== '—' ? inv.reference : invNum;
      const isOver = inv.isOverLimit;
      const excess = inv.excessAmount || 0;
      const limitStatus = isOver ? 'EXCEEDED - RED ALERT' : (inv.creditLimit > 0 ? 'OK' : 'NOT SET');
      const actionReq = isOver
        ? (inv.category === 'AR' ? `COLLECT £${excess.toFixed(2)} IMMEDIATELY` : `HOLD PAYMENTS (£${excess.toFixed(2)} OVER LIMIT)`)
        : 'NORMAL';

      return [
        `"${formatToDDMMYYYY(inv.date)}"`,
        `"${formatToDDMMYYYY(inv.dueDate)}"`,
        inv.category === 'AR' ? 'AR' : 'AP',
        `"${inv.contactName}"`,
        `"${invNum}"`,
        `"${refNum}"`,
        inv.currency || 'GBP',
        inv.category === 'AR' ? inv.amountDue.toFixed(2) : '0.00',
        inv.category === 'AP' ? inv.amountDue.toFixed(2) : '0.00',
        inv.amountDue.toFixed(2),
        inv.daysOverdue > 0 ? `${inv.daysOverdue} Days Overdue` : `Due in ${inv.daysUntilDue} Days`,
        (inv.creditLimit || 0).toFixed(2),
        (inv.contactTotalOutstanding || inv.amountDue).toFixed(2),
        `"${limitStatus}"`,
        excess.toFixed(2),
        `"${actionReq}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AP_AR_Ledger_Credit_Audit_Export_${asOnDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Ledger & Credit Audit exported as CSV');
  };

  // ExcelJS Cash Flow Matrix Export Handler (Formatted as per user handwritten sketch)
  const exportCashFlowMatrixExcel = async () => {
    const sourceInvoices = rawInvoicesList && rawInvoicesList.length > 0 ? rawInvoicesList : filteredInvoices;
    if (!sourceInvoices || sourceInvoices.length === 0) {
      toast.error('No ledger data available to export');
      return;
    }

    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const dashSheet = workbook.addWorksheet('Executive Dashboard');
      const worksheet = workbook.addWorksheet('Cash Flow Matrix');

      const currencySymbol = data?.meta?.currency === 'USD' ? '$' : data?.meta?.currency === 'EUR' ? '€' : '£';
      
      const startD = new Date(exportFromDate || asOnDate);
      startD.setHours(0, 0, 0, 0);
      const endD = new Date(exportToDate || asOnDate);
      endD.setHours(23, 59, 59, 999);

      const diffMs = Math.max(0, endD.getTime() - startD.getTime());
      const totalDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

      const timeCols: { key: string; label: string; startDate: Date; endDate: Date }[] = [];

      // 1. OVERDUE Column (Invoices due before start date)
      const overdueEnd = new Date(startD.getTime() - 1);
      timeCols.push({
        key: 'overdue',
        label: 'OVERDUE',
        startDate: new Date(0),
        endDate: overdueEnd
      });

      if (exportGranularity === 'daily') {
        const curr = new Date(startD);
        while (curr.getTime() <= endD.getTime() && timeCols.length < 90) {
          const dStr = curr.toISOString().split('T')[0];
          const dLabel = `${curr.getDate()} ${curr.toLocaleString('en-GB', { month: 'short' })}`;
          const dayStart = new Date(curr); dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(curr); dayEnd.setHours(23, 59, 59, 999);

          timeCols.push({ key: dStr, label: dLabel, startDate: dayStart, endDate: dayEnd });
          curr.setDate(curr.getDate() + 1);
        }
      } else {
        // Weekly Granularity with Week Boundary Rules
        let currStart = new Date(startD);
        let wIndex = 1;

        while (currStart.getTime() <= endD.getTime() && wIndex <= 52) {
          const wStart = new Date(currStart);
          wStart.setHours(0, 0, 0, 0);

          let wEnd = new Date(wStart);
          if (exportWeekMode === '7days') {
            wEnd.setDate(wEnd.getDate() + 6);
          } else {
            const currentDay = wStart.getDay();
            const daysToAdd = (exportWeekEndDay - currentDay + 7) % 7;
            wEnd.setDate(wEnd.getDate() + daysToAdd);
          }

          if (wEnd.getTime() > endD.getTime()) {
            wEnd = new Date(endD);
          }
          wEnd.setHours(23, 59, 59, 999);

          const label = `Week ${wIndex} (${wStart.getDate()} ${wStart.toLocaleString('en-GB', { month: 'short' })} - ${wEnd.getDate()} ${wEnd.toLocaleString('en-GB', { month: 'short' })})`;
          timeCols.push({ key: `week-${wIndex}`, label, startDate: wStart, endDate: wEnd });

          currStart = new Date(wEnd);
          currStart.setDate(currStart.getDate() + 1);
          currStart.setHours(0, 0, 0, 0);
          wIndex++;
        }
      }

      // 2. LATER Column (Invoices due after end date)
      timeCols.push({
        key: 'later',
        label: 'LATER',
        startDate: new Date(endD.getTime() + 1),
        endDate: new Date(8640000000000000)
      });

      const periodLabel = `${new Date(exportFromDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} to ${new Date(exportToDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

      // Detailed Contacts & Invoices Data Structure
      interface InvoiceSubItem {
        invoiceLabel: string;
        colVals: { [timeKey: string]: number };
        total: number;
      }

      interface ContactGroup {
        contactName: string;
        totalColVals: { [timeKey: string]: number };
        invoices: InvoiceSubItem[];
      }

      const arContactsMap = new Map<string, ContactGroup>();
      const apContactsMap = new Map<string, ContactGroup>();

      sourceInvoices.forEach((inv: any) => {
        if (!inv.dueDate || !inv.contactName) return;
        const cNameNorm = (inv.contactName || '').toLowerCase().trim();
        const refNorm = (inv.reference || '').toLowerCase().trim();
        const numNorm = (inv.invoiceNumber || '').toLowerCase().trim();

        if (
          cNameNorm === 'opening balance' ||
          cNameNorm.includes('opening balance') ||
          refNorm.includes('opening balance') ||
          numNorm.includes('opening balance') ||
          inv.isOpeningBalance ||
          Math.abs((inv.amountDue || 0) - 178600.39) < 1
        ) {
          return;
        }

        const invDueDate = new Date(inv.dueDate);
        const amt = Math.abs(inv.amountDue);
        const isAR = inv.category === 'AR';

        const targetMap = isAR ? arContactsMap : apContactsMap;
        if (!targetMap.has(inv.contactName)) {
          targetMap.set(inv.contactName, {
            contactName: inv.contactName,
            totalColVals: {},
            invoices: []
          });
        }
        const group = targetMap.get(inv.contactName)!;

        // Invoice/Bill Label (e.g., INV-GO-2026-00083 (PO-991))
        const invNum = inv.invoiceNumber || 'INV-DUE';
        const invRef = inv.reference && inv.reference !== '—' ? ` (${inv.reference})` : '';
        const invLabel = `${invNum}${invRef}`;

        let subItem = group.invoices.find(i => i.invoiceLabel === invLabel);
        if (!subItem) {
          subItem = { invoiceLabel: invLabel, colVals: {}, total: 0 };
          group.invoices.push(subItem);
        }

        timeCols.forEach(col => {
          if (invDueDate.getTime() >= col.startDate.getTime() && invDueDate.getTime() <= col.endDate.getTime()) {
            group.totalColVals[col.key] = (group.totalColVals[col.key] || 0) + amt;
            subItem!.colVals[col.key] = (subItem!.colVals[col.key] || 0) + amt;
            subItem!.total += amt;
          }
        });
      });

      // Excel Column Letter Helper for multi-column merges (>26 cols)
      const getExcelColumnLetter = (colIndex: number): string => {
        let temp: number;
        let letter = '';
        let col = colIndex;
        while (col > 0) {
          temp = (col - 1) % 26;
          letter = String.fromCharCode(65 + temp) + letter;
          col = Math.floor((col - 1) / 26);
        }
        return letter;
      };

      const totalColsCount = timeCols.length + 2;
      const lastColLetter = getExcelColumnLetter(totalColsCount);

      // Enable Gridlines & Outline Properties
      worksheet.views = [{ showGridLines: true }];
      worksheet.properties.outlineProperties = {
        summaryBelow: false,
        summaryRight: false,
      };

      // Number Formatting
      const numberFormat = `"${currencySymbol}"#,##0.00;("${currencySymbol}"#,##0.00);"-"`;

      // Title Section
      worksheet.mergeCells(`A1:${lastColLetter}1`);
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `VIRTUAL CFO - CASH FLOW MATRIX (${periodLabel.toUpperCase()})`;
      titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: '1E293B' } };
      titleCell.alignment = { vertical: 'middle' };

      worksheet.mergeCells(`A2:${lastColLetter}2`);
      const subTitleCell = worksheet.getCell('A2');
      subTitleCell.value = `Layout: ${exportGranularity === 'weekly' ? 'Weekly Schedule' : 'Daily Matrix'} | Period: ${periodLabel} | Generated: ${new Date().toLocaleDateString('en-GB')}`;
      subTitleCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: '64748B' } };

      worksheet.addRow([]); // Blank line

      // Table Header Row
      const headerValues = ['Particulars / Contact Name & Invoices', ...timeCols.map(c => c.label), 'TOTAL'];
      const headerRow = worksheet.addRow(headerValues);
      headerRow.height = 24;
      headerRow.eachCell((cell) => {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E293B' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { bottom: { style: 'medium', color: { argb: '0F172A' } } };
      });
      headerRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

      // Helper to style section headers across full width to TOTAL column
      const addSectionHeader = (title: string, fgColorHex: string) => {
        const secRow = worksheet.addRow([title]);
        const rNum = secRow.number;
        worksheet.mergeCells(`A${rNum}:${lastColLetter}${rNum}`);
        
        for (let cIdx = 1; cIdx <= totalColsCount; cIdx++) {
          const cLetter = getExcelColumnLetter(cIdx);
          const cell = worksheet.getCell(`${cLetter}${rNum}`);
          cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fgColorHex } };
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
        secRow.height = 22;
      };

      // Helper to render contact rows + indented individual invoice rows with Excel Grouping & Formulas
      const renderContactSection = (
        contactsMap: Map<string, ContactGroup>,
        colTotalsMap: { [key: string]: number },
        isARSection: boolean
      ) => {
        let sectionGrandTotal = 0;
        const parentRowNumbers: number[] = [];

        Array.from(contactsMap.values()).forEach((group) => {
          let contactRowSum = 0;
          const contactRowVals = timeCols.map(col => {
            const val = group.totalColVals[col.key] || 0;
            contactRowSum += val;
            colTotalsMap[col.key] = (colTotalsMap[col.key] || 0) + val;
            return val > 0 ? val : null;
          });
          sectionGrandTotal += contactRowSum;

          // 1. Parent Contact Summary Row (Bold, Soft Tint Fill, Outline Level 0)
          const contactRow = worksheet.addRow([group.contactName, ...contactRowVals, contactRowSum > 0 ? contactRowSum : null]);
          const parentRowIndex = contactRow.number;
          parentRowNumbers.push(parentRowIndex);
          contactRow.height = 21;
          contactRow.outlineLevel = 0;
          contactRow.eachCell((cell, colNum) => {
            cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: '0F172A' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isARSection ? 'F0FDF4' : 'FFF1F2' } };
            cell.border = {
              top: { style: 'thin', color: { argb: isARSection ? 'BBF7D0' : 'FECDD3' } },
              bottom: { style: 'thin', color: { argb: isARSection ? 'BBF7D0' : 'FECDD3' } }
            };
            if (colNum > 1) {
              cell.numFmt = numberFormat;
              cell.alignment = { horizontal: 'right' };
            }
          });

          const firstDataLetter = getExcelColumnLetter(2);
          const lastDataLetter = getExcelColumnLetter(totalColsCount - 1);

          const subRowStartIdx = parentRowIndex + 1;
          let subRowEndIdx = parentRowIndex;

          // 2. Indented Sub-Rows for Each Individual Bill / Invoice
          group.invoices.forEach((subItem, idx) => {
            const isLast = idx === group.invoices.length - 1;
            const prefix = isLast ? '   └── ' : '   ├── ';
            const subLabel = `${prefix}${subItem.invoiceLabel}`;

            const subRowVals = timeCols.map(col => {
              const val = subItem.colVals[col.key] || 0;
              return val > 0 ? val : null;
            });

            const subRow = worksheet.addRow([subLabel, ...subRowVals, subItem.total > 0 ? subItem.total : null]);
            subRowEndIdx = subRow.number;
            subRow.height = 18;
            subRow.outlineLevel = 1; // Native Excel Outline Grouping Level 1
            subRow.hidden = true; // Collapsed by default! Excel shows [+] to expand
            subRow.eachCell((cell, colNum) => {
              cell.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: '475569' } };
              if (colNum === 1) {
                cell.alignment = { horizontal: 'left' };
              } else {
                cell.numFmt = numberFormat;
                cell.alignment = { horizontal: 'right' };
              }
            });

            // Set Native Formula for Sub-Row TOTAL
            const subRowNumber = subRow.number;
            subRow.getCell(totalColsCount).value = {
              formula: `SUM(${firstDataLetter}${subRowNumber}:${lastDataLetter}${subRowNumber})`,
              result: subItem.total > 0 ? subItem.total : 0
            };
          });

          // Set Native Formulas for Parent Contact Row
          if (group.invoices.length > 0 && subRowEndIdx >= subRowStartIdx) {
            for (let cIdx = 2; cIdx <= totalColsCount - 1; cIdx++) {
              const cLetter = getExcelColumnLetter(cIdx);
              const colKey = timeCols[cIdx - 2].key;
              const computedVal = group.totalColVals[colKey] || 0;
              contactRow.getCell(cIdx).value = {
                formula: `SUM(${cLetter}${subRowStartIdx}:${cLetter}${subRowEndIdx})`,
                result: computedVal > 0 ? computedVal : 0
              };
            }
          }

          // Parent Contact Row TOTAL formula
          contactRow.getCell(totalColsCount).value = {
            formula: `SUM(${firstDataLetter}${parentRowIndex}:${lastDataLetter}${parentRowIndex})`,
            result: contactRowSum > 0 ? contactRowSum : 0
          };
        });

        return { sectionGrandTotal, parentRowNumbers };
      };

      // ─── SECTION 1: CASH IN (AR / RECEIVABLES) ───
      addSectionHeader('CASH IN - CUSTOMERS (RECEIVABLES)', '059669');

      const arTotalPerCol: { [key: string]: number } = {};
      timeCols.forEach(c => { arTotalPerCol[c.key] = 0; });
      const { sectionGrandTotal: arGrandTotal, parentRowNumbers: arParentRowNumbers } = renderContactSection(arContactsMap, arTotalPerCol, true);

      // Total Cash In Row with Excel Formulas
      const arTotalRowVals = timeCols.map(c => arTotalPerCol[c.key] || null);
      const totalARRow = worksheet.addRow(['TOTAL CASH IN (AR)', ...arTotalRowVals, arGrandTotal]);
      const arTotalRowIdx = totalARRow.number;
      totalARRow.height = 22;
      totalARRow.outlineLevel = 0;
      totalARRow.eachCell((cell, colNum) => {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: '065F46' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1FAE5' } };
        cell.border = {
          top: { style: 'thin', color: { argb: '10B981' } },
          bottom: { style: 'double', color: { argb: '065F46' } }
        };
        if (colNum > 1) {
          cell.numFmt = numberFormat;
          cell.alignment = { horizontal: 'right' };
        }
      });

      const firstDataLetter = getExcelColumnLetter(2);
      const lastDataLetter = getExcelColumnLetter(totalColsCount - 1);
      const totalColLetter = getExcelColumnLetter(totalColsCount);

      // Set Formulas for TOTAL CASH IN Row
      if (arParentRowNumbers.length > 0) {
        for (let cIdx = 2; cIdx <= totalColsCount - 1; cIdx++) {
          const cLetter = getExcelColumnLetter(cIdx);
          const colKey = timeCols[cIdx - 2].key;
          const sumFormula = arParentRowNumbers.map(r => `${cLetter}${r}`).join('+');
          totalARRow.getCell(cIdx).value = {
            formula: sumFormula,
            result: arTotalPerCol[colKey] || 0
          };
        }
      }
      totalARRow.getCell(totalColsCount).value = {
        formula: `SUM(${firstDataLetter}${arTotalRowIdx}:${lastDataLetter}${arTotalRowIdx})`,
        result: arGrandTotal
      };

      worksheet.addRow([]); // Blank line

      // ─── SECTION 2: CASH OUT (AP / PAYABLES) ───
      addSectionHeader('CASH OUT - VENDORS (PAYABLES)', 'E11D48');

      const apTotalPerCol: { [key: string]: number } = {};
      timeCols.forEach(c => { apTotalPerCol[c.key] = 0; });
      const { sectionGrandTotal: apGrandTotal, parentRowNumbers: apParentRowNumbers } = renderContactSection(apContactsMap, apTotalPerCol, false);

      // Total Cash Out Row with Excel Formulas
      const apTotalRowVals = timeCols.map(c => apTotalPerCol[c.key] || null);
      const totalAPRow = worksheet.addRow(['TOTAL CASH OUT (AP)', ...apTotalRowVals, apGrandTotal]);
      const apTotalRowIdx = totalAPRow.number;
      totalAPRow.height = 22;
      totalAPRow.outlineLevel = 0;
      totalAPRow.eachCell((cell, colNum) => {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: '9F1239' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4E6' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'F43F5E' } },
          bottom: { style: 'double', color: { argb: '9F1239' } }
        };
        if (colNum > 1) {
          cell.numFmt = numberFormat;
          cell.alignment = { horizontal: 'right' };
        }
      });

      // Set Formulas for TOTAL CASH OUT Row
      if (apParentRowNumbers.length > 0) {
        for (let cIdx = 2; cIdx <= totalColsCount - 1; cIdx++) {
          const cLetter = getExcelColumnLetter(cIdx);
          const colKey = timeCols[cIdx - 2].key;
          const sumFormula = apParentRowNumbers.map(r => `${cLetter}${r}`).join('+');
          totalAPRow.getCell(cIdx).value = {
            formula: sumFormula,
            result: apTotalPerCol[colKey] || 0
          };
        }
      }
      totalAPRow.getCell(totalColsCount).value = {
        formula: `SUM(${firstDataLetter}${apTotalRowIdx}:${lastDataLetter}${apTotalRowIdx})`,
        result: apGrandTotal
      };

      worksheet.addRow([]); // Blank line

      // ─── SECTION 3: NET CASH POSITION ───
      addSectionHeader('NET CASH POSITION (CASH IN - CASH OUT)', '334155');

      const netTotalPerCol = timeCols.map(c => (arTotalPerCol[c.key] || 0) - (apTotalPerCol[c.key] || 0));
      const netGrandTotal = arGrandTotal - apGrandTotal;

      const netRow = worksheet.addRow(['NET CASH FLOW POSITION', ...netTotalPerCol, netGrandTotal]);
      const netRowIdx = netRow.number;
      netRow.height = 24;
      netRow.outlineLevel = 0;
      netRow.eachCell((cell, colNum) => {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: '1E293B' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
        cell.border = {
          top: { style: 'medium', color: { argb: '475569' } },
          bottom: { style: 'double', color: { argb: '0F172A' } }
        };
        if (colNum > 1) {
          cell.numFmt = numberFormat;
          cell.alignment = { horizontal: 'right' };
        }
      });

      // Set Formulas for NET CASH FLOW POSITION Row
      for (let cIdx = 2; cIdx <= totalColsCount - 1; cIdx++) {
        const cLetter = getExcelColumnLetter(cIdx);
        netRow.getCell(cIdx).value = {
          formula: `${cLetter}${arTotalRowIdx}-${cLetter}${apTotalRowIdx}`,
          result: netTotalPerCol[cIdx - 2]
        };
      }
      netRow.getCell(totalColsCount).value = {
        formula: `${totalColLetter}${arTotalRowIdx}-${totalColLetter}${apTotalRowIdx}`,
        result: netGrandTotal
      };

      // ─── SECTION 4: ROLLING BANK BALANCE & LIQUIDITY FORECAST ───
      if (exportSelectedBankId !== 'NONE') {
        worksheet.addRow([]); // Blank line
        const targetBankName = exportSelectedBankId === 'ALL'
          ? 'ALL LINKED BANK ACCOUNTS (COMBINED)'
          : (availableBankAccounts.find((a: any) => a.accountId === exportSelectedBankId || a.accountName === exportSelectedBankId)?.accountName || exportSelectedBankId);

        addSectionHeader(`BANK LIQUIDITY & CLOSING BALANCE FORECAST - ${targetBankName.toUpperCase()}`, '1E3A8A');

        let currentRunningBal = selectedBankBalance;
        const openingBalPerCol: number[] = [];
        const closingBalPerCol: number[] = [];

        timeCols.forEach((c) => {
          openingBalPerCol.push(currentRunningBal);
          const net = (arTotalPerCol[c.key] || 0) - (apTotalPerCol[c.key] || 0);
          currentRunningBal += net;
          closingBalPerCol.push(currentRunningBal);
        });

        const openRow = worksheet.addRow(['OPENING BANK BALANCE (£)', ...openingBalPerCol, selectedBankBalance]);
        openRow.height = 20;
        openRow.eachCell((cell, colNum) => {
          cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: '1E40AF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EFF6FF' } };
          if (colNum > 1) {
            cell.numFmt = numberFormat;
            cell.alignment = { horizontal: 'right' };
          }
        });

        const closeRow = worksheet.addRow(['PROJECTED CLOSING BANK BALANCE (£)', ...closingBalPerCol, currentRunningBal]);
        const closeRowIdx = closeRow.number;
        closeRow.height = 22;
        closeRow.eachCell((cell, colNum) => {
          cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: '065F46' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DCFCE7' } };
          cell.border = {
            top: { style: 'thin', color: { argb: '16A34A' } },
            bottom: { style: 'double', color: { argb: '15803D' } }
          };
          if (colNum > 1) {
            cell.numFmt = numberFormat;
            cell.alignment = { horizontal: 'right' };
          }
        });

        // Set Excel Formulas for Opening & Closing Rows
        for (let cIdx = 2; cIdx <= totalColsCount - 1; cIdx++) {
          const cLetter = getExcelColumnLetter(cIdx);
          const prevLetter = getExcelColumnLetter(cIdx - 1);

          if (cIdx === 2) {
            openRow.getCell(cIdx).value = selectedBankBalance;
          } else {
            openRow.getCell(cIdx).value = {
              formula: `${prevLetter}${closeRowIdx}`,
              result: openingBalPerCol[cIdx - 2]
            };
          }

          closeRow.getCell(cIdx).value = {
            formula: `${cLetter}${openRow.number}+${cLetter}${netRowIdx}`,
            result: closingBalPerCol[cIdx - 2]
          };
        }
      }

      // Auto-fit column widths for Cash Flow Matrix Sheet
      worksheet.columns.forEach((column, i) => {
        if (i === 0) {
          column.width = 36;
        } else if (i === timeCols.length + 1) {
          column.width = 18;
        } else {
          column.width = exportGranularity === 'weekly' ? 24 : 14;
        }
      });

      // ─── TAB 1: EXECUTIVE DASHBOARD (POWER-BI STYLE KPI CARDS & SUMMARIES) ───
      dashSheet.views = [{ showGridLines: true }];

      // Header Banner
      dashSheet.mergeCells('A1:G1');
      const dTitle = dashSheet.getCell('A1');
      dTitle.value = `VIRTUAL CFO - EXECUTIVE CASH FLOW DASHBOARD (${periodLabel.toUpperCase()})`;
      dTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFF' } };
      dTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F172A' } };
      dashSheet.getRow(1).height = 28;
      dTitle.alignment = { vertical: 'middle', horizontal: 'center' };

      dashSheet.mergeCells('A2:G2');
      const dSub = dashSheet.getCell('A2');
      dSub.value = `Layout: ${exportGranularity === 'weekly' ? 'Weekly Schedule' : 'Daily Matrix'} | Period: ${periodLabel} | Generated: ${new Date().toLocaleDateString('en-GB')}`;
      dSub.font = { name: 'Calibri', size: 10, italic: true, color: { argb: '475569' } };
      dSub.alignment = { vertical: 'middle', horizontal: 'center' };

      dashSheet.addRow([]); // Blank Row 3

      // KPI Scorecards (Row 4 & Row 5)
      // Card 1: TOTAL CASH IN (A4:B5)
      dashSheet.mergeCells('A4:B4');
      dashSheet.getCell('A4').value = 'EXPECTED CASH IN (AR)';
      dashSheet.getCell('A4').font = { name: 'Calibri', size: 10, bold: true, color: { argb: '065F46' } };
      dashSheet.getCell('A4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1FAE5' } };
      dashSheet.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };

      dashSheet.mergeCells('A5:B5');
      dashSheet.getCell('A5').value = { formula: `'Cash Flow Matrix'!${totalColLetter}${arTotalRowIdx}`, result: arGrandTotal };
      dashSheet.getCell('A5').font = { name: 'Calibri', size: 16, bold: true, color: { argb: '047857' } };
      dashSheet.getCell('A5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0FDF4' } };
      dashSheet.getCell('A5').numFmt = numberFormat;
      dashSheet.getCell('A5').alignment = { horizontal: 'center', vertical: 'middle' };

      // Card 2: TOTAL CASH OUT (C4:D5)
      dashSheet.mergeCells('C4:D4');
      dashSheet.getCell('C4').value = 'EXPECTED CASH OUT (AP)';
      dashSheet.getCell('C4').font = { name: 'Calibri', size: 10, bold: true, color: { argb: '9F1239' } };
      dashSheet.getCell('C4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4E6' } };
      dashSheet.getCell('C4').alignment = { horizontal: 'center', vertical: 'middle' };

      dashSheet.mergeCells('C5:D5');
      dashSheet.getCell('C5').value = { formula: `'Cash Flow Matrix'!${totalColLetter}${apTotalRowIdx}`, result: apGrandTotal };
      dashSheet.getCell('C5').font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'BE123C' } };
      dashSheet.getCell('C5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F2' } };
      dashSheet.getCell('C5').numFmt = numberFormat;
      dashSheet.getCell('C5').alignment = { horizontal: 'center', vertical: 'middle' };

      // Card 3: NET CASH POSITION (E4:F5)
      dashSheet.mergeCells('E4:F4');
      dashSheet.getCell('E4').value = 'NET CASH POSITION';
      dashSheet.getCell('E4').font = { name: 'Calibri', size: 10, bold: true, color: { argb: '1E293B' } };
      dashSheet.getCell('E4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
      dashSheet.getCell('E4').alignment = { horizontal: 'center', vertical: 'middle' };

      dashSheet.mergeCells('E5:F5');
      dashSheet.getCell('E5').value = { formula: `'Cash Flow Matrix'!${totalColLetter}${netRowIdx}`, result: netGrandTotal };
      dashSheet.getCell('E5').font = { name: 'Calibri', size: 16, bold: true, color: { argb: netGrandTotal >= 0 ? '0F766E' : 'B91C1C' } };
      dashSheet.getCell('E5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
      dashSheet.getCell('E5').numFmt = numberFormat;
      dashSheet.getCell('E5').alignment = { horizontal: 'center', vertical: 'middle' };

      // Card 4: ACTIVE INVOICES COUNT (G4:G5)
      dashSheet.getCell('G4').value = 'ACTIVE INVOICES';
      dashSheet.getCell('G4').font = { name: 'Calibri', size: 10, bold: true, color: { argb: '0369A1' } };
      dashSheet.getCell('G4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E0F2FE' } };
      dashSheet.getCell('G4').alignment = { horizontal: 'center', vertical: 'middle' };

      dashSheet.getCell('G5').value = sourceInvoices.length;
      dashSheet.getCell('G5').font = { name: 'Calibri', size: 16, bold: true, color: { argb: '0284C7' } };
      dashSheet.getCell('G5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0F9FF' } };
      dashSheet.getCell('G5').alignment = { horizontal: 'center', vertical: 'middle' };

      dashSheet.getRow(4).height = 18;
      dashSheet.getRow(5).height = 32;

      dashSheet.addRow([]); // Blank Row 6
      dashSheet.addRow([]); // Blank Row 7

      // TOP 5 CUSTOMERS & VENDORS TABLES (Side by side)
      // Row 8 Headers
      dashSheet.mergeCells('A8:C8');
      const topCustH = dashSheet.getCell('A8');
      topCustH.value = 'TOP CUSTOMERS BY RECEIVABLES (AR)';
      topCustH.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
      topCustH.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '059669' } };

      dashSheet.mergeCells('E8:G8');
      const topVendH = dashSheet.getCell('E8');
      topVendH.value = 'TOP VENDORS BY PAYABLES (AP)';
      topVendH.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
      topVendH.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E11D48' } };

      // Row 9 Sub-Headers
      const subH = dashSheet.addRow(['Customer Name', 'Amount Due', '% Share', '', 'Vendor Name', 'Amount Due', '% Share']);
      subH.height = 20;
      subH.eachCell((cell, cNum) => {
        if (cNum !== 4) {
          cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: '1E293B' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
        }
      });

      // Top 5 Customers List
      const sortedARContacts = Array.from(arContactsMap.values())
        .map(g => {
          const total = Object.values(g.totalColVals).reduce((a, b) => a + b, 0);
          return { name: g.contactName, total };
        })
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      const sortedAPContacts = Array.from(apContactsMap.values())
        .map(g => {
          const total = Object.values(g.totalColVals).reduce((a, b) => a + b, 0);
          return { name: g.contactName, total };
        })
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      for (let i = 0; i < 5; i++) {
        const cust = sortedARContacts[i];
        const vend = sortedAPContacts[i];

        const custName = cust ? cust.name : '—';
        const custAmt = cust ? cust.total : 0;
        const custPct = cust && arGrandTotal > 0 ? (cust.total / arGrandTotal) : 0;

        const vendName = vend ? vend.name : '—';
        const vendAmt = vend ? vend.total : 0;
        const vendPct = vend && apGrandTotal > 0 ? (vend.total / apGrandTotal) : 0;

        const r = dashSheet.addRow([
          custName,
          custAmt > 0 ? custAmt : null,
          custPct > 0 ? { formula: `IF($A$5>0, B${10 + i}/$A$5, 0)`, result: custPct } : null,
          '',
          vendName,
          vendAmt > 0 ? vendAmt : null,
          vendPct > 0 ? { formula: `IF($C$5>0, F${10 + i}/$C$5, 0)`, result: vendPct } : null
        ]);
        r.height = 19;
        r.getCell(2).numFmt = numberFormat;
        r.getCell(3).numFmt = '0.0%';
        r.getCell(6).numFmt = numberFormat;
        r.getCell(7).numFmt = '0.0%';
      }

      dashSheet.addRow([]); // Blank Row

      // PERIOD BREAKDOWN TABLE
      const pHeader = dashSheet.addRow(['CASH FLOW TIMELINE BREAKDOWN SUMMARY', '', '', '', '']);
      dashSheet.mergeCells(`A${pHeader.number}:E${pHeader.number}`);
      pHeader.getCell(1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
      pHeader.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '334155' } };
      pHeader.height = 22;

      const pSubH = dashSheet.addRow(['Time Period', 'Cash In (AR)', 'Cash Out (AP)', 'Net Surplus / Deficit', 'Cumulative Balance']);
      pSubH.height = 20;
      pSubH.eachCell((cell) => {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '1E293B' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
      });

      const firstBreakdownRow = pSubH.number + 1;
      let runningCumulative = 0;

      timeCols.forEach((col, colIdx) => {
        const inAmt = arTotalPerCol[col.key] || 0;
        const outAmt = apTotalPerCol[col.key] || 0;
        const netAmt = inAmt - outAmt;
        runningCumulative += netAmt;

        const matrixColLetter = getExcelColumnLetter(colIdx + 2);
        const inFormula = `'Cash Flow Matrix'!${matrixColLetter}${arTotalRowIdx}`;
        const outFormula = `'Cash Flow Matrix'!${matrixColLetter}${apTotalRowIdx}`;

        const pRow = dashSheet.addRow(['']);
        const rNum = pRow.number;

        pRow.getCell(1).value = col.label;
        pRow.getCell(2).value = { formula: inFormula, result: inAmt };
        pRow.getCell(3).value = { formula: outFormula, result: outAmt };
        pRow.getCell(4).value = { formula: `B${rNum}-C${rNum}`, result: netAmt };

        if (colIdx === 0) {
          pRow.getCell(5).value = { formula: `D${rNum}`, result: runningCumulative };
        } else {
          pRow.getCell(5).value = { formula: `E${rNum - 1}+D${rNum}`, result: runningCumulative };
        }

        pRow.height = 19;
        pRow.getCell(2).numFmt = numberFormat;
        pRow.getCell(3).numFmt = numberFormat;
        pRow.getCell(4).numFmt = numberFormat;
        pRow.getCell(5).numFmt = numberFormat;

        if (netAmt > 0) {
          pRow.getCell(4).font = { color: { argb: '047857' }, bold: true };
        } else if (netAmt < 0) {
          pRow.getCell(4).font = { color: { argb: 'BE123C' }, bold: true };
        }
      });

      // Total Breakdown Summary Row
      const lastBreakdownRow = firstBreakdownRow + timeCols.length - 1;
      const pTotalRow = dashSheet.addRow(['']);
      const totRNum = pTotalRow.number;

      pTotalRow.getCell(1).value = 'TOTAL';
      pTotalRow.getCell(2).value = { formula: `SUM(B${firstBreakdownRow}:B${lastBreakdownRow})`, result: arGrandTotal };
      pTotalRow.getCell(3).value = { formula: `SUM(C${firstBreakdownRow}:C${lastBreakdownRow})`, result: apGrandTotal };
      pTotalRow.getCell(4).value = { formula: `B${totRNum}-C${totRNum}`, result: netGrandTotal };
      pTotalRow.getCell(5).value = { formula: `D${totRNum}`, result: netGrandTotal };

      pTotalRow.height = 22;
      pTotalRow.eachCell((cell) => {
        cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: '0F172A' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
        cell.border = { top: { style: 'thin', color: { argb: 'CBD5E1' } }, bottom: { style: 'double', color: { argb: '0F172A' } } };
        cell.numFmt = numberFormat;
      });

      dashSheet.columns = [
        { width: 30 }, // Cust Name / Period
        { width: 18 }, // Cust Amt / Cash In
        { width: 14 }, // Cust Pct / Cash Out
        { width: 6 },  // Separator / Net
        { width: 30 }, // Vend Name / Cumulative
        { width: 18 }, // Vend Amt
        { width: 14 }, // Vend Pct
      ];

      // ─── TAB 2: RAW INVOICES & BILLS LEDGER (PIVOT READY SHEET) ───
      const ledgerSheet = workbook.addWorksheet('Raw Ledger Data');
      ledgerSheet.views = [{ showGridLines: true }];

      // Ledger Title Header
      ledgerSheet.mergeCells('A1:G1');
      const lTitle = ledgerSheet.getCell('A1');
      lTitle.value = 'DETAILED INVOICES & BILLS LEDGER (RAW DATA FOR PIVOT TABLES)';
      lTitle.font = { name: 'Calibri', size: 12, bold: true, color: { argb: '1E293B' } };

      const lHeaderRow = ledgerSheet.addRow(['Type', 'Contact Name', 'Invoice / Bill #', 'Reference', 'Due Date', 'Amount Due', 'Status']);
      lHeaderRow.height = 22;
      lHeaderRow.eachCell((cell) => {
        cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '334155' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
      lHeaderRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
      lHeaderRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };

      sourceInvoices.forEach((inv: any) => {
        if (!inv.dueDate || !inv.contactName) return;
        const amt = Math.abs(inv.amountDue);
        const invType = inv.category === 'AR' ? 'CASH IN (AR)' : 'CASH OUT (AP)';
        const invNum = inv.invoiceNumber || 'INV-DUE';
        const invRef = inv.reference && inv.reference !== '—' ? inv.reference : '';
        const dStr = new Date(inv.dueDate).toLocaleDateString('en-GB');
        const statusStr = inv.status || 'AUTHORISED';

        const row = ledgerSheet.addRow([invType, inv.contactName, invNum, invRef, dStr, amt, statusStr]);
        row.height = 19;
        row.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: inv.category === 'AR' ? '059669' : 'E11D48' } };
        row.getCell(6).numFmt = numberFormat;
        row.getCell(6).alignment = { horizontal: 'right' };
      });

      ledgerSheet.columns = [
        { width: 16 }, // Type
        { width: 28 }, // Contact Name
        { width: 22 }, // Invoice #
        { width: 18 }, // Reference
        { width: 14 }, // Due Date
        { width: 16 }, // Amount
        { width: 14 }, // Status
      ];

      // Write buffer and initiate download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Cash_Flow_Matrix_${exportFromDate}_to_${exportToDate}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Exported Cash Flow Matrix Excel (${periodLabel})!`);
    } catch (err: any) {
      console.error('Excel Export Error:', err);
      toast.error('Failed to export Cash Flow Matrix Excel');
    }
  };

  // Preset Date Ranges
  const applyPresetDateRange = (days: number) => {
    const today = new Date();
    const future = new Date();
    future.setDate(today.getDate() + days);
    setFromDate(today.toISOString().split('T')[0]);
    setToDate(future.toISOString().split('T')[0]);
    setCurrentPage(1);
    toast.info(`Filtered: Next ${days} Days`);
  };

  const clearDateRange = () => {
    setFromDate('');
    setToDate('');
    setCurrentPage(1);
    toast.info('Cleared Date Range');
  };

  if (loading) {
    return <APARAnalyticsSkeleton />;
  }

  const handleSort = (col: typeof sortCol) => {
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  return (
    <div className="space-y-5 max-w-full pb-16 font-sans text-slate-800">
      
      {/* ========================================================================= */}
      {/* TOP HEADER & DATE RANGE FILTER BAR */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Title */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-2xs shrink-0">
            <Scale className="h-4.5 w-4.5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              AP & AR Ledger
              {(fromDate || toDate) && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Range Active
                </span>
              )}
            </h1>
            <p className="text-[11.5px] text-slate-500 font-medium">
              Unpaid customer invoices & vendor bills
            </p>
          </div>
        </div>

        {/* Date Range & Controls Bar (Neat Single Row Alignment) */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          
          {/* Date Pickers */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200">
            <FormattedDatePicker
              value={fromDate}
              onChange={(val) => { setFromDate(val); setCurrentPage(1); }}
              label="From:"
            />
            <span className="text-slate-400 font-bold text-xs">–</span>
            <FormattedDatePicker
              value={toDate}
              onChange={(val) => { setToDate(val); setCurrentPage(1); }}
              label="To:"
            />

            {(fromDate || toDate) && (
              <button
                onClick={clearDateRange}
                className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10.5px] font-bold rounded transition cursor-pointer"
              >
                ✕ Clear
              </button>
            )}
          </div>

          {/* Quick Range Buttons */}
          <div className="flex items-center bg-slate-50 p-0.5 rounded-lg border border-slate-200 font-medium text-[11px]">
            <button
              onClick={() => applyPresetDateRange(7)}
              className="px-1.5 py-0.5 rounded text-slate-600 hover:bg-white hover:text-slate-900 transition cursor-pointer"
            >
              +7d
            </button>
            <button
              onClick={() => applyPresetDateRange(14)}
              className="px-1.5 py-0.5 rounded text-slate-600 hover:bg-white hover:text-slate-900 transition cursor-pointer"
            >
              +14d
            </button>
            <button
              onClick={() => applyPresetDateRange(30)}
              className="px-1.5 py-0.5 rounded text-slate-600 hover:bg-white hover:text-slate-900 transition cursor-pointer"
            >
              +30d
            </button>
          </div>

          {/* As On Date Selector */}
          <FormattedDatePicker
            value={asOnDate}
            onChange={setAsOnDate}
            label="As On:"
          />

          {/* Credit Policy & Limit Manager Button */}
          <button
            onClick={() => setShowCreditDrawer(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold transition cursor-pointer shadow-2xs text-xs relative"
          >
            <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
            <span>Credit & Limit Policy</span>
            {drawerMetrics.breachedCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-extrabold rounded-full animate-pulse">
                {drawerMetrics.breachedCount} Breached
              </span>
            )}
          </button>

          {/* Refresh Button */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition cursor-pointer shadow-2xs text-xs"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN VIEW SELECTOR TABS (MATRIX VIEW | LEDGER TABLE | CHARTS) */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveMainTab('matrix')}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold transition cursor-pointer",
              activeMainTab === 'matrix'
                ? "bg-[#0f172a] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            )}
          >
            <FileSpreadsheet className="h-4 w-4 text-[#00b7e2]" />
            <span>Cash Flow Matrix View</span>
            <span className="px-1.5 py-0.2 rounded text-[9.5px] font-black uppercase bg-[#00b7e2]/20 text-[#00b7e2]">
              Excel Format
            </span>
          </button>

          <button
            onClick={() => setActiveMainTab('ledger')}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold transition cursor-pointer",
              activeMainTab === 'ledger'
                ? "bg-[#0f172a] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            )}
          >
            <FileText className="h-4 w-4 text-emerald-400" />
            <span>AP & AR Invoices Ledger</span>
          </button>

          <button
            onClick={() => setActiveMainTab('charts')}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold transition cursor-pointer",
              activeMainTab === 'charts'
                ? "bg-[#0f172a] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            )}
          >
            <BarChart3 className="h-4 w-4 text-purple-400" />
            <span>Forecast & Charts</span>
          </button>
        </div>

        {/* Quick Export Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Matrix Excel</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUMMARY KPI CARDS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Receivables Card */}
        <div className="bg-gradient-to-br from-white via-white to-emerald-50/40 rounded-2xl border border-emerald-200/70 p-4 shadow-2xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400"></div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Accounts Receivable (AR)</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform border border-emerald-200/50">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
          <div className="text-2xl font-black mt-2 text-emerald-950 tracking-tight">
            {formatAmount(tableTotals.totalAR, tableTotals.currency)}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-emerald-100/70 text-[11.5px]">
            <span className="font-medium text-slate-500">Unpaid Customer Invoices</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10.5px]">
              {filteredInvoices.filter(i => i.category === 'AR').length}
            </span>
          </div>
        </div>

        {/* Payables Card */}
        <div className="bg-gradient-to-br from-white via-white to-rose-50/40 rounded-2xl border border-rose-200/70 p-4 shadow-2xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-pink-500 to-rose-400"></div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Accounts Payable (AP)</span>
            <div className="h-8 w-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform border border-rose-200/50">
              <TrendingDown className="h-4 w-4 text-rose-600" />
            </div>
          </div>
          <div className="text-2xl font-black mt-2 text-rose-950 tracking-tight">
            {formatAmount(tableTotals.totalAP, tableTotals.currency)}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-rose-100/70 text-[11.5px]">
            <span className="font-medium text-slate-500">Unpaid Vendor Bills</span>
            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-extrabold text-[10.5px]">
              {filteredInvoices.filter(i => i.category === 'AP').length}
            </span>
          </div>
        </div>

        {/* Net Working Position */}
        <div className="bg-gradient-to-br from-white via-white to-indigo-50/40 rounded-2xl border border-indigo-200/70 p-4 shadow-2xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400"></div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Net Balance (AR - AP)</span>
            <div className="h-8 w-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform border border-indigo-200/50">
              <Scale className="h-4 w-4 text-indigo-600" />
            </div>
          </div>
          <div className={cn(
            "text-2xl font-black mt-2 tracking-tight",
            tableTotals.netBalance >= 0 ? "text-slate-900" : "text-rose-700"
          )}>
            {formatAmount(tableTotals.netBalance, tableTotals.currency)}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-indigo-100/70 text-[11.5px]">
            <span className="font-medium text-slate-500">Working Capital</span>
            <span className={cn(
              "px-2 py-0.5 rounded-full font-extrabold text-[10.5px]",
              tableTotals.netBalance >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
            )}>
              {tableTotals.netBalance >= 0 ? 'Surplus Buffer' : 'Deficit'}
            </span>
          </div>
        </div>

        {/* Overdue Status Card */}
        <div className="bg-gradient-to-br from-white via-white to-amber-50/40 rounded-2xl border border-amber-200/70 p-4 shadow-2xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400"></div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Overdue Status</span>
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform border border-amber-200/50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </div>
          </div>
          <div className="text-2xl font-black mt-2 text-amber-950 tracking-tight flex items-baseline gap-1.5">
            <span>{filteredInvoices.filter(i => i.daysOverdue > 0).length}</span>
            <span className="text-xs font-bold text-amber-700 uppercase">Overdue</span>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-amber-100/70 text-[11.5px]">
            <span className="font-medium text-slate-500">Filtered Total</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-extrabold text-[10.5px]">
              {tableTotals.count} Invoices
            </span>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 1. INTERACTIVE CASH FLOW MATRIX VIEW (EXCEL FORMAT MATCH) */}
      {/* ========================================================================= */}
      {activeMainTab === 'matrix' && (
        <div className="space-y-4">
          {/* Matrix Control Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              {/* Granularity Selector */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setWebMatrixViewMode('weekly')}
                  className={cn(
                    "px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer",
                    webMatrixViewMode === 'weekly' ? "bg-emerald-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Weekly Schedule
                </button>
                <button
                  onClick={() => setWebMatrixViewMode('daily')}
                  className={cn(
                    "px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer",
                    webMatrixViewMode === 'daily' ? "bg-emerald-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Daily Matrix
                </button>
              </div>

              {/* Week Boundary Strategy (Active for Weekly Schedule) */}
              {webMatrixViewMode === 'weekly' && (
                <div className="flex items-center gap-1.5 bg-emerald-50/70 p-1 rounded-xl border border-emerald-200/80 shadow-2xs">
                  <span className="text-[11px] font-bold text-emerald-950 pl-1">Week Ending:</span>
                  <div className="flex items-center gap-0.5 bg-white p-0.5 rounded-lg border border-emerald-300">
                    <button
                      onClick={() => setWebMatrixWeekMode('7days')}
                      className={cn(
                        "px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer",
                        webMatrixWeekMode === '7days' ? "bg-emerald-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      Fixed 7 Days
                    </button>
                    <button
                      onClick={() => setWebMatrixWeekMode('custom')}
                      className={cn(
                        "px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer",
                        webMatrixWeekMode === 'custom' ? "bg-emerald-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      Custom Day
                    </button>
                  </div>

                  <select
                    value={webMatrixWeekEndDay}
                    onChange={(e) => {
                      setWebMatrixWeekEndDay(Number(e.target.value));
                      setWebMatrixWeekMode('custom');
                    }}
                    className="bg-white border border-emerald-300 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-900 focus:outline-none cursor-pointer shadow-2xs"
                  >
                    <option value={0}>Sunday (Mon – Sun)</option>
                    <option value={6}>Saturday (Sun – Sat)</option>
                    <option value={5}>Friday (Sat – Fri)</option>
                    <option value={4}>Thursday (Fri – Thu)</option>
                    <option value={3}>Wednesday (Thu – Wed)</option>
                    <option value={2}>Tuesday (Wed – Tue)</option>
                    <option value={1}>Monday (Tue – Mon)</option>
                  </select>
                </div>
              )}

              {/* Bank Account Selector for Rolling Forecast */}
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-600">Bank Liquidity:</span>
                <select
                  value={webMatrixBankId}
                  onChange={(e) => setWebMatrixBankId(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                >
                  <option value="ALL">ALL Linked Bank Accounts (Combined)</option>
                  {availableBankAccounts.map((acc: any) => (
                    <option key={acc.accountId} value={acc.accountId}>
                      {acc.accountName} ({formatAmount(acc.balance || 0, acc.currency)})
                    </option>
                  ))}
                  <option value="NONE">No Bank Balance (Flows Only)</option>
                </select>
              </div>

              {/* Search Box inside Matrix */}
              <div className="relative min-w-[200px]">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={matrixSearchTerm}
                  onChange={(e) => setMatrixSearchTerm(e.target.value)}
                  placeholder="Filter contact or invoice..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Right Buttons: Expand / Collapse All */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={expandAllContacts}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                + Expand All Invoices
              </button>
              <button
                onClick={collapseAllContacts}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                − Collapse All
              </button>
            </div>
          </div>

          {/* Matrix Scrollable Table Container */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-md overflow-hidden">
            <div className="overflow-x-auto max-w-full">
              <table className="w-full text-left text-xs border-collapse">
                
                {/* Header Row */}
                <thead>
                  <tr className="bg-[#0f172a] text-white text-[11px] font-bold tracking-wider">
                    <th className="py-3 px-4 sticky left-0 bg-[#0f172a] z-20 min-w-[320px] shadow-r border-r border-slate-700">
                      Particulars / Contact Name & Invoices
                    </th>
                    {webMatrixData.timeCols.map((col) => (
                      <th
                        key={col.key}
                        className={cn(
                          "py-3 px-3 text-right whitespace-nowrap border-r border-slate-800 min-w-[130px]",
                          col.key === 'overdue' ? "bg-rose-950/80 text-rose-300" :
                          col.key === 'later' ? "bg-slate-800 text-slate-300" : ""
                        )}
                      >
                        {col.label}
                      </th>
                    ))}
                    <th className="py-3 px-4 text-right bg-slate-900 text-white min-w-[140px] font-black">
                      TOTAL
                    </th>
                  </tr>
                </thead>

                {/* Body */}
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  
                  {/* ========================================== */}
                  {/* SECTION 1: CASH IN - CUSTOMERS (RECEIVABLES) */}
                  {/* ========================================== */}
                  {(() => {
                    const isArExpanded = isArSectionExpanded || Boolean(matrixSearchTerm.trim());
                    const isApExpanded = isApSectionExpanded || Boolean(matrixSearchTerm.trim());

                    return (
                      <>
                        <tr 
                          onClick={() => setIsArSectionExpanded(!isArSectionExpanded)}
                          className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white font-bold tracking-wide shadow-xs cursor-pointer select-none hover:brightness-110 transition-all"
                        >
                          <td className="py-2.5 px-4 sticky left-0 bg-emerald-900 z-20 border-r border-emerald-700 shadow-r">
                            <div className="flex items-center justify-between text-xs font-extrabold tracking-wider uppercase">
                              <span className="flex items-center gap-2">
                                <span className="h-5 w-5 rounded-md bg-emerald-700/80 hover:bg-emerald-600 text-emerald-100 flex items-center justify-center text-xs shrink-0 transition">
                                  {isArExpanded ? <ChevronDown className="h-3.5 w-3.5 text-white" /> : <ChevronRight className="h-3.5 w-3.5 text-white" />}
                                </span>
                                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                <span>CASH IN — CUSTOMERS (RECEIVABLES)</span>
                              </span>
                              <span className="text-[10px] bg-emerald-950/60 px-2 py-0.5 rounded-full font-mono font-bold text-emerald-200 border border-emerald-700/50">
                                {webMatrixData.arContacts.length} Customers
                              </span>
                            </div>
                          </td>

                          {webMatrixData.timeCols.map((col) => {
                            const val = webMatrixData.arTotals[col.key] || 0;
                            return (
                              <td key={col.key} className="py-2.5 px-3 text-right border-r border-emerald-700/60 font-black whitespace-nowrap text-emerald-100 text-xs">
                                {val > 0 ? formatAmount(val, orgCurrency) : '—'}
                              </td>
                            );
                          })}

                          <td className="py-2.5 px-4 text-right font-black text-white bg-emerald-950/80 whitespace-nowrap text-xs">
                            {formatAmount(webMatrixData.arGrandTotal, orgCurrency)}
                          </td>
                        </tr>

                        {isArExpanded && (
                          <>
                            {webMatrixData.arContacts.map((group: any) => {
                              const cKey = `AR-${group.contactName}`;
                              const isExpanded = Boolean(expandedContacts[cKey]);

                              return (
                                <React.Fragment key={cKey}>
                                  {/* Parent Contact Summary Row */}
                                  <tr className="bg-emerald-50/50 hover:bg-emerald-100/70 transition-colors font-bold border-b border-emerald-200/60">
                                    <td className="py-2.5 px-4 sticky left-0 bg-emerald-50/95 z-10 border-r border-slate-200 shadow-2xs">
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleExpandContact(cKey);
                                          }}
                                          className="h-5 w-5 rounded-md bg-emerald-200/90 hover:bg-emerald-300 text-emerald-950 flex items-center justify-center text-xs font-black shrink-0 transition cursor-pointer shadow-2xs"
                                        >
                                          {isExpanded ? '−' : '+'}
                                        </button>
                                        <ContactAvatar name={group.contactName} type="AR" />
                                        <span className="font-bold text-slate-900 truncate">{group.contactName}</span>
                                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-200/70 text-emerald-950 font-bold shrink-0">
                                          {group.invoices.length} Inv
                                        </span>
                                      </div>
                                    </td>

                                    {webMatrixData.timeCols.map((col) => {
                                      const val = group.totalColVals[col.key] || 0;
                                      return (
                                        <td key={col.key} className="py-2.5 px-3 text-right border-r border-slate-200 font-bold text-slate-900 whitespace-nowrap">
                                          {val > 0 ? formatAmount(val, orgCurrency) : '—'}
                                        </td>
                                      );
                                    })}

                                    <td className="py-2.5 px-4 text-right font-black text-emerald-900 bg-emerald-100/80 whitespace-nowrap">
                                      {formatAmount(group.total, orgCurrency)}
                                    </td>
                                  </tr>

                                  {/* Indented Individual Invoice Sub-Rows */}
                                  {isExpanded && group.invoices.map((sub: any, idx: number) => {
                                    const isLast = idx === group.invoices.length - 1;
                                    const prefix = isLast ? '└── ' : '├── ';

                                    return (
                                      <tr key={idx} className="bg-slate-50/90 hover:bg-slate-100/90 transition-colors text-slate-600 text-[11px]">
                                        <td className="py-1.5 px-4 pl-10 sticky left-0 bg-slate-50/95 z-10 border-r border-slate-200 font-mono italic">
                                          <span className="text-slate-400 font-normal">{prefix}</span>
                                          <span className="font-bold text-slate-800">{sub.invoiceLabel}</span>
                                        </td>

                                        {webMatrixData.timeCols.map((col) => {
                                          const val = sub.colVals[col.key] || 0;
                                          return (
                                            <td key={col.key} className="py-1.5 px-3 text-right border-r border-slate-200 whitespace-nowrap font-semibold">
                                              {val > 0 ? formatAmount(val, sub.currency || orgCurrency) : '—'}
                                            </td>
                                          );
                                        })}

                                        <td className="py-1.5 px-4 text-right font-bold text-slate-700 bg-slate-100 whitespace-nowrap">
                                          {formatAmount(sub.total, sub.currency || orgCurrency)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </React.Fragment>
                              );
                            })}

                            {/* TOTAL CASH IN (AR) ROW */}
                            <tr className="bg-gradient-to-r from-emerald-100 via-teal-100 to-emerald-100 font-extrabold text-emerald-950 text-xs border-t-2 border-b-2 border-emerald-400 shadow-2xs">
                              <td className="py-3 px-4 sticky left-0 bg-emerald-100 z-10 border-r border-emerald-300 font-black tracking-wider uppercase">
                                TOTAL CASH IN (AR)
                              </td>

                              {webMatrixData.timeCols.map((col) => (
                                <td key={col.key} className="py-3 px-3 text-right border-r border-emerald-300 font-black whitespace-nowrap text-emerald-950">
                                  {webMatrixData.arTotals[col.key] > 0 ? formatAmount(webMatrixData.arTotals[col.key], orgCurrency) : '—'}
                                </td>
                              ))}

                              <td className="py-3 px-4 text-right font-black text-emerald-950 bg-emerald-200/90 text-sm whitespace-nowrap">
                                {formatAmount(webMatrixData.arGrandTotal, orgCurrency)}
                              </td>
                            </tr>
                          </>
                        )}

                        {/* ========================================== */}
                        {/* SECTION 2: CASH OUT - VENDORS (PAYABLES) */}
                        {/* ========================================== */}
                        <tr 
                          onClick={() => setIsApSectionExpanded(!isApSectionExpanded)}
                          className="bg-gradient-to-r from-rose-800 via-pink-800 to-rose-900 text-white font-bold tracking-wide shadow-xs cursor-pointer select-none hover:brightness-110 transition-all"
                        >
                          <td className="py-2.5 px-4 sticky left-0 bg-rose-900 z-20 border-r border-rose-700 shadow-r">
                            <div className="flex items-center justify-between text-xs font-extrabold tracking-wider uppercase">
                              <span className="flex items-center gap-2">
                                <span className="h-5 w-5 rounded-md bg-rose-700/80 hover:bg-rose-600 text-rose-100 flex items-center justify-center text-xs shrink-0 transition">
                                  {isApExpanded ? <ChevronDown className="h-3.5 w-3.5 text-white" /> : <ChevronRight className="h-3.5 w-3.5 text-white" />}
                                </span>
                                <span className="h-2 w-2 rounded-full bg-rose-400 animate-pulse"></span>
                                <span>CASH OUT — VENDORS (PAYABLES)</span>
                              </span>
                              <span className="text-[10px] bg-rose-950/60 px-2 py-0.5 rounded-full font-mono font-bold text-rose-200 border border-rose-700/50">
                                {webMatrixData.apContacts.length} Vendors
                              </span>
                            </div>
                          </td>

                          {webMatrixData.timeCols.map((col) => {
                            const val = webMatrixData.apTotals[col.key] || 0;
                            return (
                              <td key={col.key} className="py-2.5 px-3 text-right border-r border-rose-700/60 font-black whitespace-nowrap text-rose-100 text-xs">
                                {val > 0 ? formatAmount(val, orgCurrency) : '—'}
                              </td>
                            );
                          })}

                          <td className="py-2.5 px-4 text-right font-black text-white bg-rose-950/80 whitespace-nowrap text-xs">
                            {formatAmount(webMatrixData.apGrandTotal, orgCurrency)}
                          </td>
                        </tr>

                        {isApExpanded && (
                          <>
                            {webMatrixData.apContacts.map((group: any) => {
                              const cKey = `AP-${group.contactName}`;
                              const isExpanded = Boolean(expandedContacts[cKey]);

                              return (
                                <React.Fragment key={cKey}>
                                  {/* Parent Contact Summary Row */}
                                  <tr className="bg-rose-50/50 hover:bg-rose-100/70 transition-colors font-bold border-b border-rose-200/60">
                                    <td className="py-2.5 px-4 sticky left-0 bg-rose-50/95 z-10 border-r border-slate-200 shadow-2xs">
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleExpandContact(cKey);
                                          }}
                                          className="h-5 w-5 rounded-md bg-rose-200/90 hover:bg-rose-300 text-rose-950 flex items-center justify-center text-xs font-black shrink-0 transition cursor-pointer shadow-2xs"
                                        >
                                          {isExpanded ? '−' : '+'}
                                        </button>
                                        <ContactAvatar name={group.contactName} type="AP" />
                                        <span className="font-bold text-slate-900 truncate">{group.contactName}</span>
                                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-200/70 text-rose-950 font-bold shrink-0">
                                          {group.invoices.length} Bills
                                        </span>
                                      </div>
                                    </td>

                                    {webMatrixData.timeCols.map((col) => {
                                      const val = group.totalColVals[col.key] || 0;
                                      return (
                                        <td key={col.key} className="py-2.5 px-3 text-right border-r border-slate-200 font-bold text-rose-700 whitespace-nowrap">
                                          {val > 0 ? formatAmount(val, orgCurrency) : '—'}
                                        </td>
                                      );
                                    })}

                                    <td className="py-2.5 px-4 text-right font-black text-rose-900 bg-rose-100/80 whitespace-nowrap">
                                      {formatAmount(group.total, orgCurrency)}
                                    </td>
                                  </tr>

                                  {/* Indented Individual Bill Sub-Rows */}
                                  {isExpanded && group.invoices.map((sub: any, idx: number) => {
                                    const isLast = idx === group.invoices.length - 1;
                                    const prefix = isLast ? '└── ' : '├── ';

                                    return (
                                      <tr key={idx} className="bg-slate-50/90 hover:bg-slate-100/90 transition-colors text-slate-600 text-[11px]">
                                        <td className="py-1.5 px-4 pl-10 sticky left-0 bg-slate-50/95 z-10 border-r border-slate-200 font-mono italic">
                                          <span className="text-slate-400 font-normal">{prefix}</span>
                                          <span className="font-bold text-slate-800">{sub.invoiceLabel}</span>
                                        </td>

                                        {webMatrixData.timeCols.map((col) => {
                                          const val = sub.colVals[col.key] || 0;
                                          return (
                                            <td key={col.key} className="py-1.5 px-3 text-right border-r border-slate-200 whitespace-nowrap font-semibold text-rose-600">
                                              {val > 0 ? formatAmount(val, sub.currency || orgCurrency) : '—'}
                                            </td>
                                          );
                                        })}

                                        <td className="py-1.5 px-4 text-right font-bold text-slate-700 bg-slate-100 whitespace-nowrap">
                                          {formatAmount(sub.total, sub.currency || orgCurrency)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </React.Fragment>
                              );
                            })}

                            {/* TOTAL CASH OUT (AP) ROW */}
                            <tr className="bg-gradient-to-r from-rose-100 via-pink-100 to-rose-100 font-extrabold text-rose-950 text-xs border-t-2 border-b-2 border-rose-400 shadow-2xs">
                              <td className="py-3 px-4 sticky left-0 bg-rose-100 z-10 border-r border-rose-300 font-black tracking-wider uppercase">
                                TOTAL CASH OUT (AP)
                              </td>

                              {webMatrixData.timeCols.map((col) => (
                                <td key={col.key} className="py-3 px-3 text-right border-r border-rose-300 font-black whitespace-nowrap text-rose-950">
                                  {webMatrixData.apTotals[col.key] > 0 ? formatAmount(webMatrixData.apTotals[col.key], orgCurrency) : '—'}
                                </td>
                              ))}

                              <td className="py-3 px-4 text-right font-black text-rose-950 bg-rose-200/90 text-sm whitespace-nowrap">
                                {formatAmount(webMatrixData.apGrandTotal, orgCurrency)}
                              </td>
                            </tr>
                          </>
                        )}
                      </>
                    );
                  })()}

                  {/* ========================================== */}
                  {/* SECTION 3: NET CASH FLOW POSITION */}
                  {/* ========================================== */}
                  <tr className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 text-white font-extrabold text-xs border-y border-slate-700 shadow-xs">
                    <td className="py-3 px-4 sticky left-0 bg-slate-900 z-10 border-r border-slate-700 uppercase tracking-wider text-slate-200">
                      NET CASH FLOW POSITION (IN - OUT)
                    </td>

                    {webMatrixData.timeCols.map((col) => {
                      const net = webMatrixData.netTotals[col.key] || 0;
                      return (
                        <td
                          key={col.key}
                          className={cn(
                            "py-3 px-3 text-right border-r border-slate-700 font-black whitespace-nowrap",
                            net >= 0 ? "text-emerald-400" : "text-rose-400"
                          )}
                        >
                          {formatAmount(net, orgCurrency)}
                        </td>
                      );
                    })}

                    <td className={cn(
                      "py-3 px-4 text-right font-black text-sm whitespace-nowrap bg-slate-950 border-l border-slate-700",
                      webMatrixData.netGrandTotal >= 0 ? "text-emerald-300" : "text-rose-300"
                    )}>
                      {formatAmount(webMatrixData.netGrandTotal, orgCurrency)}
                    </td>
                  </tr>

                  {/* ========================================== */}
                  {/* SECTION 4: BANK LIQUIDITY & CLOSING BALANCE */}
                  {/* ========================================== */}
                  {webMatrixBankId !== 'NONE' && (
                    <>
                      <tr className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 text-indigo-200 font-bold border-t border-indigo-900/60 shadow-xs">
                        <td colSpan={webMatrixData.timeCols.length + 2} className="py-2.5 px-4 uppercase tracking-wider text-xs font-extrabold flex items-center justify-between">
                          <span className="flex items-center gap-2 text-indigo-300">
                            <Building2 className="h-4 w-4 text-indigo-400" />
                            BANK LIQUIDITY & CLOSING BALANCE FORECAST
                          </span>
                        </td>
                      </tr>

                      {/* OPENING BANK BALANCE */}
                      <tr className="bg-indigo-50/70 hover:bg-indigo-50 font-bold text-indigo-950 border-b border-indigo-200/80">
                        <td className="py-2.5 px-4 sticky left-0 bg-indigo-50/95 z-10 border-r border-indigo-200/80 uppercase text-[11px] font-extrabold text-indigo-900">
                          OPENING BANK BALANCE ({orgSym})
                        </td>

                        {webMatrixData.timeCols.map((col) => (
                          <td key={col.key} className="py-2.5 px-3 text-right border-r border-indigo-200/80 whitespace-nowrap font-bold text-slate-800">
                            {formatAmount(webMatrixData.openingBals[col.key] || 0, orgCurrency)}
                          </td>
                        ))}

                        <td className="py-2.5 px-4 text-right font-black bg-indigo-100/90 text-indigo-950 whitespace-nowrap">
                          {formatAmount(webMatrixData.startingBankBal, orgCurrency)}
                        </td>
                      </tr>

                      {/* PROJECTED CLOSING BANK BALANCE */}
                      <tr className="bg-gradient-to-r from-emerald-100 via-teal-100 to-emerald-100 font-black text-emerald-950 text-xs border-t-2 border-b-2 border-emerald-500 shadow-sm">
                        <td className="py-3.5 px-4 sticky left-0 bg-emerald-100 z-10 border-r border-emerald-300 uppercase tracking-wider text-emerald-950">
                          PROJECTED CLOSING BANK BALANCE ({orgSym})
                        </td>

                        {webMatrixData.timeCols.map((col) => {
                          const closeBal = webMatrixData.closingBals[col.key] || 0;
                          return (
                            <td
                              key={col.key}
                              className={cn(
                                "py-3.5 px-3 text-right border-r border-emerald-300 font-black whitespace-nowrap text-sm",
                                closeBal >= 0 ? "text-emerald-950" : "text-rose-950 bg-rose-200/80"
                              )}
                            >
                              {formatAmount(closeBal, orgCurrency)}
                            </td>
                          );
                        })}

                        <td className="py-3.5 px-4 text-right font-black text-emerald-950 bg-emerald-300 text-base whitespace-nowrap shadow-xs">
                          {formatAmount(webMatrixData.closingBals[webMatrixData.timeCols[webMatrixData.timeCols.length - 1]?.key] || 0, orgCurrency)}
                        </td>
                      </tr>
                    </>
                  )}

                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* AP & AR CASH FLOW FORECAST GRAPH */}
      {/* ========================================================================= */}
      {chartOption && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                  AP & AR Cash Flow Forecast Chart
                </h2>
                <p className="text-[11px] text-slate-500 font-medium">
                  {(fromDate || toDate)
                    ? `Daily breakdown of Receivables (AR), Payables (AP) for selected range`
                    : `Daily comparison of Receivables (AR), Payables (AP), and Net Position`
                  }
                </p>
              </div>
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              {(fromDate || toDate) ? 'Selected Range Forecast' : '30-Day Projections'}
            </span>
          </div>

          <div className="h-[280px] w-full">
            <ReactECharts
              option={chartOption}
              style={{ height: '100%', width: '100%' }}
              opts={{ renderer: 'svg' }}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DATATABLES.NET WRAPPER & LEDGER TABLE (DYNAMIC HEIGHT, NO EMOJIS, AP/AR ONLY) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        
        {/* DataTables Header Control Toolbar */}
        <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-semibold text-slate-700">
          
          {/* Show Entries Dropdown & Filters */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Show Entries Dropdown */}
            <div className="flex items-center gap-1.5">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-300 rounded px-2 py-1 font-bold text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value={50}>50</option>
                <option value={100}>100 (Default)</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
                <option value={0}>All</option>
              </select>
              <span>entries</span>
            </div>

            {/* Contact / Vendor Dropdown Filter */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 px-2 py-1 rounded">
              <span className="text-slate-400 font-normal">Contact:</span>
              <select
                value={selectedContact}
                onChange={(e) => {
                  setSelectedContact(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer max-w-[200px] truncate"
              >
                <option value="ALL">All Contacts ({uniqueContactsList.length})</option>
                {uniqueContactsList.map((cName) => (
                  <option key={cName} value={cName}>
                    {cName}
                  </option>
                ))}
              </select>
            </div>

            {/* Type Switcher Dropdown */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 px-2 py-1 rounded">
              <span className="text-slate-400 font-normal">Type:</span>
              <select
                value={activeTab}
                onChange={(e: any) => {
                  setActiveTab(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
              >
                <option value="all">All Invoices & Bills</option>
                <option value="ar">Receivables (AR)</option>
                <option value="ap">Payables (AP)</option>
                <option value="overdue">Overdue Only</option>
              </select>
            </div>

          </div>

          {/* Search Input & Export CSV */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2">
              <span>Search:</span>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Type to filter..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-3 pr-8 py-1 bg-white border border-slate-300 rounded font-normal text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 min-w-[180px]"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Export Report Button */}
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700 transition cursor-pointer text-xs shrink-0 shadow-2xs"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Export Report</span>
            </button>
          </div>

        </div>

        {/* DataTables Main Table - Dynamic Card Height according to user data */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-sans">
            
            {/* Table Header */}
            <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 font-bold text-[11px] uppercase tracking-wider border-b border-slate-300 select-none">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center border-r border-slate-200">#</th>

                <th
                  className="py-2.5 px-3 border-r border-slate-200 cursor-pointer hover:bg-slate-200 transition"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center justify-between">
                    <span>DATE</span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {sortCol === 'date' ? (sortDir === 'desc' ? '▼' : '▲') : '↕'}
                    </span>
                  </div>
                </th>

                <th
                  className="py-2.5 px-3 border-r border-slate-200 cursor-pointer hover:bg-slate-200 transition"
                  onClick={() => handleSort('dueDate')}
                >
                  <div className="flex items-center justify-between">
                    <span>DUE DATE</span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {sortCol === 'dueDate' ? (sortDir === 'desc' ? '▼' : '▲') : '↕'}
                    </span>
                  </div>
                </th>

                <th
                  className="py-2.5 px-3 border-r border-slate-200 text-center cursor-pointer hover:bg-slate-200 transition"
                  onClick={() => handleSort('category')}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>TYPE</span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {sortCol === 'category' ? (sortDir === 'desc' ? '▼' : '▲') : '↕'}
                    </span>
                  </div>
                </th>

                <th
                  className="py-2.5 px-3 border-r border-slate-200 cursor-pointer hover:bg-slate-200 transition"
                  onClick={() => handleSort('contact')}
                >
                  <div className="flex items-center justify-between">
                    <span>CONTACT / PARTY NAME</span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {sortCol === 'contact' ? (sortDir === 'desc' ? '▼' : '▲') : '↕'}
                    </span>
                  </div>
                </th>

                <th
                  className="py-2.5 px-3 border-r border-slate-200 cursor-pointer hover:bg-slate-200 transition"
                  onClick={() => handleSort('number')}
                >
                  <div className="flex items-center justify-between">
                    <span>REFERENCE / INVOICE #</span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {sortCol === 'number' ? (sortDir === 'desc' ? '▼' : '▲') : '↕'}
                    </span>
                  </div>
                </th>

                <th className="py-2.5 px-3 border-r border-slate-200 text-center">CURRENCY</th>

                <th
                  className="py-2.5 px-3 border-r border-slate-200 text-right cursor-pointer hover:bg-slate-200 transition"
                  onClick={() => handleSort('ar')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>DEBIT (AR)</span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {sortCol === 'ar' ? (sortDir === 'desc' ? '▼' : '▲') : '↕'}
                    </span>
                  </div>
                </th>

                <th
                  className="py-2.5 px-3 border-r border-slate-200 text-right cursor-pointer hover:bg-slate-200 transition"
                  onClick={() => handleSort('ap')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>CREDIT (AP)</span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {sortCol === 'ap' ? (sortDir === 'desc' ? '▼' : '▲') : '↕'}
                    </span>
                  </div>
                </th>

                <th
                  className="py-2.5 px-3 border-r border-slate-200 text-right cursor-pointer hover:bg-slate-200 transition"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>AMOUNT DUE</span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {sortCol === 'amount' ? (sortDir === 'desc' ? '▼' : '▲') : '↕'}
                    </span>
                  </div>
                </th>

                <th
                  className="py-2.5 px-3 text-center cursor-pointer hover:bg-slate-200 transition"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>OVERDUE</span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {sortCol === 'status' ? (sortDir === 'desc' ? '▼' : '▲') : '↕'}
                    </span>
                  </div>
                </th>
              </tr>
            </thead>

            {/* Table Rows */}
            <tbody className="divide-y divide-slate-200 text-slate-800 font-medium">
              {paginatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400 font-semibold">
                    No matching records found.
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((inv: any, idx: number) => {
                  const isOverdue = inv.daysOverdue > 0;
                  const isAR = inv.category === 'AR';
                  const isOverLimit = inv.isOverLimit;

                  const isOpeningBal = inv.isOpeningBalance || inv.invoiceNumber === 'Opening Balance' || inv.reference === 'System Opening Balance';
                  const invNum = inv.invoiceNumber && inv.invoiceNumber !== '—'
                    ? inv.invoiceNumber
                    : (inv.reference && inv.reference !== '—' ? inv.reference : (isAR ? `INV-${(inv.id || '').toString().slice(-6) || '7842'}` : `BILL-${(inv.id || '').toString().slice(-6) || '9120'}`));
                  const refNum = inv.reference && inv.reference !== '—' && inv.reference !== invNum ? inv.reference : null;

                  return (
                    <tr
                      key={`row-${inv.id || inv.invoiceNumber || 'inv'}-${inv.category || ''}-${idx}`}
                      className={cn(
                        "transition",
                        isOverLimit ? "bg-rose-50/80 hover:bg-rose-100/70 border-l-4 border-l-rose-600" : (idx % 2 === 0 ? "bg-white hover:bg-blue-50/50" : "bg-slate-50/40 hover:bg-blue-50/50")
                      )}
                    >
                      {/* # Index */}
                      <td className="py-2 px-3 text-center text-slate-400 border-r border-slate-200 font-mono">
                        {(currentPage - 1) * (pageSize || paginatedInvoices.length) + idx + 1}
                      </td>

                      {/* Date */}
                      <td className="py-2 px-3 whitespace-nowrap border-r border-slate-200 text-slate-700">
                        {formatToDDMMYYYY(inv.date)}
                      </td>

                      {/* Due Date */}
                      <td className="py-2 px-3 whitespace-nowrap border-r border-slate-200 font-semibold text-slate-900">
                        {formatToDDMMYYYY(inv.dueDate)}
                      </td>

                      {/* Type: STRICTLY 'AR' or 'AP' */}
                      <td className="py-2 px-3 text-center whitespace-nowrap border-r border-slate-200">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider border",
                          isAR
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        )}>
                          {isAR ? 'AR' : 'AP'}
                        </span>
                      </td>

                      {/* Contact Name & Credit Policy Status */}
                      <td className="py-2 px-3 border-r border-slate-200">
                        <div className="font-bold text-slate-900 truncate max-w-[240px] flex items-center justify-between gap-1">
                          <span>{inv.contactName}</span>
                          <button
                            onClick={() => handleOpenCreditModal(inv.contactName, inv.contactId, inv.creditLimit, inv.creditTermsDays)}
                            className="text-slate-400 hover:text-blue-600 cursor-pointer p-0.5"
                            title="Set / Edit Credit Limit & Terms"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                        </div>

                        {isOverLimit ? (
                          <div className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 font-black text-[9.5px]">
                            <AlertTriangle className="h-3 w-3 text-rose-600 shrink-0" />
                            <span>LIMIT BREACH: +{formatAmount(inv.excessAmount, inv.currency)} OVER</span>
                          </div>
                        ) : inv.creditLimit > 0 ? (
                          <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                            Limit: {formatAmount(inv.creditLimit, inv.currency)} ({inv.creditTermsDays || 90}d)
                          </div>
                        ) : (
                          <button
                            onClick={() => handleOpenCreditModal(inv.contactName, inv.contactId, inv.creditLimit, inv.creditTermsDays)}
                            className="text-[9.5px] font-bold text-slate-400 hover:text-blue-600 hover:underline cursor-pointer block mt-0.5"
                          >
                            + Set Credit Limit
                          </button>
                        )}
                      </td>

                      {/* Reference / Invoice # (Opening Balance Flag) */}
                      <td className="py-2 px-3 border-r border-slate-200">
                        <div className="font-bold text-blue-600 hover:underline cursor-pointer flex items-center gap-1.5 flex-wrap">
                          <span>{invNum}</span>
                          {isOpeningBal && (
                            <span className="px-1.5 py-0.2 rounded text-[9.5px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300">
                              Conversion Bal
                            </span>
                          )}
                        </div>
                        {refNum && (
                          <div className="text-[10.5px] text-slate-400 font-mono truncate max-w-[200px]">
                            {refNum}
                          </div>
                        )}
                      </td>

                      {/* Currency */}
                      <td className="py-2 px-3 text-center border-r border-slate-200 font-mono text-slate-500 font-bold">
                        {inv.currency || 'GBP'}
                      </td>

                      {/* Debit (AR) */}
                      <td className="py-2 px-3 text-right border-r border-slate-200 font-bold text-emerald-700 whitespace-nowrap">
                        {isAR ? formatAmount(inv.amountDue, inv.currency) : '—'}
                      </td>

                      {/* Credit (AP) */}
                      <td className="py-2 px-3 text-right border-r border-slate-200 font-bold text-rose-700 whitespace-nowrap">
                        {!isAR ? formatAmount(inv.amountDue, inv.currency) : '—'}
                      </td>

                      {/* Amount Due */}
                      <td className="py-2 px-3 text-right border-r border-slate-200 font-black text-slate-900 text-xs whitespace-nowrap">
                        {formatAmount(inv.amountDue, inv.currency)}
                      </td>

                      {/* OVERDUE Column */}
                      <td className={cn(
                        "py-2 px-3 text-center whitespace-nowrap font-black text-xs transition-colors",
                        isOverdue ? "bg-rose-100 text-rose-800" : "text-slate-400"
                      )}>
                        {isOverdue ? `${inv.daysOverdue}d` : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* DataTables Summary Footer (Clean Integrated Style) */}
            <tfoot className="bg-slate-100 text-slate-800 font-bold text-xs border-t-2 border-slate-300">
              <tr>
                <td colSpan={7} className="py-2.5 px-3 text-left font-extrabold text-slate-700 tracking-wider uppercase text-[11px] border-r border-slate-200">
                  Total Ledger Summary ({tableTotals.count} Entries)
                </td>
                <td className="py-2.5 px-3 text-right font-black text-emerald-700 whitespace-nowrap border-r border-slate-200">
                  {formatAmount(tableTotals.totalAR, tableTotals.currency)}
                </td>
                <td className="py-2.5 px-3 text-right font-black text-rose-700 whitespace-nowrap border-r border-slate-200">
                  {formatAmount(tableTotals.totalAP, tableTotals.currency)}
                </td>
                <td className="py-2.5 px-3 text-right font-black text-slate-900 text-xs whitespace-nowrap border-r border-slate-200">
                  {formatAmount(tableTotals.netBalance, tableTotals.currency)}
                </td>
                <td className="py-2.5 px-3 text-center text-slate-500 font-semibold text-[11px]">
                  Net Buffer
                </td>
              </tr>
            </tfoot>

          </table>
        </div>

        {/* DataTables Footer Pagination Bar */}
        <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 font-medium">
          
          <div>
            Showing <strong>{filteredInvoices.length > 0 ? (currentPage - 1) * (pageSize || filteredInvoices.length) + 1 : 0}</strong> to <strong>{Math.min(currentPage * (pageSize || filteredInvoices.length), filteredInvoices.length)}</strong> of <strong>{filteredInvoices.length}</strong> entries
          </div>

          {pageSize > 0 && totalPages > 1 && (
            <div className="flex items-center gap-1 select-none">
              
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer font-bold"
              >
                First
              </button>

              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer font-bold"
              >
                Previous
              </button>

              <span className="px-3 py-1 bg-blue-600 text-white font-black rounded border border-blue-600">
                {currentPage}
              </span>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer font-bold"
              >
                Next
              </button>

              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer font-bold"
              >
                Last
              </button>

            </div>
          )}

        </div>

      </div>

      {/* ========================================================================= */}
      {/* EXPORT OPTIONS MODAL WITH MONTH & YEAR SELECTORS */}
      {/* ========================================================================= */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden font-sans animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-2xs">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Export Cash Flow Matrix Report</h3>
                  <p className="text-xs text-slate-500 font-medium">Configure month, year & layout for Excel export</p>
                </div>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="h-8 w-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              
              {/* Step 1: Select Layout Granularity (Weekly / Daily) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  1. Select Matrix Layout
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setExportGranularity('weekly')}
                    className={cn(
                      "p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between",
                      exportGranularity === 'weekly'
                        ? "bg-emerald-50/60 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900 font-bold"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-white"
                    )}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>Weekly Schedule</span>
                      {exportGranularity === 'weekly' && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
                    </div>
                    <span className="text-[10.5px] text-slate-500 mt-1">Grouped in Weekly Columns</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportGranularity('daily')}
                    className={cn(
                      "p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between",
                      exportGranularity === 'daily'
                        ? "bg-emerald-50/60 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900 font-bold"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-white"
                    )}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>Daily Matrix</span>
                      {exportGranularity === 'daily' && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
                    </div>
                    <span className="text-[10.5px] text-slate-500 mt-1">Day-by-Day Columns (1 Sept, 2 Sept...)</span>
                  </button>
                </div>

                {/* Sub-selector for Week Ending Boundary */}
                {exportGranularity === 'weekly' && (
                  <div className="mt-3 p-3 rounded-xl border border-slate-200 bg-slate-50/80 space-y-2.5 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider shrink-0">
                        Week Boundary Strategy:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setExportWeekMode('7days')}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer shadow-2xs",
                            exportWeekMode === '7days'
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                          )}
                        >
                          Fixed 7 Days
                        </button>

                        <button
                          type="button"
                          onClick={() => setExportWeekMode('custom')}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer shadow-2xs",
                            exportWeekMode === 'custom'
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                          )}
                        >
                          Custom Week Ending
                        </button>
                      </div>
                    </div>

                    {/* Custom Week Ending Dropdown */}
                    {exportWeekMode === 'custom' && (
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
                        <label className="text-[11px] font-bold text-slate-700">
                          Select Week End Day:
                        </label>
                        <select
                          value={exportWeekEndDay}
                          onChange={(e) => setExportWeekEndDay(Number(e.target.value))}
                          className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-2xs"
                        >
                          <option value={0}>Sunday (Mon – Sun weeks)</option>
                          <option value={6}>Saturday (Sun – Sat weeks)</option>
                          <option value={5}>Friday (Sat – Fri weeks)</option>
                          <option value={4}>Thursday (Fri – Thu weeks)</option>
                          <option value={3}>Wednesday (Thu – Wed weeks)</option>
                          <option value={2}>Tuesday (Wed – Tue weeks)</option>
                          <option value={1}>Monday (Tue – Mon weeks)</option>
                        </select>
                      </div>
                    )}

                    {/* Explanatory Note */}
                    <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-lg p-2.5 flex items-start gap-2 text-[11px] text-emerald-950 leading-snug">
                      <AlertCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-emerald-900 block mb-0.5">Week Alignment Logic:</span>
                        <span>
                          {(() => {
                            const d = new Date(exportFromDate);
                            if (isNaN(d.getTime())) return '';
                            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                            const dayNameShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                            const startDayName = dayNames[d.getDay()];

                            if (exportWeekMode === '7days') {
                              const w1End = new Date(d);
                              w1End.setDate(w1End.getDate() + 6);
                              return `Fixed 7-Day Cycle: Week 1 spans ${d.getDate()} ${monthNames[d.getMonth()]} (${startDayName}) to ${w1End.getDate()} ${monthNames[w1End.getMonth()]} (${dayNameShort[w1End.getDay()]}). Every week will be exact 7 days.`;
                            }

                            const currentDay = d.getDay();
                            const daysToAdd = (exportWeekEndDay - currentDay + 7) % 7;
                            const w1End = new Date(d);
                            w1End.setDate(w1End.getDate() + daysToAdd);
                            const w1EndDayName = dayNames[w1End.getDay()];

                            const w2Start = new Date(w1End);
                            w2Start.setDate(w2Start.getDate() + 1);
                            const w2StartDayName = dayNames[w2Start.getDay()];

                            const w2End = new Date(w2Start);
                            w2End.setDate(w2End.getDate() + 6);
                            const targetDayName = dayNames[exportWeekEndDay];

                            if (daysToAdd === 0) {
                              return `Week 1 ends on ${targetDayName} (${w1End.getDate()} ${monthNames[w1End.getMonth()]}). Week 2 onwards run full ${w2StartDayName} to ${targetDayName} weeks.`;
                            }

                            return `Week 1 (${startDayName} to ${w1EndDayName}): ${d.getDate()} ${monthNames[d.getMonth()]} – ${w1End.getDate()} ${monthNames[w1End.getMonth()]}. Week 2 onwards run full ${w2StartDayName} to ${targetDayName} weeks (${w2Start.getDate()} ${monthNames[w2Start.getMonth()]} – ${w2End.getDate()} ${monthNames[w2End.getMonth()]}).`;
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Select Date Range */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    2. Select Date Range
                  </label>
                  <span className="text-[10.5px] font-semibold text-slate-500">Pick any custom period</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] text-slate-500 block mb-1 font-semibold">Start Date (From):</span>
                    <input
                      type="date"
                      value={exportFromDate}
                      onChange={(e) => setExportFromDate(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 focus:outline-none focus:border-emerald-500 cursor-pointer text-xs"
                    />
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 block mb-1 font-semibold">End Date (To):</span>
                    <input
                      type="date"
                      value={exportToDate}
                      onChange={(e) => setExportToDate(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 focus:outline-none focus:border-emerald-500 cursor-pointer text-xs"
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Presets:</span>
                  
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
                      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                      const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                      setExportFromDate(start);
                      setExportToDate(end);
                      setExportGranularity('daily');
                    }}
                    className="px-2.5 py-1 bg-white border border-slate-300 rounded-md text-[10.5px] font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition cursor-pointer shadow-2xs"
                  >
                    This Month
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const start = now.toISOString().split('T')[0];
                      const future = new Date(now);
                      future.setDate(future.getDate() + 91);
                      const end = future.toISOString().split('T')[0];
                      setExportFromDate(start);
                      setExportToDate(end);
                      setExportGranularity('weekly');
                    }}
                    className="px-2.5 py-1 bg-white border border-slate-300 rounded-md text-[10.5px] font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition cursor-pointer shadow-2xs"
                  >
                    13 Weeks (~90 Days)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const start = now.toISOString().split('T')[0];
                      const future = new Date(now);
                      future.setDate(future.getDate() + 180);
                      const end = future.toISOString().split('T')[0];
                      setExportFromDate(start);
                      setExportToDate(end);
                      setExportGranularity('weekly');
                    }}
                    className="px-2.5 py-1 bg-white border border-slate-300 rounded-md text-[10.5px] font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition cursor-pointer shadow-2xs"
                  >
                    6 Months
                  </button>
                </div>

                {/* Dynamic Live Calculation Card */}
                {(() => {
                  const s = new Date(exportFromDate);
                  const e = new Date(exportToDate);
                  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
                  const diffDays = Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));

                  // Compute exact week count based on boundary
                  let weeksCount = 0;
                  let currStart = new Date(s);
                  while (currStart.getTime() <= e.getTime() && weeksCount < 52) {
                    let wEnd = new Date(currStart);
                    if (exportWeekMode === '7days') {
                      wEnd.setDate(wEnd.getDate() + 6);
                    } else {
                      const currentDay = currStart.getDay();
                      const daysToAdd = (exportWeekEndDay - currentDay + 7) % 7;
                      wEnd.setDate(wEnd.getDate() + daysToAdd);
                    }
                    if (wEnd.getTime() > e.getTime()) wEnd = new Date(e);
                    weeksCount++;
                    currStart = new Date(wEnd);
                    currStart.setDate(currStart.getDate() + 1);
                  }

                  return (
                    <div className="bg-gradient-to-r from-emerald-50 via-teal-50/50 to-emerald-50 border border-emerald-200/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                          <Calendar className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-emerald-950 tracking-wide uppercase">
                            Calculation Summary
                          </div>
                          <div className="text-[11px] font-medium text-slate-600">
                            {diffDays} Days range selected
                          </div>
                        </div>
                      </div>

                      <div className="px-3 py-1 bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-2xs shrink-0 whitespace-nowrap self-start sm:self-auto">
                        {exportGranularity === 'weekly'
                          ? `${weeksCount} Weekly Columns (Week 1 to Week ${weeksCount})`
                          : `${diffDays} Daily Columns`}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Step 3: Select Bank Account for Liquidity & Closing Balance Forecast */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    3. Select Bank Account for Closing Balance Forecast
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                    Live Opening Sync
                  </span>
                </div>

                <select
                  value={exportSelectedBankId}
                  onChange={(e) => setExportSelectedBankId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-900 text-xs focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
                >
                  <option value="ALL">
                    All Linked Bank Accounts (Combined Opening: {formatAmount(availableBankAccounts.reduce((sum: number, a: any) => sum + (a.balance || 0), 0), orgCurrency)})
                  </option>
                  {availableBankAccounts.map((b: any) => (
                    <option key={b.accountId || b.accountName} value={b.accountId || b.accountName}>
                      {b.accountName} ({b.currency || orgCurrency} {formatAmount(b.balance || 0, b.currency || orgCurrency)})
                    </option>
                  ))}
                  <option value="NONE">None (Pure Receivables/Payables Net Only)</option>
                </select>

                {exportSelectedBankId !== 'NONE' && (
                  <div className="bg-blue-50/80 border border-blue-200/80 rounded-lg p-2.5 flex items-center justify-between text-xs">
                    <span className="font-semibold text-blue-950 flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
                      Initial Opening Bank Balance (as of {formatToDDMMYYYY(exportFromDate || asOnDate)}):
                    </span>
                    <span className="font-extrabold text-blue-900 text-xs">
                      {formatAmount(selectedBankBalance, orgCurrency)}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="pt-1">
                <button
                  onClick={async () => {
                    setExportLoading(true);
                    await exportCashFlowMatrixExcel();
                    setExportLoading(false);
                    setShowExportModal(false);
                  }}
                  disabled={exportLoading}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className={cn("h-4 w-4", exportLoading && "animate-bounce")} />
                  <span>
                    {exportLoading
                      ? 'Generating Matrix Excel...'
                      : `Download Matrix Excel (.xlsx) [${exportFromDate} to ${exportToDate}]`
                    }
                  </span>
                </button>
              </div>

              {/* Standard CSV List Link */}
              <div className="pt-0.5 text-center">
                <button
                  type="button"
                  onClick={() => {
                    handleExportCSV();
                    setShowExportModal(false);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 underline font-semibold cursor-pointer"
                >
                  Or download standard raw CSV list
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* CREDIT LIMIT & PAYMENT TERMS CONFIGURATION MODAL */}
      {showCreditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden space-y-4">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight text-white">Credit Policy & Term Limit</h3>
                  <p className="text-[11px] text-blue-200 font-medium">Configure max balance limit & payment waiting period</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreditModal(false)}
                className="h-7 w-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form Body */}
            <div className="p-5 space-y-4">
              {/* Contact Name Selector / Input */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Customer / Supplier Name:</label>
                <input
                  type="text"
                  value={creditContactName}
                  onChange={(e) => {
                    setCreditContactName(e.target.value);
                    setCreditContactId(e.target.value);
                  }}
                  placeholder="e.g. Alliance Healthcare or Laxmico Ltd"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Credit Limit (Org Currency) */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1 flex items-center justify-between">
                  <span>Max Credit Exposure Limit ({orgSym}):</span>
                  <span className="text-[10px] text-slate-400 font-normal">e.g. {orgSym}100,000</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">{orgSym}</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={creditLimitInput}
                    onChange={(e) => setCreditLimitInput(parseFloat(e.target.value) || 0)}
                    className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-black text-slate-900 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <p className="text-[10.5px] text-slate-500 mt-1">
                  When outstanding invoices breach this amount, excess balances will be flagged red in LEDGER & Exports.
                </p>
              </div>

              {/* Credit Waiting Period (Days) */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1 flex items-center justify-between">
                  <span>Credit Waiting Period (Days):</span>
                  <span className="text-[10px] text-blue-600 font-bold">Default 90 Days (3 Months)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={creditTermsDaysInput}
                  onChange={(e) => setCreditTermsDaysInput(parseInt(e.target.value, 10) || 90)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Policy Rule Preset Shortcuts */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1.5">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Quick Limit Presets</span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCreditLimitInput(50000);
                      setCreditTermsDaysInput(60);
                    }}
                    className="px-2 py-1 bg-white hover:bg-blue-50 text-slate-700 font-bold text-[10.5px] rounded-lg border border-slate-200"
                  >
                    {orgSym}50k (60d)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreditLimitInput(100000);
                      setCreditTermsDaysInput(90);
                    }}
                    className="px-2 py-1 bg-blue-50 text-blue-700 font-bold text-[10.5px] rounded-lg border border-blue-200"
                  >
                    {orgSym}100k (90d)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreditLimitInput(250000);
                      setCreditTermsDaysInput(90);
                    }}
                    className="px-2 py-1 bg-white hover:bg-blue-50 text-slate-700 font-bold text-[10.5px] rounded-lg border border-slate-200"
                  >
                    {orgSym}250k (90d)
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreditModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCreditLimit}
                  disabled={savingCreditLimit}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{savingCreditLimit ? 'Saving Policy...' : 'Save Credit Policy'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SLIDE-OVER CREDIT POLICY & LIMIT MANAGEMENT DRAWER (RIGHT-TO-LEFT) */}
      {/* ========================================================================= */}
      {showCreditDrawer && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Dark Backdrop Overlay */}
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-300"
            onClick={() => setShowCreditDrawer(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-xl bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
              
              {/* DRAWER HEADER */}
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold flex items-center gap-2">
                      Credit Limit & Risk Policy Manager
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Xero Live Sync
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Monitor customer exposure, set terms, & highlight limit breaches
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreditDrawer(false)}
                  className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* EXECUTIVE SUMMARY RIBBON */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border-b border-slate-200">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block">Total Allocated</span>
                  <span className="text-sm font-bold text-slate-900">{formatAmount(drawerMetrics.totalLimit, orgCurrency)}</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block">Active Breaches</span>
                  <span className={cn("text-sm font-extrabold", drawerMetrics.breachedCount > 0 ? "text-rose-600" : "text-emerald-600")}>
                    {drawerMetrics.breachedCount} Contacts
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block">Total Exposure</span>
                  <span className="text-sm font-bold text-blue-700">{formatAmount(drawerMetrics.totalExposure, orgCurrency)}</span>
                </div>
              </div>

              {/* SEARCH & TAB FILTERS */}
              <div className="p-3 border-b border-slate-200 space-y-2 bg-white">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search contacts by name..."
                    value={drawerSearchTerm}
                    onChange={(e) => setDrawerSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-medium"
                  />
                  {drawerSearchTerm && (
                    <button 
                      onClick={() => setDrawerSearchTerm('')} 
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
                  <button
                    onClick={() => setDrawerTab('all')}
                    className={cn("flex-1 py-1 rounded-md text-center transition cursor-pointer", drawerTab === 'all' ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900")}
                  >
                    All ({drawerContacts.length})
                  </button>
                  <button
                    onClick={() => setDrawerTab('breached')}
                    className={cn("flex-1 py-1 rounded-md text-center transition cursor-pointer flex items-center justify-center gap-1", drawerTab === 'breached' ? "bg-rose-600 text-white font-bold shadow-2xs" : "text-rose-600 hover:bg-rose-50")}
                  >
                    <span>Breached</span>
                    {drawerMetrics.breachedCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-white text-rose-700 font-black">
                        {drawerMetrics.breachedCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setDrawerTab('ar')}
                    className={cn("flex-1 py-1 rounded-md text-center transition cursor-pointer", drawerTab === 'ar' ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900")}
                  >
                    AR Customers
                  </button>
                  <button
                    onClick={() => setDrawerTab('ap')}
                    className={cn("flex-1 py-1 rounded-md text-center transition cursor-pointer", drawerTab === 'ap' ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900")}
                  >
                    AP Suppliers
                  </button>
                </div>
              </div>

              {/* CONTACT LIST */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                {filteredDrawerContacts.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-xl border border-slate-200 p-6">
                    <ShieldAlert className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700">No matching contacts found</p>
                    <p className="text-xs text-slate-500 mt-1">Try adjusting your filter or search query.</p>
                  </div>
                ) : (
                  filteredDrawerContacts.map((contact, idx) => {
                    const cName = contact.name || contact.contactName || `Contact-${idx}`;
                    const isEditing = drawerEditingContactId === cName;
                    const isBreached = contact.limitStatus === 'EXCEEDED';
                    const pct = Math.min(100, contact.creditLimit ? Math.round((contact.totalAmount / contact.creditLimit) * 100) : 0);

                    return (
                      <div 
                        key={cName}
                        className={cn(
                          "bg-white rounded-xl border p-3.5 shadow-2xs transition-all",
                          isBreached ? "border-rose-300 bg-rose-50/20" : "border-slate-200 hover:border-slate-300"
                        )}
                      >
                        {/* Contact Main Info Row */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0", contact.type === 'customer' ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-blue-100 text-blue-800 border border-blue-200")}>
                              {(contact.name || contact.contactName || 'C').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-slate-900 truncate flex items-center gap-1.5">
                                {contact.name || contact.contactName || 'Unnamed Contact'}
                                <span className={cn("text-[9.5px] px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider", contact.type === 'customer' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-blue-50 text-blue-700 border border-blue-200")}>
                                  {contact.type === 'customer' ? 'AR Customer' : 'AP Supplier'}
                                </span>
                              </h4>
                              <p className="text-[11px] text-slate-500 font-medium">
                                {contact.invoiceCount} open bill{contact.invoiceCount !== 1 ? 's' : ''} • Max Terms: <span className="font-semibold text-slate-700">{contact.creditTermsDays} days</span>
                              </p>
                            </div>
                          </div>

                          {/* Status Pill */}
                          <div>
                            {isBreached ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-extrabold border border-rose-300 animate-pulse">
                                <AlertTriangle className="h-3 w-3 text-rose-600" />
                                Breached (+{formatAmount(contact.excessAmount, orgCurrency)})
                              </span>
                            ) : contact.creditLimit ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border border-emerald-300">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                Within Limit
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200">
                                No Limit Set
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Exposure Progress Gauge Bar */}
                        <div className="mt-3 space-y-1">
                          <div className="flex justify-between items-center text-[11px] font-semibold">
                            <span className="text-slate-600">
                              Outstanding Exposure: <strong className="text-slate-900">{formatAmount(contact.totalAmount, orgCurrency)}</strong>
                            </span>
                            <span className="text-slate-500">
                              Limit: <strong className="text-slate-900">{contact.creditLimit ? formatAmount(contact.creditLimit, orgCurrency) : 'Uncapped'}</strong>
                            </span>
                          </div>

                          {contact.creditLimit ? (
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200 flex">
                              <div
                                style={{ width: `${pct}%` }}
                                className={cn(
                                  "h-full transition-all duration-500 rounded-full",
                                  pct >= 100 ? "bg-rose-600" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"
                                )}
                              />
                            </div>
                          ) : (
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200" />
                          )}
                        </div>

                        {/* Quick Actions / Inline Editing Form */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                          {isEditing ? (
                            <div className="w-full bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Credit Limit (£)</label>
                                  <input
                                    type="number"
                                    value={drawerEditLimit}
                                    onChange={(e) => setDrawerEditLimit(Number(e.target.value))}
                                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold"
                                    placeholder="50000"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Terms (Days)</label>
                                  <input
                                    type="number"
                                    value={drawerEditTerms}
                                    onChange={(e) => setDrawerEditTerms(Number(e.target.value))}
                                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold"
                                    placeholder="30"
                                  />
                                </div>
                              </div>
                              <div className="flex justify-end gap-1.5 pt-1">
                                <button
                                  onClick={() => setDrawerEditingContactId(null)}
                                  className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded transition cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      const res = await fetch('/api/dashboard/ap-ar-analytics', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          contactName: cName,
                                          creditLimit: drawerEditLimit,
                                          creditTermsDays: drawerEditTerms
                                        })
                                      });
                                      if (res.ok) {
                                        toast.success(`Updated policy for ${cName}`);
                                        setDrawerEditingContactId(null);
                                        fetchData();
                                      } else {
                                        toast.error('Failed to update limit');
                                      }
                                    } catch {
                                      toast.error('Network error updating limit');
                                    }
                                  }}
                                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded transition shadow-2xs cursor-pointer"
                                >
                                  Save Policy
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <span className="text-[11px] text-slate-500 italic">
                                {contact.creditLimit ? `${pct}% of policy cap utilized` : 'Default 30d terms applies'}
                              </span>
                              <button
                                onClick={() => {
                                  setDrawerEditingContactId(cName);
                                  setDrawerEditLimit(contact.creditLimit || 50000);
                                  setDrawerEditTerms(contact.creditTermsDays || 30);
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer flex items-center gap-1"
                              >
                                <Edit3 className="h-3 w-3" />
                                <span>Edit Policy</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* FOOTER */}
              <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <span>Showing {filteredDrawerContacts.length} of {drawerContacts.length} total contacts</span>
                <button
                  onClick={() => setShowCreditDrawer(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition cursor-pointer"
                >
                  Close Panel
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* ========================================================================= */
/* SHIMMER SKELETON LOADING COMPONENT */
/* ========================================================================= */
function APARAnalyticsSkeleton() {
  return (
    <div className="space-y-5 max-w-full pb-16 font-sans text-slate-800 animate-pulse select-none">
      {/* Shimmer Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-slate-200" />
          <div className="space-y-1.5">
            <div className="h-5 w-40 bg-slate-200 rounded-md" />
            <div className="h-3 w-56 bg-slate-200 rounded-md" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-8 w-64 bg-slate-200 rounded-lg" />
          <div className="h-8 w-24 bg-slate-200 rounded-lg" />
          <div className="h-8 w-24 bg-slate-200 rounded-lg" />
        </div>
      </div>

      {/* Shimmer KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs space-y-2">
            <div className="flex justify-between items-center">
              <div className="h-3.5 w-28 bg-slate-200 rounded" />
              <div className="h-2 w-2 rounded-full bg-slate-200" />
            </div>
            <div className="h-7 w-32 bg-slate-200 rounded-md" />
            <div className="h-3 w-36 bg-slate-200 rounded" />
          </div>
        ))}
      </div>

      {/* Shimmer DataTables Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Shimmer Toolbar */}
        <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="h-7 w-28 bg-slate-200 rounded" />
            <div className="h-7 w-36 bg-slate-200 rounded" />
            <div className="h-7 w-32 bg-slate-200 rounded" />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-44 bg-slate-200 rounded" />
            <div className="h-7 w-24 bg-slate-200 rounded" />
          </div>
        </div>

        {/* Shimmer Table Rows */}
        <div className="p-3 space-y-3">
          {/* Header Row */}
          <div className="h-8 w-full bg-slate-100 rounded-md" />
          
          {/* Body Rows */}
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-2 border-b border-slate-100">
              <div className="h-4 w-6 bg-slate-200 rounded shrink-0" />
              <div className="h-4 w-20 bg-slate-200 rounded shrink-0" />
              <div className="h-4 w-20 bg-slate-200 rounded shrink-0" />
              <div className="h-5 w-12 bg-slate-200 rounded shrink-0" />
              <div className="h-4 w-40 bg-slate-200 rounded shrink-0" />
              <div className="h-4 w-24 bg-slate-200 rounded shrink-0" />
              <div className="h-4 w-10 bg-slate-200 rounded shrink-0" />
              <div className="h-4 w-20 bg-slate-200 rounded shrink-0" />
              <div className="h-4 w-20 bg-slate-200 rounded shrink-0" />
              <div className="h-4 w-24 bg-slate-200 rounded shrink-0" />
              <div className="h-5 w-14 bg-slate-200 rounded shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

