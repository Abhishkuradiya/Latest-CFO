<?php

namespace App\Integrations\DTOs;

class OverpaymentDTO
{
    public function __construct(
        public readonly string  $overpaymentId,
        public readonly ?string $contactId,
        public readonly ?string $contactName,
        public readonly ?string $date,
        public readonly ?string $status,
        public readonly ?string $lineAmountTypes,
        public readonly float   $subTotal,
        public readonly float   $totalTax,
        public readonly float   $total,
        public readonly ?string $currencyCode,
        public readonly ?string $type,
        public readonly float   $remainingCredit,
        public readonly ?string $reference,
        public readonly bool    $hasAttachments,
        public readonly array   $lineItems,
        public readonly array   $allocations,
        public readonly array   $payments,
        public readonly array   $rawData = []
    ) {}

    public function toArray(): array
    {
        return [
            'external_id'       => $this->overpaymentId,
            'contact_id'        => $this->contactId,
            'contact_name'      => $this->contactName,
            'date'              => $this->date,
            'status'            => $this->status,
            'line_amount_types' => $this->lineAmountTypes,
            'sub_total'         => $this->subTotal,
            'total_tax'         => $this->totalTax,
            'total'             => $this->total,
            'currency_code'     => $this->currencyCode,
            'type'              => $this->type,
            'remaining_credit'  => $this->remainingCredit,
            'reference'         => $this->reference,
            'has_attachments'   => $this->hasAttachments,
            'line_items'        => $this->lineItems,
            'allocations'       => $this->allocations,
            'payments'          => $this->payments,
            'raw_data'          => $this->rawData,
        ];
    }
}
