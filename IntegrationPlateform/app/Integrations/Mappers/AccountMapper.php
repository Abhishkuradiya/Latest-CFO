<?php

namespace App\Integrations\Mappers;

use App\Integrations\DTOs\AccountDTO;

class AccountMapper
{
    /**
     * Map Xero account array to AccountDTO.
     *
     * @param array $data
     * @return AccountDTO
     */
    public static function toDTO(array $data): AccountDTO
    {
        return new AccountDTO(
            externalId: $data['AccountID'],
            code: $data['Code'] ?? null,
            name: $data['Name'],
            type: $data['Type'],
            status: $data['Status'] ?? 'ACTIVE',
            rawData: $data
        );
    }
}
