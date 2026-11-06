<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Repositories\Contracts\PurchaseOrderRepositoryInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PurchaseOrderController extends Controller
{
    public function __construct(
        protected PurchaseOrderRepositoryInterface $purchaseOrderRepo
    ) {}

    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');
        $purchaseOrders = $this->purchaseOrderRepo->getByTenant($tenantId);

        $rawPurchaseOrders = $purchaseOrders->map(function ($item) {
            return $item->raw_data ?: [
                'PurchaseOrderID'      => $item->external_id,
                'PurchaseOrderNumber'  => $item->purchase_order_number,
                'Reference'            => $item->reference,
                'Date'                 => $item->date?->format('Y-m-d'),
                'DeliveryDate'         => $item->delivery_date?->format('Y-m-d'),
                'ExpectedArrivalDate'  => $item->expected_arrival_date?->format('Y-m-d'),
                'Status'               => $item->status,
                'CurrencyCode'         => $item->currency_code,
                'CurrencyRate'         => (float) $item->currency_rate,
                'SubTotal'             => (float) $item->sub_total,
                'TotalTax'             => (float) $item->total_tax,
                'Total'                => (float) $item->total,
                'Contact'              => [
                    'ContactID' => $item->contact_id,
                    'Name'      => $item->contact_name,
                ],
                'DeliveryAddress'      => $item->delivery_address,
                'AttentionTo'          => $item->attention_to,
                'Telephone'            => $item->telephone,
                'DeliveryInstructions' => $item->delivery_instructions,
                'HasAttachments'       => $item->has_attachments ? 'true' : 'false',
                'LineItems'            => $item->line_items ?? [],
            ];
        })->toArray();

        return response()->json([
            'Id'             => \Illuminate\Support\Str::uuid()->toString(),
            'Status'         => 'OK',
            'ProviderName'   => 'Integration Platform',
            'DateTimeUTC'    => '/Date(' . round(microtime(true) * 1000) . ')/',
            'PurchaseOrders' => $rawPurchaseOrders,
        ]);
    }
}
