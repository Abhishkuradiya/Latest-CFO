<?php

namespace App\Integrations\Mappers;

use App\Integrations\DTOs\ItemDTO;

class ItemMapper
{
    public static function toDTO(array $data): ItemDTO
    {
        return new ItemDTO(
            itemId: $data['ItemID'],
            code: $data['Code'] ?? '',
            name: $data['Name'] ?? null,
            description: $data['Description'] ?? null,
            purchaseDescription: $data['PurchaseDescription'] ?? null,
            isSold: (bool) ($data['IsSold'] ?? false),
            isPurchased: (bool) ($data['IsPurchased'] ?? false),
            isTrackedAsInventory: (bool) ($data['IsTrackedAsInventory'] ?? false),
            inventoryAssetAccountCode: $data['InventoryAssetAccountCode'] ?? null,
            totalCostPool: isset($data['TotalCostPool']) ? (float) $data['TotalCostPool'] : null,
            quantityOnHand: isset($data['QuantityOnHand']) ? (float) $data['QuantityOnHand'] : null,
            rawData: $data
        );
    }
}
