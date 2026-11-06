<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Repositories\Contracts\PaymentRepositoryInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function __construct(
        protected PaymentRepositoryInterface $paymentRepo
    ) {}

    /**
     * Display a listing of payments for the active tenant.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');
        $filters = $request->only(['status']);

        $payments = $this->paymentRepo->getByTenant($tenantId, $filters);

        $rawPayments = $payments->map(function ($pay) {
            return $pay->raw_data ?: [
                'PaymentID'    => $pay->external_id,
                'DateString'   => $pay->date,
                'Amount'       => (float) $pay->amount,
                'BankAmount'   => (float) $pay->bank_amount,
                'CurrencyRate' => (float) $pay->currency_rate,
                'PaymentType'  => $pay->payment_type,
                'IsReconciled' => $pay->is_reconciled ? 'true' : 'false',
                'Reference'    => $pay->reference,
                'Status'       => $pay->status,
            ];
        })->toArray();

        return response()->json([
            'Id' => \Illuminate\Support\Str::uuid()->toString(),
            'Status' => 'OK',
            'ProviderName' => 'Integration Platform',
            'DateTimeUTC' => '/Date(' . round(microtime(true) * 1000) . ')/',
            'Payments' => $rawPayments
        ]);
    }
}
