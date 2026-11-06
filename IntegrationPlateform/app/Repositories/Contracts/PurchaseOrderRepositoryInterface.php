<?php

namespace App\Repositories\Contracts;

use App\Integrations\DTOs\PurchaseOrderDTO;
use App\Models\PurchaseOrder;
use Illuminate\Database\Eloquent\Collection;

interface PurchaseOrderRepositoryInterface
{
    public function updateOrCreate(int $tenantId, PurchaseOrderDTO $dto): PurchaseOrder;
    public function getByTenant(int $tenantId): Collection;
}
