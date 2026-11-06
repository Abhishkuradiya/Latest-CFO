<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Organisation extends Model
{
    protected $fillable = [
        'tenant_id',
        'external_id',
        'name',
        'legal_name',
        'pays_tax',
        'version',
        'organisation_type',
        'base_currency',
        'country_code',
        'is_demo_company',
        'organisation_status',
        'tax_number',
        'financial_year_end_day',
        'financial_year_end_month',
        'sales_tax_basis',
        'sales_tax_period',
        'timezone',
        'edition',
        'class',
        'addresses',
        'phones',
        'external_links',
        'payment_terms',
        'raw_data',
    ];

    protected $casts = [
        'pays_tax' => 'boolean',
        'is_demo_company' => 'boolean',
        'financial_year_end_day' => 'integer',
        'financial_year_end_month' => 'integer',
        'addresses' => 'array',
        'phones' => 'array',
        'external_links' => 'array',
        'payment_terms' => 'array',
        'raw_data' => 'array',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }
}
