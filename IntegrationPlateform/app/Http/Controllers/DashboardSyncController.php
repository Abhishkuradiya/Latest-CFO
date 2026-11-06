<?php

namespace App\Http\Controllers;

use App\Models\Tenant;
use App\Models\TenantCredential;
use App\Integrations\Services\SyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class DashboardSyncController extends Controller
{
    public function __construct(
        protected SyncService $syncService
    ) {}

    /**
     * Trigger manual sync for a tenant via AJAX request.
     *
     * @param int $tenantId
     * @return JsonResponse
     */
    public function sync(int $tenantId): JsonResponse
    {
        $credential = TenantCredential::where('tenant_id', $tenantId)
            ->where('provider', 'xero')
            ->orderBy('updated_at', 'desc')
            ->first();

        if (!$credential) {
            return response()->json([
                'status' => 'error',
                'message' => 'No active Xero credentials found. Please connect your Xero App first.'
            ], 400);
        }

        try {
            // Trigger sync synchronously for immediate UI feedback
            $this->syncService->syncAll($credential);

            // Fetch new counts
            return response()->json([
                'status' => 'success',
                'message' => 'Accounting data synchronized successfully!',
                'counts' => [
                    'contacts' => \App\Models\Contact::where('tenant_id', $tenantId)->count(),
                    'invoices' => \App\Models\Invoice::where('tenant_id', $tenantId)->count(),
                    'payments' => \App\Models\Payment::where('tenant_id', $tenantId)->count(),
                    'accounts' => \App\Models\Account::where('tenant_id', $tenantId)->count(),
                    'bank_transactions' => \App\Models\BankTransaction::where('tenant_id', $tenantId)->count(),
                ]
            ]);
        } catch (\Exception $e) {
            Log::error("Dashboard manual sync failed for tenant #{$tenantId}: " . $e->getMessage());
            return response()->json([
                'status' => 'error',
                'message' => 'Sync failed: ' . $e->getMessage()
            ], 500);
        }
    }
}
