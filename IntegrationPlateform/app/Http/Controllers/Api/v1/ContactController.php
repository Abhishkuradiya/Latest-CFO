<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Repositories\Contracts\ContactRepositoryInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContactController extends Controller
{
    public function __construct(
        protected ContactRepositoryInterface $contactRepo
    ) {}

    /**
     * Display a listing of contacts for the active tenant.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');
        $filters = $request->only(['is_customer', 'is_supplier']);

        $contacts = $this->contactRepo->getByTenant($tenantId, $filters);

        $rawContacts = $contacts->map(function ($c) {
            return $c->raw_data ?: [
                'ContactID' => $c->external_id,
                'Name' => $c->name,
                'EmailAddress' => $c->email,
                'Phones' => [['PhoneNumber' => $c->phone]],
                'ContactStatus' => $c->status,
                'IsCustomer' => $c->is_customer,
                'IsSupplier' => $c->is_supplier,
            ];
        })->toArray();

        return response()->json([
            'Id' => \Illuminate\Support\Str::uuid()->toString(),
            'Status' => 'OK',
            'ProviderName' => 'Integration Platform',
            'DateTimeUTC' => '/Date(' . round(microtime(true) * 1000) . ')/',
            'Contacts' => $rawContacts
        ]);
    }

    /**
     * Fetch contact groups from the local database.
     */
    public function contactGroups(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');

        $groups = \App\Models\ContactGroup::where('tenant_id', $tenantId)
            ->orderBy('name', 'asc')
            ->get();

        $formattedGroups = $groups->map(function ($g) {
            return $g->raw_data ?: [
                'ContactGroupID' => $g->external_id,
                'Name'           => $g->name,
                'Status'         => $g->status,
                'Contacts'       => [],
            ];
        });

        return response()->json([
            'status' => 'success',
            'data'   => [
                'ContactGroups' => $formattedGroups,
                'count'         => $formattedGroups->count()
            ],
        ]);
    }
}
