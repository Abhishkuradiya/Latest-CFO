<?php

namespace App\Integrations\DTOs;

class ProfitLossReportDTO
{
    public function __construct(
        public readonly string $organizationName,
        public readonly string $startDate,
        public readonly string $endDate,
        public readonly array $revenueSections,
        public readonly float $totalRevenue,
        public readonly array $costOfGoodsSoldSections,
        public readonly float $totalCostOfGoodsSold,
        public readonly float $grossProfit,
        public readonly array $expenseSections,
        public readonly float $totalExpenses,
        public readonly float $netProfit
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            organizationName: $data['organization_name'],
            startDate: $data['start_date'],
            endDate: $data['end_date'],
            revenueSections: $data['revenue_sections'] ?? [],
            totalRevenue: (float) ($data['total_revenue'] ?? 0.0),
            costOfGoodsSoldSections: $data['cost_of_goods_sold_sections'] ?? [],
            totalCostOfGoodsSold: (float) ($data['total_cost_of_goods_sold'] ?? 0.0),
            grossProfit: (float) ($data['gross_profit'] ?? 0.0),
            expenseSections: $data['expense_sections'] ?? [],
            totalExpenses: (float) ($data['total_expenses'] ?? 0.0),
            netProfit: (float) ($data['net_profit'] ?? 0.0)
        );
    }

    public function toArray(): array
    {
        return [
            'organization_name' => $this->organizationName,
            'start_date' => $this->startDate,
            'end_date' => $this->endDate,
            'revenue_sections' => $this->revenueSections,
            'total_revenue' => $this->totalRevenue,
            'cost_of_goods_sold_sections' => $this->costOfGoodsSoldSections,
            'total_cost_of_goods_sold' => $this->totalCostOfGoodsSold,
            'gross_profit' => $this->grossProfit,
            'expense_sections' => $this->expenseSections,
            'total_expenses' => $this->totalExpenses,
            'net_profit' => $this->netProfit,
        ];
    }
}
