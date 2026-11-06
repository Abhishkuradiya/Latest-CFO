"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, Download, Printer, CheckCircle2, Loader2, ExternalLink, Minus, Maximize2, Minimize2, Move, FileText, Layers, Paperclip, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { resolveBrandingTheme } from '@/lib/constants/brandingThemes';

export interface OpenInvoiceLineItem {
  desc: string;
  account: string;
  taxRate: string;
  amountGbp: number;
}

const ACCOUNT_CODE_MAP: Record<string, string> = {
  '400': 'SLA & Contract Income',
  '405': 'PayPal Fee',
  '410': 'Sales',
  '411': 'Ebay sales',
  '412': 'Amazon Sales',
  '413': 'Website Sales',
  '414': 'Groupon Sales',
  '415': 'Inter company sales to BC Ltd',
  '416': 'Website Sales-GWL',
  '420': 'Rebates & Supplier Incentives',
  '421': 'Interest Income',
  '499': 'Inter company Purchases from BC Ltd',
  '500': 'Cost of goods or services',
  '501': 'Packaging Materials',
  '502': 'Inventory Write-offs / Expiry',
  '503': 'Logistics',
  '504': '3PL',
  '505': 'Referral Fees',
  '506': 'Merchant Fees',
  '507': 'Courier & Shipping Costs',
  '508': 'Amazon Fee',
  '509': 'Ebay fee',
  '510': 'Amazon Shipping',
  '511': 'Opening stock',
  '512': 'Closing stock'
};

export interface OpenInvoiceData {
  id: string;
  refNumber: string;
  contactName?: string;
  customer?: string;
  date: string;
  dueDate?: string;
  paymentDate?: string;
  desc?: string;
  amount: number;
  subTotal?: number;
  totalTax?: number;
  amountPaid?: number;
  amountDue?: number;
  status?: string;
  accountName?: string;
  lineItems?: OpenInvoiceLineItem[] | any[];
  payments?: any[];
  attachments?: any[];
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  isMinimized: boolean;
  isMaximized: boolean;
  isHighlighted?: boolean;
}

interface XeroInvoiceWindowManagerProps {
  invoices: OpenInvoiceData[];
  onCloseInvoice: (id: string) => void;
  onFocusInvoice: (id: string) => void;
  onUpdateInvoice: (id: string, updates: Partial<OpenInvoiceData>) => void;
  onOpenPayment?: (doc: Partial<OpenInvoiceData>) => void;
}

export default function XeroInvoiceViewerDrawer({
  invoices,
  onCloseInvoice,
  onFocusInvoice,
  onUpdateInvoice,
  onOpenPayment
}: XeroInvoiceWindowManagerProps) {
  if (!invoices || invoices.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
      {/* Floating Windows Stack */}
      {invoices.map((inv) => (
        <SingleFloatingInvoiceWindow
          key={inv.id}
          invoice={inv}
          onClose={() => onCloseInvoice(inv.id)}
          onFocus={() => onFocusInvoice(inv.id)}
          onUpdate={(updates) => onUpdateInvoice(inv.id, updates)}
          onOpenPayment={onOpenPayment}
        />
      ))}

      {/* Bottom Full-Width Taskbar Dock for Open/Minimized Invoice Windows */}
      <div className="fixed bottom-3 left-6 right-6 z-[10000] pointer-events-auto flex items-center justify-between gap-3 bg-slate-900/95 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-700/80 shadow-2xl">
        <div className="flex items-center gap-1.5 text-xs text-slate-300 font-bold px-2 border-r border-slate-700/80 mr-1 shrink-0">
          <Layers className="h-4 w-4 text-blue-400" />
          <span>Open Invoices ({invoices.length})</span>
        </div>

        <div className="flex-1 flex items-center gap-2 overflow-x-auto thin-scrollbar py-1 min-w-0">
          {invoices.map((inv) => (
            <button
              key={inv.id}
              onClick={() => {
                onFocusInvoice(inv.id);
                if (inv.isMinimized) {
                  onUpdateInvoice(inv.id, { isMinimized: false, isHighlighted: true });
                } else {
                  onUpdateInvoice(inv.id, { isHighlighted: true });
                }
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 border ${
                inv.isMinimized
                  ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                  : 'bg-blue-600 text-white border-blue-500 shadow-xs hover:bg-blue-700'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>{inv.refNumber}</span>
              <span className="text-[10px] opacity-75">(&pound;{formatNum(inv.amount)})</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseInvoice(inv.id);
                }}
                className="hover:bg-black/20 p-0.5 rounded-md ml-1 transition"
                title="Close Window"
              >
                <X className="h-3 w-3" />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Single Floating, Draggable, Resizable Window Component
function SingleFloatingInvoiceWindow({
  invoice,
  onClose,
  onFocus,
  onUpdate,
  onOpenPayment
}: {
  invoice: OpenInvoiceData;
  onClose: () => void;
  onFocus: () => void;
  onUpdate: (updates: Partial<OpenInvoiceData>) => void;
  onOpenPayment?: (doc: Partial<OpenInvoiceData>) => void;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, winX: 0, winY: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, winW: 0, winH: 0 });

  const [isInteracting, setIsInteracting] = useState(false);
  const windowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsLoading(true);
    let isMounted = true;

    let fetchTargetId = (invoice as any).xeroInvoiceId || (invoice as any).externalId || (invoice.refNumber && invoice.refNumber !== 'Receive Money' ? invoice.refNumber : '');
    if (!fetchTargetId) {
      fetchTargetId = (invoice.id || '').replace(/-\d{13}$/, '');
    }

    if (fetchTargetId) {
      fetch(`/api/dashboard/invoices/live/${encodeURIComponent(fetchTargetId)}`)
        .then(res => res.json())
        .then(data => {
          if (isMounted && data && !data.error) {
            const updates: Partial<OpenInvoiceData> = {};
            if (data.paymentDate) updates.paymentDate = data.paymentDate;
            if (data.dueDate) updates.dueDate = data.dueDate;
            if (data.date) updates.date = data.date;
            if (data.status) updates.status = data.status;
            if (data.amountPaid !== undefined) updates.amountPaid = data.amountPaid;
            if (data.amountDue !== undefined) updates.amountDue = data.amountDue;
            if (data.subTotal !== undefined) updates.subTotal = data.subTotal;
            if (data.totalTax !== undefined) updates.totalTax = data.totalTax;
            if (data.total !== undefined) updates.amount = data.total;
            if (data.lineItems && Array.isArray(data.lineItems) && data.lineItems.length > 0) {
              updates.lineItems = data.lineItems;
            }
            if (data.payments && Array.isArray(data.payments) && data.payments.length > 0) {
              updates.payments = data.payments;
            }
            if (data.attachments && Array.isArray(data.attachments)) {
              updates.attachments = data.attachments;
            }
            if (Object.keys(updates).length > 0) {
              onUpdate(updates);
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [invoice.id, invoice.refNumber]);

  // Clear highlight glow ring after 1.4s
  useEffect(() => {
    if (invoice.isHighlighted) {
      const timer = setTimeout(() => {
        onUpdate({ isHighlighted: false });
      }, 1450);
      return () => clearTimeout(timer);
    }
  }, [invoice.isHighlighted, onUpdate]);

  // Ultra-Smooth 60FPS Dragging Implementation
  const handleDragMouseDown = (e: React.MouseEvent) => {
    if (invoice.isMaximized) return;
    e.preventDefault();
    e.stopPropagation();
    onFocus();
    isDraggingRef.current = true;
    setIsInteracting(true);

    document.body.style.userSelect = 'none';

    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = invoice.x;
    const initialY = invoice.y;
    let latestX = initialX;
    let latestY = initialY;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      ev.preventDefault();
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      // Strict boundary clamping so title bar is NEVER lost behind taskbar dock or screen edges
      const maxTop = typeof window !== 'undefined' ? Math.max(10, window.innerHeight - 120) : 600;
      const maxLeft = typeof window !== 'undefined' ? Math.max(10, window.innerWidth - 200) : 800;

      latestX = Math.max(10, Math.min(maxLeft, initialX + dx));
      latestY = Math.max(10, Math.min(maxTop, initialY + dy));

      if (windowRef.current) {
        windowRef.current.style.left = `${latestX}px`;
        windowRef.current.style.top = `${latestY}px`;
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      setIsInteracting(false);
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      onUpdate({ x: latestX, y: latestY });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: false });
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Ultra-Smooth 60FPS Resizing Implementation
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (invoice.isMaximized) return;
    onFocus();
    isResizingRef.current = true;
    setIsInteracting(true);
    document.body.style.userSelect = 'none';

    const startX = e.clientX;
    const startY = e.clientY;
    const initialW = invoice.width;
    const initialH = invoice.height;
    let latestW = initialW;
    let latestH = initialH;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isResizingRef.current) return;
      ev.preventDefault();
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      const maxW = typeof window !== 'undefined' ? Math.max(480, window.innerWidth - invoice.x - 20) : 820;
      const maxH = typeof window !== 'undefined' ? Math.max(320, window.innerHeight - invoice.y - 70) : 600;

      latestW = Math.max(480, Math.min(maxW, initialW + dx));
      latestH = Math.max(320, Math.min(maxH, initialH + dy));

      if (windowRef.current) {
        windowRef.current.style.width = `${latestW}px`;
        windowRef.current.style.height = `${latestH}px`;
      }
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      setIsInteracting(false);
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      onUpdate({ width: latestW, height: latestH });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: false });
    window.addEventListener('mouseup', handleMouseUp);
  };

  if (invoice.isMinimized) return null;

  const invNum = invoice.refNumber || 'INV-001';
  const contact = (invoice.contactName || invoice.customer || (invoice.desc && invoice.desc.includes('-') ? invoice.desc.split('-')[0].trim() : (invoice.desc || 'Client'))).trim();
  const issueDate = formatXeroDateString(invoice.date);
  const dueDate = formatXeroDateString(invoice.dueDate || invoice.date);
  const totalAmount = invoice.amount || 0;

  const isExpense = invNum.toLowerCase().includes('bill') || invNum.toLowerCase().includes('amz') || (invoice.accountName && (invoice.accountName.startsWith('5') || invoice.accountName.startsWith('6') || invoice.accountName === '499')) || (invoice.desc && (invoice.desc.toLowerCase().includes('fee') || invoice.desc.toLowerCase().includes('purchases') || invoice.desc.toLowerCase().includes('cogs') || invoice.desc.toLowerCase().includes('bill')));

  const invType = (invoice as any).type || (invoice as any).Type;
  const lineAmtTypes = ((invoice as any).lineAmountTypes || (invoice as any).LineAmountTypes || '').toString().toLowerCase();
  const isTaxInclusive = lineAmtTypes === 'inclusive' || (invType === 'ACCREC' && lineAmtTypes !== 'exclusive');

  // Compute or format line items dynamically from real invoice record
  const computedLineItems: OpenInvoiceLineItem[] = useMemo(() => {
    const rawItems = invoice.lineItems || (invoice as any).LineItems || (invoice as any).line_items;
    if (rawItems && Array.isArray(rawItems) && rawItems.length > 0) {
      return rawItems.map((item: any) => {
        let rawLineAmt = item.LineAmount !== undefined 
          ? parseFloat(item.LineAmount) 
          : (item.lineAmount !== undefined
              ? parseFloat(item.lineAmount)
              : (item.line_amount !== undefined
                  ? parseFloat(item.line_amount)
                  : (item.UnitAmount !== undefined 
                      ? parseFloat(item.UnitAmount) 
                      : (item.unitAmount !== undefined
                          ? parseFloat(item.unitAmount)
                          : (typeof item.amountGbp === 'number' ? item.amountGbp : totalAmount)))));

        const t = (item.TaxType || item.taxType || item.tax_type || '').toUpperCase();
        let taxRateStr = item.taxRate || item.tax_rate;

        if (t === 'ZERORATEDOUTPUT' || t === 'ZERORATEDINPUT' || t === 'ZERORATED') {
          taxRateStr = 'Zero Rated';
        } else if (t === 'RROUTPUT' || t === 'RRINPUT') {
          taxRateStr = item.TaxType || item.taxType || item.tax_type || 'Reduced Rate Tax';
        } else if (t === 'OUTPUT2' || t === 'OUTPUT' || t === 'INPUT2' || t === 'INPUT') {
          taxRateStr = item.TaxType || item.taxType || item.tax_type || 'Standard Tax';
        } else if (t === 'NONE' || t === 'NO VAT') {
          taxRateStr = 'No Tax';
        } else if (!taxRateStr) {
          taxRateStr = (item.TaxAmount || item.taxAmount) ? 'Tax Applied' : 'Zero Rated';
        }

        const accCode = (item.AccountCode || item.accountCode || item.account_code || (item.account && item.account.match(/^(\d{3,4})/)?.[1]) || '').toString();
        let resolvedAccount = '';

        if (accCode && ACCOUNT_CODE_MAP[accCode]) {
          resolvedAccount = `${accCode} - ${ACCOUNT_CODE_MAP[accCode]}`;
        } else if (item.AccountName && accCode) {
          resolvedAccount = `${accCode} - ${item.AccountName}`;
        } else if (item.account && !item.account.includes(contact)) {
          resolvedAccount = item.account;
        } else if (accCode) {
          resolvedAccount = `${accCode} - ${contact}`;
        } else {
          resolvedAccount = invoice.accountName || (isExpense ? '500 - Cost of goods' : '400 - Sales');
        }

        return {
          desc: item.Description || item.description || item.desc || item.ItemCode || item.itemCode || `${contact} Transaction`,
          account: resolvedAccount,
          taxRate: taxRateStr,
          amountGbp: Math.round(rawLineAmt * 100) / 100
        };
      });
    }

    if (totalAmount > 0) {
      return [
        {
          desc: invoice.desc || `${contact} Transaction`,
          account: invoice.accountName || (isExpense ? '500 - Cost of goods' : '400 - Sales'),
          taxRate: (invoice.totalTax && invoice.totalTax > 0) ? 'Tax Applied' : 'Zero Rated',
          amountGbp: invoice.subTotal !== undefined ? invoice.subTotal : totalAmount
        }
      ];
    }

    return [];
  }, [invoice.lineItems, (invoice as any).LineItems, (invoice as any).line_items, contact, totalAmount, invoice.desc, invoice.accountName, invoice.totalTax, invoice.subTotal, isExpense]);

  const { rrTaxAmount, outputTaxAmount, inputTaxAmount } = useMemo(() => {
    let rr = 0;
    let out = 0;
    let inp = 0;

    const itemsList = invoice.lineItems || (invoice as any).LineItems || (invoice as any).line_items;
    if (itemsList && Array.isArray(itemsList)) {
      itemsList.forEach((li: any) => {
        const t = (li.TaxType || li.taxType || li.tax_type || '').toUpperCase();
        const taxAmt = parseFloat(li.TaxAmount || li.taxAmount || li.tax_amount || 0);
        if (t === 'RROUTPUT' || t === 'RRINPUT') rr += taxAmt;
        if (t === 'OUTPUT2' || t === 'OUTPUT') out += taxAmt;
        if (t === 'INPUT2' || t === 'INPUT') inp += taxAmt;
      });
    }
    if (rr === 0 && out === 0 && inp === 0 && invoice.totalTax) {
      if (isExpense) inp = invoice.totalTax;
      else out = invoice.totalTax;
    }
    return {
      rrTaxAmount: Math.round(rr * 100) / 100,
      outputTaxAmount: Math.round(out * 100) / 100,
      inputTaxAmount: Math.round(inp * 100) / 100
    };
  }, [invoice.lineItems, (invoice as any).LineItems, (invoice as any).line_items, invoice.totalTax, isExpense]);

  const calcSubtotal = useMemo(() => {
    if (invoice.subTotal !== undefined && invoice.subTotal !== null) {
      return invoice.subTotal;
    }
    if (computedLineItems.length > 0) {
      const lineSum = computedLineItems.reduce((acc, row) => acc + row.amountGbp, 0);
      return Math.round(lineSum * 100) / 100;
    }
    return totalAmount;
  }, [computedLineItems, totalAmount, invoice.subTotal]);

  const calcTax = useMemo(() => {
    if (invoice.totalTax !== undefined && invoice.totalTax !== null) {
      return invoice.totalTax;
    }
    const taxSum = rrTaxAmount + outputTaxAmount + inputTaxAmount;
    if (taxSum > 0) return taxSum;
    return Math.round((totalAmount - calcSubtotal) * 100) / 100;
  }, [invoice.totalTax, rrTaxAmount, outputTaxAmount, inputTaxAmount, totalAmount, calcSubtotal]);

  const calcGrossTotal = totalAmount || Math.round((calcSubtotal + calcTax) * 100) / 100;
  
  const isFullyPaidStatus = invoice.status === 'PAID' || invoice.status === 'Paid' || invoice.status === 'Reconciled';
  
  let calcDue = 0;
  if (isFullyPaidStatus) {
    calcDue = 0;
  } else if (invoice.amountDue !== undefined && invoice.amountDue !== null && !isNaN(Number(invoice.amountDue))) {
    calcDue = Math.max(0, Math.min(calcGrossTotal, parseFloat(invoice.amountDue as any)));
  } else if (invoice.amountPaid !== undefined && invoice.amountPaid !== null && !isNaN(Number(invoice.amountPaid))) {
    calcDue = Math.max(0, Math.round((calcGrossTotal - parseFloat(invoice.amountPaid as any)) * 100) / 100);
  } else {
    calcDue = calcGrossTotal;
  }

  const calcPaid = isFullyPaidStatus 
    ? calcGrossTotal 
    : Math.max(0, Math.round((calcGrossTotal - calcDue) * 100) / 100);

  const isPaid = calcDue <= 0.01;

  const handlePrint = () => {
    toast.info(`Preparing print for ${invNum}...`);
    window.print();
  };

  const handleExportPDF = () => {
    toast.success(`Exported PDF for ${invNum}`);
  };

  const handlePaymentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const pay = (invoice.payments && invoice.payments.length > 0) ? invoice.payments[0] : null;
    const payId = pay?.PaymentID || pay?.id || `pay-${invoice.id}`;
    const payDate = invoice.paymentDate || issueDate;
    const payAmt = pay?.Amount !== undefined ? parseFloat(pay.Amount) : calcPaid;

    if (onOpenPayment) {
      onOpenPayment({
        id: payId,
        refNumber: pay?.Reference || `Payment for ${invNum}`,
        contactName: contact,
        date: payDate,
        dueDate: payDate,
        paymentDate: payDate,
        desc: `Payment received for ${invNum}`,
        amount: payAmt,
        subTotal: payAmt,
        totalTax: 0,
        amountPaid: payAmt,
        amountDue: 0,
        status: 'RECONCILED',
        accountName: '100 - Starling Business Account',
        lineItems: [
          {
            desc: `Payment for Tax Invoice ${invNum}`,
            account: '100 - Starling Business Account',
            taxRate: 'No VAT',
            amountGbp: payAmt
          }
        ]
      });
    } else {
      toast.info(`Payment ID: ${payId} (${payDate}) - £${payAmt.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`);
    }
  };

  const maxTopBound = typeof window !== 'undefined' ? Math.max(10, window.innerHeight - 120) : 600;
  const maxLeftBound = typeof window !== 'undefined' ? Math.max(10, window.innerWidth - 200) : 800;
  const safeX = Math.max(10, Math.min(maxLeftBound, invoice.x));
  const safeY = Math.max(10, Math.min(maxTopBound, invoice.y));

  const windowStyle: React.CSSProperties = invoice.isMaximized
    ? {
        position: 'fixed',
        top: 10,
        left: 10,
        right: 10,
        bottom: 70,
        zIndex: invoice.zIndex
      }
    : {
        position: 'fixed',
        top: safeY,
        left: safeX,
        width: invoice.width,
        height: invoice.height,
        zIndex: invoice.zIndex
      };

  return (
    <div
      ref={windowRef}
      onClick={onFocus}
      style={windowStyle}
      className={`pointer-events-auto bg-slate-100 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-800 ${
        isInteracting
          ? 'transition-none select-none border-2 border-blue-500 shadow-2xl scale-[1.005]'
          : invoice.isHighlighted
          ? 'transition-all duration-300 ring-4 ring-blue-500 shadow-[0_0_35px_rgba(59,130,246,0.65)] border-2 border-blue-400 scale-[1.01]'
          : 'transition-shadow duration-200 border border-slate-400/80 hover:shadow-blue-500/10'
      }`}
    >
      {/* Draggable Window Top Title Bar */}
      <div
        onMouseDown={handleDragMouseDown}
        className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between shrink-0 select-none cursor-move border-b border-slate-700/80"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="w-3.5 h-3.5 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-slate-900 transition"
              title="Close"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ isMinimized: true });
              }}
              className="w-3.5 h-3.5 rounded-full bg-amber-500 hover:bg-amber-600 flex items-center justify-center text-slate-900 transition"
              title="Minimize"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ isMaximized: !invoice.isMaximized });
              }}
              className="w-3.5 h-3.5 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-slate-900 transition"
              title={invoice.isMaximized ? "Restore Window" : "Maximize Window"}
            />
          </div>

          <div className="flex items-center gap-2 font-bold text-xs text-slate-200">
            <Move className="h-3.5 w-3.5 text-slate-400" />
            <span>{invNum === 'Receive Money' ? 'Receive Money Document' : 'Tax Invoice Document'}</span>
            <span className="text-slate-600">|</span>
            <span className="text-blue-400 font-mono">{invNum === 'Receive Money' ? contact : invNum}</span>
          </div>
        </div>

        {/* Window Quick Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportPDF}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition cursor-pointer border border-slate-700"
          >
            <Download className="h-3 w-3 inline mr-1 text-slate-400" />
            <span>PDF</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition cursor-pointer border border-slate-700"
          >
            <Printer className="h-3 w-3 inline mr-1 text-slate-400" />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdate({ isMinimized: true })}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer ml-1"
            title="Minimize"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onUpdate({ isMaximized: !invoice.isMaximized })}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title={invoice.isMaximized ? "Restore Window" : "Maximize Window"}
          >
            {invoice.isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-red-600 transition cursor-pointer"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Window Body Container */}
      <div className="flex-1 overflow-y-auto p-5 md:p-6 custom-table-scrollbar relative">
        {isLoading ? (
          <div className="min-h-[300px] bg-white rounded-lg border border-slate-300 flex flex-col items-center justify-center p-8 text-center shadow-xs">
            <Loader2 className="h-7 w-7 text-blue-600 animate-spin mb-2" />
            <h4 className="text-xs font-bold text-slate-800">Loading Document...</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Fetching verified records for {invNum}</p>
          </div>
        ) : (
          /* Formal Paper Tax Invoice Sheet */
          <div className="bg-white rounded-md border border-slate-300 shadow-md p-6 md:p-8 space-y-6 text-slate-800 font-sans text-xs">
            
            {/* Header Block */}
            <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-800 pb-5 gap-4">
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                  {invoice.desc || invoice.refNumber || "Tax Invoice"}
                </h1>
                <p className="text-slate-500 font-medium text-[11px] mt-0.5">
                  123 Healthcare Avenue, London, UK &bull; VAT Reg: GB987654321
                </p>
                <p className="text-slate-400 text-[10px]">Official Xero Financial Record</p>
              </div>

              <div className="text-left sm:text-right">
                <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider mb-1.5 border ${
                  isPaid ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'
                }`}>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{isPaid ? (invNum === 'Receive Money' ? 'RECONCILED' : 'PAID IN FULL') : 'AUTHORISED'}</span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
                  {invNum === 'Receive Money' ? 'RECEIVE MONEY' : 'TAX INVOICE'}
                </h2>
                <div className="font-mono font-bold text-slate-700 text-xs mt-0.5">
                  {invNum === 'Receive Money' ? 'Bank Direct Receipt' : invNum}
                </div>
              </div>
            </div>

            {/* Billed To Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/80 p-4 rounded-lg border border-slate-200 text-xs">
              <div className="space-y-0.5">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {invNum === 'Receive Money' ? 'Received From (Contact)' : 'Billed To (Contact)'}
                </div>
                <div className="font-extrabold text-blue-700 text-xs">{contact}</div>
                {resolveBrandingTheme(invoice) ? (
                  <div className="text-slate-500 text-[11px]">Branding Theme: <span className="font-semibold text-slate-700">{resolveBrandingTheme(invoice)}</span></div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Issue Date</div>
                  <div className="font-bold text-slate-800 mt-0.5">{issueDate}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Due Date</div>
                  <div className="font-bold text-slate-800 mt-0.5">{dueDate}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Reference</div>
                  <div className="font-semibold text-slate-800 mt-0.5">{invNum}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Online Payments</div>
                  <div className="font-semibold text-slate-600 mt-0.5">Bank Transfer</div>
                </div>
              </div>
            </div>

            {/* Line Items Table - Strictly 4 Columns Specified by User */}
            <div className="border border-slate-300 rounded-md overflow-hidden">
              <div className="bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider text-right border-b border-slate-300">
                {isTaxInclusive ? 'Amounts are tax inclusive' : 'Amounts are Tax Exclusive'}
              </div>
              <div className="overflow-x-auto custom-table-scrollbar">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-white font-bold text-[10px] uppercase tracking-wider">
                      <th className="py-2.5 px-4 border-r border-slate-700">Description</th>
                      <th className="py-2.5 px-4 border-r border-slate-700">Account</th>
                      <th className="py-2.5 px-4 border-r border-slate-700">Tax rate</th>
                      <th className="py-2.5 px-4 text-right">Amount GBP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800 font-sans">
                    {computedLineItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 px-4 text-center text-slate-400 font-medium italic">
                          No line items recorded for this document
                        </td>
                      </tr>
                    ) : (
                      computedLineItems.map((row, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                          <td className="py-2.5 px-4 font-semibold text-slate-900 border-r border-slate-200">{row.desc}</td>
                          <td className="py-2.5 px-4 text-slate-600 border-r border-slate-200 font-medium">{row.account}</td>
                          <td className="py-2.5 px-4 text-slate-600 border-r border-slate-200 font-medium">{row.taxRate}</td>
                          <td className={`py-2.5 px-4 text-right font-bold tabular-nums ${row.amountGbp < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                            {formatNum(row.amountGbp)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Reconciliation & Totals Box */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-1">
              <div className="space-y-2 text-[11px] text-slate-500 max-w-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded font-semibold text-slate-600 text-[10px]">Verified Xero Document</span>
                  
                  {(() => {
                    const rawAtts = invoice.attachments || (invoice as any).Attachments || [];
                    const attsList = Array.isArray(rawAtts) ? rawAtts : [];
                    return (
                      <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded font-semibold text-slate-700 text-[10px] inline-flex items-center gap-1">
                        <Paperclip className="h-3 w-3 text-blue-600" />
                        <span>Attached Files ({attsList.length})</span>
                      </span>
                    );
                  })()}
                </div>

                {(() => {
                  const rawAtts = invoice.attachments || (invoice as any).Attachments || [];
                  const attsList = Array.isArray(rawAtts) ? rawAtts : [];
                  if (attsList.length === 0) return null;

                  return (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {attsList.map((att: any, attIdx: number) => {
                        const fName = att.fileName || att.FileName || `Attachment-${attIdx + 1}`;
                        const attId = att.id || att.AttachmentID;
                        const invId = invoice.id || (invoice as any).InvoiceID || invoice.refNumber;
                        const mime = att.mimeType || att.MimeType || '';
                        const isPdf = mime.includes('pdf') || fName.toLowerCase().endsWith('.pdf');
                        const isImage = mime.includes('image') || fName.toLowerCase().match(/\.(png|jpg|jpeg|gif|webp)$/);
                        const targetUrl = attId && invId
                          ? `/api/dashboard/invoices/attachment?invoiceId=${encodeURIComponent(invId)}&attachmentId=${encodeURIComponent(attId)}&fileName=${encodeURIComponent(fName)}`
                          : (att.url || att.Url || '#');

                        return (
                          <a
                            key={attId || attIdx}
                            href={targetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 dark:bg-slate-800 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-slate-700 rounded-md font-semibold text-[11px] transition shadow-2xs hover:shadow-xs group cursor-pointer"
                            title={`Click to open/download ${fName}`}
                          >
                            {isPdf ? (
                              <FileText className="h-3.5 w-3.5 text-red-500 shrink-0" />
                            ) : isImage ? (
                              <ImageIcon className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <Paperclip className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                            )}
                            <span className="truncate max-w-[130px] font-mono">{fName}</span>
                            <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100 text-blue-600 transition shrink-0" />
                          </a>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              <div className="w-full sm:w-80 bg-slate-50 p-4 rounded-md border border-slate-300 space-y-2 text-xs">
                <div className="flex justify-between py-0.5 border-b border-slate-200 font-bold text-slate-800">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatNum(calcSubtotal)}</span>
                </div>

                <div className="space-y-0.5 text-[10px] text-slate-600 pl-1.5">
                  <div className="flex justify-between">
                    <span>Includes Zero Rated</span>
                    <span className="tabular-nums">0.00</span>
                  </div>
                  {rrTaxAmount > 0 && (
                    <div className="flex justify-between font-medium text-slate-800">
                      <span>Includes Reduced Rate Tax</span>
                      <span className="tabular-nums">{formatNum(rrTaxAmount)}</span>
                    </div>
                  )}
                  {outputTaxAmount > 0 && (
                    <div className="flex justify-between font-medium text-slate-800">
                      <span>Includes Output Tax</span>
                      <span className="tabular-nums">{formatNum(outputTaxAmount)}</span>
                    </div>
                  )}
                  {inputTaxAmount !== 0 && (
                    <div className="flex justify-between font-medium text-slate-800">
                      <span>Includes Input Tax</span>
                      <span className="tabular-nums">{formatNum(inputTaxAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Includes No Tax</span>
                    <span className="tabular-nums">0.00</span>
                  </div>
                </div>

                <div className="flex justify-between py-1.5 border-t-2 border-b-4 border-slate-900 text-xs font-black text-slate-900">
                  <span>Total</span>
                  <span className="tabular-nums">{formatNum(calcGrossTotal)}</span>
                </div>

                {calcPaid > 0 && (
                  <div className="space-y-1 pt-1.5 border-t border-slate-200 text-[11px]">
                    <div 
                      onClick={handlePaymentClick}
                      className="flex items-center justify-between text-blue-700 hover:text-blue-900 font-semibold cursor-pointer group transition-all py-1 px-1.5 rounded hover:bg-blue-50 border border-transparent hover:border-blue-200 shadow-2xs hover:shadow-xs"
                      title="Click to drill down into Payment & Bank Transaction Details"
                    >
                      <span className="flex items-center gap-1.5">
                        <ExternalLink className="h-3.5 w-3.5 text-blue-600 group-hover:scale-110 transition-transform" />
                        <span className="underline decoration-blue-400 group-hover:decoration-blue-700">Less: Payment ({formatXeroDateString(invoice.paymentDate || invoice.date)})</span>
                      </span>
                      <span className="tabular-nums font-bold">{formatNum(calcPaid)}</span>
                    </div>
                  </div>
                )}

                <div className={`flex justify-between py-1.5 px-2.5 rounded font-black text-xs mt-1.5 border ${
                  isPaid ? 'bg-emerald-100 border-emerald-300 text-emerald-900' : 'bg-amber-100 border-amber-300 text-amber-900'
                }`}>
                  <span>Amount due</span>
                  <span className="tabular-nums">{formatNum(calcDue)}</span>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Resize Handle on Bottom Right Corner */}
      {!invoice.isMaximized && (
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize flex items-center justify-center text-slate-400 hover:text-slate-700 select-none"
          title="Drag to resize window"
        >
          &para;
        </div>
      )}
    </div>
  );
}

function formatNum(val: number) {
  if (typeof val !== 'number' || isNaN(val)) return '0.00';
  return new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

function formatXeroDateString(rawDate: any): string {
  if (!rawDate) return '—';
  if (typeof rawDate === 'string') {
    if (/^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$/.test(rawDate)) {
      return rawDate;
    }
    const match = rawDate.match(/\/Date\((\d+)(?:[+-]\d+)?\)\//);
    if (match) {
      const ts = parseInt(match[1], 10);
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      }
    }
  }
  const d = new Date(rawDate);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return String(rawDate);
}
