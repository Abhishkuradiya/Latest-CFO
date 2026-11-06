<?php

namespace App\Integrations\Mappers;

use App\Integrations\DTOs\PurchaseOrderDTO;

class PurchaseOrderMapper
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

    public static function toDTO(array $data): PurchaseOrderDTO
    {
        $lineItems = array_map(function ($line) {
            return [
                'line_item_id'  => $line['LineItemID'] ?? null,
                'description'   => $line['Description'] ?? '',
                'quantity'      => isset($line['Quantity']) ? (float) $line['Quantity'] : 1.0,
                'unit_amount'   => isset($line['UnitAmount']) ? (float) $line['UnitAmount'] : 0.0,
                'item_code'     => $line['ItemCode'] ?? null,
                'account_code'  => $line['AccountCode'] ?? null,
                'tax_type'      => $line['TaxType'] ?? null,
                'tax_amount'    => isset($line['TaxAmount']) ? (float) $line['TaxAmount'] : 0.0,
                'line_amount'   => isset($line['LineAmount']) ? (float) $line['LineAmount'] : 0.0,
                'discount_rate' => isset($line['DiscountRate']) ? (float) $line['DiscountRate'] : 0.0,
            ];
        }, $data['LineItems'] ?? []);

        return new PurchaseOrderDTO(
            purchaseOrderId:      $data['PurchaseOrderID'],
            purchaseOrderNumber:  $data['PurchaseOrderNumber'] ?? null,
            reference:            $data['Reference'] ?? null,
            date:                 self::parseDate($data['DateString'] ?? $data['Date'] ?? null),
            deliveryDate:         self::parseDate($data['DeliveryDateString'] ?? $data['DeliveryDate'] ?? null),
            expectedArrivalDate:  self::parseDate($data['ExpectedArrivalDateString'] ?? $data['ExpectedArrivalDate'] ?? null),
            status:               $data['Status'] ?? null,
            currencyCode:         $data['CurrencyCode'] ?? null,
            currencyRate:         isset($data['CurrencyRate']) ? (float) $data['CurrencyRate'] : 1.0,
            subTotal:             isset($data['SubTotal']) ? (float) $data['SubTotal'] : 0.0,
            totalTax:             isset($data['TotalTax']) ? (float) $data['TotalTax'] : 0.0,
            total:                isset($data['Total']) ? (float) $data['Total'] : 0.0,
            contactId:            $data['Contact']['ContactID'] ?? null,
            contactName:          $data['Contact']['Name'] ?? null,
            deliveryAddress:      $data['DeliveryAddress'] ?? null,
            attentionTo:          $data['AttentionTo'] ?? null,
            telephone:            $data['Telephone'] ?? null,
            deliveryInstructions: $data['DeliveryInstructions'] ?? null,
            hasAttachments:       isset($data['HasAttachments']) ? (bool) ($data['HasAttachments'] === 'true' || $data['HasAttachments'] === true) : false,
            lineItems:            $lineItems,
            rawData:              $data
        );
    }
}
