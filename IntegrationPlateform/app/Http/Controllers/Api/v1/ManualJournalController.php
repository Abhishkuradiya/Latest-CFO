<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Repositories\Contracts\ManualJournalRepositoryInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ManualJournalController extends Controller
{
    public function __construct(
        protected ManualJournalRepositoryInterface $manualJournalRepo
    ) {}

    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');
        $journals = $this->manualJournalRepo->getByTenant($tenantId);

        $rawJournals = $journals->map(function ($mj) {
            return $mj->raw_data ?: [
                'ManualJournalID'   => $mj->external_id,
                'Date'              => $mj->date?->format('Y-m-d'),
                'Status'            => $mj->status,
                'Narration'         => $mj->narration,
                'LineAmountTypes'   => $mj->line_amount_types,
                'JournalLines'      => $mj->journal_lines ?? [],
            ];
        })->toArray();

        return response()->json([
            'Id'             => \Illuminate\Support\Str::uuid()->toString(),
            'Status'         => 'OK',
            'ProviderName'   => 'Integration Platform',
            'DateTimeUTC'    => '/Date(' . round(microtime(true) * 1000) . ')/',
            'ManualJournals' => $rawJournals,
        ]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');

        $mj = \App\Models\ManualJournal::where('tenant_id', $tenantId)
            ->where('external_id', $id)
            ->first();

        if (!$mj) {
            return response()->json(['error' => 'Manual journal not found.'], 404);
        }

        return response()->json([
            'Id'             => \Illuminate\Support\Str::uuid()->toString(),
            'Status'         => 'OK',
            'ProviderName'   => 'Integration Platform',
            'DateTimeUTC'    => '/Date(' . round(microtime(true) * 1000) . ')/',
            'ManualJournals' => [$mj->raw_data ?: [
                'ManualJournalID' => $mj->external_id,
                'Date'            => $mj->date?->format('Y-m-d'),
                'Status'          => $mj->status,
                'Narration'       => $mj->narration,
                'LineAmountTypes' => $mj->line_amount_types,
                'JournalLines'    => $mj->journal_lines ?? [],
            ]],
        ]);
    }
}
