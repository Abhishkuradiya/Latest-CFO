<?php

namespace App\Repositories\Contracts;

use App\Integrations\DTOs\XeroUserDTO;
use App\Models\XeroUser;
use Illuminate\Database\Eloquent\Collection;

interface XeroUserRepositoryInterface
{
    public function updateOrCreate(int $tenantId, XeroUserDTO $dto): XeroUser;
    public function getByTenant(int $tenantId): Collection;
}
