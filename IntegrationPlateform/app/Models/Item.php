<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Item extends Model
{
    protected $fillable = [
        'tenant_id',
        'external_id',
        'code',
        'name',
        'description',
        'purchase_description',
        'is_sold',
        'is_purchased',
        'is_tracked_as_inventory',
        'inventory_asset_account_code',
        'total_cost_pool',
        'quantity_on_hand',
        'raw_data',
    ];

    protected $casts = [
        'is_sold' => 'boolean',
        'is_purchased' => 'boolean',
        'is_tracked_as_inventory' => 'boolean',
        'total_cost_pool' => 'decimal:4',
        'quantity_on_hand' => 'decimal:4',
        'raw_data' => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
