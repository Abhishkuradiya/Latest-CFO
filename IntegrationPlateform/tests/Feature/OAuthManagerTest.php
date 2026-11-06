<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\Tenant;
use App\Models\TenantCredential;
use App\Integrations\OAuth\OAuthManager;
use Illuminate\Support\Facades\Http;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Carbon\Carbon;

class OAuthManagerTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Verify that if a token is still valid, it is not refreshed.
     */
    public function test_token_is_not_refreshed_if_valid()
    {
        Http::fake();

        $tenant = Tenant::create(['name' => 'Test Tenant']);
        $credential = TenantCredential::create([
            'tenant_id' => $tenant->id,
            'provider' => 'xero',
            'tenant_identifier' => 'xero-tenant-123',
            'access_token' => 'valid-access-token',
            'refresh_token' => 'valid-refresh-token',
            'expires_at' => Carbon::now()->addHours(1),
            'scopes' => ['scope1'],
        ]);

        $oauthManager = new OAuthManager();
        $updatedCredential = $oauthManager->refreshIfNeeded($credential);

        $this->assertEquals('valid-access-token', $updatedCredential->access_token);
        $this->assertEquals('valid-refresh-token', $updatedCredential->refresh_token);
        
        Http::assertNothingSent();
    }

    /**
     * Verify that if a token is expired or expiring soon, it is refreshed.
     */
    public function test_token_is_refreshed_if_expired()
    {
        Http::fake([
            'https://identity.xero.com/connect/token' => Http::response([
                'access_token' => 'new-access-token',
                'refresh_token' => 'new-refresh-token',
                'expires_in' => 1800,
                'scope' => 'scope1 scope2',
            ], 200)
        ]);

        $tenant = Tenant::create(['name' => 'Test Tenant']);
        $credential = TenantCredential::create([
            'tenant_id' => $tenant->id,
            'provider' => 'xero',
            'tenant_identifier' => 'xero-tenant-123',
            'access_token' => 'old-access-token',
            'refresh_token' => 'old-refresh-token',
            'expires_at' => Carbon::now()->subMinutes(10),
            'scopes' => ['scope1'],
        ]);

        $oauthManager = new OAuthManager();
        $updatedCredential = $oauthManager->refreshIfNeeded($credential);

        $this->assertEquals('new-access-token', $updatedCredential->access_token);
        $this->assertEquals('new-refresh-token', $updatedCredential->refresh_token);
        $this->assertTrue($updatedCredential->expires_at->isFuture());
        $this->assertEquals(['scope1', 'scope2'], $updatedCredential->scopes);

        Http::assertSent(function ($request) {
            return $request->url() === 'https://identity.xero.com/connect/token' &&
                   $request['grant_type'] === 'refresh_token' &&
                   $request['refresh_token'] === 'old-refresh-token';
        });
    }
}
