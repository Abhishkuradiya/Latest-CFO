<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\Tenant;
use App\Models\TenantCredential;
use App\Models\Contact;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Account;
use App\Integrations\Services\SyncService;
use App\Integrations\Contracts\AccountingProvider;
use App\Integrations\AccountingProviderFactory;
use App\Integrations\DTOs\CustomerDTO;
use App\Integrations\DTOs\InvoiceDTO;
use App\Integrations\DTOs\PaymentDTO;
use App\Integrations\DTOs\AccountDTO;
use App\Integrations\DTOs\BankTransactionDTO;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;

class SyncServiceTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test that the SyncService orchestrates synchronization of all entities
     * in the correct order and resolves database relationships.
     */
    public function test_sync_service_syncs_all_entities_in_correct_order()
    {
        $tenant = Tenant::create(['name' => 'Acme Corp']);
        $credential = TenantCredential::create([
            'tenant_id' => $tenant->id,
            'provider' => 'xero',
            'tenant_identifier' => 'xero-tenant-id',
            'access_token' => 'token',
            'refresh_token' => 'refresh',
            'expires_at' => now()->addHour(),
        ]);

        // Mock the AccountingProvider
        $mockProvider = Mockery::mock(AccountingProvider::class);

        // 1. Customer DTO response
        $mockProvider->shouldReceive('getCustomers')
            ->once()
            ->with($credential)
            ->andReturn([
                new CustomerDTO(
                    externalId: 'cust-123',
                    name: 'Customer One',
                    email: 'cust1@test.com',
                    phone: '123456789',
                    status: 'ACTIVE'
                )
            ]);

        // 2. Account DTO response
        $mockProvider->shouldReceive('getAccounts')
            ->once()
            ->with($credential)
            ->andReturn([
                new AccountDTO(
                    externalId: 'acc-999',
                    code: '200',
                    name: 'Sales Account',
                    type: 'REVENUE',
                    status: 'ACTIVE'
                )
            ]);

        // 3. Invoice DTO response referencing customer
        $mockProvider->shouldReceive('getInvoices')
            ->once()
            ->with($credential)
            ->andReturn([
                new InvoiceDTO(
                    externalId: 'inv-456',
                    contactExternalId: 'cust-123',
                    invoiceNumber: 'INV-100',
                    type: 'ACCREC',
                    status: 'AUTHORISED',
                    date: '2021-05-07',
                    dueDate: '2021-06-06',
                    subTotal: 100.0,
                    taxTotal: 10.0,
                    total: 110.0,
                    amountDue: 110.0,
                    amountPaid: 0.0
                )
            ]);

        // 4. Payment DTO response referencing invoice
        $mockProvider->shouldReceive('getPayments')
            ->once()
            ->with($credential)
            ->andReturn([
                new PaymentDTO(
                    externalId: 'pay-789',
                    invoiceExternalId: 'inv-456',
                    date: '2021-05-08',
                    amount: 50.0,
                    reference: 'Pay-Ref',
                    status: 'AUTHORISED'
                )
            ]);

        // 5. Bank Transaction DTO response
        $mockProvider->shouldReceive('getBankTransactions')
            ->once()
            ->with($credential)
            ->andReturn([
                new BankTransactionDTO(
                    externalId: 'tx-111',
                    type: 'SPEND',
                    date: '2021-05-09',
                    total: 150.0,
                    reference: 'Tx-Ref',
                    status: 'AUTHORISED',
                    isReconciled: true
                )
            ]);

        // Mock the factory to return our mock provider
        $mockFactory = Mockery::mock(AccountingProviderFactory::class);
        $mockFactory->shouldReceive('get')
            ->once()
            ->with('xero')
            ->andReturn($mockProvider);

        // Bind the factory into the container
        $this->app->instance(AccountingProviderFactory::class, $mockFactory);

        // Run sync
        $syncService = $this->app->make(SyncService::class);
        $syncService->syncAll($credential);

        // Verify database records
        $this->assertDatabaseHas('contacts', [
            'tenant_id' => $tenant->id,
            'external_id' => 'cust-123',
            'name' => 'Customer One',
        ]);

        $this->assertDatabaseHas('accounts', [
            'tenant_id' => $tenant->id,
            'external_id' => 'acc-999',
            'code' => '200',
        ]);

        $localContact = Contact::where('external_id', 'cust-123')->first();
        $this->assertNotNull($localContact);

        $this->assertDatabaseHas('invoices', [
            'tenant_id' => $tenant->id,
            'external_id' => 'inv-456',
            'contact_id' => $localContact->id,
            'invoice_number' => 'INV-100',
        ]);

        $localInvoice = Invoice::where('external_id', 'inv-456')->first();
        $this->assertNotNull($localInvoice);

        $this->assertDatabaseHas('payments', [
            'tenant_id' => $tenant->id,
            'external_id' => 'pay-789',
            'invoice_id' => $localInvoice->id,
            'amount' => 50.0000,
        ]);

        $this->assertDatabaseHas('bank_transactions', [
            'tenant_id' => $tenant->id,
            'external_id' => 'tx-111',
            'type' => 'SPEND',
            'total' => 150.0000,
            'is_reconciled' => true,
        ]);
    }
}
