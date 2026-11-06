<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Repositories\Contracts\XeroUserRepositoryInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class XeroUserController extends Controller
{
    public function __construct(
        protected XeroUserRepositoryInterface $xeroUserRepo
    ) {}

    /**
     * Display a listing of organization users for the active tenant.
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');
        $users = $this->xeroUserRepo->getByTenant($tenantId);

        $formattedUsers = $users->map(function ($u) {
            return $u->raw_data ?: [
                'UserID' => $u->external_id,
                'EmailAddress' => $u->email,
                'FirstName' => $u->first_name,
                'LastName' => $u->last_name,
                'OrganisationRole' => $u->role,
                'IsSubscriber' => $u->is_subscriber,
                'UpdatedDateUTC' => $u->updated_date_utc
            ];
        });

        return response()->json([
            'Users' => $formattedUsers,
            'count' => $formattedUsers->count()
        ]);
    }
}
