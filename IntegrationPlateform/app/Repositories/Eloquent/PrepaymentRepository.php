<?php

namespace App\Repositories\Eloquent;

use App\Integrations\DTOs\PrepaymentDTO;
use App\Models\Prepayment;
use App\Repositories\Contracts\PrepaymentRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class PrepaymentRepository implements PrepaymentRepositoryInterface
{
    public function updateOrCreate(int $tenantId, PrepaymentDTO $dto): Prepayment
    {
        return Prepayment::updateOrCreate(
            [
                'tenant_id'   => $tenantId,
                'external_id' => $dto->prepaymentId,
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
                'invoice_number'    => $dto->invoiceNumber,
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
        return Prepayment::where('tenant_id', $tenantId)
            ->orderBy('date', 'desc')
            ->get();
    }
}
