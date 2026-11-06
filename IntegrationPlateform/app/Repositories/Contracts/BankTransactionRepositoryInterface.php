<?php

namespace App\Repositories\Contracts;

use App\Models\BankTransaction;
use Illuminate\Support\Collection;

interface BankTransactionRepositoryInterface
{
    /**
     * Upsert a bank transaction by its external ID for a specific tenant.
     *
     * @param int $tenantId
     * @param array $data
     * @return BankTransaction
     */
    public function upsertByExternalId(int $tenantId, array $data): BankTransaction;

    /**
     * Get all bank transactions for a specific tenant.
     *
     * @param int $tenantId
     * @param array $filters
     * @return Collection
     */
    public function getByTenant(int $tenantId, array $filters = []): Collection;
}
