<?php

namespace App\Integrations\Mappers;

use App\Integrations\DTOs\TaxRateDTO;

class TaxRateMapper
{
    public static function toDTO(array $data): TaxRateDTO
    {
        return TaxRateDTO::fromArray($data);
    }

    public static function toDTOCollection(array $data): array
    {
        $taxRates = $data['TaxRates'] ?? [];
        return array_map(fn($item) => self::toDTO($item), $taxRates);
    }
}
