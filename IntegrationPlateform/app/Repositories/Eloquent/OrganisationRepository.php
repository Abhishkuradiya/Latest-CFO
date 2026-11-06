<?php

namespace App\Repositories\Eloquent;

use App\Integrations\DTOs\OrganisationDTO;
use App\Models\Organisation;
use App\Repositories\Contracts\OrganisationRepositoryInterface;

class OrganisationRepository implements OrganisationRepositoryInterface
{
    public function updateOrCreate(int $tenantId, OrganisationDTO $dto): Organisation
    {
        return Organisation::updateOrCreate(
            [
                'tenant_id'   => $tenantId,
                'external_id' => $dto->organisationId,
            ],
            [
                'name'                     => $dto->name,
                'legal_name'               => $dto->legalName,
                'pays_tax'                 => $dto->paysTax,
                'version'                  => $dto->version,
                'organisation_type'        => $dto->organisationType,
                'base_currency'            => $dto->baseCurrency,
                'country_code'             => $dto->countryCode,
                'is_demo_company'          => $dto->isDemoCompany,
                'organisation_status'      => $dto->organisationStatus,
                'tax_number'               => $dto->taxNumber,
                'financial_year_end_day'   => $dto->financialYearEndDay,
                'financial_year_end_month' => $dto->financialYearEndMonth,
                'sales_tax_basis'          => $dto->salesTaxBasis,
                'sales_tax_period'         => $dto->salesTaxPeriod,
                'timezone'                 => $dto->timezone,
                'edition'                  => $dto->edition,
                'class'                    => $dto->class,
                'addresses'                => $dto->addresses,
                'phones'                   => $dto->phones,
                'external_links'           => $dto->externalLinks,
                'payment_terms'            => $dto->paymentTerms,
                'raw_data'                 => $dto->rawData,
            ]
        );
    }

    public function getByTenant(int $tenantId): ?Organisation
    {
        return Organisation::where('tenant_id', $tenantId)->first();
    }
}
