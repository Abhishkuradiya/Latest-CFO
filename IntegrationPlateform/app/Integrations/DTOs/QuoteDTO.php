<?php

namespace App\Integrations\DTOs;

class QuoteDTO
{
    public function __construct(
        public readonly string  $quoteId,
        public readonly ?string $quoteNumber,
        public readonly ?string $reference,
        public readonly ?string $title,
        public readonly ?string $summary,
        public readonly ?string $terms,
        public readonly ?string $date,
        public readonly ?string $expiryDate,
        public readonly ?string $status,
        public readonly ?string $currencyCode,
        public readonly float   $currencyRate,
        public readonly float   $subTotal,
        public readonly float   $totalTax,
        public readonly float   $total,
        public readonly float   $totalDiscount,
        public readonly ?string $lineAmountTypes,
        public readonly ?string $contactId,
        public readonly ?string $contactName,
        public readonly array   $lineItems,
        public readonly array   $rawData = []
    ) {}

    public function toArray(): array
    {
        return [
            'external_id'       => $this->quoteId,
            'quote_number'      => $this->quoteNumber,
            'reference'         => $this->reference,
            'title'             => $this->title,
            'summary'           => $this->summary,
            'terms'             => $this->terms,
            'date'              => $this->date,
            'expiry_date'       => $this->expiryDate,
            'status'            => $this->status,
            'currency_code'     => $this->currencyCode,
            'currency_rate'     => $this->currencyRate,
            'sub_total'         => $this->subTotal,
            'total_tax'         => $this->totalTax,
            'total'             => $this->total,
            'total_discount'    => $this->totalDiscount,
            'line_amount_types' => $this->lineAmountTypes,
            'contact_id'        => $this->contactId,
            'contact_name'      => $this->contactName,
            'line_items'        => $this->lineItems,
            'raw_data'          => $this->rawData,
        ];
    }
}
