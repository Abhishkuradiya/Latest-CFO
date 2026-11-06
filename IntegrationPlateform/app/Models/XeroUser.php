<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class XeroUser extends Model
{
    protected $table = 'xero_users';

    protected $fillable = [
        'tenant_id',
        'external_id',
        'email',
        'first_name',
        'last_name',
        'role',
        'is_subscriber',
        'updated_date_utc',
        'raw_data'
    ];

    protected $casts = [
        'is_subscriber' => 'boolean',
        'raw_data' => 'array'
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }
}
