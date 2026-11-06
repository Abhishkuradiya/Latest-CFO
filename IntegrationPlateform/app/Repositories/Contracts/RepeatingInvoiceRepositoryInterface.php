<?php

namespace App\Repositories\Contracts;

use App\Integrations\DTOs\RepeatingInvoiceDTO;
use App\Models\RepeatingInvoice;
use Illuminate\Database\Eloquent\Collection;

interface RepeatingInvoiceRepositoryInterface
{
    public function updateOrCreate(int $tenantId, RepeatingInvoiceDTO $dto): RepeatingInvoice;
    public function getByTenant(int $tenantId): Collection;
}
