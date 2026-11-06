"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, ChevronLeft, Download, Layers, ChevronDown, Search, ArrowUpAZ, ArrowDownZA, Filter } from 'lucide-react';
import { toast } from 'sonner';
import XeroInvoiceViewerDrawer, { OpenInvoiceData } from './XeroInvoiceViewerDrawer';

interface TransactionLine {
  date: string;
  source: string;
  desc: string;
  ref: string;
  currency: string;
  debitSource: string;
  creditSource: number;
  debitGbp: number;
  creditGbp: number;
  runningBalance: number;
  grossGbp?: number;
  taxGbp?: number;
  rawInvoice?: any;
  lineItems?: any[];
}

interface AccountTransactionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  streamName: string;
  totalRevenue: number;
  salesData?: any;
  dateLabel?: string;
}

export const getCurrencySymbol = (curr: string = "GBP") => {
  switch (curr?.toUpperCase()) {
    case 'GBP': return '£';
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'INR': return '₹';
    case 'AUD': return 'A$';
    case 'CAD': return 'C$';
    default: return '£';
  }
};

export const formatNum = (val: number) => {
  if (typeof val !== 'number' || isNaN(val)) return '0.00';
  return new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
};

export default function AccountTransactionsDrawer({
  isOpen,
  onClose,
  onBack,
  streamName,
  totalRevenue,
  salesData = null,
  dateLabel = ""
}: AccountTransactionsDrawerProps) {
  const searchParams = useSearchParams();
  const urlFromDate = searchParams?.get('from_date') || searchParams?.get('fromDate') || '';
  const urlToDate = searchParams?.get('to_date') || searchParams?.get('toDate') || '';
  const effectiveFromDate = (urlFromDate || salesData?.meta?.fromDate || '2026-04-01').split('T')[0];
  const effectiveToDate = (urlToDate || salesData?.meta?.toDate || '2026-09-30').split('T')[0];

  // Preserve data during exit animation transition
  const [displayStreamName, setDisplayStreamName] = useState(streamName);
  const [displayTotalRevenue, setDisplayTotalRevenue] = useState(totalRevenue);
  const [liveDbTransactions, setLiveDbTransactions] = useState<TransactionLine[] | null>(null);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);

  // Excel Column Filtering & Sorting States
  const [filterSelections, setFilterSelections] = useState<Record<string, string[]>>({});
  const [draftSelections, setDraftSelections] = useState<string[]>([]);
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
  const [sortConfig, setSortConfig] = useState<{ colKey: string; direction: 'asc' | 'desc' } | null>(null);

  // 3rd Level Multi-Instance Floating Xero Invoice Windows
  const [openInvoices, setOpenInvoices] = useState<OpenInvoiceData[]>([]);

  const activeStreamName = streamName || displayStreamName || "Sales";
  const activeTotalRevenue = totalRevenue || displayTotalRevenue || 0;

  const handleOpenInvoice = (row: TransactionLine) => {
    setOpenInvoices(prev => {
      const isReceiveMoney = row.source === 'Receive Money';
      const refKey = row.ref || (isReceiveMoney ? `REC-${row.date.replace(/\s+/g, '')}` : `TXN-${Date.now()}`);
      const displayRef = row.ref || (isReceiveMoney ? 'Receive Money' : 'INV-001');

      const existing = prev.find(inv => inv.id.startsWith(refKey) || (row.ref && inv.refNumber === row.ref));
      if (existing) {
        const maxZ = Math.max(...prev.map(i => i.zIndex), 1000);
        toast.info(`Transaction ${displayRef} is already open and brought to front!`);
        return prev.map(inv => inv.id === existing.id ? { ...inv, zIndex: maxZ + 1, isMinimized: false, isHighlighted: true } : inv);
      }
      const offset = (prev.length % 5) * 30;
      const maxZ = Math.max(...prev.map(i => i.zIndex), 1000);
      const winW = typeof window !== 'undefined' ? Math.min(820, window.innerWidth - 60) : 820;
      const winH = typeof window !== 'undefined' ? Math.min(520, window.innerHeight - 180) : 520;
      const startX = typeof window !== 'undefined' ? Math.max(30, Math.round((window.innerWidth - winW) / 2) + offset) : 90;
      const startY = typeof window !== 'undefined' ? Math.max(30, Math.round((window.innerHeight - winH) / 2 - 30) + offset) : 50;

      // Extract authentic contact name & invoice matching
      const matchingInv = row.rawInvoice || (salesData?.allInvoices || []).find((inv: any) => 
        (row.ref && (inv.number === row.ref || inv.reference === row.ref || inv.id === row.ref))
      );

      const contactName = matchingInv?.customer || (row.desc.includes('-') ? row.desc.split('-')[0].trim() : (row.desc || activeStreamName));
      const amountVal = row.creditGbp || row.debitGbp || matchingInv?.amount || 0;

      const grossTotalVal = matchingInv?.amount || (matchingInv?.subTotal && matchingInv?.totalTax ? matchingInv.subTotal + matchingInv.totalTax : amountVal);
      const subTotalVal = matchingInv?.subTotal !== undefined ? matchingInv.subTotal : amountVal;
      const totalTaxVal = matchingInv?.totalTax !== undefined ? matchingInv.totalTax : (grossTotalVal > subTotalVal ? grossTotalVal - subTotalVal : 0);
      const paidVal = matchingInv?.amountPaid !== undefined ? matchingInv.amountPaid : grossTotalVal;
      const dueVal = matchingInv?.amountDue !== undefined ? matchingInv.amountDue : 0;

      return [
        ...prev,
        {
          id: `${refKey}-${Date.now()}`,
          refNumber: displayRef,
          contactName: contactName,
          date: row.date,
          dueDate: matchingInv?.dueDate || row.date,
          paymentDate: matchingInv?.paymentDate || matchingInv?.fullyPaidOnDate || matchingInv?.Payments?.[0]?.Date || row.date,
          desc: row.desc,
          amount: grossTotalVal,
          subTotal: subTotalVal,
          totalTax: totalTaxVal,
          amountPaid: paidVal,
          amountDue: dueVal,
          status: matchingInv?.status || (isReceiveMoney ? 'Reconciled' : 'PAID'),
          lineItems: matchingInv?.lineItems || row.lineItems || [
            {
              desc: row.desc.includes('-') ? row.desc.split('-').slice(1).join('-').trim() : row.desc,
              account: `${activeStreamName}`,
              taxRate: 'Zero Rated Income',
              amountGbp: subTotalVal
            }
          ],
          attachments: matchingInv?.attachments || matchingInv?.Attachments || [],
          x: startX,
          y: startY,
          width: winW,
          height: winH,
          zIndex: maxZ + 1,
          isMinimized: false,
          isMaximized: false,
          isHighlighted: true
        }
      ];
    });
  };

  const handleCloseInvoice = (id: string) => {
    setOpenInvoices(prev => prev.filter(inv => inv.id !== id));
  };

  const handleFocusInvoice = (id: string) => {
    setOpenInvoices(prev => {
      const maxZ = Math.max(...prev.map(i => i.zIndex), 1000);
      return prev.map(inv => inv.id === id ? { ...inv, zIndex: maxZ + 1 } : inv);
    });
  };

  const handleUpdateInvoice = (id: string, updates: Partial<OpenInvoiceData>) => {
    setOpenInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...updates } : inv));
  };

  const handleOpenPaymentDoc = (doc: Partial<OpenInvoiceData>) => {
    setOpenInvoices(prev => {
      const maxZ = Math.max(...prev.map(i => i.zIndex), 1000);
      const winW = typeof window !== 'undefined' ? Math.min(820, window.innerWidth - 60) : 820;
      const winH = typeof window !== 'undefined' ? Math.min(520, window.innerHeight - 180) : 520;
      const offset = (prev.length % 5) * 35;
      const startX = typeof window !== 'undefined' ? Math.max(30, Math.round((window.innerWidth - winW) / 2) + offset) : 90;
      const startY = typeof window !== 'undefined' ? Math.max(30, Math.round((window.innerHeight - winH) / 2 - 30) + offset) : 50;

      return [
        ...prev,
        {
          id: doc.id || `pay-${Date.now()}`,
          refNumber: doc.refNumber || 'Receive Money',
          contactName: doc.contactName || 'Client',
          date: doc.date || '01 Apr 2026',
          dueDate: doc.dueDate || doc.date || '01 Apr 2026',
          paymentDate: doc.paymentDate || doc.date || '01 Apr 2026',
          desc: doc.desc || 'Payment Document',
          amount: doc.amount || 0,
          subTotal: doc.subTotal || doc.amount || 0,
          totalTax: 0,
          amountPaid: doc.amount || 0,
          amountDue: 0,
          status: doc.status || 'Reconciled',
          accountName: doc.accountName || '100 - Starling Business Account',
          lineItems: doc.lineItems || [],
          x: startX,
          y: startY,
          width: winW,
          height: winH,
          zIndex: maxZ + 1,
          isMinimized: false,
          isMaximized: false,
          isHighlighted: true
        }
      ];
    });
  };

  useEffect(() => {
    if (isOpen) {
      if (streamName) {
        setDisplayStreamName(streamName);
        setDisplayTotalRevenue(totalRevenue);
      }
      // Reset column filters and sorting whenever the drawer opens or stream changes
      setFilterSelections({});
      setDraftSelections([]);
      setActiveFilterColumn(null);
      setSearchTerms({});
      setSortConfig(null);

      // Async live fetch from PostgreSQL P&L drilldown API
      const fromDate = effectiveFromDate;
      const toDate = effectiveToDate;
      const targetStream = streamName || displayStreamName;
      
      if (targetStream) {
        setIsLoadingLedger(true);
        fetch(`/api/dashboard/reports/profit-and-loss/drilldown?account=${encodeURIComponent(targetStream)}&fromDate=${fromDate}&toDate=${toDate}&value=${totalRevenue || 0}`)
          .then(res => res.json())
          .then(data => {
            if (data && Array.isArray(data.transactions) && data.transactions.length > 0) {
              const mapped: TransactionLine[] = data.transactions.map((t: any) => ({
                date: t.date,
                source: t.source || 'Receivable Invoice',
                desc: t.description || t.desc || targetStream,
                ref: t.reference || t.ref || (t.source === 'Receive Money' ? '' : 'INV-001'),
                currency: t.currency || 'GBP',
                debitSource: t.debit > 0 ? formatNum(t.debit) : '-',
                creditSource: t.credit || 0,
                debitGbp: t.debit || 0,
                creditGbp: t.credit || 0,
                runningBalance: t.runningBalance || 0,
                grossGbp: t.gross || t.gross_amount || ((t.credit || t.debit || 0) + (t.tax || t.tax_amount || 0)),
                taxGbp: t.tax || t.tax_amount || 0,
                lineItems: t.lineItems,
                rawInvoice: t.rawInvoice
              }));
              setLiveDbTransactions(mapped);
            } else {
              setLiveDbTransactions(null);
            }
          })
          .catch(() => {
            setLiveDbTransactions(null);
          })
          .finally(() => {
            setIsLoadingLedger(false);
          });
      }
    }
  }, [isOpen, streamName, totalRevenue, effectiveFromDate, effectiveToDate]);

  // Close filter popover on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (activeFilterColumn && !target.closest('.excel-filter-cell')) {
        setActiveFilterColumn(null);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [activeFilterColumn]);

  // ESC key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (activeFilterColumn) {
          setActiveFilterColumn(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeFilterColumn, onClose]);

  // Generate authentic Xero Account Transactions matching live data and exact stream total
  const transactionsData: TransactionLine[] = useMemo(() => {
    if (liveDbTransactions && liveDbTransactions.length > 0) {
      return liveDbTransactions;
    }

    // STRICT ZERO-DATA GUARD: If total revenue is 0 or less, NEVER output dummy rows!
    if (activeTotalRevenue <= 0) {
      return [];
    }

    // Secondary fallback: Map from salesData.allInvoices if available in client memory
    if (salesData?.allInvoices && Array.isArray(salesData.allInvoices) && salesData.allInvoices.length > 0) {
      const currentStream = activeStreamName.toLowerCase().trim();
      const startRangeTs = new Date(`${effectiveFromDate.split('T')[0]}T00:00:00Z`).getTime();
      const endRangeTs = new Date(`${effectiveToDate.split('T')[0]}T23:59:59Z`).getTime();

      const matchedInvoices = salesData.allInvoices.filter((inv: any) => {
        const cName = (inv.customer || inv.contactName || '').toLowerCase();
        const ref = (inv.reference || inv.number || '').toLowerCase();
        const desc = (inv.desc || '').toLowerCase();

        const streamKeyword = currentStream.replace(/sales|income|trading/gi, '').trim() || currentStream;
        const matches = cName.includes(streamKeyword) || ref.includes(streamKeyword) || desc.includes(streamKeyword);

        if (!matches) return false;

        const dTime = new Date(inv.date).getTime();
        return !isNaN(dTime) ? (dTime >= startRangeTs && dTime <= endRangeTs) : true;
      });

      if (matchedInvoices.length > 0) {
        let running = 0;
        return matchedInvoices.map((inv: any) => {
          const amt = inv.amount || 0;
          running = Math.round((running + amt) * 100) / 100;
          return {
            date: inv.date,
            source: 'Receivable Invoice',
            desc: inv.desc || `${inv.customer || activeStreamName} - ${inv.reference || 'Sales'}`,
            ref: inv.number || inv.reference || 'INV-001',
            currency: inv.currencyCode || 'GBP',
            debitSource: '-',
            creditSource: amt,
            debitGbp: 0,
            creditGbp: amt,
            runningBalance: running,
            rawInvoice: inv,
            lineItems: inv.lineItems
          };
        });
      }
    }

    return [];
  }, [activeStreamName, activeTotalRevenue, liveDbTransactions, salesData, effectiveFromDate, effectiveToDate]);

  const getColVal = (item: TransactionLine, colKey: string) => {
    if (colKey === 'date') return item.date;
    if (colKey === 'source') return item.source;
    if (colKey === 'desc') return item.desc;
    if (colKey === 'ref') return item.ref;
    if (colKey === 'currency') return item.currency;
    if (colKey === 'debitGbp') return item.debitGbp > 0 ? formatNum(item.debitGbp) : '-';
    if (colKey === 'creditGbp') return item.creditGbp > 0 ? formatNum(item.creditGbp) : '-';
    if (colKey === 'runningBalance') return formatNum(item.runningBalance);
    if (colKey === 'grossGbp') return item.grossGbp ? formatNum(item.grossGbp) : '-';
    if (colKey === 'taxGbp') return item.taxGbp ? formatNum(item.taxGbp) : '-';
    return "";
  };

  // Processed Data with Column Filters & Sorting
  const processedData = useMemo(() => {
    let result = [...transactionsData];

    // Apply column filters
    Object.keys(filterSelections).forEach(colKey => {
      const selectedVals = filterSelections[colKey];
      if (selectedVals) {
        const selectedSet = new Set(selectedVals);
        result = result.filter(item => {
          const valStr = getColVal(item, colKey);
          return selectedSet.has(valStr);
        });
      }
    });

    // Apply sorting
    if (sortConfig) {
      const { colKey, direction } = sortConfig;
      result.sort((a, b) => {
        let valA: any = "";
        let valB: any = "";
        if (colKey === 'date') { valA = new Date(a.date).getTime() || 0; valB = new Date(b.date).getTime() || 0; }
        else if (colKey === 'source') { valA = a.source; valB = b.source; }
        else if (colKey === 'desc') { valA = a.desc; valB = b.desc; }
        else if (colKey === 'ref') { valA = a.ref; valB = b.ref; }
        else if (colKey === 'currency') { valA = a.currency; valB = b.currency; }
        else if (colKey === 'debitGbp') { valA = a.debitGbp; valB = b.debitGbp; }
        else if (colKey === 'creditGbp') { valA = a.creditGbp; valB = b.creditGbp; }
        else if (colKey === 'runningBalance') { valA = a.runningBalance; valB = b.runningBalance; }
        else if (colKey === 'grossGbp') { valA = a.grossGbp || 0; valB = b.grossGbp || 0; }
        else if (colKey === 'taxGbp') { valA = a.taxGbp || 0; valB = b.taxGbp || 0; }

        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Determine if this account is predominantly an expense/COGS account
    const isExpenseLedger = transactionsData.some(t => t.debitGbp > 0) && transactionsData.reduce((sum, t) => sum + t.debitGbp, 0) >= transactionsData.reduce((sum, t) => sum + t.creditGbp, 0);

    // Recalculate running balance
    let running = 0;
    return result.map(item => {
      const delta = isExpenseLedger ? (item.debitGbp - item.creditGbp) : (item.creditGbp - item.debitGbp);
      running = Math.round((running + delta) * 100) / 100;
      return {
        ...item,
        runningBalance: running
      };
    });
  }, [transactionsData, filterSelections, sortConfig]);

  const filteredDebitSum = useMemo(() => {
    return processedData.reduce((acc, curr) => acc + (curr.debitGbp || 0), 0);
  }, [processedData]);

  const filteredCreditSum = useMemo(() => {
    return processedData.reduce((acc, curr) => acc + (curr.creditGbp || 0), 0);
  }, [processedData]);

  const filteredGrossSum = useMemo(() => {
    return processedData.reduce((acc, curr) => acc + (curr.grossGbp || 0), 0);
  }, [processedData]);

  const filteredTaxSum = useMemo(() => {
    return processedData.reduce((acc, curr) => acc + (curr.taxGbp || 0), 0);
  }, [processedData]);

  const filteredNetBalance = useMemo(() => {
    const isExpenseLedger = processedData.some(t => t.debitGbp > 0) && processedData.reduce((sum, t) => sum + t.debitGbp, 0) >= processedData.reduce((sum, t) => sum + t.creditGbp, 0);
    return isExpenseLedger
      ? Math.round((filteredDebitSum - filteredCreditSum) * 100) / 100
      : Math.round((filteredCreditSum - filteredDebitSum) * 100) / 100;
  }, [filteredCreditSum, filteredDebitSum, processedData]);

  const activeCurrencySymbol = getCurrencySymbol(processedData[0]?.currency || "GBP");

  const handleExportCSV = () => {
    try {
      const headers = ["Date,Source,Description,Reference,Currency,Debit (GBP),Credit (GBP),Running Balance (GBP),Gross (GBP),Tax (GBP)"];
      const rows = processedData.map(t => `"${t.date}","${t.source}","${t.desc}","${t.ref}","${t.currency}",${t.debitGbp || 0},${t.creditGbp || 0},${t.runningBalance},${t.grossGbp || 0},${t.taxGbp || 0}`);
      const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${activeStreamName}_Account_Transactions_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Account transactions CSV exported successfully!");
    } catch (err) {
      toast.error("Failed to export CSV");
    }
  };

  const renderColumnHeader = (colKey: string, label: string, align: 'left' | 'center' | 'right' = 'left') => {
    const isFilterActive = filterSelections[colKey] !== undefined;
    const isPopoverOpen = activeFilterColumn === colKey;

    const allUniqueValues = Array.from(new Set(transactionsData.map(item => getColVal(item, colKey)))).sort();

    const searchTerm = searchTerms[colKey] || '';

    const visibleOptions = allUniqueValues.filter(val =>
      val.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isAllSelected = visibleOptions.length > 0 && visibleOptions.every(v => draftSelections.includes(v));

    const toggleSelectAll = () => {
      if (isAllSelected) {
        setDraftSelections(prev => prev.filter(v => !visibleOptions.includes(v)));
      } else {
        setDraftSelections(prev => Array.from(new Set([...prev, ...visibleOptions])));
      }
    };

    const toggleOption = (val: string) => {
      setDraftSelections(prev => 
        prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
      );
    };

    const applyFilter = () => {
      if (draftSelections.length === allUniqueValues.length) {
        setFilterSelections(prev => {
          const copy = { ...prev };
          delete copy[colKey];
          return copy;
        });
      } else {
        setFilterSelections(prev => ({ ...prev, [colKey]: draftSelections }));
      }
      setActiveFilterColumn(null);
    };

    const clearColumnFilter = () => {
      setFilterSelections(prev => {
        const copy = { ...prev };
        delete copy[colKey];
        return copy;
      });
      setSearchTerms(prev => ({ ...prev, [colKey]: '' }));
      setActiveFilterColumn(null);
    };

    const openPopover = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isPopoverOpen) {
        setActiveFilterColumn(null);
      } else {
        const existing = filterSelections[colKey];
        setDraftSelections(existing !== undefined ? [...existing] : [...allUniqueValues]);
        setActiveFilterColumn(colKey);
      }
    };

    return (
      <th className={`py-3.5 px-6 relative select-none excel-filter-cell text-${align}`}>
        <div 
          className={`inline-flex items-center gap-1.5 cursor-pointer group ${align === 'right' ? 'flex-row-reverse' : align === 'center' ? 'justify-center w-full' : ''}`}
          onClick={openPopover}
        >
          <span>{label}</span>
          <button
            type="button"
            className={`p-1 rounded-md transition-all ${
              isFilterActive 
                ? 'bg-blue-600 text-white font-bold shadow-2xs' 
                : 'text-slate-400 group-hover:text-slate-700 group-hover:bg-slate-200/80'
            }`}
            title={`Filter / Sort ${label}`}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Excel Filter Dropdown Popover */}
        {isPopoverOpen && (
          <div 
            onClick={(e) => e.stopPropagation()}
            className={`absolute top-full mt-1.5 z-50 w-72 bg-white rounded-xl border border-slate-200 shadow-2xl p-3.5 text-slate-800 text-xs font-normal normal-case text-left ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            
            {/* Header Bar */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 font-bold text-slate-900">
              <span>Filter: {label}</span>
              <button
                type="button"
                onClick={() => setActiveFilterColumn(null)}
                className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Sort Buttons */}
            <div className="py-2 flex flex-col gap-1 border-b border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setSortConfig({ colKey, direction: 'asc' });
                  setActiveFilterColumn(null);
                }}
                className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer ${
                  sortConfig?.colKey === colKey && sortConfig?.direction === 'asc' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700'
                }`}
              >
                <ArrowUpAZ className="h-4 w-4 text-slate-400" />
                <span>Sort A to Z (Ascending)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSortConfig({ colKey, direction: 'desc' });
                  setActiveFilterColumn(null);
                }}
                className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer ${
                  sortConfig?.colKey === colKey && sortConfig?.direction === 'desc' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700'
                }`}
              >
                <ArrowDownZA className="h-4 w-4 text-slate-400" />
                <span>Sort Z to A (Descending)</span>
              </button>
            </div>

            {/* Search Box */}
            <div className="pt-2.5 pb-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search values..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerms(prev => ({ ...prev, [colKey]: e.target.value }))}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>
            </div>

            {/* Checkbox Multiselect List */}
            <div className="max-h-48 overflow-y-auto border border-slate-200/90 rounded-lg bg-slate-50/50 p-1 space-y-0.5">
              <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-200/60 rounded cursor-pointer font-bold text-slate-800 border-b border-slate-200/80 mb-1">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                />
                <span>(Select All)</span>
              </label>

              {visibleOptions.length === 0 ? (
                <div className="py-3 text-center text-slate-400 italic">No matching items</div>
              ) : (
                visibleOptions.map((optVal, idx) => {
                  const isChecked = draftSelections.includes(optVal);
                  let displayOpt = optVal;
                  if (colKey === 'creditGbp' || colKey === 'runningBalance') {
                    displayOpt = formatNum(parseFloat(optVal) || 0);
                  }

                  return (
                    <label key={idx} className="flex items-center gap-2 px-2 py-1 hover:bg-blue-50/70 rounded cursor-pointer text-slate-700 text-xs transition-colors">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOption(optVal)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                      />
                      <span className="truncate">{displayOpt}</span>
                    </label>
                  );
                })
              )}
            </div>

            {/* Action Footer */}
            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100">
              <button
                type="button"
                onClick={clearColumnFilter}
                className="text-xs text-slate-500 hover:text-red-600 font-medium transition cursor-pointer"
              >
                Clear Filter
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveFilterColumn(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyFilter}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer shadow-xs active:scale-95"
                >
                  OK
                </button>
              </div>
            </div>

          </div>
        )}
      </th>
    );
  };

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-white">
          {/* Full Screen Ultra Smooth Slide-Over Page (Left-to-Right Entrance) */}
          <motion.div 
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full h-full bg-white flex flex-col"
          >
            
            {/* Full Screen Header (Clean Modern Accounting Style) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-8 py-4 border-b border-slate-200 bg-white shrink-0">
              <div className="flex items-center gap-3.5">
                <button
                  onClick={onBack}
                  className="w-10 h-10 rounded-full bg-slate-100/90 hover:bg-blue-600 text-slate-700 hover:text-white border border-slate-200/80 hover:border-blue-600 flex items-center justify-center transition-all duration-200 shadow-2xs hover:shadow-md hover:shadow-blue-500/25 cursor-pointer group shrink-0 active:scale-95"
                  title="Back to Turnover Breakdown"
                  aria-label="Back to Turnover Breakdown"
                >
                  <ChevronLeft className="h-5.5 w-5.5 group-hover:-translate-x-0.5 transition-transform ease-out" />
                </button>

                <div>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                    {activeStreamName} Transactions
                  </h2>
                  <div className="text-xs text-slate-500 font-medium mt-0.5">
                    {salesData?.meta?.orgName || "Organization"} &nbsp;|&nbsp; {
                      dateLabel && !dateLabel.includes("2026-") ? dateLabel :
                      effectiveFromDate && effectiveToDate ? `For the period ${new Date(effectiveFromDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} to ${new Date(effectiveToDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` :
                      "For the period 1 April 2026 to 30 September 2026"
                    }
                  </div>
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-1.5 px-4 py-2 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition cursor-pointer shadow-2xs whitespace-nowrap"
                >
                  <Download className="h-4 w-4 text-slate-400" />
                  <span>Export CSV</span>
                </button>

                <button
                  onClick={onClose}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer outline-none ml-2"
                  aria-label="Close transactions view"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Account Transactions Data Table (Clean Full Screen Accounting Typography with Excel Filters) */}
            <div className="flex-1 overflow-y-auto px-2 relative custom-table-scrollbar">
              <table className="w-full text-center text-xs border-collapse">
                <thead className="sticky top-0 z-30">
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase tracking-wider text-center">
                    {renderColumnHeader('date', 'Date', 'center')}
                    {renderColumnHeader('source', 'Source', 'center')}
                    {renderColumnHeader('desc', 'Description', 'center')}
                    {renderColumnHeader('ref', 'Reference / Invoice No.', 'center')}
                    {renderColumnHeader('currency', 'Currency', 'center')}
                    {renderColumnHeader('debitGbp', 'Debit', 'center')}
                    {renderColumnHeader('creditGbp', 'Credit', 'center')}
                    {renderColumnHeader('runningBalance', 'Running Balance', 'center')}
                    {renderColumnHeader('grossGbp', 'Gross', 'center')}
                    {renderColumnHeader('taxGbp', 'Tax', 'center')}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-sans text-xs">
                  {isLoadingLedger ? (
                    Array.from({ length: 6 }).map((_, sIdx) => (
                      <tr key={`skel-${sIdx}`} className="animate-pulse border-b border-slate-100 bg-white">
                        <td className="py-4 px-6"><div className="h-3.5 bg-slate-200/80 rounded-md w-20 mx-auto"></div></td>
                        <td className="py-4 px-6"><div className="h-3.5 bg-slate-200/80 rounded-md w-24 mx-auto"></div></td>
                        <td className="py-4 px-6"><div className="h-3.5 bg-slate-200/80 rounded-md w-48 mx-auto"></div></td>
                        <td className="py-4 px-6"><div className="h-3.5 bg-slate-200/80 rounded-md w-20 mx-auto"></div></td>
                        <td className="py-4 px-4"><div className="h-3.5 bg-slate-200/80 rounded-md w-10 mx-auto"></div></td>
                        <td className="py-4 px-6"><div className="h-3.5 bg-slate-200/80 rounded-md w-16 mx-auto"></div></td>
                        <td className="py-4 px-6"><div className="h-3.5 bg-slate-200/80 rounded-md w-16 mx-auto"></div></td>
                        <td className="py-4 px-8"><div className="h-3.5 bg-slate-200/80 rounded-md w-20 mx-auto"></div></td>
                        <td className="py-4 px-6"><div className="h-3.5 bg-slate-200/80 rounded-md w-16 mx-auto"></div></td>
                        <td className="py-4 px-6"><div className="h-3.5 bg-slate-200/80 rounded-md w-16 mx-auto"></div></td>
                      </tr>
                    ))
                  ) : processedData.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400 italic font-medium">
                        No transactions match the selected filters
                      </td>
                    </tr>
                  ) : (
                    processedData.map((row, idx) => {
                      const isBankTxn = row.source === 'Receive Money' || row.source === 'Spend Money';
                      const isJournal = row.source === 'Manual Journal';
                      const mainRef = row.ref || (isBankTxn ? row.source : '-');
                      const actualInvNum = row.rawInvoice?.number || row.rawInvoice?.InvoiceNumber;
                      const actualInvId = row.rawInvoice?.id || row.rawInvoice?.InvoiceID;
                      
                      let extraLabel: string | null = null;
                      if (isBankTxn && actualInvId) {
                        extraLabel = `Bank Txn ID: ${actualInvId}`;
                      } else if (isJournal && actualInvId) {
                        extraLabel = `Journal ID: ${actualInvId}`;
                      } else if (actualInvNum && actualInvNum !== mainRef && mainRef !== '-') {
                        extraLabel = (actualInvId && actualInvId !== actualInvNum && !mainRef.includes(actualInvId.toString()))
                          ? `Inv #: ${actualInvNum} | Inv ID: ${actualInvId}`
                          : `Inv #: ${actualInvNum}`;
                      } else if (actualInvId && !mainRef.includes(actualInvId.toString())) {
                        extraLabel = `Inv ID: ${actualInvId}`;
                      }

                      return (
                        <tr 
                          key={idx} 
                          className={`transition-colors border-b border-slate-100 ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'
                          } hover:bg-blue-50/70`}
                        >
                          <td className="py-3 px-6 text-center whitespace-nowrap text-slate-700 font-medium">{row.date}</td>
                          <td className="py-3 px-6 text-center whitespace-nowrap text-slate-500">{row.source}</td>
                          <td 
                            className="py-3 px-6 text-center font-semibold text-slate-900 hover:text-blue-600 cursor-pointer transition-colors"
                            onClick={() => handleOpenInvoice(row)}
                            title="Click to view transaction details"
                          >
                            {row.desc}
                          </td>
                          <td 
                            className="py-3 px-6 text-center font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors" 
                            title="Click to view full Xero invoice details & breakdown"
                            onClick={() => handleOpenInvoice(row)}
                          >
                            <div>{mainRef}</div>
                            {extraLabel && (
                              <div className="text-[10px] text-slate-500 font-mono font-normal flex items-center justify-center gap-1 mt-0.5">
                                <span className="bg-blue-50/90 text-blue-700 border border-blue-200/70 px-1 py-0.2 rounded text-[9.5px]">
                                  {extraLabel}
                                </span>
                              </div>
                            )}
                          </td>
                        <td className="py-3 px-4 text-center text-slate-400 text-[11px] font-medium">{row.currency}</td>
                        <td className="py-3 px-6 text-center text-slate-700 tabular-nums">
                          {row.debitGbp > 0 ? (
                            <span className="font-semibold text-red-600">
                              <span className="text-slate-400 font-normal text-[11px] mr-1">{getCurrencySymbol(row.currency)}</span>
                              {formatNum(row.debitGbp)}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-6 text-center font-semibold text-slate-900 tabular-nums">
                          {row.creditGbp > 0 ? (
                            <>
                              <span className="text-slate-400 font-normal text-[11px] mr-1">{getCurrencySymbol(row.currency)}</span>
                              <span>{formatNum(row.creditGbp)}</span>
                            </>
                          ) : (
                            <span className="text-slate-300 font-normal">-</span>
                          )}
                        </td>
                        <td className="py-3 px-8 text-center font-bold text-slate-900 tabular-nums">
                          <span className="text-slate-400 font-normal text-[11px] mr-1">{getCurrencySymbol(row.currency)}</span>
                          <span>{formatNum(row.runningBalance)}</span>
                        </td>
                        <td className="py-3 px-6 text-center font-semibold text-slate-900 tabular-nums">
                          {row.grossGbp ? (
                            <>
                              <span className="text-slate-400 font-normal text-[11px] mr-1">{getCurrencySymbol(row.currency)}</span>
                              <span>{formatNum(row.grossGbp)}</span>
                            </>
                          ) : (
                            <span className="text-slate-300 font-normal">-</span>
                          )}
                        </td>
                        <td className="py-3 px-6 text-center font-semibold text-slate-900 tabular-nums">
                          {row.taxGbp ? (
                            <>
                              <span className="text-slate-400 font-normal text-[11px] mr-1">{getCurrencySymbol(row.currency)}</span>
                              <span>{formatNum(row.taxGbp)}</span>
                            </>
                          ) : (
                            <span className="text-slate-300 font-normal">-</span>
                          )}
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>

                {/* Normal Sticky Bottom Total Summary Row */}
                <tfoot className="sticky bottom-0 z-10 bg-slate-50 border-t-2 border-slate-300 shadow-md">
                  <tr className="border-b border-b-slate-300 bg-slate-50 font-bold text-xs text-slate-900 text-center">
                    <td colSpan={5} className="py-4 px-6 text-center font-bold text-slate-800 uppercase tracking-wider text-xs">
                      Total {activeStreamName}
                    </td>
                    <td className="py-4 px-6 text-center font-extrabold text-red-600 tabular-nums text-sm">
                      {filteredDebitSum > 0 ? (
                        <>
                          <span className="text-slate-500 font-bold text-xs mr-1">{activeCurrencySymbol}</span>
                          <span>{formatNum(filteredDebitSum)}</span>
                        </>
                      ) : (
                        <span className="text-slate-400 font-normal">-</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center font-extrabold text-slate-900 tabular-nums text-sm">
                      <span className="text-slate-600 font-bold text-xs mr-1">{activeCurrencySymbol}</span>
                      <span>{formatNum(filteredCreditSum)}</span>
                    </td>
                    <td className="py-4 px-8 text-center font-black text-slate-900 tabular-nums text-sm">
                      <span className="text-slate-600 font-bold text-xs mr-1">{activeCurrencySymbol}</span>
                      <span>{formatNum(filteredNetBalance)}</span>
                    </td>
                    <td className="py-4 px-6 text-center font-extrabold text-slate-900 tabular-nums text-sm">
                      {filteredGrossSum > 0 ? (
                        <>
                          <span className="text-slate-600 font-bold text-xs mr-1">{activeCurrencySymbol}</span>
                          <span>{formatNum(filteredGrossSum)}</span>
                        </>
                      ) : (
                        <span className="text-slate-400 font-normal">-</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center font-extrabold text-slate-900 tabular-nums text-sm">
                      {filteredTaxSum > 0 ? (
                        <>
                          <span className="text-slate-600 font-bold text-xs mr-1">{activeCurrencySymbol}</span>
                          <span>{formatNum(filteredTaxSum)}</span>
                        </>
                      ) : (
                        <span className="text-slate-400 font-normal">-</span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Fixed Footer Note */}
            <div className="border-t border-slate-200 bg-slate-100/80 px-8 py-3 text-xs text-slate-500 flex justify-between shrink-0">
              <span>Showing {processedData.length} of {transactionsData.length} entries</span>
              <span className="font-semibold text-slate-700">Official Xero Account Transactions Report</span>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* 3rd Level Multi-Instance Floating, Draggable, Resizable Invoice Window Manager */}
    <XeroInvoiceViewerDrawer
      invoices={openInvoices}
      onCloseInvoice={handleCloseInvoice}
      onFocusInvoice={handleFocusInvoice}
      onUpdateInvoice={handleUpdateInvoice}
      onOpenPayment={handleOpenPaymentDoc}
    />
    </>
  );
}
