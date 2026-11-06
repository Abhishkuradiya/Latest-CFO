<?php

namespace App\Integrations\DTOs;

class AccountDTO
{
    public function __construct(
        public readonly string $externalId,
        public readonly ?string $code,
        public readonly string $name,
        public readonly string $type,
        public readonly ?string $status,
        public readonly ?array $rawData = null
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            externalId: $data['external_id'],
            code: $data['code'] ?? null,
            name: $data['name'],
            type: $data['type'],
            status: $data['status'] ?? null,
            rawData: is_string($data['raw_data'] ?? null) ? json_decode($data['raw_data'], true) : ($data['raw_data'] ?? null)
        );
    }

    public function toArray(): array
    {
        return [
            'external_id' => $this->externalId,
            'code' => $this->code,
            'name' => $this->name,
            'type' => $this->type,
            'status' => $this->status,
            'raw_data' => $this->rawData,
        ];
    }
}
