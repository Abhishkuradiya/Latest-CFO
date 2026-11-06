<?php

namespace App\Integrations\DTOs;

class ItemDTO
{
    public function __construct(
        public readonly string $itemId,
        public readonly string $code,
        public readonly ?string $name,
        public readonly ?string $description,
        public readonly ?string $purchaseDescription,
        public readonly bool $isSold,
        public readonly bool $isPurchased,
        public readonly bool $isTrackedAsInventory,
        public readonly ?string $inventoryAssetAccountCode,
        public readonly ?float $totalCostPool,
        public readonly ?float $quantityOnHand,
        public readonly array $rawData = []
    ) {}

    public function toArray(): array
    {
        return [
            'external_id' => $this->itemId,
            'code' => $this->code,
            'name' => $this->name,
            'description' => $this->description,
            'purchase_description' => $this->purchaseDescription,
            'is_sold' => $this->isSold,
            'is_purchased' => $this->isPurchased,
            'is_tracked_as_inventory' => $this->isTrackedAsInventory,
            'inventory_asset_account_code' => $this->inventoryAssetAccountCode,
            'total_cost_pool' => $this->totalCostPool,
            'quantity_on_hand' => $this->quantityOnHand,
            'raw_data' => $this->rawData,
        ];
    }
}
