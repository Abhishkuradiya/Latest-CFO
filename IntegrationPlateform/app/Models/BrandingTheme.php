<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BrandingTheme extends Model
{
    protected $fillable = [
        'tenant_id',
        'external_id',
        'name',
        'type',
        'logo_url',
        'sort_order',
        'created_date_utc',
        'raw_data',
    ];

    protected $casts = [
        'sort_order' => 'integer',
        'raw_data'   => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function paymentServices(): HasMany
    {
        return $this->hasMany(PaymentService::class);
    }
}
