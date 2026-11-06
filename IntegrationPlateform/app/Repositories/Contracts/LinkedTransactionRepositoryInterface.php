<?php

namespace App\Repositories\Contracts;

use App\Integrations\DTOs\LinkedTransactionDTO;
use App\Models\LinkedTransaction;
use Illuminate\Database\Eloquent\Collection;

interface LinkedTransactionRepositoryInterface
{
    public function updateOrCreate(int $tenantId, LinkedTransactionDTO $dto): LinkedTransaction;
    public function getByTenant(int $tenantId): Collection;
}
