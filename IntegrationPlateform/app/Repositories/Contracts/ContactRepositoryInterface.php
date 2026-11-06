<?php

namespace App\Repositories\Contracts;

use App\Models\Contact;
use Illuminate\Support\Collection;

interface ContactRepositoryInterface
{
    /**
     * Upsert a contact by its external ID for a specific tenant.
     *
     * @param int $tenantId
     * @param array $data
     * @return Contact
     */
    public function upsertByExternalId(int $tenantId, array $data): Contact;

    /**
     * Get all contacts for a specific tenant.
     *
     * @param int $tenantId
     * @param array $filters
     * @return Collection
     */
    public function getByTenant(int $tenantId, array $filters = []): Collection;
}
