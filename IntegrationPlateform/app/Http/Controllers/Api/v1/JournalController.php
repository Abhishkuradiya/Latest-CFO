<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Repositories\Contracts\JournalRepositoryInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class JournalController extends Controller
{
    public function __construct(
        protected JournalRepositoryInterface $journalRepo
    ) {}

    /**
     * Return all journals for a tenant (from local DB).
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');
        $journals = $this->journalRepo->getByTenant($tenantId);

        $rawJournals = $journals->map(function ($journal) {
            return $journal->raw_data ?: [
                'JournalID'      => $journal->external_id,
                'JournalNumber'  => $journal->journal_number,
                'JournalDate'    => $journal->journal_date?->format('Y-m-d'),
                'CreatedDateUTC' => $journal->created_date_utc?->format('Y-m-d H:i:s'),
                'Reference'      => $journal->reference,
                'SourceID'       => $journal->source_id,
                'SourceType'     => $journal->source_type,
                'JournalLines'   => $journal->journal_lines ?? [],
            ];
        })->toArray();

        return response()->json([
            'Id'           => \Illuminate\Support\Str::uuid()->toString(),
            'Status'       => 'OK',
            'ProviderName' => 'Integration Platform',
            'DateTimeUTC'  => '/Date(' . round(microtime(true) * 1000) . ')/',
            'Journals'     => $rawJournals,
        ]);
    }

    /**
     * Return a single journal with its full JournalLines.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');

        $journal = \App\Models\Journal::where('tenant_id', $tenantId)
            ->where('external_id', $id)
            ->first();

        if (!$journal) {
            return response()->json(['error' => 'Journal not found.'], 404);
        }

        return response()->json([
            'Id'           => \Illuminate\Support\Str::uuid()->toString(),
            'Status'       => 'OK',
            'ProviderName' => 'Integration Platform',
            'DateTimeUTC'  => '/Date(' . round(microtime(true) * 1000) . ')/',
            'Journals'     => [$journal->raw_data ?: [
                'JournalID'     => $journal->external_id,
                'JournalNumber' => $journal->journal_number,
                'JournalDate'   => $journal->journal_date?->format('Y-m-d'),
                'Reference'     => $journal->reference,
                'SourceType'    => $journal->source_type,
                'JournalLines'  => $journal->journal_lines ?? [],
            ]],
        ]);
    }
}
