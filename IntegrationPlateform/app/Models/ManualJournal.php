<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ManualJournal extends Model
{
    protected $fillable = [
        'tenant_id',
        'external_id',
        'date',
        'status',
        'narration',
        'line_amount_types',
        'journal_lines',
        'raw_data',
    ];

    protected $casts = [
        'date' => 'date',
        'journal_lines' => 'array',
        'raw_data' => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
