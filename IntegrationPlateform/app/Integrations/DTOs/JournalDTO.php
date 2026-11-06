<?php

namespace App\Integrations\DTOs;

class JournalDTO
{
    public function __construct(
        public readonly string  $journalId,
        public readonly int     $journalNumber,
        public readonly ?string $journalDate,
        public readonly ?string $createdDateUtc,
        public readonly ?string $reference,
        public readonly ?string $sourceId,
        public readonly ?string $sourceType,
        public readonly array   $journalLines,
        public readonly array   $rawData = []
    ) {}

    public function toArray(): array
    {
        return [
            'external_id'      => $this->journalId,
            'journal_number'   => $this->journalNumber,
            'journal_date'     => $this->journalDate,
            'created_date_utc' => $this->createdDateUtc,
            'reference'        => $this->reference,
            'source_id'        => $this->sourceId,
            'source_type'      => $this->sourceType,
            'journal_lines'    => $this->journalLines,
            'raw_data'         => $this->rawData,
        ];
    }
}
