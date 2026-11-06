<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LinkedTransaction extends Model
{
    protected $fillable = [
        'tenant_id',
        'external_id',
        'source_transaction_id',
        'source_line_item_id',
        'contact_id',
        'target_transaction_id',
        'target_line_item_id',
        'status',
        'type',
        'source_transaction_type_code',
        'updated_date_utc',
        'raw_data',
    ];

    protected $casts = [
        'updated_date_utc' => 'datetime',
        'raw_data' => 'array',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }
}
