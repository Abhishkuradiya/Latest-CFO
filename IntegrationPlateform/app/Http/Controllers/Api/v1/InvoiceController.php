<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Repositories\Contracts\InvoiceRepositoryInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InvoiceController extends Controller
{
    public function __construct(
        protected InvoiceRepositoryInterface $invoiceRepo
    ) {}

    /**
     * Display a listing of invoices for the active tenant.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');
        $filters = $request->only(['type', 'status']);

        $invoices = $this->invoiceRepo->getByTenant($tenantId, $filters);

        $rawInvoices = $invoices->map(function ($inv) {
            return $inv->raw_data ?: [
                'InvoiceID' => $inv->external_id,
                'InvoiceNumber' => $inv->invoice_number,
                'Type' => $inv->type,
                'Status' => $inv->status,
                'DateString' => $inv->date,
                'DueDateString' => $inv->due_date,
                'SubTotal' => (float) $inv->sub_total,
                'TaxTotal' => (float) $inv->tax_total,
                'Total' => (float) $inv->total,
                'AmountDue' => (float) $inv->amount_due,
                'AmountPaid' => (float) $inv->amount_paid,
                'CurrencyCode' => $inv->currency_code,
            ];
        })->toArray();

        return response()->json([
            'Id' => \Illuminate\Support\Str::uuid()->toString(),
            'Status' => 'OK',
            'ProviderName' => 'Integration Platform',
            'DateTimeUTC' => '/Date(' . round(microtime(true) * 1000) . ')/',
            'Invoices' => $rawInvoices
        ]);
    }
}
