<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BatchPayment extends Model
{
    protected $fillable = [
        'tenant_id',
        'external_id',
        'account_id',
        'account_currency',
        'date',
        'type',
        'status',
        'total_amount',
        'is_reconciled',
        'reference',
        'payment_count',
        'raw_data',
    ];

    protected $casts = [
        'date'          => 'date',
        'total_amount'  => 'decimal:4',
        'is_reconciled' => 'boolean',
        'raw_data'      => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
