<?php

namespace App\Repositories\Contracts;

use App\Integrations\DTOs\ManualJournalDTO;
use App\Models\ManualJournal;
use Illuminate\Database\Eloquent\Collection;

interface ManualJournalRepositoryInterface
{
    public function updateOrCreate(int $tenantId, ManualJournalDTO $dto): ManualJournal;
    public function getByTenant(int $tenantId): Collection;
}
