<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Repositories\Contracts\LinkedTransactionRepositoryInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LinkedTransactionController extends Controller
{
    public function __construct(
        protected LinkedTransactionRepositoryInterface $linkedTransactionRepo
    ) {}

    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');
        $transactions = $this->linkedTransactionRepo->getByTenant($tenantId);

        $rawTransactions = $transactions->map(function ($item) {
            return $item->raw_data ?: [
                'LinkedTransactionID'        => $item->external_id,
                'SourceTransactionID'        => $item->source_transaction_id,
                'SourceLineItemID'           => $item->source_line_item_id,
                'ContactID'                  => $item->contact_id,
                'TargetTransactionID'        => $item->target_transaction_id,
                'TargetLineItemID'           => $item->target_line_item_id,
                'Status'                     => $item->status,
                'Type'                       => $item->type,
                'SourceTransactionTypeCode'  => $item->source_transaction_type_code,
                'UpdatedDateUTC'             => $item->updated_date_utc?->toIso8601String(),
            ];
        })->toArray();

        return response()->json([
            'Id'                 => \Illuminate\Support\Str::uuid()->toString(),
            'Status'             => 'OK',
            'ProviderName'       => 'Integration Platform',
            'DateTimeUTC'        => '/Date(' . round(microtime(true) * 1000) . ')/',
            'LinkedTransactions' => $rawTransactions,
        ]);
    }
}
