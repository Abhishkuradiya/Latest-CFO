<?php

namespace App\Integrations\Mappers;

use App\Integrations\DTOs\OrganisationDTO;

class OrganisationMapper
{
    public static function toDTO(array $data): OrganisationDTO
    {
        return new OrganisationDTO(
            organisationId:       $data['OrganisationID'],
            name:                 $data['Name'] ?? null,
            legalName:            $data['LegalName'] ?? null,
            paysTax:              isset($data['PaysTax']) ? (bool) $data['PaysTax'] : false,
            version:              $data['Version'] ?? null,
            organisationType:     $data['OrganisationType'] ?? null,
            baseCurrency:         $data['BaseCurrency'] ?? null,
            countryCode:          $data['CountryCode'] ?? null,
            isDemoCompany:        isset($data['IsDemoCompany']) ? (bool) $data['IsDemoCompany'] : false,
            organisationStatus:   $data['OrganisationStatus'] ?? null,
            taxNumber:            $data['TaxNumber'] ?? null,
            financialYearEndDay:  isset($data['FinancialYearEndDay']) ? (int) $data['FinancialYearEndDay'] : null,
            financialYearEndMonth:isset($data['FinancialYearEndMonth']) ? (int) $data['FinancialYearEndMonth'] : null,
            salesTaxBasis:        $data['SalesTaxBasis'] ?? null,
            salesTaxPeriod:       $data['SalesTaxPeriod'] ?? null,
            timezone:             $data['Timezone'] ?? null,
            edition:              $data['Edition'] ?? null,
            class:                $data['Class'] ?? null,
            addresses:            $data['Addresses'] ?? [],
            phones:               $data['Phones'] ?? [],
            externalLinks:        $data['ExternalLinks'] ?? [],
            paymentTerms:         $data['PaymentTerms'] ?? [],
            rawData:              $data
        );
    }
}
