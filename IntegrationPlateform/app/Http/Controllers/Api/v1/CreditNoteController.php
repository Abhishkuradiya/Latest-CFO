<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Models\TenantCredential;
use App\Repositories\Contracts\CreditNoteRepositoryInterface;
use App\Integrations\Providers\XeroProvider;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CreditNoteController extends Controller
{
    public function __construct(
        protected CreditNoteRepositoryInterface $creditNoteRepo,
        protected XeroProvider $xeroProvider
    ) {}

    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');
        $creditNotes = $this->creditNoteRepo->getByTenant($tenantId);

        $rawCreditNotes = $creditNotes->map(function ($cn) {
            return $cn->raw_data ?: [
                'CreditNoteID' => $cn->external_id,
                'CreditNoteNumber' => $cn->credit_note_number,
                'Total' => (float) $cn->total,
                'DateString' => $cn->date ? $cn->date->format('Y-m-d\T00:00:00') : null,
                'Status' => $cn->status,
                'Type' => $cn->type,
            ];
        })->toArray();

        return response()->json([
            'Id' => \Illuminate\Support\Str::uuid()->toString(),
            'Status' => 'OK',
            'ProviderName' => 'Integration Platform',
            'DateTimeUTC' => '/Date(' . round(microtime(true) * 1000) . ')/',
            'CreditNotes' => $rawCreditNotes
        ]);
    }

    public function downloadPdf(Request $request, string $id)
    {
        $tenantId = $request->attributes->get('tenant_id');
        $credential = TenantCredential::where('tenant_id', $tenantId)
            ->where('provider', 'xero')
            ->first();

        if (!$credential) {
            return response()->json(['error' => 'No Xero credential found.'], 400);
        }

        try {
            $response = $this->xeroProvider->getCreditNoteAsPdf($credential, $id);
            return response($response->body(), 200)
                ->header('Content-Type', 'application/pdf')
                ->header('Content-Disposition', 'attachment; filename="CreditNote_' . $id . '.pdf"');
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}
