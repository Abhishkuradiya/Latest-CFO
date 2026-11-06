<?php

namespace App\Repositories\Eloquent;

use App\Integrations\DTOs\OverpaymentDTO;
use App\Models\Overpayment;
use App\Repositories\Contracts\OverpaymentRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class OverpaymentRepository implements OverpaymentRepositoryInterface
{
    public function updateOrCreate(int $tenantId, OverpaymentDTO $dto): Overpayment
    {
        return Overpayment::updateOrCreate(
            [
                'tenant_id'   => $tenantId,
                'external_id' => $dto->overpaymentId,
            ],
            [
                'contact_id'        => $dto->contactId,
                'contact_name'      => $dto->contactName,
                'date'              => $dto->date,
                'status'            => $dto->status,
                'line_amount_types' => $dto->lineAmountTypes,
                'sub_total'         => $dto->subTotal,
                'total_tax'         => $dto->totalTax,
                'total'             => $dto->total,
                'currency_code'     => $dto->currencyCode,
                'type'              => $dto->type,
                'remaining_credit'  => $dto->remainingCredit,
                'reference'         => $dto->reference,
                'has_attachments'   => $dto->hasAttachments,
                'line_items'        => $dto->lineItems,
                'allocations'       => $dto->allocations,
                'payments'          => $dto->payments,
                'raw_data'          => $dto->rawData,
            ]
        );
    }

    public function getByTenant(int $tenantId): Collection
    {
        return Overpayment::where('tenant_id', $tenantId)
            ->orderBy('date', 'desc')
            ->get();
    }
}
