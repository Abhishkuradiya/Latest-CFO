<?php

namespace App\Repositories\Contracts;

use App\Integrations\DTOs\PrepaymentDTO;
use App\Models\Prepayment;
use Illuminate\Database\Eloquent\Collection;

interface PrepaymentRepositoryInterface
{
    public function updateOrCreate(int $tenantId, PrepaymentDTO $dto): Prepayment;
    public function getByTenant(int $tenantId): Collection;
}
