<?php

namespace App\Integrations\DTOs;

class PaymentDTO
{
    public function __construct(
        public readonly string $externalId,
        public readonly ?string $invoiceExternalId,
        public readonly string $date,
        public readonly float $amount,
        public readonly float $bankAmount,
        public readonly float $currencyRate,
        public readonly ?string $paymentType,
        public readonly bool $isReconciled,
        public readonly ?string $reference,
        public readonly ?string $status,
        public readonly ?array $rawData = null
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            externalId: $data['external_id'],
            invoiceExternalId: $data['invoice_external_id'] ?? null,
            date: $data['date'],
            amount: (float) ($data['amount'] ?? 0.0),
            bankAmount: (float) ($data['bank_amount'] ?? 0.0),
            currencyRate: (float) ($data['currency_rate'] ?? 1.0),
            paymentType: $data['payment_type'] ?? null,
            isReconciled: isset($data['is_reconciled']) ? (bool) $data['is_reconciled'] : false,
            reference: $data['reference'] ?? null,
            status: $data['status'] ?? null,
            rawData: is_string($data['raw_data'] ?? null) ? json_decode($data['raw_data'], true) : ($data['raw_data'] ?? null)
        );
    }

    public function toArray(): array
    {
        return [
            'external_id' => $this->externalId,
            'invoice_external_id' => $this->invoiceExternalId,
            'date' => $this->date,
            'amount' => $this->amount,
            'bank_amount' => $this->bankAmount,
            'currency_rate' => $this->currencyRate,
            'payment_type' => $this->paymentType,
            'is_reconciled' => $this->isReconciled,
            'reference' => $this->reference,
            'status' => $this->status,
            'raw_data' => $this->rawData,
        ];
    }
}
