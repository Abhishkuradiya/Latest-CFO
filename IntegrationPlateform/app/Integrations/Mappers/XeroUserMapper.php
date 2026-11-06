<?php

namespace App\Integrations\Mappers;

use App\Integrations\DTOs\XeroUserDTO;

class XeroUserMapper
{
    public static function toDTO(array $data): XeroUserDTO
    {
        return XeroUserDTO::fromArray($data);
    }

    public static function toDTOCollection(array $data): array
    {
        $users = $data['Users'] ?? [];
        return array_map(fn($item) => self::toDTO($item), $users);
    }
}
