<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Repositories\Contracts\QuoteRepositoryInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QuoteController extends Controller
{
    public function __construct(
        protected QuoteRepositoryInterface $quoteRepo
    ) {}

    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');
        $quotes = $this->quoteRepo->getByTenant($tenantId);

        $rawQuotes = $quotes->map(function ($item) {
            return $item->raw_data ?: [
                'QuoteID'           => $item->external_id,
                'QuoteNumber'       => $item->quote_number,
                'Reference'         => $item->reference,
                'Title'             => $item->title,
                'Summary'           => $item->summary,
                'Terms'             => $item->terms,
                'Date'              => $item->date?->format('Y-m-d'),
                'ExpiryDate'        => $item->expiry_date?->format('Y-m-d'),
                'Status'            => $item->status,
                'CurrencyCode'      => $item->currency_code,
                'CurrencyRate'      => (float) $item->currency_rate,
                'SubTotal'          => (float) $item->sub_total,
                'TotalTax'          => (float) $item->total_tax,
                'Total'             => (float) $item->total,
                'TotalDiscount'     => (float) $item->total_discount,
                'LineAmountTypes'   => $item->line_amount_types,
                'Contact'           => [
                    'ContactID' => $item->contact_id,
                    'Name'      => $item->contact_name,
                ],
                'LineItems'         => $item->line_items ?? [],
            ];
        })->toArray();

        return response()->json([
            'Id'           => \Illuminate\Support\Str::uuid()->toString(),
            'Status'       => 'OK',
            'ProviderName' => 'Integration Platform',
            'DateTimeUTC'  => '/Date(' . round(microtime(true) * 1000) . ')/',
            'Quotes'       => $rawQuotes,
        ]);
    }
}
