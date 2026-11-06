<?php

namespace App\Repositories\Eloquent;

use App\Integrations\DTOs\LinkedTransactionDTO;
use App\Models\LinkedTransaction;
use App\Repositories\Contracts\LinkedTransactionRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class LinkedTransactionRepository implements LinkedTransactionRepositoryInterface
{
    public function updateOrCreate(int $tenantId, LinkedTransactionDTO $dto): LinkedTransaction
    {
        return LinkedTransaction::updateOrCreate(
            [
                'tenant_id'   => $tenantId,
                'external_id' => $dto->linkedTransactionId,
            ],
            [
                'source_transaction_id'        => $dto->sourceTransactionId,
                'source_line_item_id'          => $dto->sourceLineItemId,
                'contact_id'                   => $dto->contactId,
                'target_transaction_id'        => $dto->targetTransactionId,
                'target_line_item_id'          => $dto->targetLineItemId,
                'status'                       => $dto->status,
                'type'                         => $dto->type,
                'source_transaction_type_code' => $dto->sourceTransactionTypeCode,
                'updated_date_utc'             => $dto->updatedDateUtc,
                'raw_data'                     => $dto->rawData,
            ]
        );
    }

    public function getByTenant(int $tenantId): Collection
    {
        return LinkedTransaction::where('tenant_id', $tenantId)
            ->orderBy('updated_date_utc', 'desc')
            ->get();
    }
}
