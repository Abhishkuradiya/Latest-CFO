<?php

namespace App\Repositories\Contracts;

use App\Integrations\DTOs\JournalDTO;
use App\Models\Journal;
use Illuminate\Database\Eloquent\Collection;

interface JournalRepositoryInterface
{
    /**
     * Upsert a journal from the given DTO.
     */
    public function updateOrCreate(int $tenantId, JournalDTO $dto): Journal;

    /**
     * Get all journals for a tenant, ordered newest first.
     */
    public function getByTenant(int $tenantId): Collection;

    /**
     * Get the highest synced JournalNumber for offset-based pagination.
     * Returns 0 if no journals have been synced yet (start from beginning).
     */
    public function getMaxJournalNumber(int $tenantId): int;
}
