<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentService extends Model
{
    protected $fillable = [
        'branding_theme_id',
        'external_id',
        'name',
        'url',
        'pay_now_text',
        'type',
        'raw_data',
    ];

    protected $casts = [
        'raw_data' => 'array',
    ];

    public function brandingTheme(): BelongsTo
    {
        return $this->belongsTo(BrandingTheme::class);
    }
}
