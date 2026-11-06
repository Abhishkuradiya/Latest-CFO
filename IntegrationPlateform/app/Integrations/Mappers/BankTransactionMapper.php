<?php

namespace App\Integrations\Mappers;

use App\Integrations\DTOs\BankTransactionDTO;

class BankTransactionMapper
{
    /**
     * Map Xero bank transaction array to BankTransactionDTO.
     *
     * @param array $data
     * @return BankTransactionDTO
     */
    public static function toDTO(array $data): BankTransactionDTO
    {
        $isReconciled = false;
        if (isset($data['IsReconciled'])) {
            $isReconciled = filter_var($data['IsReconciled'], FILTER_VALIDATE_BOOLEAN);
        }

        return new BankTransactionDTO(
            externalId: $data['BankTransactionID'],
            type: $data['Type'],
            date: self::parseXeroDate($data['DateString'] ?? $data['Date'] ?? ''),
            total: (float) ($data['Total'] ?? 0.0),
            reference: $data['Reference'] ?? null,
            status: $data['Status'] ?? null,
            isReconciled: $isReconciled,
            rawData: $data
        );
    }

    /**
     * Parse Xero date.
     *
     * @param string|null $date
     * @return string|null
     */
    private static function parseXeroDate(?string $date): ?string
    {
        if (!$date) {
            return null;
        }

        if (preg_match('/\/Date\((-?\d+)(?:[+-]\d+)?\)\//', $date, $matches)) {
            $timestamp = (int) ($matches[1] / 1000);
            return date('Y-m-d', $timestamp);
        }

        $time = strtotime($date);
        return $time ? date('Y-m-d', $time) : null;
    }
}
