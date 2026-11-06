<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Invoice extends Model
{
    protected $fillable = [
        'tenant_id',
        'external_id',
        'contact_id',
        'invoice_number',
        'type',
        'status',
        'date',
        'due_date',
        'sub_total',
        'tax_total',
        'total',
        'amount_due',
        'amount_paid',
        'currency_code',
        'raw_data'
    ];

    protected $casts = [
        'date' => 'date',
        'due_date' => 'date',
        'sub_total' => 'decimal:4',
        'tax_total' => 'decimal:4',
        'total' => 'decimal:4',
        'amount_due' => 'decimal:4',
        'amount_paid' => 'decimal:4',
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

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }
}
