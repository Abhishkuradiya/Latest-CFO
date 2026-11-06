<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Integrations\OAuth\OAuthManager;
use App\Models\Tenant;
use App\Models\TenantCredential;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;

class OAuthController extends Controller
{
    public function __construct(
        protected OAuthManager $oauthManager
    ) {}

    /**
     * Redirect to Xero authorization.
     *
     * @param Request $request
     * @return \Illuminate\Http\RedirectResponse
     */
    public function redirect(Request $request)
    {
        $request->validate([
            'tenant_id' => 'required|exists:tenants,id',
        ]);

        $tenantId = $request->query('tenant_id');
        $state = bin2hex(random_bytes(16));

        // Save state in cache to verify on callback (valid for 15 mins)
        cache()->put("xero_state_{$tenantId}", $state, now()->addMinutes(15));

        $authUrl = $this->oauthManager->getXeroAuthUrl($tenantId, $state);

        return redirect()->away($authUrl);
    }

    /**
     * Handle Xero callback redirect.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function callback(Request $request)
    {
        $code = $request->query('code');
        $state = $request->query('state');

        if (!$code || !$state) {
            return response()->json([
                'status' => 'error',
                'message' => 'Missing code or state parameters from authorization server.'
            ], 400);
        }

        // Parse state format: tenant_{tenantId}_{randomState}
        if (!preg_match('/^tenant_(\d+)_(.+)$/', $state, $matches)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Invalid state format.'
            ], 400);
        }

        $tenantId = (int) $matches[1];
        $originalState = $matches[2];

        // Verify state
        $cachedState = cache()->get("xero_state_{$tenantId}");
        if (!$cachedState || $cachedState !== $originalState) {
            return response()->json([
                'status' => 'error',
                'message' => 'OAuth state verification failed. Possible CSRF attack.'
            ], 403);
        }

        // Remove state from cache
        cache()->forget("xero_state_{$tenantId}");

        $tenant = Tenant::findOrFail($tenantId);

        try {
            $result = $this->oauthManager->handleXeroCallback($code);
            $tokens = $result['tokens'];
            $connections = $result['connections'];

            if (empty($connections)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'No active Xero connections found. Please connect an organization.'
                ], 400);
            }

            // Save credentials for each organization authorized
            $savedCredentials = [];
            foreach ($connections as $conn) {
                // If tenantType is not ORGANISATION (Xero uses British spelling), skip
                if (isset($conn['tenantType']) && $conn['tenantType'] !== 'ORGANISATION') {
                    continue;
                }

                $tenantIdentifier = $conn['tenantId'];
                $orgName = $conn['tenantName'] ?? $tenant->name;

                // If the connected organization is different, purge old cache data to prevent contamination
                $existingCredential = TenantCredential::where('tenant_id', $tenant->id)
                    ->where('provider', 'xero')
                    ->first();

                if ($existingCredential && $existingCredential->tenant_identifier !== $tenantIdentifier) {
                    \App\Models\Contact::where('tenant_id', $tenant->id)->delete();
                    \App\Models\Invoice::where('tenant_id', $tenant->id)->delete();
                    \App\Models\Payment::where('tenant_id', $tenant->id)->delete();
                    \App\Models\Account::where('tenant_id', $tenant->id)->delete();
                }

                // Update or create the tenant credential
                $credential = TenantCredential::updateOrCreate(
                    [
                        'tenant_id' => $tenant->id,
                        'provider' => 'xero',
                        'tenant_identifier' => $tenantIdentifier,
                    ],
                    [
                        'access_token' => $tokens['access_token'],
                        'refresh_token' => $tokens['refresh_token'],
                        'expires_at' => Carbon::now()->addSeconds($tokens['expires_in']),
                        'scopes' => explode(' ', $tokens['scope'] ?? ''),
                    ]
                );

                // Delete older credentials for this tenant to keep only the active one
                TenantCredential::where('tenant_id', $tenant->id)
                    ->where('provider', 'xero')
                    ->where('tenant_identifier', '!=', $tenantIdentifier)
                    ->delete();

                $savedCredentials[] = [
                    'organization_id' => $tenantIdentifier,
                    'organization_name' => $orgName,
                ];
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Xero connection authorized successfully.',
                'tenant' => [
                    'id' => $tenant->id,
                    'name' => $tenant->name,
                ],
                'connections' => $savedCredentials,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to complete Xero authentication: ' . $e->getMessage()
            ], 500);
        }
    }
}
