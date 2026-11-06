<?php

namespace App\Repositories\Eloquent;

use App\Integrations\DTOs\TaxRateDTO;
use App\Models\TaxRate;
use App\Repositories\Contracts\TaxRateRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class TaxRateRepository implements TaxRateRepositoryInterface
{
    public function updateOrCreate(int $tenantId, TaxRateDTO $dto): TaxRate
    {
        return TaxRate::updateOrCreate(
            [
                'tenant_id' => $tenantId,
                'tax_type'  => $dto->taxType,
            ],
            [
                'name'                     => $dto->name,
                'status'                   => $dto->status,
                'report_tax_type'          => $dto->reportTaxType,
                'can_apply_to_assets'      => $dto->canApplyToAssets,
                'can_apply_to_equity'      => $dto->canApplyToEquity,
                'can_apply_to_expenses'      => $dto->canApplyToExpenses,
                'can_apply_to_liabilities' => $dto->canApplyToLiabilities,
                'can_apply_to_revenue'     => $dto->canApplyToRevenue,
                'display_tax_rate'         => $dto->displayTaxRate,
                'effective_rate'           => $dto->effectiveRate,
                'tax_components'           => $dto->taxComponents,
                'raw_data'                 => $dto->rawData,
            ]
        );
    }

    public function getByTenant(int $tenantId): Collection
    {
        return TaxRate::where('tenant_id', $tenantId)
            ->orderBy('name', 'asc')
            ->get();
    }
}
