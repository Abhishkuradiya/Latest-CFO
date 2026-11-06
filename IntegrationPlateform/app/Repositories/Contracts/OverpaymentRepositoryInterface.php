<?php

namespace App\Repositories\Contracts;

use App\Integrations\DTOs\OverpaymentDTO;
use App\Models\Overpayment;
use Illuminate\Database\Eloquent\Collection;

interface OverpaymentRepositoryInterface
{
    public function updateOrCreate(int $tenantId, OverpaymentDTO $dto): Overpayment;
    public function getByTenant(int $tenantId): Collection;
}
