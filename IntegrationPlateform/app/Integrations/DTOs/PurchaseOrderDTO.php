<?php

namespace App\Integrations\DTOs;

class PurchaseOrderDTO
{
    public function __construct(
        public readonly string  $purchaseOrderId,
        public readonly ?string $purchaseOrderNumber,
        public readonly ?string $reference,
        public readonly ?string $date,
        public readonly ?string $deliveryDate,
        public readonly ?string $expectedArrivalDate,
        public readonly ?string $status,
        public readonly ?string $currencyCode,
        public readonly float   $currencyRate,
        public readonly float   $subTotal,
        public readonly float   $totalTax,
        public readonly float   $total,
        public readonly ?string $contactId,
        public readonly ?string $contactName,
        public readonly ?string $deliveryAddress,
        public readonly ?string $attentionTo,
        public readonly ?string $telephone,
        public readonly ?string $deliveryInstructions,
        public readonly bool    $hasAttachments,
        public readonly array   $lineItems,
        public readonly array   $rawData = []
    ) {}

    public function toArray(): array
    {
        return [
            'external_id'            => $this->purchaseOrderId,
            'purchase_order_number'  => $this->purchaseOrderNumber,
            'reference'              => $this->reference,
            'date'                   => $this->date,
            'delivery_date'          => $this->deliveryDate,
            'expected_arrival_date'  => $this->expectedArrivalDate,
            'status'                 => $this->status,
            'currency_code'          => $this->currencyCode,
            'currency_rate'          => $this->currencyRate,
            'sub_total'              => $this->subTotal,
            'total_tax'              => $this->totalTax,
            'total'                  => $this->total,
            'contact_id'             => $this->contactId,
            'contact_name'           => $this->contactName,
            'delivery_address'       => $this->deliveryAddress,
            'attention_to'           => $this->attentionTo,
            'telephone'              => $this->telephone,
            'delivery_instructions'  => $this->deliveryInstructions,
            'has_attachments'        => $this->hasAttachments,
            'line_items'             => $this->lineItems,
            'raw_data'               => $this->rawData,
        ];
    }
}
