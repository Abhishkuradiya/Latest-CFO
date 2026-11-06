<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    protected $fillable = [
        'tenant_id',
        'external_id',
        'invoice_id',
        'date',
        'amount',
        'bank_amount',
        'currency_rate',
        'payment_type',
        'is_reconciled',
        'reference',
        'status',
        'raw_data'
    ];

    protected $casts = [
        'date' => 'date',
        'amount' => 'decimal:4',
        'bank_amount' => 'decimal:4',
        'currency_rate' => 'decimal:10',
        'is_reconciled' => 'boolean',
        'raw_data' => 'array'
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }
}
