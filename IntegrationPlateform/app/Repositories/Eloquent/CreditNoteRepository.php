<?php

namespace App\Repositories\Eloquent;

use App\Integrations\DTOs\CreditNoteDTO;
use App\Models\CreditNote;
use App\Repositories\Contracts\CreditNoteRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class CreditNoteRepository implements CreditNoteRepositoryInterface
{
    public function updateOrCreate(int $tenantId, CreditNoteDTO $dto): CreditNote
    {
        return CreditNote::updateOrCreate(
            [
                'tenant_id' => $tenantId,
                'external_id' => $dto->creditNoteId,
            ],
            [
                'credit_note_number' => $dto->creditNoteNumber,
                'date' => $dto->date,
                'total' => $dto->total,
                'status' => $dto->status,
                'type' => $dto->type,
                'raw_data' => $dto->rawData,
            ]
        );
    }

    public function getByTenant(int $tenantId): Collection
    {
        return CreditNote::where('tenant_id', $tenantId)
            ->orderBy('date', 'desc')
            ->get();
    }
}