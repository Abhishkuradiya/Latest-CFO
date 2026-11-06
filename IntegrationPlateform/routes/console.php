<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use App\Models\TenantCredential;
use App\Jobs\SyncProviderDataJob;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Schedule hourly sync of data for all tenants
Schedule::call(function () {
    TenantCredential::all()->each(function (TenantCredential $credential) {
        SyncProviderDataJob::dispatch($credential);
    });
})->hourly();
