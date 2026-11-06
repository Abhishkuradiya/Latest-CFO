<?php

namespace App\Integrations\DTOs;

class TaxRateDTO
{
    public function __construct(
        public readonly string $name,
        public readonly string $taxType,
        public readonly string $status,
        public readonly ?string $reportTaxType,
        public readonly bool $canApplyToAssets,
        public readonly bool $canApplyToEquity,
        public readonly bool $canApplyToExpenses,
        public readonly bool $canApplyToLiabilities,
        public readonly bool $canApplyToRevenue,
        public readonly float $displayTaxRate,
        public readonly float $effectiveRate,
        public readonly array $taxComponents,
        public readonly array $rawData
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            name: $data['Name'] ?? '',
            taxType: $data['TaxType'] ?? '',
            status: $data['Status'] ?? 'ACTIVE',
            reportTaxType: $data['ReportTaxType'] ?? null,
            canApplyToAssets: filter_var($data['CanApplyToAssets'] ?? false, FILTER_VALIDATE_BOOLEAN),
            canApplyToEquity: filter_var($data['CanApplyToEquity'] ?? false, FILTER_VALIDATE_BOOLEAN),
            canApplyToExpenses: filter_var($data['CanApplyToExpenses'] ?? false, FILTER_VALIDATE_BOOLEAN),
            canApplyToLiabilities: filter_var($data['CanApplyToLiabilities'] ?? false, FILTER_VALIDATE_BOOLEAN),
            canApplyToRevenue: filter_var($data['CanApplyToRevenue'] ?? false, FILTER_VALIDATE_BOOLEAN),
            displayTaxRate: (float) ($data['DisplayTaxRate'] ?? 0.0),
            effectiveRate: (float) ($data['EffectiveRate'] ?? 0.0),
            taxComponents: $data['TaxComponents'] ?? [],
            rawData: $data
        );
    }

    public function toArray(): array
    {
        return [
            'name' => $this->name,
            'tax_type' => $this->taxType,
            'status' => $this->status,
            'report_tax_type' => $this->reportTaxType,
            'can_apply_to_assets' => $this->canApplyToAssets,
            'can_apply_to_equity' => $this->canApplyToEquity,
            'can_apply_to_expenses' => $this->canApplyToExpenses,
            'can_apply_to_liabilities' => $this->canApplyToLiabilities,
            'can_apply_to_revenue' => $this->canApplyToRevenue,
            'display_tax_rate' => $this->displayTaxRate,
            'effective_rate' => $this->effectiveRate,
            'tax_components' => $this->taxComponents,
            'raw_data' => $this->rawData
        ];
    }
}
