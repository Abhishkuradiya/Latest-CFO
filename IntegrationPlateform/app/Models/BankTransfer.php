<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BankTransfer extends Model
{
    protected $fillable = [
        'tenant_id',
        'external_id',
        'from_account_name',
        'from_account_id',
        'to_account_name',
        'to_account_id',
        'amount',
        'date',
        'reference',
        'from_is_reconciled',
        'to_is_reconciled',
        'raw_data',
    ];

    protected $casts = [
        'date'                => 'date',
        'amount'              => 'decimal:4',
        'from_is_reconciled'  => 'boolean',
        'to_is_reconciled'    => 'boolean',
        'raw_data'            => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
