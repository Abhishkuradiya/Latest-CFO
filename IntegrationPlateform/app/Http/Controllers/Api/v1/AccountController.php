<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Repositories\Contracts\AccountRepositoryInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountController extends Controller
{
    public function __construct(
        protected AccountRepositoryInterface $accountRepo
    ) {}

    /**
     * Display a listing of ledger accounts for the active tenant.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');
        $filters = $request->only(['type', 'status']);

        $accounts = $this->accountRepo->getByTenant($tenantId, $filters);

        $rawAccounts = $accounts->map(function ($acc) {
            return $acc->raw_data ?: [
                'AccountID' => $acc->external_id,
                'Code' => $acc->code,
                'Name' => $acc->name,
                'Type' => $acc->type,
                'Status' => $acc->status,
            ];
        })->toArray();

        return response()->json([
            'Id' => \Illuminate\Support\Str::uuid()->toString(),
            'Status' => 'OK',
            'ProviderName' => 'Integration Platform',
            'DateTimeUTC' => '/Date(' . round(microtime(true) * 1000) . ')/',
            'Accounts' => $rawAccounts
        ]);
    }
}
