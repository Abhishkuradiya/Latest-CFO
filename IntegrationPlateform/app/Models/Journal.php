<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Journal extends Model
{
    protected $fillable = [
        'tenant_id',
        'external_id',
        'journal_number',
        'journal_date',
        'created_date_utc',
        'reference',
        'source_id',
        'source_type',
        'journal_lines',
        'raw_data',
    ];

    protected $casts = [
        'journal_date' => 'date',
        'created_date_utc' => 'datetime',
        'journal_number' => 'integer',
        'journal_lines' => 'array',
        'raw_data' => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}

