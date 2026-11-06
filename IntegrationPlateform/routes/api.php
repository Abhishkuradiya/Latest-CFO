<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\v1\ContactController;
use App\Http\Controllers\Api\v1\InvoiceController;
use App\Http\Controllers\Api\v1\PaymentController;
use App\Http\Controllers\Api\v1\AccountController;
use App\Http\Controllers\Api\v1\BankTransactionController;
use App\Http\Controllers\Api\v1\ReportController;
use App\Http\Controllers\Api\v1\AttachmentController;
use App\Http\Controllers\Api\v1\SettingsController;
use App\Http\Controllers\Api\v1\CreditNoteController;
use App\Http\Controllers\Api\v1\ItemController;
use App\Http\Controllers\Api\v1\JournalController;
use App\Http\Controllers\Api\v1\ManualJournalController;
use App\Http\Controllers\Api\v1\LinkedTransactionController;
use App\Http\Controllers\Api\v1\OrganisationController;
use App\Http\Controllers\Api\v1\OverpaymentController;
use App\Http\Controllers\Api\v1\PrepaymentController;
use App\Http\Controllers\Api\v1\PurchaseOrderController;
use App\Http\Controllers\Api\v1\QuoteController;
use App\Http\Controllers\Api\v1\RepeatingInvoiceController;

use App\Http\Controllers\DashboardSyncController;

Route::middleware('tenant')->group(function () {
    Route::get('/contacts', [ContactController::class, 'index']);
    Route::get('/contact-groups', [ContactController::class, 'contactGroups']);
    Route::get('/invoices', [InvoiceController::class, 'index']);
    Route::get('/payments', [PaymentController::class, 'index']);
    Route::get('/accounts', [AccountController::class, 'index']);
    Route::get('/bank-transactions', [BankTransactionController::class, 'index']);
    Route::get('/bank-statements', [BankTransactionController::class, 'statements']);
    Route::get('/bank-transfers', [BankTransactionController::class, 'transfers']);
    Route::get('/batch-payments', [BankTransactionController::class, 'batchPayments']);
    Route::get('/credit-notes', [CreditNoteController::class, 'index']);
    Route::get('/credit-notes/{id}/pdf', [CreditNoteController::class, 'downloadPdf']);
    Route::get('/items', [ItemController::class, 'index']);
    Route::get('/journals', [JournalController::class, 'index']);
    Route::get('/journals/{id}', [JournalController::class, 'show']);
    Route::get('/manual-journals', [ManualJournalController::class, 'index']);
    Route::get('/manual-journals/{id}', [ManualJournalController::class, 'show']);
    Route::get('/linked-transactions', [LinkedTransactionController::class, 'index']);
    Route::get('/organisation', [OrganisationController::class, 'index']);
    Route::get('/overpayments', [OverpaymentController::class, 'index']);
    Route::get('/prepayments', [PrepaymentController::class, 'index']);
    Route::get('/purchase-orders', [PurchaseOrderController::class, 'index']);
    Route::get('/quotes', [QuoteController::class, 'index']);
    Route::get('/repeating-invoices', [RepeatingInvoiceController::class, 'index']);
    Route::get('/tax-rates', [\App\Http\Controllers\Api\v1\TaxRateController::class, 'index']);
    Route::get('/users', [\App\Http\Controllers\Api\v1\XeroUserController::class, 'index']);
    Route::get('/reports/profit-loss', [ReportController::class, 'profitLoss']);
    Route::get('/reports/aged-payables', [ReportController::class, 'agedPayablesByContact']);
    Route::get('/reports/aged-receivables', [ReportController::class, 'agedReceivablesByContact']);
    Route::get('/reports/balance-sheet', [ReportController::class, 'balanceSheet']);
    Route::get('/reports/bank-summary', [ReportController::class, 'bankSummary']);
    Route::get('/reports/trial-balance', [ReportController::class, 'trialBalance']);
    Route::get('/budgets', [ReportController::class, 'budgets']);
    Route::get('/branding-themes', [SettingsController::class, 'brandingThemes']);
    Route::get('/currencies', [SettingsController::class, 'currencies']);
    Route::post('/currencies', [SettingsController::class, 'addCurrency']);

    // Attachments
    Route::get('/attachments/{endpoint}/{guid}', [AttachmentController::class, 'index']);
    Route::get('/attachments/{endpoint}/{guid}/{filename}', [AttachmentController::class, 'download']);
    Route::post('/attachments/{endpoint}/{guid}', [AttachmentController::class, 'upload']);
});

// Sync route (outside tenant middleware to accept tenant_id from request)
Route::post('/sync/{tenant_id}', [DashboardSyncController::class, 'sync']);
