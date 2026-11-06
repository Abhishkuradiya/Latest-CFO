<?php

namespace App\Integrations\OAuth;

use App\Models\TenantCredential;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class OAuthManager
{
    /**
     * Get the authorization URL for Xero.
     *
     * @param int $tenantId
     * @param string $state
     * @return string
     */
    public function getXeroAuthUrl(int $tenantId, string $state): string
    {
        $clientId = config('services.xero.client_id');
        $redirectUri = config('services.xero.redirect_uri');
        $scope = 'openid profile email offline_access accounting.contacts.read accounting.invoices.read accounting.payments.read accounting.settings.read accounting.reports.profitandloss.read accounting.banktransactions.read accounting.attachments accounting.budgets.read accounting.manualjournals.read accounting.reports.balancesheet.read accounting.reports.trialbalance.read accounting.reports.aged.read';

        $query = http_build_query([
            'response_type' => 'code',
            'client_id' => $clientId,
            'redirect_uri' => $redirectUri,
            'scope' => $scope,
            'state' => "tenant_{$tenantId}_{$state}",
        ]);

        return 'https://login.xero.com/identity/connect/authorize?' . $query;
    }

    /**
     * Handle Xero authorization callback and return tokens and connections.
     *
     * @param string $code
     * @return array
     */
    public function handleXeroCallback(string $code): array
    {
        $clientId = config('services.xero.client_id');
        $clientSecret = config('services.xero.client_secret');
        $redirectUri = config('services.xero.redirect_uri');

        $response = Http::asForm()
            ->withBasicAuth($clientId, $clientSecret)
            ->post('https://identity.xero.com/connect/token', [
                'grant_type' => 'authorization_code',
                'code' => $code,
                'redirect_uri' => $redirectUri,
            ]);

        if ($response->failed()) {
            Log::error('Xero OAuth code exchange failed', [
                'status' => $response->status(),
                'body' => $response->body()
            ]);
            throw new \Exception('Xero OAuth code exchange failed: ' . $response->body());
        }

        $tokens = $response->json();
        
        // Fetch connections (Tenant identifiers)
        $connectionsResponse = Http::withToken($tokens['access_token'])
            ->get('https://api.xero.com/connections');

        if ($connectionsResponse->failed()) {
             Log::error('Failed to fetch Xero connections', [
                 'status' => $connectionsResponse->status(),
                 'body' => $connectionsResponse->body()
             ]);
             throw new \Exception('Failed to fetch Xero connections: ' . $connectionsResponse->body());
        }

        return [
            'tokens' => $tokens,
            'connections' => $connectionsResponse->json(),
        ];
    }

    /**
     * Ensure a credential has a valid token. If it's expired or about to expire, refresh it.
     *
     * @param TenantCredential $credential
     * @return TenantCredential
     */
    public function refreshIfNeeded(TenantCredential $credential): TenantCredential
    {
        if ($credential->provider !== 'xero') {
            // Future extension: handle other providers if needed.
            return $credential;
        }

        // Refresh token if it's expired or expires in the next 5 minutes
        if ($credential->expires_at->isPast() || $credential->expires_at->subMinutes(5)->isPast()) {
            return $this->refreshXeroToken($credential);
        }

        return $credential;
    }

    /**
     * Force refresh the Xero token.
     *
     * @param TenantCredential $credential
     * @return TenantCredential
     */
    public function refreshXeroToken(TenantCredential $credential): TenantCredential
    {
        $clientId = config('services.xero.client_id');
        $clientSecret = config('services.xero.client_secret');

        $response = Http::asForm()
            ->withBasicAuth($clientId, $clientSecret)
            ->post('https://identity.xero.com/connect/token', [
                'grant_type' => 'refresh_token',
                'refresh_token' => $credential->refresh_token,
            ]);

        if ($response->failed()) {
            Log::error('Xero Token Refresh Failed', [
                'tenant_id' => $credential->tenant_id,
                'credential_id' => $credential->id,
                'status' => $response->status(),
                'body' => $response->body()
            ]);
            throw new \Exception('Xero token refresh failed: ' . $response->body());
        }

        $data = $response->json();

        $credential->update([
            'access_token' => $data['access_token'],
            'refresh_token' => $data['refresh_token'],
            'expires_at' => Carbon::now()->addSeconds($data['expires_in']),
            'scopes' => explode(' ', $data['scope'] ?? ''),
        ]);

        Log::info("Successfully refreshed Xero token for tenant ID {$credential->tenant_id}");

        return $credential;
    }
}
