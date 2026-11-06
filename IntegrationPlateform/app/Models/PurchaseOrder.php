<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PurchaseOrder extends Model
{
    protected $fillable = [
        'tenant_id',
        'external_id',
        'purchase_order_number',
        'reference',
        'date',
        'delivery_date',
        'expected_arrival_date',
        'status',
        'currency_code',
        'currency_rate',
        'sub_total',
        'total_tax',
        'total',
        'contact_id',
        'contact_name',
        'delivery_address',
        'attention_to',
        'telephone',
        'delivery_instructions',
        'has_attachments',
        'line_items',
        'raw_data',
    ];

    protected $casts = [
        'date' => 'date',
        'delivery_date' => 'date',
        'expected_arrival_date' => 'date',
        'currency_rate' => 'decimal:10',
        'sub_total' => 'decimal:4',
        'total_tax' => 'decimal:4',
        'total' => 'decimal:4',
        'has_attachments' => 'boolean',
        'line_items' => 'array',
        'raw_data' => 'array',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }
}
