<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Models\TenantCredential;
use App\Integrations\AccountingProviderFactory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class ReportController extends Controller
{
    public function __construct(
        protected AccountingProviderFactory $providerFactory
    ) {}

    /**
     * Get the Profit and Loss report for the active tenant.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function profitLoss(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');

        $request->validate([
            'start_date' => 'required|date_format:Y-m-d',
            'end_date' => 'required|date_format:Y-m-d',
        ]);

        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');

        // Retrieve active provider credential for this tenant (defaulting to xero)
        $credential = TenantCredential::where('tenant_id', $tenantId)
            ->where('provider', 'xero')
            ->first();

        if (!$credential) {
            return response()->json([
                'status' => 'error',
                'message' => 'No active credentials found for the Xero provider.'
            ], 400);
        }

        // Cache results using standard cache driver (e.g. database/file or Redis if active)
        $cacheKey = "tenant_{$tenantId}_pl_report_{$startDate}_{$endDate}";

        try {
            $report = Cache::remember($cacheKey, now()->addMinutes(15), function () use ($credential, $startDate, $endDate) {
                $provider = $this->providerFactory->get($credential->provider);
                return $provider->getProfitLossReport($credential, $startDate, $endDate)->toArray();
            });

            return response()->json([
                'status' => 'success',
                'data' => $report
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to retrieve Profit & Loss report: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Fetch budgets from the local database.
     */
    public function budgets(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');

        $budgets = \App\Models\Budget::where('tenant_id', $tenantId)
            ->orderBy('updated_date_utc', 'desc')
            ->get();

        $formattedBudgets = $budgets->map(function ($b) {
            return $b->raw_data ?: [
                'BudgetID'       => $b->external_id,
                'Type'           => $b->type,
                'Description'    => $b->description,
                'UpdatedDateUTC' => $b->updated_date_utc,
            ];
        });

        return response()->json([
            'status' => 'success',
            'data'   => [
                'Budgets' => $formattedBudgets,
                'count'   => $formattedBudgets->count()
            ],
        ]);
    }

    /**
     * Get the Aged Payables By Contact report for the active tenant.
     */
    public function agedPayablesByContact(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');

        $request->validate([
            'contact_id' => 'required|string',
            'date' => 'nullable|date_format:Y-m-d',
            'from_date' => 'nullable|date_format:Y-m-d',
            'to_date' => 'nullable|date_format:Y-m-d',
        ]);

        $contactId = $request->query('contact_id');
        $date = $request->query('date');
        $fromDate = $request->query('from_date');
        $toDate = $request->query('to_date');

        $credential = TenantCredential::where('tenant_id', $tenantId)
            ->where('provider', 'xero')
            ->first();

        if (!$credential) {
            return response()->json([
                'status' => 'error',
                'message' => 'No active credentials found for the Xero provider.'
            ], 400);
        }

        $cacheKey = "tenant_{$tenantId}_aged_payables_{$contactId}_{$date}_{$fromDate}_{$toDate}";

        try {
            $report = Cache::remember($cacheKey, now()->addMinutes(15), function () use ($credential, $contactId, $date, $fromDate, $toDate) {
                $provider = $this->providerFactory->get($credential->provider);
                return $provider->getAgedPayablesByContact($credential, $contactId, $date, $fromDate, $toDate)->toArray();
            });

            return response()->json([
                'status' => 'success',
                'data' => $report
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to retrieve Aged Payables report: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get the Aged Receivables By Contact report for the active tenant.
     */
    public function agedReceivablesByContact(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');

        $request->validate([
            'contact_id' => 'required|string',
            'date' => 'nullable|date_format:Y-m-d',
            'from_date' => 'nullable|date_format:Y-m-d',
            'to_date' => 'nullable|date_format:Y-m-d',
        ]);

        $contactId = $request->query('contact_id');
        $date = $request->query('date');
        $fromDate = $request->query('from_date');
        $toDate = $request->query('to_date');

        $credential = TenantCredential::where('tenant_id', $tenantId)->where('provider', 'xero')->first();
        if (!$credential) {
            return response()->json(['status' => 'error', 'message' => 'No active credentials found.'], 400);
        }

        $cacheKey = "tenant_{$tenantId}_aged_receivables_{$contactId}_{$date}_{$fromDate}_{$toDate}";

        try {
            $report = Cache::remember($cacheKey, now()->addMinutes(15), function () use ($credential, $contactId, $date, $fromDate, $toDate) {
                $provider = $this->providerFactory->get($credential->provider);
                return $provider->getAgedReceivablesByContact($credential, $contactId, $date, $fromDate, $toDate)->toArray();
            });

            return response()->json(['status' => 'success', 'data' => $report]);
        } catch (\Exception $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Get the Balance Sheet report for the active tenant.
     */
    public function balanceSheet(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');

        $request->validate([
            'date' => 'nullable|date_format:Y-m-d',
            'periods' => 'nullable|integer|between:1,11',
            'timeframe' => 'nullable|string|in:MONTH,QUARTER,YEAR',
            'payments_only' => 'nullable|boolean'
        ]);

        $date = $request->query('date');
        $periods = $request->query('periods') ? (int) $request->query('periods') : null;
        $timeframe = $request->query('timeframe');
        $paymentsOnly = $request->has('payments_only') ? filter_var($request->query('payments_only'), FILTER_VALIDATE_BOOLEAN) : null;

        $credential = TenantCredential::where('tenant_id', $tenantId)->where('provider', 'xero')->first();
        if (!$credential) {
            return response()->json(['status' => 'error', 'message' => 'No active credentials found.'], 400);
        }

        $cacheKey = "tenant_{$tenantId}_balance_sheet_{$date}_{$periods}_{$timeframe}_" . ($paymentsOnly ? '1' : '0');

        try {
            $report = Cache::remember($cacheKey, now()->addMinutes(15), function () use ($credential, $date, $periods, $timeframe, $paymentsOnly) {
                $provider = $this->providerFactory->get($credential->provider);
                return $provider->getBalanceSheetReport($credential, $date, $periods, $timeframe, $paymentsOnly)->toArray();
            });

            return response()->json(['status' => 'success', 'data' => $report]);
        } catch (\Exception $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Get the Bank Summary report for the active tenant.
     */
    public function bankSummary(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');

        $request->validate([
            'from_date' => 'nullable|date_format:Y-m-d',
            'to_date' => 'nullable|date_format:Y-m-d'
        ]);

        $fromDate = $request->query('from_date');
        $toDate = $request->query('to_date');

        $credential = TenantCredential::where('tenant_id', $tenantId)->where('provider', 'xero')->first();
        if (!$credential) {
            return response()->json(['status' => 'error', 'message' => 'No active credentials found.'], 400);
        }

        $cacheKey = "tenant_{$tenantId}_bank_summary_{$fromDate}_{$toDate}";

        try {
            $report = Cache::remember($cacheKey, now()->addMinutes(15), function () use ($credential, $fromDate, $toDate) {
                $provider = $this->providerFactory->get($credential->provider);
                return $provider->getBankSummaryReport($credential, $fromDate, $toDate)->toArray();
            });

            return response()->json(['status' => 'success', 'data' => $report]);
        } catch (\Exception $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Get the Trial Balance report for the active tenant.
     */
    public function trialBalance(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');

        $request->validate([
            'date' => 'nullable|date_format:Y-m-d',
            'payments_only' => 'nullable|boolean'
        ]);

        $date = $request->query('date');
        $paymentsOnly = $request->has('payments_only') ? filter_var($request->query('payments_only'), FILTER_VALIDATE_BOOLEAN) : null;

        $credential = TenantCredential::where('tenant_id', $tenantId)->where('provider', 'xero')->first();
        if (!$credential) {
            return response()->json(['status' => 'error', 'message' => 'No active credentials found.'], 400);
        }

        $cacheKey = "tenant_{$tenantId}_trial_balance_{$date}_" . ($paymentsOnly ? '1' : '0');

        try {
            $report = Cache::remember($cacheKey, now()->addMinutes(15), function () use ($credential, $date, $paymentsOnly) {
                $provider = $this->providerFactory->get($credential->provider);
                return $provider->getTrialBalanceReport($credential, $date, $paymentsOnly)->toArray();
            });

            return response()->json(['status' => 'success', 'data' => $report]);
        } catch (\Exception $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }
    }
}

