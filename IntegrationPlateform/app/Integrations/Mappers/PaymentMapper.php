<?php

namespace App\Integrations\Mappers;

use App\Integrations\DTOs\PaymentDTO;

class PaymentMapper
{
    /**
     * Map Xero payment array to PaymentDTO.
     *
     * @param array $data
     * @return PaymentDTO
     */
    public static function toDTO(array $data): PaymentDTO
    {
        $invoiceId = $data['Invoice']['InvoiceID'] ?? $data['InvoiceID'] ?? null;
        $amount = (float) ($data['Amount'] ?? 0.0);
        $bankAmount = (float) ($data['BankAmount'] ?? $amount);
        $currencyRate = (float) ($data['CurrencyRate'] ?? 1.0);
        $paymentType = $data['PaymentType'] ?? null;
        $isReconciled = isset($data['IsReconciled']) ? ($data['IsReconciled'] === 'true' || $data['IsReconciled'] === true) : false;

        return new PaymentDTO(
            externalId: $data['PaymentID'],
            invoiceExternalId: $invoiceId,
            date: self::parseXeroDate($data['DateString'] ?? $data['Date'] ?? ''),
            amount: $amount,
            bankAmount: $bankAmount,
            currencyRate: $currencyRate,
            paymentType: $paymentType,
            isReconciled: $isReconciled,
            reference: $data['Reference'] ?? null,
            status: $data['Status'] ?? null,
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
