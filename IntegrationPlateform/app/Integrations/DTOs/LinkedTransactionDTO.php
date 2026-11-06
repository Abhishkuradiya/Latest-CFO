<?php

namespace App\Integrations\DTOs;

class LinkedTransactionDTO
{
    public function __construct(
        public readonly string  $linkedTransactionId,
        public readonly ?string $sourceTransactionId,
        public readonly ?string $sourceLineItemId,
        public readonly ?string $contactId,
        public readonly ?string $targetTransactionId,
        public readonly ?string $targetLineItemId,
        public readonly ?string $status,
        public readonly ?string $type,
        public readonly ?string $sourceTransactionTypeCode,
        public readonly ?string $updatedDateUtc,
        public readonly array   $rawData = []
    ) {}

    public function toArray(): array
    {
        return [
            'external_id'                  => $this->linkedTransactionId,
            'source_transaction_id'        => $this->sourceTransactionId,
            'source_line_item_id'          => $this->sourceLineItemId,
            'contact_id'                   => $this->contactId,
            'target_transaction_id'        => $this->targetTransactionId,
            'target_line_item_id'          => $this->targetLineItemId,
            'status'                       => $this->status,
            'type'                         => $this->type,
            'source_transaction_type_code' => $this->sourceTransactionTypeCode,
            'updated_date_utc'             => $this->updatedDateUtc,
            'raw_data'                     => $this->rawData,
        ];
    }
}
