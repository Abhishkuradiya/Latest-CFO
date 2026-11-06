<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CreditNote extends Model
{
    protected $fillable = [
        'tenant_id',
        'contact_id',
        'external_id',
        'credit_note_number',
        'date',
        'total',
        'status',
        'type',
        'raw_data'
    ];

    protected $casts = [
        'date' => 'date',
        'total' => 'decimal:2',
        'raw_data' => 'array'
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }
}
