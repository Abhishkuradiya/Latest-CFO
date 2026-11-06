<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Repositories\Contracts\OrganisationRepositoryInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrganisationController extends Controller
{
    public function __construct(
        protected OrganisationRepositoryInterface $organisationRepo
    ) {}

    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');
        $org = $this->organisationRepo->getByTenant($tenantId);

        if (!$org) {
            return response()->json([
                'Id'           => \Illuminate\Support\Str::uuid()->toString(),
                'Status'       => 'OK',
                'ProviderName' => 'Integration Platform',
                'DateTimeUTC'  => '/Date(' . round(microtime(true) * 1000) . ')/',
                'Organisations' => []
            ]);
        }

        $rawOrg = $org->raw_data ?: [
            'OrganisationID'      => $org->external_id,
            'Name'                 => $org->name,
            'LegalName'            => $org->legal_name,
            'PaysTax'              => $org->pays_tax,
            'Version'              => $org->version,
            'OrganisationType'     => $org->organisation_type,
            'BaseCurrency'         => $org->base_currency,
            'CountryCode'          => $org->country_code,
            'IsDemoCompany'        => $org->is_demo_company,
            'OrganisationStatus'   => $org->organisation_status,
            'TaxNumber'            => $org->tax_number,
            'FinancialYearEndDay'  => $org->financial_year_end_day,
            'FinancialYearEndMonth'=> $org->financial_year_end_month,
            'SalesTaxBasis'        => $org->sales_tax_basis,
            'SalesTaxPeriod'       => $org->sales_tax_period,
            'Timezone'             => $org->timezone,
            'Edition'              => $org->edition,
            'Class'                => $org->class,
            'Addresses'            => $org->addresses ?? [],
            'Phones'               => $org->phones ?? [],
            'ExternalLinks'        => $org->external_links ?? [],
            'PaymentTerms'         => $org->payment_terms ?? [],
        ];

        return response()->json([
            'Id'            => \Illuminate\Support\Str::uuid()->toString(),
            'Status'        => 'OK',
            'ProviderName'  => 'Integration Platform',
            'DateTimeUTC'   => '/Date(' . round(microtime(true) * 1000) . ')/',
            'Organisations' => [$rawOrg],
        ]);
    }
}
