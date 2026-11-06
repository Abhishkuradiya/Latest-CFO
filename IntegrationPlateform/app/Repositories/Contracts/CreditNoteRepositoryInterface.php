<?php

namespace App\Repositories\Contracts;

use App\Integrations\DTOs\CreditNoteDTO;
use App\Models\CreditNote;
use Illuminate\Database\Eloquent\Collection;

interface CreditNoteRepositoryInterface
{
    /**
     * @param int $tenantId
     * @param CreditNoteDTO $dto
     * @return CreditNote
     */
    public function updateOrCreate(int $tenantId, CreditNoteDTO $dto): CreditNote;

    /**
     * @param int $tenantId
     * @return Collection
     */
    public function getByTenant(int $tenantId): Collection;
}