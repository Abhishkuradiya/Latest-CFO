<?php

namespace App\Repositories\Eloquent;

use App\Models\Invoice;
use App\Models\Contact;
use App\Repositories\Contracts\InvoiceRepositoryInterface;
use Illuminate\Support\Collection;

class InvoiceRepository implements InvoiceRepositoryInterface
{
    /**
     * Upsert an invoice by external ID. Resolves local contact_id if possible.
     *
     * @param int $tenantId
     * @param array $data
     * @return Invoice
     */
    public function upsertByExternalId(int $tenantId, array $data): Invoice
    {
        if (!empty($data['contact_external_id'])) {
            $contact = Contact::where('tenant_id', $tenantId)
                ->where('external_id', $data['contact_external_id'])
                ->first();
            if ($contact) {
                $data['contact_id'] = $contact->id;
            }
        }

        unset($data['contact_external_id']);

        return Invoice::updateOrCreate(
            [
                'tenant_id' => $tenantId,
                'external_id' => $data['external_id']
            ],
            $data
        );
    }

    /**
     * Get invoices by tenant.
     *
     * @param int $tenantId
     * @param array $filters
     * @return Collection
     */
    public function getByTenant(int $tenantId, array $filters = []): Collection
    {
        $query = Invoice::with('contact')->where('tenant_id', $tenantId);

        if (isset($filters['type'])) {
            $query->where('type', $filters['type']);
        }
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        return $query->get();
    }
}
