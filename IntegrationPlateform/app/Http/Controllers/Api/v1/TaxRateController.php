<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Repositories\Contracts\TaxRateRepositoryInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TaxRateController extends Controller
{
    public function __construct(
        protected TaxRateRepositoryInterface $taxRateRepo
    ) {}

    /**
     * Display a listing of tax rates for the active tenant.
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');
        $taxRates = $this->taxRateRepo->getByTenant($tenantId);

        $formattedTaxRates = $taxRates->map(function ($t) {
            return $t->raw_data ?: [
                'Name' => $t->name,
                'TaxType' => $t->tax_type,
                'CanApplyToAssets' => $t->can_apply_to_assets ? 'true' : 'false',
                'CanApplyToEquity' => $t->can_apply_to_equity ? 'true' : 'false',
                'CanApplyToExpenses' => $t->can_apply_to_expenses ? 'true' : 'false',
                'CanApplyToLiabilities' => $t->can_apply_to_liabilities ? 'true' : 'false',
                'CanApplyToRevenue' => $t->can_apply_to_revenue ? 'true' : 'false',
                'DisplayTaxRate' => number_format($t->display_tax_rate, 4, '.', ''),
                'EffectiveRate' => number_format($t->effective_rate, 4, '.', ''),
                'Status' => $t->status,
                'TaxComponents' => $t->tax_components ?: []
            ];
        });

        return response()->json([
            'TaxRates' => $formattedTaxRates,
            'count' => $formattedTaxRates->count()
        ]);
    }
}
