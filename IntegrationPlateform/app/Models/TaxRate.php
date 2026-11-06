<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TaxRate extends Model
{
    protected $fillable = [
        'tenant_id',
        'name',
        'tax_type',
        'status',
        'report_tax_type',
        'can_apply_to_assets',
        'can_apply_to_equity',
        'can_apply_to_expenses',
        'can_apply_to_liabilities',
        'can_apply_to_revenue',
        'display_tax_rate',
        'effective_rate',
        'tax_components',
        'raw_data'
    ];

    protected $casts = [
        'can_apply_to_assets' => 'boolean',
        'can_apply_to_equity' => 'boolean',
        'can_apply_to_expenses' => 'boolean',
        'can_apply_to_liabilities' => 'boolean',
        'can_apply_to_revenue' => 'boolean',
        'display_tax_rate' => 'float',
        'effective_rate' => 'float',
        'tax_components' => 'array',
        'raw_data' => 'array'
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }
}
