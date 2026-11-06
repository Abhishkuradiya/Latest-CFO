<?php

namespace App\Repositories\Eloquent;

use App\Integrations\DTOs\XeroUserDTO;
use App\Models\XeroUser;
use App\Repositories\Contracts\XeroUserRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class XeroUserRepository implements XeroUserRepositoryInterface
{
    public function updateOrCreate(int $tenantId, XeroUserDTO $dto): XeroUser
    {
        return XeroUser::updateOrCreate(
            [
                'tenant_id'   => $tenantId,
                'external_id' => $dto->userId,
            ],
            [
                'email'            => $dto->emailAddress,
                'first_name'       => $dto->firstName,
                'last_name'        => $dto->lastName,
                'role'             => $dto->organisationRole,
                'is_subscriber'    => $dto->isSubscriber,
                'updated_date_utc' => $dto->updatedDateUtc,
                'raw_data'         => $dto->rawData,
            ]
        );
    }

    public function getByTenant(int $tenantId): Collection
    {
        return XeroUser::where('tenant_id', $tenantId)
            ->orderBy('first_name', 'asc')
            ->get();
    }
}
