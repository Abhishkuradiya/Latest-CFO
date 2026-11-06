<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Repositories\Contracts\BankTransactionRepositoryInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class BankTransactionController extends Controller
{
    public function __construct(
        protected BankTransactionRepositoryInterface $bankTransactionRepo
    ) {}

    /**
     * Display a listing of bank transactions for the active tenant.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');
        $filters = $request->only(['type', 'status']);

        $transactions = $this->bankTransactionRepo->getByTenant($tenantId, $filters);

        $rawTransactions = $transactions->map(function ($tx) {
            return $tx->raw_data ?: [
                'BankTransactionID' => $tx->external_id,
                'Type' => $tx->type,
                'Date' => $tx->date->format('Y-m-d'),
                'Total' => (float)$tx->total,
                'Reference' => $tx->reference,
                'Status' => $tx->status,
                'IsReconciled' => $tx->is_reconciled,
            ];
        })->toArray();

        return response()->json([
            'Id' => Str::uuid()->toString(),
            'Status' => 'OK',
            'ProviderName' => 'Integration Platform',
            'DateTimeUTC' => '/Date(' . round(microtime(true) * 1000) . ')/',
            'BankTransactions' => $rawTransactions
        ]);
    }

    /**
     * Fetch bank statement feeds directly from Xero Finance API.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function statements(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');

        $credential = \App\Models\TenantCredential::where('tenant_id', $tenantId)
            ->where('provider', 'xero')
            ->first();

        if (!$credential) {
            return response()->json([
                'status' => 'error',
                'message' => 'No active credentials found for the Xero provider.'
            ], 400);
        }

        $bankAccountId = $request->query('bank_account_id', '562555f2-8cde-4ce9-8203-0363922537a4');
        $fromDate = $request->query('from_date', '2026-06-01');
        $toDate = $request->query('to_date', '2026-07-31');

        try {
            $provider = app(\App\Integrations\AccountingProviderFactory::class)->get('xero');
            $data = $provider->getBankStatements($credential, $bankAccountId, $fromDate, $toDate);

            return response()->json([
                'status' => 'success',
                'data' => $data
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to retrieve bank statements: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Fetch bank transfers from local database (synced via Sync Now).
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function transfers(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');

        $transfers = \App\Models\BankTransfer::where('tenant_id', $tenantId)
            ->orderBy('date', 'desc')
            ->get()
            ->map(function ($t) {
                return $t->raw_data ?: [
                    'BankTransferID'   => $t->external_id,
                    'DateString'       => $t->date?->format('Y-m-d'),
                    'Amount'           => (float) $t->amount,
                    'Reference'        => $t->reference,
                    'FromBankAccount'  => ['Name' => $t->from_account_name, 'AccountID' => $t->from_account_id],
                    'ToBankAccount'    => ['Name' => $t->to_account_name,   'AccountID' => $t->to_account_id],
                    'FromIsReconciled' => $t->from_is_reconciled ? 'true' : 'false',
                    'ToIsReconciled'   => $t->to_is_reconciled   ? 'true' : 'false',
                ];
            })
            ->toArray();

        return response()->json([
            'status' => 'success',
            'data'   => ['BankTransfers' => $transfers],
        ]);
    }

    /**
     * Fetch batch payments from local database (synced via Sync Now).
     */
    public function batchPayments(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');

        $batches = \App\Models\BatchPayment::where('tenant_id', $tenantId)
            ->orderBy('date', 'desc')
            ->get()
            ->map(function ($b) {
                return $b->raw_data ?: [
                    'BatchPaymentID' => $b->external_id,
                    'DateString'     => $b->date?->format('Y-m-d'),
                    'TotalAmount'    => (float) $b->total_amount,
                    'Type'           => $b->type,
                    'Status'         => $b->status,
                    'IsReconciled'   => $b->is_reconciled,
                    'Reference'      => $b->reference,
                    'Payments'       => [],
                    'Account'        => ['AccountID' => $b->account_id, 'CurrencyCode' => $b->account_currency],
                ];
            })
            ->toArray();

        return response()->json([
            'status' => 'success',
            'data'   => ['BatchPayments' => $batches, 'count' => count($batches)],
        ]);
    }
}
