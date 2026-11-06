<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Repositories\Contracts\PrepaymentRepositoryInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PrepaymentController extends Controller
{
    public function __construct(
        protected PrepaymentRepositoryInterface $prepaymentRepo
    ) {}

    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');
        $prepayments = $this->prepaymentRepo->getByTenant($tenantId);

        $rawPrepayments = $prepayments->map(function ($item) {
            return $item->raw_data ?: [
                'PrepaymentID'    => $item->external_id,
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
                'InvoiceNumber'    => $item->invoice_number,
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
            'Prepayments' => $rawPrepayments,
        ]);
    }
}
