<?php

namespace App\Integrations\Mappers;

use App\Integrations\DTOs\ContactDTO;

class ContactMapper
{
    /**
     * Map Xero contact array to ContactDTO.
     *
     * @param array $data
     * @return ContactDTO
     */
    public static function toDTO(array $data): ContactDTO
    {
        $phone = null;
        if (!empty($data['Phones'])) {
            foreach ($data['Phones'] as $p) {
                if (!empty($p['PhoneNumber'])) {
                    $phone = trim(($p['PhoneAreaCode'] ?? '') . ' ' . $p['PhoneNumber']);
                    break;
                }
            }
        }

        $address = null;
        if (!empty($data['Addresses'])) {
            foreach ($data['Addresses'] as $addr) {
                if (!empty($addr['AddressLine1']) || !empty($addr['City'])) {
                    $parts = array_filter([
                        $addr['AddressLine1'] ?? null,
                        $addr['AddressLine2'] ?? null,
                        $addr['City'] ?? null,
                        $addr['Region'] ?? null,
                        $addr['PostalCode'] ?? null,
                        $addr['Country'] ?? null,
                    ]);
                    // Combine into a single comma-separated string
                    $address = implode(', ', array_map('trim', $parts));
                    // Break on the first valid address we find (usually POBOX or STREET)
                    break;
                }
            }
        }

        return new ContactDTO(
            externalId: $data['ContactID'],
            name: $data['Name'],
            email: $data['EmailAddress'] ?? null,
            phone: $phone,
            address: $address,
            status: $data['ContactStatus'] ?? 'ACTIVE',
            isCustomer: $data['IsCustomer'] ?? true,
            isSupplier: $data['IsSupplier'] ?? false,
            rawData: $data
        );
    }
}
