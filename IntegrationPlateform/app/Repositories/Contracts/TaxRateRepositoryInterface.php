<?php

namespace App\Repositories\Contracts;

use App\Integrations\DTOs\TaxRateDTO;
use App\Models\TaxRate;
use Illuminate\Database\Eloquent\Collection;

interface TaxRateRepositoryInterface
{
    public function updateOrCreate(int $tenantId, TaxRateDTO $dto): TaxRate;
    public function getByTenant(int $tenantId): Collection;
}
