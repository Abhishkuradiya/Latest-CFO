<?php

namespace App\Repositories\Contracts;

use App\Models\Account;
use Illuminate\Support\Collection;

interface AccountRepositoryInterface
{
    /**
     * Upsert an account by its external ID for a specific tenant.
     *
     * @param int $tenantId
     * @param array $data
     * @return Account
     */
    public function upsertByExternalId(int $tenantId, array $data): Account;

    /**
     * Get all accounts for a specific tenant.
     *
     * @param int $tenantId
     * @param array $filters
     * @return Collection
     */
    public function getByTenant(int $tenantId, array $filters = []): Collection;
}
