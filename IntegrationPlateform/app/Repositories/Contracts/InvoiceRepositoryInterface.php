<?php

namespace App\Repositories\Contracts;

use App\Models\Invoice;
use Illuminate\Support\Collection;

interface InvoiceRepositoryInterface
{
    /**
     * Upsert an invoice by its external ID for a specific tenant.
     *
     * @param int $tenantId
     * @param array $data
     * @return Invoice
     */
    public function upsertByExternalId(int $tenantId, array $data): Invoice;

    /**
     * Get all invoices for a specific tenant.
     *
     * @param int $tenantId
     * @param array $filters
     * @return Collection
     */
    public function getByTenant(int $tenantId, array $filters = []): Collection;
}
