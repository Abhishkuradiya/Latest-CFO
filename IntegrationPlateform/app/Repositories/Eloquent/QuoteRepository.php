<?php

namespace App\Repositories\Eloquent;

use App\Integrations\DTOs\QuoteDTO;
use App\Models\Quote;
use App\Repositories\Contracts\QuoteRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class QuoteRepository implements QuoteRepositoryInterface
{
    public function updateOrCreate(int $tenantId, QuoteDTO $dto): Quote
    {
        return Quote::updateOrCreate(
            [
                'tenant_id'   => $tenantId,
                'external_id' => $dto->quoteId,
            ],
            [
                'quote_number'      => $dto->quoteNumber,
                'reference'         => $dto->reference,
                'title'             => $dto->title,
                'summary'           => $dto->summary,
                'terms'             => $dto->terms,
                'date'              => $dto->date,
                'expiry_date'       => $dto->expiryDate,
                'status'            => $dto->status,
                'currency_code'     => $dto->currencyCode,
                'currency_rate'     => $dto->currencyRate,
                'sub_total'         => $dto->subTotal,
                'total_tax'         => $dto->totalTax,
                'total'             => $dto->total,
                'total_discount'    => $dto->totalDiscount,
                'line_amount_types' => $dto->lineAmountTypes,
                'contact_id'        => $dto->contactId,
                'contact_name'      => $dto->contactName,
                'line_items'        => $dto->lineItems,
                'raw_data'          => $dto->rawData,
            ]
        );
    }

    public function getByTenant(int $tenantId): Collection
    {
        return Quote::where('tenant_id', $tenantId)
            ->orderBy('date', 'desc')
            ->get();
    }
}
