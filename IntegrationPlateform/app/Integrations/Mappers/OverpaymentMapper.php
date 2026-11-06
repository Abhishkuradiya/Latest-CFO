<?php

namespace App\Integrations\Mappers;

use App\Integrations\DTOs\OverpaymentDTO;

class OverpaymentMapper
{
    private static function parseDate(?string $xeroDate): ?string
    {
        if (!$xeroDate) {
            return null;
        }
        if (preg_match('/\/Date\((\d+)([+-]\d{4})?\)\//', $xeroDate, $matches)) {
            return date('Y-m-d', (int)($matches[1] / 1000));
        }
        return date('Y-m-d', strtotime($xeroDate));
    }

    public static function toDTO(array $data): OverpaymentDTO
    {
        $lineItems = array_map(function ($line) {
            return [
                'description'  => $line['Description'] ?? '',
                'quantity'     => isset($line['Quantity']) ? (float) $line['Quantity'] : 1.0,
                'unit_amount'  => isset($line['UnitAmount']) ? (float) $line['UnitAmount'] : 0.0,
                'account_code' => $line['AccountCode'] ?? null,
                'tax_type'     => $line['TaxType'] ?? null,
                'tax_amount'   => isset($line['TaxAmount']) ? (float) $line['TaxAmount'] : 0.0,
                'line_amount'  => isset($line['LineAmount']) ? (float) $line['LineAmount'] : 0.0,
            ];
        }, $data['LineItems'] ?? []);

        $allocations = array_map(function ($alloc) {
            return [
                'allocation_id'  => $alloc['AllocationID'] ?? null,
                'amount'         => isset($alloc['Amount']) ? (float) $alloc['Amount'] : 0.0,
                'date'           => self::parseDate($alloc['Date'] ?? null),
                'invoice_id'     => $alloc['Invoice']['InvoiceID'] ?? null,
                'invoice_number' => $alloc['Invoice']['InvoiceNumber'] ?? null,
            ];
        }, $data['Allocations'] ?? []);

        $payments = array_map(function ($pay) {
            return [
                'payment_id' => $pay['PaymentID'] ?? null,
                'amount'     => isset($pay['Amount']) ? (float) $pay['Amount'] : 0.0,
                'date'       => self::parseDate($pay['Date'] ?? null),
            ];
        }, $data['Payments'] ?? []);

        return new OverpaymentDTO(
            overpaymentId:     $data['OverpaymentID'],
            contactId:         $data['Contact']['ContactID'] ?? null,
            contactName:       $data['Contact']['Name'] ?? null,
            date:              self::parseDate($data['Date'] ?? null),
            status:            $data['Status'] ?? null,
            lineAmountTypes:   $data['LineAmountTypes'] ?? null,
            subTotal:          isset($data['SubTotal']) ? (float) $data['SubTotal'] : 0.0,
            totalTax:          isset($data['TotalTax']) ? (float) $data['TotalTax'] : 0.0,
            total:             isset($data['Total']) ? (float) $data['Total'] : 0.0,
            currencyCode:      $data['CurrencyCode'] ?? null,
            type:              $data['Type'] ?? null,
            remainingCredit:   isset($data['RemainingCredit']) ? (float) $data['RemainingCredit'] : 0.0,
            reference:         $data['Reference'] ?? null,
            hasAttachments:    isset($data['HasAttachments']) ? (bool) ($data['HasAttachments'] === 'true' || $data['HasAttachments'] === true) : false,
            lineItems:         $lineItems,
            allocations:       $allocations,
            payments:          $payments,
            rawData:           $data
        );
    }
}
