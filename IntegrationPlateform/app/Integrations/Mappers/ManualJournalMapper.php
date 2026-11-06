<?php

namespace App\Integrations\Mappers;

use App\Integrations\DTOs\ManualJournalDTO;

class ManualJournalMapper
{
    private static function parseDate(?string $xeroDate): ?string
    {
        if (!$xeroDate) {
            return null;
        }
        if (preg_match('/\/Date\((\d+)([+-]\d{4})?\)\//', $xeroDate, $matches)) {
            return date('Y-m-d', (int)($matches[1] / 1000));
        }
        return $xeroDate;
    }

    public static function toDTO(array $data): ManualJournalDTO
    {
        $lines = array_map(function ($line) {
            return [
                'journal_line_id' => $line['JournalLineID'] ?? null,
                'line_amount'     => isset($line['LineAmount']) ? (float) $line['LineAmount'] : 0.0,
                'account_code'    => $line['AccountCode'] ?? null,
                'account_name'    => $line['AccountName'] ?? null,
                'description'     => $line['Description'] ?? null,
                'tax_type'        => $line['TaxType'] ?? null,
                'tax_amount'      => isset($line['TaxAmount']) ? (float) $line['TaxAmount'] : 0.0,
                'tracking'        => $line['Tracking'] ?? [],
            ];
        }, $data['JournalLines'] ?? []);

        return new ManualJournalDTO(
            manualJournalId: $data['ManualJournalID'],
            date:            self::parseDate($data['Date'] ?? null),
            status:          $data['Status'] ?? null,
            narration:       $data['Narration'] ?? null,
            lineAmountTypes: $data['LineAmountTypes'] ?? null,
            journalLines:    $lines,
            rawData:         $data
        );
    }
}
