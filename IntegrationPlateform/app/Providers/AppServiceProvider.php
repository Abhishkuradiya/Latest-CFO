<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(
            \App\Repositories\Contracts\ContactRepositoryInterface::class,
            \App\Repositories\Eloquent\ContactRepository::class
        );
        $this->app->bind(
            \App\Repositories\Contracts\InvoiceRepositoryInterface::class,
            \App\Repositories\Eloquent\InvoiceRepository::class
        );
        $this->app->bind(
            \App\Repositories\Contracts\PaymentRepositoryInterface::class,
            \App\Repositories\Eloquent\PaymentRepository::class
        );
        $this->app->bind(
            \App\Repositories\Contracts\AccountRepositoryInterface::class,
            \App\Repositories\Eloquent\AccountRepository::class
        );
        $this->app->bind(
            \App\Repositories\Contracts\BankTransactionRepositoryInterface::class,
            \App\Repositories\Eloquent\BankTransactionRepository::class
        );
        $this->app->bind(
            \App\Repositories\Contracts\CreditNoteRepositoryInterface::class,
            \App\Repositories\Eloquent\CreditNoteRepository::class
        );
        $this->app->bind(
            \App\Repositories\Contracts\ItemRepositoryInterface::class,
            \App\Repositories\Eloquent\ItemRepository::class
        );
        $this->app->bind(
            \App\Repositories\Contracts\JournalRepositoryInterface::class,
            \App\Repositories\Eloquent\JournalRepository::class
        );
        $this->app->bind(
            \App\Repositories\Contracts\ManualJournalRepositoryInterface::class,
            \App\Repositories\Eloquent\ManualJournalRepository::class
        );
        $this->app->bind(
            \App\Repositories\Contracts\LinkedTransactionRepositoryInterface::class,
            \App\Repositories\Eloquent\LinkedTransactionRepository::class
        );
        $this->app->bind(
            \App\Repositories\Contracts\OrganisationRepositoryInterface::class,
            \App\Repositories\Eloquent\OrganisationRepository::class
        );
        $this->app->bind(
            \App\Repositories\Contracts\OverpaymentRepositoryInterface::class,
            \App\Repositories\Eloquent\OverpaymentRepository::class
        );
        $this->app->bind(
            \App\Repositories\Contracts\PrepaymentRepositoryInterface::class,
            \App\Repositories\Eloquent\PrepaymentRepository::class
        );
        $this->app->bind(
            \App\Repositories\Contracts\PurchaseOrderRepositoryInterface::class,
            \App\Repositories\Eloquent\PurchaseOrderRepository::class
        );
        $this->app->bind(
            \App\Repositories\Contracts\QuoteRepositoryInterface::class,
            \App\Repositories\Eloquent\QuoteRepository::class
        );
        $this->app->bind(
            \App\Repositories\Contracts\RepeatingInvoiceRepositoryInterface::class,
            \App\Repositories\Eloquent\RepeatingInvoiceRepository::class
        );
        $this->app->bind(
            \App\Repositories\Contracts\TaxRateRepositoryInterface::class,
            \App\Repositories\Eloquent\TaxRateRepository::class
        );
        $this->app->bind(
            \App\Repositories\Contracts\XeroUserRepositoryInterface::class,
            \App\Repositories\Eloquent\XeroUserRepository::class
        );
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
