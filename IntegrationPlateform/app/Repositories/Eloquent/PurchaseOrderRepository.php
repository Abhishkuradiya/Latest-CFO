<?php

namespace App\Repositories\Eloquent;

use App\Integrations\DTOs\PurchaseOrderDTO;
use App\Models\PurchaseOrder;
use App\Repositories\Contracts\PurchaseOrderRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class PurchaseOrderRepository implements PurchaseOrderRepositoryInterface
{
    public function updateOrCreate(int $tenantId, PurchaseOrderDTO $dto): PurchaseOrder
    {
        return PurchaseOrder::updateOrCreate(
            [
                'tenant_id'   => $tenantId,
                'external_id' => $dto->purchaseOrderId,
            ],
            [
                'purchase_order_number'  => $dto->purchaseOrderNumber,
                'reference'              => $dto->reference,
                'date'                   => $dto->date,
                'delivery_date'          => $dto->deliveryDate,
                'expected_arrival_date'  => $dto->expectedArrivalDate,
                'status'                 => $dto->status,
                'currency_code'          => $dto->currencyCode,
                'currency_rate'          => $dto->currencyRate,
                'sub_total'              => $dto->subTotal,
                'total_tax'              => $dto->totalTax,
                'total'                  => $dto->total,
                'contact_id'             => $dto->contactId,
                'contact_name'           => $dto->contactName,
                'delivery_address'       => $dto->deliveryAddress,
                'attention_to'           => $dto->attentionTo,
                'telephone'              => $dto->telephone,
                'delivery_instructions'  => $dto->deliveryInstructions,
                'has_attachments'        => $dto->hasAttachments,
                'line_items'             => $dto->lineItems,
                'raw_data'               => $dto->rawData,
            ]
        );
    }

    public function getByTenant(int $tenantId): Collection
    {
        return PurchaseOrder::where('tenant_id', $tenantId)
            ->orderBy('date', 'desc')
            ->get();
    }
}
