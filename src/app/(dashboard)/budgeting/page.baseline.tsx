"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import type {
  BudgetReportItem,
  BudgetingReportData,
} from "@/lib/exports/budgeting-report";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/store/sidebar-store";

type Period = "ttm" | "ytd" | "quarter" | "this_month";

interface IntelligenceResponse extends BudgetingReportData {
  connected: boolean;
  error?: string;
}

type BudgetItem = BudgetReportItem;

const periods: { code: Period; label: string }[] = [
  { code: "ttm", label: "Trailing 12M" },
  { code: "ytd", label: "Year to date" },
  { code: "quarter", label: "This quarter" },
  { code: "this_month", label: "This month" },
];

const EMPTY_BUDGET_ITEMS: BudgetItem[] = [];

const currencyFormatter = (currency: string) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });

function MetricCard({
  title,
  value,
  detail,
  accent,
}: {
  title: string;
  value: string;
  detail: string;
  accent: string;
}) {
  return (
    <article className={cn("min-w-0 rounded-md border border-slate-200 border-l-[3px] bg-white px-3 py-2.5", accent)}>
      <p className="text-[10px] font-medium text-slate-600">{title}</p>
      <p className="mt-1 truncate text-xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-1 truncate text-[10px] leading-4 text-slate-500">{detail}</p>
    </article>
  );
}

export default function BudgetingPage() {
  const setSidebarCollapsed = useSidebarStore((state) => state.setCollapsed);
  const [period, setPeriod] = useState<Period>("ttm");
  const [customDateRange, setCustomDateRange] = useState<{ from: string; to: string } | null>(null);
  const [draftFromDate, setDraftFromDate] = useState("");
  const [draftToDate, setDraftToDate] = useState("");
  const [data, setData] = useState<IntelligenceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);
  const revenueChartRef = useRef<HTMLDivElement>(null);
  const budgetChartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSidebarCollapsed(false);
  }, [setSidebarCollapsed]);

  useEffect(() => {
    const controller = new AbortController();
    const loadBudgetData = async () => {
      try {
        const params = new URLSearchParams({ period });
        if (customDateRange) {
          params.set("from", customDateRange.from);
          params.set("to", customDateRange.to);
        }
        const response = await fetch(
          `/api/dashboard/cfo-intelligence?${params.toString()}`,
          { signal: controller.signal },
        );
        const result = (await response.json()) as IntelligenceResponse;
        if (!response.ok) {
          throw new Error(result.error || "Unable to load Xero financial data.");
        }
        if (result.connected && (!result.profitability || !result.cashFlow13Week || !result.budgeting)) {
          throw new Error("The financial data response is incomplete. Please try again.");
        }
        setData(result);
        if (!customDateRange && result.periodInfo) {
          setDraftFromDate(result.periodInfo.startDate);
          setDraftToDate(result.periodInfo.endDate);
        }
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        const message =
          fetchError instanceof Error ? fetchError.message : "Unable to load financial data.";
        console.error("Failed to load Xero budget dashboard:", fetchError);
        setError(message);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    void loadBudgetData();
    return () => controller.abort();
  }, [customDateRange, period, refreshCount]);

  const profitability = data?.profitability;
  const budgetItems = data?.budgeting?.budgetItems ?? EMPTY_BUDGET_ITEMS;
  const currency = data?.currency || "GBP";
  const formatMoney = useMemo(() => currencyFormatter(currency), [currency]);
  const actualRevenue = profitability?.revenue ?? 0;
  const periodMonths =
    customDateRange
      ? Math.max(
          1,
          (new Date(`${customDateRange.to}T00:00:00`).getTime() -
            new Date(`${customDateRange.from}T00:00:00`).getTime()) /
            (30 * 24 * 60 * 60 * 1000),
        )
      : period === "ytd"
      ? new Date().getMonth() + 1
      : period === "quarter"
        ? 3
        : period === "this_month"
          ? 1
          : 12;
  const forecastRevenue = actualRevenue * (12 / periodMonths) * 1.1;

  const watchlist = useMemo(
    () =>
      budgetItems
        .map((item) => ({
          ...item,
          variance: item.actual - item.budget,
          unfavorable:
            item.type === "revenue"
              ? item.actual < item.budget
              : item.actual > item.budget,
        }))
        .filter((item) => item.unfavorable)
        .sort(
          (a, b) =>
            Math.abs(b.variance) - Math.abs(a.variance),
        )
        .slice(0, 3),
    [budgetItems],
  );

  useEffect(() => {
    if (!profitability) return;

    const charts: echarts.ECharts[] = [];
    if (revenueChartRef.current) {
      const revenueChart = echarts.init(revenueChartRef.current);
      revenueChart.setOption({
        grid: { left: 12, right: 18, top: 24, bottom: 12, containLabel: true },
        tooltip: {
          trigger: "axis",
          valueFormatter: (value: number) => formatMoney.format(value),
        },
        xAxis: {
          type: "category",
          data: profitability.monthlyTrend.map((item) => item.month),
          axisLine: { lineStyle: { color: "#e2e8f0" } },
          axisLabel: { color: "#64748b", fontSize: 10 },
        },
        yAxis: {
          type: "value",
          axisLabel: {
            color: "#64748b",
            fontSize: 10,
            formatter: (value: number) => formatMoney.format(value),
          },
          splitLine: { lineStyle: { color: "#f1f5f9" } },
        },
        series: [
          {
            name: "Revenue",
            type: "line",
            smooth: true,
            data: profitability.monthlyTrend.map((item) => item.revenue),
            symbolSize: 6,
            lineStyle: { width: 3, color: "#155e75" },
            itemStyle: { color: "#155e75" },
            areaStyle: { color: "rgba(21, 94, 117, 0.08)" },
          },
        ],
      });
      charts.push(revenueChart);
    }

    if (budgetChartRef.current && budgetItems.length > 0) {
      const budgetChart = echarts.init(budgetChartRef.current);
      budgetChart.setOption({
        grid: { left: 12, right: 18, top: 16, bottom: 12, containLabel: true },
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "shadow" },
          valueFormatter: (value: number) => formatMoney.format(value),
        },
        legend: {
          data: ["Budget", "Actual"],
          top: 0,
          textStyle: { color: "#64748b", fontSize: 10 },
        },
        xAxis: {
          type: "value",
          axisLabel: {
            color: "#64748b",
            fontSize: 10,
            formatter: (value: number) => formatMoney.format(value),
          },
          splitLine: { lineStyle: { color: "#f1f5f9" } },
        },
        yAxis: {
          type: "category",
          data: budgetItems.map((item) => item.category),
          axisLabel: { color: "#475569", fontSize: 10, width: 135, overflow: "truncate" },
          axisLine: { show: false },
        },
        series: [
          {
            name: "Budget",
            type: "bar",
            data: budgetItems.map((item) => item.budget),
            itemStyle: { color: "#cbd5e1", borderRadius: [0, 4, 4, 0] },
            barMaxWidth: 12,
          },
          {
            name: "Actual",
            type: "bar",
            data: budgetItems.map((item) => item.actual),
            itemStyle: { color: "#155e75", borderRadius: [0, 4, 4, 0] },
            barMaxWidth: 12,
          },
        ],
      });
      charts.push(budgetChart);
    }

    const resizeCharts = () => {
      charts.forEach((chart) => chart.resize());
    };
    window.addEventListener("resize", resizeCharts);
    return () => {
      window.removeEventListener("resize", resizeCharts);
      charts.forEach((chart) => chart.dispose());
    };
  }, [budgetItems, formatMoney, profitability]);

  const handlePeriodChange = (newPeriod: Period) => {
    if (newPeriod === period && !customDateRange) return;
    setIsLoading(true);
    setError(null);
    setData(null);
    setCustomDateRange(null);
    setPeriod(newPeriod);
  };

  const applyCustomDateRange = () => {
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const fromDate = new Date(`${draftFromDate}T00:00:00`);
    const toDate = new Date(`${draftToDate}T00:00:00`);
    const matchesCalendarDate = (value: string, date: Date) => {
      const [year, month, day] = value.split("-").map(Number);
      return (
        date.getFullYear() === year &&
        date.getMonth() + 1 === month &&
        date.getDate() === day
      );
    };
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (
      !datePattern.test(draftFromDate) ||
      !datePattern.test(draftToDate) ||
      Number.isNaN(fromDate.getTime()) ||
      Number.isNaN(toDate.getTime()) ||
      !matchesCalendarDate(draftFromDate, fromDate) ||
      !matchesCalendarDate(draftToDate, toDate)
    ) {
      setError("Enter a valid start and end date.");
      return;
    }
    if (fromDate > toDate) {
      setError("The start date must be on or before the end date.");
      return;
    }
    if (toDate > today) {
      setError("The end date cannot be in the future.");
      return;
    }

    setError(null);
    setIsLoading(true);
    setData(null);
    setCustomDateRange({ from: draftFromDate, to: draftToDate });
  };

  const refreshData = () => {
    setIsLoading(true);
    setError(null);
    setData(null);
    setRefreshCount((count) => count + 1);
  };

  const exportReport = async (format: "xlsx" | "pdf") => {
    if (!data?.connected || !profitability) {
      toast.error("Load connected financial data before exporting the report.");
      return;
    }

    const fromDate =
      data.periodInfo?.startDate ?? customDateRange?.from ?? draftFromDate;
    const toDate = data.periodInfo?.endDate ?? customDateRange?.to ?? draftToDate;
    if (!fromDate || !toDate) {
      toast.error("The report date range is unavailable. Refresh the dashboard and try again.");
      return;
    }

    setExporting(format);
    try {
      const report = await import("@/lib/exports/budgeting-report");
      if (format === "xlsx") {
        await report.exportBudgetingExcelReport(
          data,
          fromDate,
          toDate,
          forecastRevenue,
        );
      } else {
        await report.exportBudgetingPdfReport(
          data,
          fromDate,
          toDate,
          forecastRevenue,
        );
      }
      toast.success(`Budget and variance ${format.toUpperCase()} report downloaded.`);
    } catch (exportError) {
      console.error(`Failed to export budget report as ${format}:`, exportError);
      toast.error(
        `Unable to export the ${format.toUpperCase()} report. Please try again.`,
      );
    } finally {
      setExporting(null);
    }
  };

  return (
    <main className="w-full space-y-4 p-0">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Budget &amp; variance dashboard</h1>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                data?.connected
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-600",
              )}
            >
              {data?.connected ? "Xero connected" : "Xero financial overview"}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            A clear view of performance, cash and the outlook for the financial year.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap rounded-md border border-slate-200 bg-white p-1">
            {periods.map((option) => (
              <button
                key={option.code}
                type="button"
                onClick={() => handlePeriodChange(option.code)}
                aria-pressed={period === option.code && !customDateRange}
                className={cn(
                  "rounded px-2.5 py-1.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-1",
                  period === option.code && !customDateRange
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              applyCustomDateRange();
            }}
          >
            <label className="grid gap-1 text-[10px] font-medium text-slate-500">
              From
              <input
                type="date"
                value={draftFromDate}
                max={draftToDate || undefined}
                onChange={(event) => setDraftFromDate(event.target.value)}
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-700"
                aria-label="Start date"
              />
            </label>
            <label className="grid gap-1 text-[10px] font-medium text-slate-500">
              To
              <input
                type="date"
                value={draftToDate}
                min={draftFromDate || undefined}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setDraftToDate(event.target.value)}
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-700"
                aria-label="End date"
              />
            </label>
            <button
              type="submit"
              disabled={!draftFromDate || !draftToDate || isLoading}
              aria-pressed={Boolean(customDateRange)}
              className="h-8 rounded-md bg-slate-900 px-3 text-[11px] font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Apply dates
            </button>
          </form>
          {data?.connected && profitability && !isLoading && (
            <>
              <button
                type="button"
                onClick={() => void exportReport("xlsx")}
                disabled={exporting !== null}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
                {exporting === "xlsx" ? "Exporting…" : "Export XLSX"}
              </button>
              <button
                type="button"
                onClick={() => void exportReport("pdf")}
                disabled={exporting !== null}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FileText className="h-3.5 w-3.5 text-rose-700" />
                {exporting === "pdf" ? "Exporting…" : "Export PDF"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={refreshData}
            disabled={isLoading || exporting !== null}
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 text-sky-700", isLoading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </header>

      {data?.connected && data.periodInfo && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px]">
          <p className="font-medium text-slate-700">
            {data.periodInfo.label}
            <span className="ml-2 font-normal text-slate-500">
              {data.periodInfo.startDate} – {data.periodInfo.endDate}
            </span>
          </p>
          <p className="text-slate-500">{data.periodInfo.dataSource}</p>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <CircleAlert className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {data && !data.connected && !isLoading && (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-6 text-center">
          <Wallet className="mx-auto h-7 w-7 text-amber-700" />
          <h2 className="mt-3 font-semibold text-slate-900">Connect Xero to view your finances</h2>
          <p className="mt-1 text-sm text-slate-600">
            Connect your Xero organization to load revenue, costs and cash position.
          </p>
          <a
            href="/data-sources"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Go to data sources <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </section>
      )}

      {isLoading && (
        <div className="rounded-md border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          <RefreshCw className="mx-auto mb-3 h-5 w-5 animate-spin text-sky-700" />
          Loading financial data from Xero…
        </div>
      )}

      {data?.connected && profitability && !isLoading && (
        <>
          <section aria-label="Financial overview" className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <MetricCard
              title="Revenue"
              value={formatMoney.format(profitability.revenue)}
              detail={`Actual · ${data.periodInfo?.label ?? "selected period"}`}
              accent="border-l-emerald-600"
            />
            <MetricCard
              title="Gross margin"
              value={`${profitability.grossMarginPct.toFixed(1)}%`}
              detail={`${formatMoney.format(profitability.grossProfit)} gross profit`}
              accent="border-l-emerald-600"
            />
            <MetricCard
              title="Operating expenses"
              value={formatMoney.format(profitability.opexFixed + profitability.opexVariable)}
              detail="Operating costs · selected period"
              accent="border-l-amber-600"
            />
            <MetricCard
              title="EBITDA"
              value={formatMoney.format(profitability.ebitda)}
              detail={`${profitability.ebitdaMarginPct.toFixed(1)}% EBITDA margin`}
              accent="border-l-emerald-600"
            />
            <MetricCard
              title="Cash position"
              value={formatMoney.format(data.cashFlow13Week?.startingCash ?? 0)}
              detail="Current cash balance"
              accent="border-l-amber-600"
            />
            <MetricCard
              title="FY forecast revenue"
              value={formatMoney.format(forecastRevenue)}
              detail="Annualized run rate · +10% base case"
              accent="border-l-emerald-600"
            />
          </section>

          <section className="grid grid-cols-1 gap-2 xl:grid-cols-2">
            <article className="rounded-md border border-slate-200 bg-white p-3">
              <div className="mb-2">
                <h2 className="text-xs font-semibold text-slate-900">Revenue trend</h2>
                <p className="mt-1 text-[10px] text-slate-500">Monthly revenue recorded in Xero</p>
              </div>
              <div ref={revenueChartRef} className="h-60 w-full" />
            </article>
            <article className="rounded-md border border-slate-200 bg-white p-3">
              <div className="mb-2">
                <h2 className="text-xs font-semibold text-slate-900">Budget vs actual</h2>
                <p className="mt-1 text-[10px] text-slate-500">Performance by budget line</p>
              </div>
              {budgetItems.length > 0 ? (
                <div
                  ref={budgetChartRef}
                  className="w-full"
                  style={{ height: Math.max(256, budgetItems.length * 42) }}
                />
              ) : (
                <p className="py-16 text-center text-sm text-slate-500">
                  No budget lines are available for this period.
                </p>
              )}
            </article>
          </section>

          <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-3">
              <div>
                <h2 className="text-xs font-semibold text-slate-900">Budget vs actual (P&amp;L)</h2>
                <p className="mt-1 text-[10px] text-slate-500">
                  Variance = actual − budget. Revenue is favorable above budget; costs are favorable below budget.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                {budgetItems.length} line items
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[660px] text-left text-xs">
                <thead className="bg-white text-[10px] text-slate-600">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Line item</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Actual</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Budget</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Variance</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Variance %</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {budgetItems.map((item) => {
                    const variance = item.actual - item.budget;
                    const unfavorable =
                      item.type === "revenue" ? variance < 0 : variance > 0;
                    const variancePct =
                      item.budget !== 0 ? (variance / Math.abs(item.budget)) * 100 : 0;
                    return (
                      <tr key={item.category} className="text-slate-700 hover:bg-slate-50">
                        <th scope="row" className="px-3 py-2.5 text-left font-medium text-slate-900">
                          {item.category}
                        </th>
                        <td className="px-3 py-2.5 text-right font-medium tabular-nums">{formatMoney.format(item.actual)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney.format(item.budget)}</td>
                        <td className={cn("px-3 py-2.5 text-right font-medium tabular-nums", unfavorable ? "text-rose-600" : "text-emerald-700")}>
                          {variance > 0 ? "+" : ""}
                          {formatMoney.format(variance)}
                        </td>
                        <td className={cn("px-3 py-2.5 text-right tabular-nums", unfavorable ? "text-rose-600" : "text-emerald-700")}>
                          {variancePct > 0 ? "+" : ""}
                          {variancePct.toFixed(1)}%
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", unfavorable ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700")}>
                            {unfavorable ? (
                              <CircleAlert className="h-3 w-3" />
                            ) : (
                              <CircleCheck className="h-3 w-3" />
                            )}
                            {unfavorable ? "Review" : "On track"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {budgetItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-xs text-slate-500">
                        No budget data is available for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2">
              <CircleAlert className="h-4 w-4 text-amber-600" />
              <h2 className="text-xs font-semibold text-slate-900">Budget watchlist</h2>
            </div>
            {watchlist.length > 0 ? (
              <ul className="mt-2 grid gap-2 md:grid-cols-3">
                {watchlist.map((item) => (
                  <li key={item.category} className="rounded-sm border-l-2 border-amber-500 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
                    <span className="font-semibold">{item.category}</span>
                    <span className="mt-1 flex items-center gap-1 text-amber-800">
                      {item.type === "revenue" ? (
                        <ArrowDownRight className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      )}
                      {formatMoney.format(Math.abs(item.variance))} unfavorable variance
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[11px] text-slate-500">
                No unfavorable variances in the available budget lines.
              </p>
            )}
          </section>

          <p className="text-[10px] leading-relaxed text-slate-500">
            Financial actuals and cash position are loaded from the Xero finance integration. FY
            forecast revenue is an illustrative annualized run rate using a 10% base-case growth
            assumption; it is not a Xero-reported forecast.
          </p>
        </>
      )}
    </main>
  );
}
