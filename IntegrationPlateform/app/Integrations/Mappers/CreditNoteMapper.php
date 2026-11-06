<?php

namespace App\Integrations\Mappers;

use App\Integrations\DTOs\CreditNoteDTO;
use Carbon\Carbon;

class CreditNoteMapper
{
    /**
     * Map Xero credit note array to CreditNoteDTO.
     *
     * @param array $data
     * @return CreditNoteDTO
     */
    public static function toDTO(array $data): CreditNoteDTO
    {
        $date = null;
        if (!empty($data['DateString'])) {
            $date = Carbon::parse($data['DateString'])->format('Y-m-d');
        } elseif (!empty($data['Date'])) {
            // Handle /Date(1234567890+0000)/ format
            preg_match('/\/Date\((\d+)[+-]\d+\)\//', $data['Date'], $matches);
            if (isset($matches[1])) {
                $date = Carbon::createFromTimestampMs($matches[1])->format('Y-m-d');
            }
        }

        return new CreditNoteDTO(
            creditNoteId: $data['CreditNoteID'],
            creditNoteNumber: $data['CreditNoteNumber'] ?? '',
            contactId: $data['Contact']['ContactID'] ?? '',
            date: $date,
            total: (float) ($data['Total'] ?? 0),
            status: $data['Status'] ?? 'UNKNOWN',
            type: $data['Type'] ?? 'UNKNOWN',
            rawData: $data
        );
    }
}