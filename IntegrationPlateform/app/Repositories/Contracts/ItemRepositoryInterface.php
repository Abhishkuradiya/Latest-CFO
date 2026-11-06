<?php

namespace App\Repositories\Contracts;

use App\Integrations\DTOs\ItemDTO;
use App\Models\Item;
use Illuminate\Database\Eloquent\Collection;

interface ItemRepositoryInterface
{
    /**
     * @param int $tenantId
     * @param ItemDTO $dto
     * @return Item
     */
    public function updateOrCreate(int $tenantId, ItemDTO $dto): Item;

    /**
     * @param int $tenantId
     * @return Collection
     */
    public function getByTenant(int $tenantId): Collection;
}
