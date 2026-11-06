<?php

namespace App\Integrations\DTOs;

class OrganisationDTO
{
    public function __construct(
        public readonly string  $organisationId,
        public readonly ?string $name,
        public readonly ?string $legalName,
        public readonly bool    $paysTax,
        public readonly ?string $version,
        public readonly ?string $organisationType,
        public readonly ?string $baseCurrency,
        public readonly ?string $countryCode,
        public readonly bool    $isDemoCompany,
        public readonly ?string $organisationStatus,
        public readonly ?string $taxNumber,
        public readonly ?int    $financialYearEndDay,
        public readonly ?int    $financialYearEndMonth,
        public readonly ?string $salesTaxBasis,
        public readonly ?string $salesTaxPeriod,
        public readonly ?string $timezone,
        public readonly ?string $edition,
        public readonly ?string $class,
        public readonly array   $addresses,
        public readonly array   $phones,
        public readonly array   $externalLinks,
        public readonly array   $paymentTerms,
        public readonly array   $rawData = []
    ) {}

    public function toArray(): array
    {
        return [
            'external_id'              => $this->organisationId,
            'name'                     => $this->name,
            'legal_name'               => $this->legalName,
            'pays_tax'                 => $this->paysTax,
            'version'                  => $this->version,
            'organisation_type'        => $this->organisationType,
            'base_currency'            => $this->baseCurrency,
            'country_code'             => $this->countryCode,
            'is_demo_company'          => $this->isDemoCompany,
            'organisation_status'      => $this->organisationStatus,
            'tax_number'               => $this->taxNumber,
            'financial_year_end_day'   => $this->financialYearEndDay,
            'financial_year_end_month' => $this->financialYearEndMonth,
            'sales_tax_basis'          => $this->salesTaxBasis,
            'sales_tax_period'         => $this->salesTaxPeriod,
            'timezone'                 => $this->timezone,
            'edition'                  => $this->edition,
            'class'                    => $this->class,
            'addresses'                => $this->addresses,
            'phones'                   => $this->phones,
            'external_links'           => $this->externalLinks,
            'payment_terms'            => $this->paymentTerms,
            'raw_data'                 => $this->rawData,
        ];
    }
}
