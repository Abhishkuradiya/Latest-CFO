<?php

namespace App\Integrations\DTOs;

class BankTransactionDTO
{
    public function __construct(
        public readonly string $externalId,
        public readonly string $type,
        public readonly string $date,
        public readonly float $total,
        public readonly ?string $reference,
        public readonly ?string $status,
        public readonly bool $isReconciled,
        public readonly ?array $rawData = null
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            externalId: $data['external_id'],
            type: $data['type'],
            date: $data['date'],
            total: (float) ($data['total'] ?? 0.0),
            reference: $data['reference'] ?? null,
            status: $data['status'] ?? null,
            isReconciled: (bool) ($data['is_reconciled'] ?? false),
            rawData: is_string($data['raw_data'] ?? null) ? json_decode($data['raw_data'], true) : ($data['raw_data'] ?? null)
        );
    }

    public function toArray(): array
    {
        return [
            'external_id' => $this->externalId,
            'type' => $this->type,
            'date' => $this->date,
            'total' => $this->total,
            'reference' => $this->reference,
            'status' => $this->status,
            'is_reconciled' => $this->isReconciled,
            'raw_data' => $this->rawData,
        ];
    }
}
