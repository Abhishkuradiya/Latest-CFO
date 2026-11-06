<?php

namespace App\Repositories\Eloquent;

use App\Integrations\DTOs\JournalDTO;
use App\Models\Journal;
use App\Repositories\Contracts\JournalRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class JournalRepository implements JournalRepositoryInterface
{
    public function updateOrCreate(int $tenantId, JournalDTO $dto): Journal
    {
        return Journal::updateOrCreate(
            [
                'tenant_id'   => $tenantId,
                'external_id' => $dto->journalId,
            ],
            [
                'journal_number'   => $dto->journalNumber,
                'journal_date'     => $dto->journalDate,
                'created_date_utc' => $dto->createdDateUtc,
                'reference'        => $dto->reference,
                'source_id'        => $dto->sourceId,
                'source_type'      => $dto->sourceType,
                'journal_lines'    => $dto->journalLines,
                'raw_data'         => $dto->rawData,
            ]
        );
    }

    public function getByTenant(int $tenantId): Collection
    {
        return Journal::where('tenant_id', $tenantId)
            ->orderBy('journal_number', 'desc')
            ->get();
    }

    public function getMaxJournalNumber(int $tenantId): int
    {
        return (int) Journal::where('tenant_id', $tenantId)
            ->max('journal_number') ?? 0;
    }
}
