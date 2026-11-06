<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Repositories\Contracts\OverpaymentRepositoryInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OverpaymentController extends Controller
{
    public function __construct(
        protected OverpaymentRepositoryInterface $overpaymentRepo
    ) {}

    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');
        $overpayments = $this->overpaymentRepo->getByTenant($tenantId);

        $rawOverpayments = $overpayments->map(function ($item) {
            return $item->raw_data ?: [
                'OverpaymentID'    => $item->external_id,
                'Contact'          => [
                    'ContactID' => $item->contact_id,
                    'Name'      => $item->contact_name,
                ],
                'Date'             => $item->date?->format('Y-m-d'),
                'Status'           => $item->status,
                'LineAmountTypes'  => $item->line_amount_types,
                'SubTotal'         => (float) $item->sub_total,
                'TotalTax'         => (float) $item->total_tax,
                'Total'            => (float) $item->total,
                'CurrencyCode'     => $item->currency_code,
                'Type'             => $item->type,
                'RemainingCredit'  => (float) $item->remaining_credit,
                'Reference'        => $item->reference,
                'HasAttachments'   => $item->has_attachments ? 'true' : 'false',
                'LineItems'        => $item->line_items ?? [],
                'Allocations'      => $item->allocations ?? [],
                'Payments'         => $item->payments ?? [],
            ];
        })->toArray();

        return response()->json([
            'Id'           => \Illuminate\Support\Str::uuid()->toString(),
            'Status'       => 'OK',
            'ProviderName' => 'Integration Platform',
            'DateTimeUTC'  => '/Date(' . round(microtime(true) * 1000) . ')/',
            'Overpayments' => $rawOverpayments,
        ]);
    }
}
