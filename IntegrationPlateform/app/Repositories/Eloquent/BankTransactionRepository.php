<?php

namespace App\Repositories\Eloquent;

use App\Models\BankTransaction;
use App\Repositories\Contracts\BankTransactionRepositoryInterface;
use Illuminate\Support\Collection;

class BankTransactionRepository implements BankTransactionRepositoryInterface
{
    /**
     * Upsert a bank transaction by external ID.
     *
     * @param int $tenantId
     * @param array $data
     * @return BankTransaction
     */
    public function upsertByExternalId(int $tenantId, array $data): BankTransaction
    {
        return BankTransaction::updateOrCreate(
            [
                'tenant_id' => $tenantId,
                'external_id' => $data['external_id']
            ],
            $data
        );
    }

    /**
     * Get bank transactions by tenant.
     *
     * @param int $tenantId
     * @param array $filters
     * @return Collection
     */
    public function getByTenant(int $tenantId, array $filters = []): Collection
    {
        $query = BankTransaction::where('tenant_id', $tenantId);

        if (isset($filters['type'])) {
            $query->where('type', $filters['type']);
        }

        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        return $query->get();
    }
}
