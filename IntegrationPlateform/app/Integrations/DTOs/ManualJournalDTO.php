<?php

namespace App\Integrations\DTOs;

class ManualJournalDTO
{
    public function __construct(
        public readonly string  $manualJournalId,
        public readonly ?string $date,
        public readonly ?string $status,
        public readonly ?string $narration,
        public readonly ?string $lineAmountTypes,
        public readonly array   $journalLines,
        public readonly array   $rawData = []
    ) {}

    public function toArray(): array
    {
        return [
            'external_id'       => $this->manualJournalId,
            'date'              => $this->date,
            'status'            => $this->status,
            'narration'         => $this->narration,
            'line_amount_types' => $this->lineAmountTypes,
            'journal_lines'     => $this->journalLines,
            'raw_data'          => $this->rawData,
        ];
    }
}
