<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Repositories\Contracts\RepeatingInvoiceRepositoryInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RepeatingInvoiceController extends Controller
{
    public function __construct(
        protected RepeatingInvoiceRepositoryInterface $repeatingInvoiceRepo
    ) {}

    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');
        $repeatingInvoices = $this->repeatingInvoiceRepo->getByTenant($tenantId);

        $rawRepeatingInvoices = $repeatingInvoices->map(function ($item) {
            return $item->raw_data ?: [
                'RepeatingInvoiceID'   => $item->external_id,
                'ID'                   => $item->external_id,
                'Type'                 => $item->type,
                'Reference'            => $item->reference,
                'Status'               => $item->status,
                'LineAmountTypes'      => $item->line_amount_types,
                'SubTotal'             => (float) $item->sub_total,
                'TotalTax'             => (float) $item->total_tax,
                'Total'                => (float) $item->total,
                'CurrencyCode'         => $item->currency_code,
                'Contact'              => [
                    'ContactID' => $item->contact_id,
                    'Name'      => $item->contact_name,
                ],
                'HasAttachments'       => $item->has_attachments,
                'ApprovedForSending'   => $item->approved_for_sending,
                'SendCopy'             => $item->send_copy,
                'MarkAsSent'           => $item->mark_as_sent,
                'IncludePDF'           => $item->include_pdf,
                'Schedule'             => $item->schedule ?: [],
                'LineItems'            => $item->line_items ?? [],
            ];
        })->toArray();

        return response()->json([
            'Id'                => \Illuminate\Support\Str::uuid()->toString(),
            'Status'            => 'OK',
            'ProviderName'      => 'Integration Platform',
            'DateTimeUTC'       => '/Date(' . round(microtime(true) * 1000) . ')/',
            'RepeatingInvoices' => $rawRepeatingInvoices,
        ]);
    }
}
