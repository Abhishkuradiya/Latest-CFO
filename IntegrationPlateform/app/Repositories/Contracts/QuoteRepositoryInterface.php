<?php

namespace App\Repositories\Contracts;

use App\Integrations\DTOs\QuoteDTO;
use App\Models\Quote;
use Illuminate\Database\Eloquent\Collection;

interface QuoteRepositoryInterface
{
    public function updateOrCreate(int $tenantId, QuoteDTO $dto): Quote;
    public function getByTenant(int $tenantId): Collection;
}
