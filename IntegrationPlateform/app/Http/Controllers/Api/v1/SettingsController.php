<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Models\BrandingTheme;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    /**
     * Fetch branding themes and their payment services from local database.
     */
    public function brandingThemes(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');

        $themes = BrandingTheme::with('paymentServices')
            ->where('tenant_id', $tenantId)
            ->orderBy('sort_order', 'asc')
            ->get();

        $formattedThemes = $themes->map(function ($t) {
            $data = $t->raw_data ?: [
                'BrandingThemeID'  => $t->external_id,
                'Name'             => $t->name,
                'Type'             => $t->type,
                'LogoUrl'          => $t->logo_url,
                'SortOrder'        => $t->sort_order,
                'CreatedDateUTC'   => $t->created_date_utc,
            ];

            // Embed mapped payment services
            $data['PaymentServices'] = $t->paymentServices->map(function ($s) {
                return $s->raw_data ?: [
                    'PaymentServiceID'   => $s->external_id,
                    'PaymentServiceName' => $s->name,
                    'PaymentServiceUrl'  => $s->url,
                    'PayNowText'         => $s->pay_now_text,
                    'PaymentServiceType' => $s->type,
                ];
            });

            return $data;
        });

        return response()->json([
            'status' => 'success',
            'data'   => [
                'BrandingThemes' => $formattedThemes,
                'count'          => $formattedThemes->count()
            ],
        ]);
    }

    public function currencies(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');
        
        $currencies = \App\Models\Currency::where('tenant_id', $tenantId)
            ->orderBy('code', 'asc')
            ->get();

        $formattedCurrencies = $currencies->map(function ($c) {
            return $c->raw_data ?: [
                'Code' => $c->code,
                'Description' => $c->description,
            ];
        });

        return response()->json([
            'Id' => \Illuminate\Support\Str::uuid()->toString(),
            'Status' => 'OK',
            'ProviderName' => 'Integration Platform',
            'DateTimeUTC' => '/Date(' . round(microtime(true) * 1000) . ')/',
            'Currencies' => $formattedCurrencies
        ]);
    }

    public function addCurrency(Request $request): JsonResponse
    {
        $request->validate([
            'Code' => 'required|string|size:3',
            'Description' => 'nullable|string',
        ]);

        $tenantId = $request->attributes->get('tenant_id');
        $credential = \App\Models\TenantCredential::where('tenant_id', $tenantId)
            ->where('provider', 'xero')
            ->first();

        if (!$credential) {
            return response()->json(['error' => 'No Xero credential found.'], 400);
        }

        try {
            $provider = app(\App\Integrations\AccountingProviderFactory::class)->get('xero');
            $response = $provider->addCurrency($credential, $request->input('Code'), $request->input('Description'));

            // It usually takes a moment, but we can also immediately store it locally
            \App\Models\Currency::updateOrCreate(
                ['tenant_id' => $tenantId, 'code' => $request->input('Code')],
                [
                    'description' => $request->input('Description'),
                    'raw_data' => $response['Currencies'][0] ?? ['Code' => $request->input('Code'), 'Description' => $request->input('Description')]
                ]
            );

            return response()->json([
                'status' => 'success',
                'message' => 'Currency added successfully.',
                'data' => $response
            ], 201);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}
