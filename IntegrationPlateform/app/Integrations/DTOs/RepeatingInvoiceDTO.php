<?php

namespace App\Integrations\DTOs;

class RepeatingInvoiceDTO
{
    public function __construct(
        public readonly string  $repeatingInvoiceId,
        public readonly ?string $type,
        public readonly ?string $reference,
        public readonly ?string $status,
        public readonly ?string $lineAmountTypes,
        public readonly float   $subTotal,
        public readonly float   $totalTax,
        public readonly float   $total,
        public readonly ?string $currencyCode,
        public readonly ?string $contactId,
        public readonly ?string $contactName,
        public readonly bool    $hasAttachments,
        public readonly bool    $approvedForSending,
        public readonly bool    $sendCopy,
        public readonly bool    $markAsSent,
        public readonly bool    $includePdf,
        public readonly array   $schedule,
        public readonly array   $lineItems,
        public readonly array   $rawData = []
    ) {}

    public function toArray(): array
    {
        return [
            'external_id'          => $this->repeatingInvoiceId,
            'type'                 => $this->type,
            'reference'            => $this->reference,
            'status'               => $this->status,
            'line_amount_types'    => $this->lineAmountTypes,
            'sub_total'            => $this->subTotal,
            'total_tax'            => $this->totalTax,
            'total'                => $this->total,
            'currency_code'        => $this->currencyCode,
            'contact_id'           => $this->contactId,
            'contact_name'         => $this->contactName,
            'has_attachments'      => $this->hasAttachments,
            'approved_for_sending' => $this->approvedForSending,
            'send_copy'            => $this->sendCopy,
            'mark_as_sent'         => $this->markAsSent,
            'include_pdf'          => $this->includePdf,
            'schedule'             => $this->schedule,
            'line_items'           => $this->lineItems,
            'raw_data'             => $this->rawData,
        ];
    }
}
