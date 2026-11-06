<?php

namespace App\Repositories\Contracts;

use App\Models\Payment;
use Illuminate\Support\Collection;

interface PaymentRepositoryInterface
{
    /**
     * Upsert a payment by its external ID for a specific tenant.
     *
     * @param int $tenantId
     * @param array $data
     * @return Payment
     */
    public function upsertByExternalId(int $tenantId, array $data): Payment;

    /**
     * Get all payments for a specific tenant.
     *
     * @param int $tenantId
     * @param array $filters
     * @return Collection
     */
    public function getByTenant(int $tenantId, array $filters = []): Collection;
}
