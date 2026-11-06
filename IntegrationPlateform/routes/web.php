<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\OAuthController;

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DashboardSyncController;

Route::get('/', [DashboardController::class, 'index'])->name('dashboard');
Route::post('/tenant/store', [DashboardController::class, 'storeTenant'])->name('tenant.store');
Route::post('/dashboard/sync/{tenant_id}', [DashboardSyncController::class, 'sync'])->name('dashboard.sync');

Route::prefix('oauth')->group(function () {
    Route::get('/xero/redirect', [OAuthController::class, 'redirect'])->name('oauth.xero.redirect');
    Route::get('/xero/callback', [OAuthController::class, 'callback'])->name('oauth.xero.callback');
});
