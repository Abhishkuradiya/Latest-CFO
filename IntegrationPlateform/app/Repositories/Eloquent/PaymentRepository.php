<?php

namespace App\Repositories\Eloquent;

use App\Models\Payment;
use App\Models\Invoice;
use App\Repositories\Contracts\PaymentRepositoryInterface;
use Illuminate\Support\Collection;

class PaymentRepository implements PaymentRepositoryInterface
{
    /**
     * Upsert a payment by external ID. Resolves local invoice_id if possible.
     *
     * @param int $tenantId
     * @param array $data
     * @return Payment
     */
    public function upsertByExternalId(int $tenantId, array $data): Payment
    {
        if (!empty($data['invoice_external_id'])) {
            $invoice = Invoice::where('tenant_id', $tenantId)
                ->where('external_id', $data['invoice_external_id'])
                ->first();
            if ($invoice) {
                $data['invoice_id'] = $invoice->id;
            }
        }

        unset($data['invoice_external_id']);

        return Payment::updateOrCreate(
            [
                'tenant_id' => $tenantId,
                'external_id' => $data['external_id']
            ],
            $data
        );
    }

    /**
     * Get payments by tenant.
     *
     * @param int $tenantId
     * @param array $filters
     * @return Collection
     */
    public function getByTenant(int $tenantId, array $filters = []): Collection
    {
        $query = Payment::with('invoice')->where('tenant_id', $tenantId);

        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        return $query->get();
    }
}
