<?php

namespace App\Integrations\Mappers;

use App\Integrations\DTOs\LinkedTransactionDTO;

class LinkedTransactionMapper
{
    private static function parseDateTime(?string $dateStr): ?string
    {
        if (!$dateStr) {
            return null;
        }
        if (preg_match('/\/Date\((\d+)/', $dateStr, $matches)) {
            return date('Y-m-d H:i:s', (int)($matches[1] / 1000));
        }
        // If it's already a standard string, return it
        return date('Y-m-d H:i:s', strtotime($dateStr));
    }

    public static function toDTO(array $data): LinkedTransactionDTO
    {
        return new LinkedTransactionDTO(
            linkedTransactionId:       $data['LinkedTransactionID'],
            sourceTransactionId:       $data['SourceTransactionID'] ?? null,
            sourceLineItemId:          $data['SourceLineItemID'] ?? null,
            contactId:                 $data['ContactID'] ?? null,
            targetTransactionId:       $data['TargetTransactionID'] ?? null,
            targetLineItemId:          $data['TargetLineItemID'] ?? null,
            status:                    $data['Status'] ?? null,
            type:                      $data['Type'] ?? null,
            sourceTransactionTypeCode: $data['SourceTransactionTypeCode'] ?? null,
            updatedDateUtc:            self::parseDateTime($data['UpdatedDateUTC'] ?? null),
            rawData:                   $data
        );
    }
}
