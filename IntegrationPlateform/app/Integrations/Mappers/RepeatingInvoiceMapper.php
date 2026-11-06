<?php

namespace App\Integrations\Mappers;

use App\Integrations\DTOs\RepeatingInvoiceDTO;

class RepeatingInvoiceMapper
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

    public static function toDTO(array $data): RepeatingInvoiceDTO
    {
        $lineItems = array_map(function ($line) {
            return [
                'line_item_id' => $line['LineItemID'] ?? null,
                'description'  => $line['Description'] ?? '',
                'quantity'     => isset($line['Quantity']) ? (float) $line['Quantity'] : 1.0,
                'unit_amount'  => isset($line['UnitAmount']) ? (float) $line['UnitAmount'] : 0.0,
                'item_code'    => $line['ItemCode'] ?? null,
                'account_code' => $line['AccountCode'] ?? null,
                'tax_type'     => $line['TaxType'] ?? null,
                'tax_amount'   => isset($line['TaxAmount']) ? (float) $line['TaxAmount'] : 0.0,
                'line_amount'  => isset($line['LineAmount']) ? (float) $line['LineAmount'] : 0.0,
                'discount_rate'=> isset($line['DiscountRate']) ? (float) $line['DiscountRate'] : 0.0,
            ];
        }, $data['LineItems'] ?? []);

        $sched = $data['Schedule'] ?? [];
        $schedule = [
            'period'              => isset($sched['Period']) ? (int) $sched['Period'] : 1,
            'unit'                => $sched['Unit'] ?? 'MONTHLY',
            'due_date'            => isset($sched['DueDate']) ? (int) $sched['DueDate'] : 30,
            'due_date_type'       => $sched['DueDateType'] ?? 'OFCURRENTMONTH',
            'start_date'          => self::parseDate($sched['StartDate'] ?? null),
            'next_scheduled_date' => self::parseDate($sched['NextScheduledDate'] ?? null),
            'end_date'            => self::parseDate($sched['EndDate'] ?? null),
        ];

        return new RepeatingInvoiceDTO(
            repeatingInvoiceId: $data['RepeatingInvoiceID'] ?? $data['ID'],
            type:               $data['Type'] ?? null,
            reference:          $data['Reference'] ?? null,
            status:             $data['Status'] ?? null,
            lineAmountTypes:    $data['LineAmountTypes'] ?? null,
            subTotal:           isset($data['SubTotal']) ? (float) $data['SubTotal'] : 0.0,
            totalTax:           isset($data['TotalTax']) ? (float) $data['TotalTax'] : 0.0,
            total:              isset($data['Total']) ? (float) $data['Total'] : 0.0,
            currencyCode:       $data['CurrencyCode'] ?? null,
            contactId:          $data['Contact']['ContactID'] ?? null,
            contactName:        $data['Contact']['Name'] ?? null,
            hasAttachments:     isset($data['HasAttachments']) ? (bool) $data['HasAttachments'] : false,
            approvedForSending: isset($data['ApprovedForSending']) ? (bool) $data['ApprovedForSending'] : false,
            sendCopy:           isset($data['SendCopy']) ? (bool) $data['SendCopy'] : false,
            markAsSent:         isset($data['MarkAsSent']) ? (bool) $data['MarkAsSent'] : false,
            includePdf:         isset($data['IncludePDF']) ? (bool) $data['IncludePDF'] : false,
            schedule:           $schedule,
            lineItems:           $lineItems,
            rawData:            $data
        );
    }
}
