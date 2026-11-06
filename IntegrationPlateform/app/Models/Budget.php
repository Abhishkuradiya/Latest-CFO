<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Budget extends Model
{
    protected $fillable = [
        'tenant_id',
        'external_id',
        'type',
        'description',
        'updated_date_utc',
        'raw_data',
    ];

    protected $casts = [
        'raw_data' => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
