<?php

namespace App\Integrations\Mappers;

use App\Integrations\DTOs\JournalDTO;

class JournalMapper
{
    /**
     * Parse Xero's /Date(timestamp+offset)/ format into a Y-m-d string.
     */
    private static function parseDate(?string $xeroDate): ?string
    {
        if (!$xeroDate) {
            return null;
        }
        if (preg_match('/\/Date\((\d+)([+-]\d{4})?\)\//', $xeroDate, $matches)) {
            $timestamp = (int) $matches[0] === 0 ? 0 : (int)($matches[1] / 1000);
            return date('Y-m-d', (int)($matches[1] / 1000));
        }
        return $xeroDate;
    }

    /**
     * Parse Xero's /Date(timestamp)/ format into a datetime string (UTC).
     */
    private static function parseDateTime(?string $xeroDate): ?string
    {
        if (!$xeroDate) {
            return null;
        }
        if (preg_match('/\/Date\((\d+)/', $xeroDate, $matches)) {
            return date('Y-m-d H:i:s', (int)($matches[1] / 1000));
        }
        return $xeroDate;
    }

    public static function toDTO(array $data): JournalDTO
    {
        $lines = array_map(function ($line) {
            return [
                'journal_line_id'      => $line['JournalLineID'] ?? null,
                'account_id'           => $line['AccountID'] ?? null,
                'account_code'         => $line['AccountCode'] ?? null,
                'account_type'         => $line['AccountType'] ?? null,
                'account_name'         => $line['AccountName'] ?? null,
                'description'          => $line['Description'] ?? null,
                'net_amount'           => isset($line['NetAmount']) ? (float) $line['NetAmount'] : 0.0,
                'gross_amount'         => isset($line['GrossAmount']) ? (float) $line['GrossAmount'] : 0.0,
                'tax_amount'           => isset($line['TaxAmount']) ? (float) $line['TaxAmount'] : 0.0,
                'tax_type'             => $line['TaxType'] ?? null,
                'tax_name'             => $line['TaxName'] ?? null,
                'tracking_categories'  => $line['TrackingCategories'] ?? [],
            ];
        }, $data['JournalLines'] ?? []);

        return new JournalDTO(
            journalId:      $data['JournalID'],
            journalNumber:  (int) ($data['JournalNumber'] ?? 0),
            journalDate:    self::parseDate($data['JournalDate'] ?? null),
            createdDateUtc: self::parseDateTime($data['CreatedDateUTC'] ?? null),
            reference:      $data['Reference'] ?? null,
            sourceId:       $data['SourceID'] ?? null,
            sourceType:     $data['SourceType'] ?? null,
            journalLines:   $lines,
            rawData:        $data
        );
    }
}
