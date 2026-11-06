<?php

namespace App\Repositories\Eloquent;

use App\Integrations\DTOs\RepeatingInvoiceDTO;
use App\Models\RepeatingInvoice;
use App\Repositories\Contracts\RepeatingInvoiceRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class RepeatingInvoiceRepository implements RepeatingInvoiceRepositoryInterface
{
    public function updateOrCreate(int $tenantId, RepeatingInvoiceDTO $dto): RepeatingInvoice
    {
        return RepeatingInvoice::updateOrCreate(
            [
                'tenant_id'   => $tenantId,
                'external_id' => $dto->repeatingInvoiceId,
            ],
            [
                'type'                 => $dto->type,
                'reference'            => $dto->reference,
                'status'               => $dto->status,
                'line_amount_types'    => $dto->lineAmountTypes,
                'sub_total'            => $dto->subTotal,
                'total_tax'            => $dto->totalTax,
                'total'                => $dto->total,
                'currency_code'        => $dto->currencyCode,
                'contact_id'           => $dto->contactId,
                'contact_name'         => $dto->contactName,
                'has_attachments'      => $dto->hasAttachments,
                'approved_for_sending' => $dto->approvedForSending,
                'send_copy'            => $dto->sendCopy,
                'mark_as_sent'         => $dto->markAsSent,
                'include_pdf'          => $dto->includePdf,
                'schedule'             => $dto->schedule,
                'line_items'           => $dto->lineItems,
                'raw_data'             => $dto->rawData,
            ]
        );
    }

    public function getByTenant(int $tenantId): Collection
    {
        return RepeatingInvoice::where('tenant_id', $tenantId)
            ->orderBy('id', 'desc')
            ->get();
    }
}
