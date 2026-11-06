<?php

namespace App\Integrations\Mappers;

use App\Integrations\DTOs\InvoiceDTO;

class InvoiceMapper
{
    /**
     * Map Xero invoice array to InvoiceDTO.
     *
     * @param array $data
     * @return InvoiceDTO
     */
    public static function toDTO(array $data): InvoiceDTO
    {
        $contactId = $data['Contact']['ContactID'] ?? '';
        
        return new InvoiceDTO(
            externalId: $data['InvoiceID'],
            contactExternalId: $contactId,
            invoiceNumber: $data['InvoiceNumber'] ?? null,
            type: $data['Type'],
            status: $data['Status'],
            date: self::parseXeroDate($data['DateString'] ?? $data['Date'] ?? ''),
            dueDate: self::parseXeroDate($data['DueDateString'] ?? $data['DueDate'] ?? null),
            subTotal: (float) ($data['SubTotal'] ?? 0.0),
            taxTotal: (float) ($data['TaxTotal'] ?? 0.0),
            total: (float) ($data['Total'] ?? 0.0),
            amountDue: (float) ($data['AmountDue'] ?? 0.0),
            amountPaid: (float) ($data['AmountPaid'] ?? 0.0),
            currencyCode: $data['CurrencyCode'] ?? 'USD',
            rawData: $data
        );
    }

    /**
     * Helper to parse Microsoft JSON Date format '/Date(1620345600000+0000)/' into Y-m-d format.
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

        // Fallback to standard string to time parsing if it's already an ISO format
        $time = strtotime($date);
        return $time ? date('Y-m-d', $time) : null;
    }
}
