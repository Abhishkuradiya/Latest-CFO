<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Repositories\Contracts\ItemRepositoryInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ItemController extends Controller
{
    public function __construct(
        protected ItemRepositoryInterface $itemRepo
    ) {}

    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');
        $items = $this->itemRepo->getByTenant($tenantId);

        $rawItems = $items->map(function ($item) {
            return $item->raw_data ?: [
                'ItemID'                   => $item->external_id,
                'Code'                     => $item->code,
                'Name'                     => $item->name,
                'Description'              => $item->description,
                'PurchaseDescription'      => $item->purchase_description,
                'IsSold'                   => $item->is_sold,
                'IsPurchased'              => $item->is_purchased,
                'IsTrackedAsInventory'     => $item->is_tracked_as_inventory,
                'InventoryAssetAccountCode'=> $item->inventory_asset_account_code,
                'TotalCostPool'            => $item->total_cost_pool,
                'QuantityOnHand'           => $item->quantity_on_hand,
            ];
        })->toArray();

        return response()->json([
            'Id'           => \Illuminate\Support\Str::uuid()->toString(),
            'Status'       => 'OK',
            'ProviderName' => 'Integration Platform',
            'DateTimeUTC'  => '/Date(' . round(microtime(true) * 1000) . ')/',
            'Items'        => $rawItems,
        ]);
    }
}
