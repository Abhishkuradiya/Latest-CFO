<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Account extends Model
{
    protected $fillable = [
        'tenant_id',
        'external_id',
        'code',
        'name',
        'type',
        'status',
        'raw_data'
    ];

    protected $casts = [
        'raw_data' => 'array'
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
