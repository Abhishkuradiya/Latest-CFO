<?php

namespace App\Repositories\Contracts;

use App\Integrations\DTOs\OrganisationDTO;
use App\Models\Organisation;

interface OrganisationRepositoryInterface
{
    public function updateOrCreate(int $tenantId, OrganisationDTO $dto): Organisation;
    public function getByTenant(int $tenantId): ?Organisation;
}
