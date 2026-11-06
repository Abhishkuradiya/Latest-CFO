<?php

namespace App\Integrations\DTOs;

class InvoiceDTO
{
    public function __construct(
        public readonly string $externalId,
        public readonly string $contactExternalId,
        public readonly ?string $invoiceNumber,
        public readonly string $type,
        public readonly string $status,
        public readonly string $date,
        public readonly ?string $dueDate,
        public readonly float $subTotal,
        public readonly float $taxTotal,
        public readonly float $total,
        public readonly float $amountDue,
        public readonly float $amountPaid,
        public readonly string $currencyCode = 'USD',
        public readonly ?array $rawData = null
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            externalId: $data['external_id'],
            contactExternalId: $data['contact_external_id'] ?? ($data['raw_data']['Contact']['ContactID'] ?? ''),
            invoiceNumber: $data['invoice_number'] ?? null,
            type: $data['type'],
            status: $data['status'],
            date: $data['date'],
            dueDate: $data['due_date'] ?? null,
            subTotal: (float) ($data['sub_total'] ?? 0.0),
            taxTotal: (float) ($data['tax_total'] ?? 0.0),
            total: (float) ($data['total'] ?? 0.0),
            amountDue: (float) ($data['amount_due'] ?? 0.0),
            amountPaid: (float) ($data['amount_paid'] ?? 0.0),
            currencyCode: $data['currency_code'] ?? 'USD',
            rawData: is_string($data['raw_data'] ?? null) ? json_decode($data['raw_data'], true) : ($data['raw_data'] ?? null)
        );
    }

    public function toArray(): array
    {
        return [
            'external_id' => $this->externalId,
            'contact_external_id' => $this->contactExternalId,
            'invoice_number' => $this->invoiceNumber,
            'type' => $this->type,
            'status' => $this->status,
            'date' => $this->date,
            'due_date' => $this->dueDate,
            'sub_total' => $this->subTotal,
            'tax_total' => $this->taxTotal,
            'total' => $this->total,
            'amount_due' => $this->amountDue,
            'amount_paid' => $this->amountPaid,
            'currency_code' => $this->currencyCode,
            'raw_data' => $this->rawData,
        ];
    }
}
