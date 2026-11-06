<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BankTransaction extends Model
{
    protected $fillable = [
        'tenant_id',
        'external_id',
        'type',
        'date',
        'total',
        'reference',
        'status',
        'is_reconciled',
        'raw_data'
    ];

    protected $casts = [
        'date' => 'date',
        'total' => 'decimal:4',
        'is_reconciled' => 'boolean',
        'raw_data' => 'array'
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
