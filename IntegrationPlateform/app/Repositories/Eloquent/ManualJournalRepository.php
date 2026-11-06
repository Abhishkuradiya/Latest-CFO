<?php

namespace App\Repositories\Eloquent;

use App\Integrations\DTOs\ManualJournalDTO;
use App\Models\ManualJournal;
use App\Repositories\Contracts\ManualJournalRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class ManualJournalRepository implements ManualJournalRepositoryInterface
{
    public function updateOrCreate(int $tenantId, ManualJournalDTO $dto): ManualJournal
    {
        return ManualJournal::updateOrCreate(
            [
                'tenant_id'   => $tenantId,
                'external_id' => $dto->manualJournalId,
            ],
            [
                'date'              => $dto->date,
                'status'            => $dto->status,
                'narration'         => $dto->narration,
                'line_amount_types' => $dto->lineAmountTypes,
                'journal_lines'     => $dto->journalLines,
                'raw_data'          => $dto->rawData,
            ]
        );
    }

    public function getByTenant(int $tenantId): Collection
    {
        return ManualJournal::where('tenant_id', $tenantId)
            ->orderBy('date', 'desc')
            ->get();
    }
}
