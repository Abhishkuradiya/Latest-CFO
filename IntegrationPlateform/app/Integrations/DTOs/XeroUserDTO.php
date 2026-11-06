<?php

namespace App\Integrations\DTOs;

class XeroUserDTO
{
    public function __construct(
        public readonly string $userId,
        public readonly string $emailAddress,
        public readonly string $firstName,
        public readonly string $lastName,
        public readonly string $updatedDateUtc,
        public readonly bool $isSubscriber,
        public readonly string $organisationRole,
        public readonly array $rawData
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            userId: $data['UserID'] ?? '',
            emailAddress: $data['EmailAddress'] ?? '',
            firstName: $data['FirstName'] ?? '',
            lastName: $data['LastName'] ?? '',
            updatedDateUtc: $data['UpdatedDateUTC'] ?? '',
            isSubscriber: filter_var($data['IsSubscriber'] ?? false, FILTER_VALIDATE_BOOLEAN),
            organisationRole: $data['OrganisationRole'] ?? '',
            rawData: $data
        );
    }

    public function toArray(): array
    {
        return [
            'external_id' => $this->userId,
            'email' => $this->emailAddress,
            'first_name' => $this->firstName,
            'last_name' => $this->lastName,
            'updated_date_utc' => $this->updatedDateUtc,
            'is_subscriber' => $this->isSubscriber,
            'role' => $this->organisationRole,
            'raw_data' => $this->rawData
        ];
    }
}
