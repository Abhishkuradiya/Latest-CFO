<?php

namespace App\Integrations\DTOs;

class CreditNoteDTO
{
    public function __construct(
        public readonly string $creditNoteId,
        public readonly string $creditNoteNumber,
        public readonly string $contactId,
        public readonly ?string $date,
        public readonly float $total,
        public readonly string $status,
        public readonly string $type,
        public readonly array $rawData = []
    ) {}

    public function toArray(): array
    {
        return [
            'external_id' => $this->creditNoteId,
            'credit_note_number' => $this->creditNoteNumber,
            'contact_id' => $this->contactId, // Need to map this to internal contact_id in SyncService
            'date' => $this->date,
            'total' => $this->total,
            'status' => $this->status,
            'type' => $this->type,
            'raw_data' => $this->rawData,
        ];
    }
}