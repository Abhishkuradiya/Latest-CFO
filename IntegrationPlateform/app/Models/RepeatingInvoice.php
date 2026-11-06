<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RepeatingInvoice extends Model
{
    protected $fillable = [
        'tenant_id',
        'external_id',
        'type',
        'reference',
        'status',
        'line_amount_types',
        'sub_total',
        'total_tax',
        'total',
        'currency_code',
        'contact_id',
        'contact_name',
        'has_attachments',
        'approved_for_sending',
        'send_copy',
        'mark_as_sent',
        'include_pdf',
        'schedule',
        'line_items',
        'raw_data',
    ];

    protected $casts = [
        'sub_total' => 'decimal:4',
        'total_tax' => 'decimal:4',
        'total' => 'decimal:4',
        'has_attachments' => 'boolean',
        'approved_for_sending' => 'boolean',
        'send_copy' => 'boolean',
        'mark_as_sent' => 'boolean',
        'include_pdf' => 'boolean',
        'schedule' => 'array',
        'line_items' => 'array',
        'raw_data' => 'array',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }
}
