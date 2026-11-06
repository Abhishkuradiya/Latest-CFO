<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Quote extends Model
{
    protected $fillable = [
        'tenant_id',
        'external_id',
        'quote_number',
        'reference',
        'title',
        'summary',
        'terms',
        'date',
        'expiry_date',
        'status',
        'currency_code',
        'currency_rate',
        'sub_total',
        'total_tax',
        'total',
        'total_discount',
        'line_amount_types',
        'contact_id',
        'contact_name',
        'line_items',
        'raw_data',
    ];

    protected $casts = [
        'date' => 'date',
        'expiry_date' => 'date',
        'currency_rate' => 'decimal:10',
        'sub_total' => 'decimal:4',
        'total_tax' => 'decimal:4',
        'total' => 'decimal:4',
        'total_discount' => 'decimal:4',
        'line_items' => 'array',
        'raw_data' => 'array',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }
}
