<?php

namespace App\Repositories\Eloquent;

use App\Integrations\DTOs\ItemDTO;
use App\Models\Item;
use App\Repositories\Contracts\ItemRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class ItemRepository implements ItemRepositoryInterface
{
    public function updateOrCreate(int $tenantId, ItemDTO $dto): Item
    {
        return Item::updateOrCreate(
            [
                'tenant_id' => $tenantId,
                'external_id' => $dto->itemId,
            ],
            [
                'code' => $dto->code,
                'name' => $dto->name,
                'description' => $dto->description,
                'purchase_description' => $dto->purchaseDescription,
                'is_sold' => $dto->isSold,
                'is_purchased' => $dto->isPurchased,
                'is_tracked_as_inventory' => $dto->isTrackedAsInventory,
                'inventory_asset_account_code' => $dto->inventoryAssetAccountCode,
                'total_cost_pool' => $dto->totalCostPool,
                'quantity_on_hand' => $dto->quantityOnHand,
                'raw_data' => $dto->rawData,
            ]
        );
    }

    public function getByTenant(int $tenantId): Collection
    {
        return Item::where('tenant_id', $tenantId)
            ->orderBy('code', 'asc')
            ->get();
    }
}
