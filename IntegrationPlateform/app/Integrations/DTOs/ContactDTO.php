<?php

namespace App\Integrations\DTOs;

class ContactDTO
{
    public function __construct(
        public readonly string $externalId,
        public readonly string $name,
        public readonly ?string $email,
        public readonly ?string $phone,
        public readonly ?string $address,
        public readonly ?string $status,
        public readonly bool $isCustomer = true,
        public readonly bool $isSupplier = false,
        public readonly ?array $rawData = null
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            externalId: $data['external_id'],
            name: $data['name'],
            email: $data['email'] ?? null,
            phone: $data['phone'] ?? null,
            status: $data['status'] ?? null,
            isCustomer: $data['is_customer'] ?? true,
            isSupplier: $data['is_supplier'] ?? false,
            rawData: is_string($data['raw_data'] ?? null) ? json_decode($data['raw_data'], true) : ($data['raw_data'] ?? null)
        );
    }

    public function toArray(): array
    {
        return [
            'external_id' => $this->externalId,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'status' => $this->status,
            'is_customer' => $this->isCustomer,
            'is_supplier' => $this->isSupplier,
            'raw_data' => $this->rawData,
        ];
    }
}
