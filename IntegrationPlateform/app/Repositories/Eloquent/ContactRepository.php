<?php

namespace App\Repositories\Eloquent;

use App\Models\Contact;
use App\Repositories\Contracts\ContactRepositoryInterface;
use Illuminate\Support\Collection;

class ContactRepository implements ContactRepositoryInterface
{
    /**
     * Upsert a contact by external ID.
     *
     * @param int $tenantId
     * @param array $data
     * @return Contact
     */
    public function upsertByExternalId(int $tenantId, array $data): Contact
    {
        return Contact::updateOrCreate(
            [
                'tenant_id' => $tenantId,
                'external_id' => $data['external_id']
            ],
            $data
        );
    }

    /**
     * Fetch contacts for a tenant.
     *
     * @param int $tenantId
     * @param array $filters
     * @return Collection
     */
    public function getByTenant(int $tenantId, array $filters = []): Collection
    {
        $query = Contact::where('tenant_id', $tenantId);
        
        if (isset($filters['is_customer'])) {
            $query->where('is_customer', (bool) $filters['is_customer']);
        }
        if (isset($filters['is_supplier'])) {
            $query->where('is_supplier', (bool) $filters['is_supplier']);
        }

        return $query->get();
    }
}
