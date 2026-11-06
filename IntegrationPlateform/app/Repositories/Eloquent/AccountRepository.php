<?php

namespace App\Repositories\Eloquent;

use App\Models\Account;
use App\Repositories\Contracts\AccountRepositoryInterface;
use Illuminate\Support\Collection;

class AccountRepository implements AccountRepositoryInterface
{
    /**
     * Upsert an account by external ID.
     *
     * @param int $tenantId
     * @param array $data
     * @return Account
     */
    public function upsertByExternalId(int $tenantId, array $data): Account
    {
        return Account::updateOrCreate(
            [
                'tenant_id' => $tenantId,
                'external_id' => $data['external_id']
            ],
            $data
        );
    }

    /**
     * Get accounts by tenant.
     *
     * @param int $tenantId
     * @param array $filters
     * @return Collection
     */
    public function getByTenant(int $tenantId, array $filters = []): Collection
    {
        $query = Account::where('tenant_id', $tenantId);

        if (isset($filters['type'])) {
            $query->where('type', $filters['type']);
        }
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        return $query->get();
    }
}
