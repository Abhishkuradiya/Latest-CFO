<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Prepayment extends Model
{
    protected $fillable = [
        'tenant_id',
        'external_id',
        'contact_id',
        'contact_name',
        'date',
        'status',
        'line_amount_types',
        'sub_total',
        'total_tax',
        'total',
        'currency_code',
        'type',
        'remaining_credit',
        'invoice_number',
        'has_attachments',
        'line_items',
        'allocations',
        'payments',
        'raw_data',
    ];

    protected $casts = [
        'date' => 'date',
        'sub_total' => 'decimal:4',
        'total_tax' => 'decimal:4',
        'total' => 'decimal:4',
        'remaining_credit' => 'decimal:4',
        'has_attachments' => 'boolean',
        'line_items' => 'array',
        'allocations' => 'array',
        'payments' => 'array',
        'raw_data' => 'array',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }
}
