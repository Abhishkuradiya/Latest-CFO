<?php

namespace App\Integrations\Services;

use App\Models\TenantCredential;
use App\Integrations\AccountingProviderFactory;
use App\Repositories\Contracts\ContactRepositoryInterface;
use App\Repositories\Contracts\AccountRepositoryInterface;
use App\Repositories\Contracts\InvoiceRepositoryInterface;
use App\Repositories\Contracts\PaymentRepositoryInterface;
use App\Repositories\Contracts\CreditNoteRepositoryInterface;
use App\Repositories\Contracts\ItemRepositoryInterface;
use App\Repositories\Contracts\JournalRepositoryInterface;
use App\Repositories\Contracts\ManualJournalRepositoryInterface;
use App\Repositories\Contracts\LinkedTransactionRepositoryInterface;
use App\Repositories\Contracts\OrganisationRepositoryInterface;
use App\Repositories\Contracts\OverpaymentRepositoryInterface;
use App\Repositories\Contracts\PrepaymentRepositoryInterface;
use App\Repositories\Contracts\PurchaseOrderRepositoryInterface;
use App\Repositories\Contracts\QuoteRepositoryInterface;
use App\Repositories\Contracts\RepeatingInvoiceRepositoryInterface;
use App\Repositories\Contracts\TaxRateRepositoryInterface;
use App\Repositories\Contracts\XeroUserRepositoryInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SyncService
{
    public function __construct(
        protected AccountingProviderFactory $providerFactory,
        protected ContactRepositoryInterface $contactRepo,
        protected AccountRepositoryInterface $accountRepo,
        protected InvoiceRepositoryInterface $invoiceRepo,
        protected PaymentRepositoryInterface $paymentRepo,
        protected \App\Repositories\Contracts\BankTransactionRepositoryInterface $bankTransactionRepo,
        protected CreditNoteRepositoryInterface $creditNoteRepo,
        protected ItemRepositoryInterface $itemRepo,
        protected JournalRepositoryInterface $journalRepo,
        protected ManualJournalRepositoryInterface $manualJournalRepo,
        protected LinkedTransactionRepositoryInterface $linkedTransactionRepo,
        protected OrganisationRepositoryInterface $organisationRepo,
        protected OverpaymentRepositoryInterface $overpaymentRepo,
        protected PrepaymentRepositoryInterface $prepaymentRepo,
        protected PurchaseOrderRepositoryInterface $purchaseOrderRepo,
        protected QuoteRepositoryInterface $quoteRepo,
        protected RepeatingInvoiceRepositoryInterface $repeatingInvoiceRepo,
        protected TaxRateRepositoryInterface $taxRateRepo,
        protected XeroUserRepositoryInterface $xeroUserRepo
    ) {}

    /**
     * Sync all financial entities for a tenant in the correct dependency order.
     *
     * @param TenantCredential $credential
     * @return void
     */
    public function syncAll(TenantCredential $credential): void
    {
        $tenantId = $credential->tenant_id;
        $providerName = $credential->provider;
        $provider = $this->providerFactory->get($providerName);

        Log::info("Starting accounting sync for Tenant #{$tenantId} via provider {$providerName}.");

        DB::transaction(function () use ($tenantId, $credential, $provider) {
            // 1. Sync All Contacts
            $this->syncAllContacts($tenantId, $credential, $provider);

            // 2. Sync Accounts (dependencies for general ledger reports)
            $this->syncAccounts($tenantId, $credential, $provider);

            // 3. Sync Invoices (dependencies for Payments)
            $this->syncInvoices($tenantId, $credential, $provider);
            
            // 3.5 Sync Credit Notes
            $this->syncCreditNotes($tenantId, $credential, $provider);

            // 4. Sync Payments
            $this->syncPayments($tenantId, $credential, $provider);

            // 5. Sync Bank Transactions
            $this->syncBankTransactions($tenantId, $credential, $provider);

            // 6. Sync Bank Transfers
            $this->syncBankTransfers($tenantId, $credential, $provider);

            // 7. Sync Batch Payments
            $this->syncBatchPayments($tenantId, $credential, $provider);

            // 8. Sync Branding Themes & Payment Services
            $this->syncBrandingThemes($tenantId, $credential, $provider);

            // 9. Sync Budgets
            $this->syncBudgets($tenantId, $credential, $provider);

            // 10. Sync Contact Groups
            $this->syncContactGroups($tenantId, $credential, $provider);

            // 11. Sync Currencies
            $this->syncCurrencies($tenantId, $credential, $provider);

            // 12. Sync Items
            $this->syncItems($tenantId, $credential, $provider);

            // 13. Sync Journals (offset-paginated)
            $this->syncJournals($tenantId, $credential, $provider);

            // 14. Sync Manual Journals
            $this->syncManualJournals($tenantId, $credential, $provider);

            // 15. Sync Linked Transactions
            $this->syncLinkedTransactions($tenantId, $credential, $provider);

            // 16. Sync Organisation Details
            $this->syncOrganisation($tenantId, $credential, $provider);

            // 17. Sync Overpayments
            $this->syncOverpayments($tenantId, $credential, $provider);

            // 18. Sync Prepayments
            $this->syncPrepayments($tenantId, $credential, $provider);

            // 19. Sync Purchase Orders
            $this->syncPurchaseOrders($tenantId, $credential, $provider);

            // 20. Sync Quotes
            $this->syncQuotes($tenantId, $credential, $provider);

            // 21. Sync Repeating Invoices
            $this->syncRepeatingInvoices($tenantId, $credential, $provider);

            // 22. Sync Tax Rates
            $this->syncTaxRates($tenantId, $credential, $provider);

            // 23. Sync Users
            $this->syncUsers($tenantId, $credential, $provider);
        });

        Log::info("Successfully completed accounting sync for Tenant #{$tenantId}.");
    }

    /**
     * Sync all contacts.
     */
    protected function syncAllContacts(int $tenantId, TenantCredential $credential, $provider): void
    {
        $dtos = $provider->getAllContacts($credential);
        foreach ($dtos as $dto) {
            $this->contactRepo->upsertByExternalId($tenantId, $dto->toArray());
        }
        Log::debug("Synced " . count($dtos) . " contacts for Tenant #{$tenantId}.");
    }

    /**
     * Sync accounts.
     */
    protected function syncAccounts(int $tenantId, TenantCredential $credential, $provider): void
    {
        $dtos = $provider->getAccounts($credential);
        foreach ($dtos as $dto) {
            $this->accountRepo->upsertByExternalId($tenantId, $dto->toArray());
        }
        Log::debug("Synced " . count($dtos) . " accounts for Tenant #{$tenantId}.");
    }

    /**
     * Sync invoices.
     */
    protected function syncInvoices(int $tenantId, TenantCredential $credential, $provider): void
    {
        $dtos = $provider->getInvoices($credential);
        foreach ($dtos as $dto) {
            $this->invoiceRepo->upsertByExternalId($tenantId, $dto->toArray());
        }
        Log::debug("Synced " . count($dtos) . " invoices for Tenant #{$tenantId}.");
    }

    /**
     * Sync payments.
     */
    protected function syncPayments(int $tenantId, TenantCredential $credential, $provider): void
    {
        $dtos = $provider->getPayments($credential);
        foreach ($dtos as $dto) {
            $this->paymentRepo->upsertByExternalId($tenantId, $dto->toArray());
        }
        Log::debug("Synced " . count($dtos) . " payments for Tenant #{$tenantId}.");
    }

    /**
     * Sync bank transactions.
     */
    protected function syncBankTransactions(int $tenantId, TenantCredential $credential, $provider): void
    {
        $dtos = $provider->getBankTransactions($credential);
        foreach ($dtos as $dto) {
            $this->bankTransactionRepo->upsertByExternalId($tenantId, $dto->toArray());
        }
        Log::debug("Synced " . count($dtos) . " bank transactions for Tenant #{$tenantId}.");
    }

    /**
     * Sync bank transfers from Xero and store in local DB.
     */
    protected function syncBankTransfers(int $tenantId, TenantCredential $credential, $provider): void
    {
        if (!method_exists($provider, 'getBankTransfers')) {
            Log::warning("Provider does not support getBankTransfers, skipping.");
            return;
        }

        try {
            $data = $provider->getBankTransfers($credential);
            $transfers = $data['BankTransfers'] ?? [];

            foreach ($transfers as $t) {
                $transferId = $t['BankTransferID'] ?? null;
                if (!$transferId) continue;

                // Parse date
                $date = null;
                if (!empty($t['DateString'])) {
                    $date = substr($t['DateString'], 0, 10);
                } elseif (!empty($t['Date'])) {
                    preg_match('/\/Date\((\d+)/', $t['Date'], $matches);
                    $date = isset($matches[1]) ? date('Y-m-d', (int)($matches[1] / 1000)) : null;
                }

                \App\Models\BankTransfer::updateOrCreate(
                    ['tenant_id' => $tenantId, 'external_id' => $transferId],
                    [
                        'from_account_name'  => $t['FromBankAccount']['Name'] ?? null,
                        'from_account_id'    => $t['FromBankAccount']['AccountID'] ?? null,
                        'to_account_name'    => $t['ToBankAccount']['Name'] ?? null,
                        'to_account_id'      => $t['ToBankAccount']['AccountID'] ?? null,
                        'amount'             => $t['Amount'] ?? 0,
                        'date'               => $date,
                        'reference'          => $t['Reference'] ?? null,
                        'from_is_reconciled' => ($t['FromIsReconciled'] ?? 'false') === 'true',
                        'to_is_reconciled'   => ($t['ToIsReconciled'] ?? 'false') === 'true',
                        'raw_data'           => $t,
                    ]
                );
            }

            Log::debug("Synced " . count($transfers) . " bank transfers for Tenant #{$tenantId}.");
        } catch (\Exception $e) {
            Log::warning("Bank transfers sync skipped for Tenant #{$tenantId}: " . $e->getMessage());
        }
    }

    /**
     * Sync batch payments from Xero and store in local DB.
     */
    protected function syncBatchPayments(int $tenantId, TenantCredential $credential, $provider): void
    {
        try {
            $data = $provider->getBatchPayments($credential);
            $batches = $data['BatchPayments'] ?? [];

            foreach ($batches as $b) {
                $batchId = $b['BatchPaymentID'] ?? null;
                if (!$batchId) continue;

                // Parse date
                $date = null;
                if (!empty($b['DateString'])) {
                    $date = substr($b['DateString'], 0, 10);
                } elseif (!empty($b['Date'])) {
                    preg_match('/\/Date\((\d+)/', $b['Date'], $matches);
                    $date = isset($matches[1]) ? date('Y-m-d', (int)($matches[1] / 1000)) : null;
                }

                \App\Models\BatchPayment::updateOrCreate(
                    ['tenant_id' => $tenantId, 'external_id' => $batchId],
                    [
                        'account_id'       => $b['Account']['AccountID'] ?? null,
                        'account_currency' => $b['Account']['CurrencyCode'] ?? null,
                        'date'             => $date,
                        'type'             => $b['Type'] ?? null,
                        'status'           => $b['Status'] ?? null,
                        'total_amount'     => $b['TotalAmount'] ?? 0,
                        'is_reconciled'    => (bool)($b['IsReconciled'] ?? false),
                        'reference'        => $b['Reference'] ?? null,
                        'payment_count'    => count($b['Payments'] ?? []),
                        'raw_data'         => $b,
                    ]
                );
            }

            Log::debug("Synced " . count($batches) . " batch payments for Tenant #{$tenantId}.");
        } catch (\Exception $e) {
            Log::warning("Batch payments sync skipped for Tenant #{$tenantId}: " . $e->getMessage());
        }
    }

    /**
     * Sync branding themes and their payment services from Xero.
     */
    protected function syncBrandingThemes(int $tenantId, TenantCredential $credential, $provider): void
    {
        try {
            $data = $provider->getBrandingThemes($credential);
            $themes = $data['BrandingThemes'] ?? [];

            foreach ($themes as $t) {
                $themeId = $t['BrandingThemeID'] ?? null;
                if (!$themeId) continue;

                $themeRecord = \App\Models\BrandingTheme::updateOrCreate(
                    ['tenant_id' => $tenantId, 'external_id' => $themeId],
                    [
                        'name'             => $t['Name'] ?? 'Unknown',
                        'type'             => $t['Type'] ?? null,
                        'logo_url'         => $t['LogoUrl'] ?? null,
                        'sort_order'       => $t['SortOrder'] ?? 0,
                        'created_date_utc' => $t['CreatedDateUTC'] ?? null,
                        'raw_data'         => $t,
                    ]
                );

                // Now fetch payment services for this theme
                try {
                    $servicesData = $provider->getPaymentServices($credential, $themeId);
                    $services = $servicesData['PaymentServices'] ?? [];
                    
                    // Clear old services to avoid stale records
                    $themeRecord->paymentServices()->delete();

                    foreach ($services as $s) {
                        $serviceId = $s['PaymentServiceID'] ?? null;
                        if (!$serviceId) continue;

                        $themeRecord->paymentServices()->create([
                            'external_id'  => $serviceId,
                            'name'         => $s['PaymentServiceName'] ?? 'Unknown',
                            'url'          => $s['PaymentServiceUrl'] ?? null,
                            'pay_now_text' => $s['PayNowText'] ?? null,
                            'type'         => $s['PaymentServiceType'] ?? null,
                            'raw_data'     => $s,
                        ]);
                    }
                } catch (\Exception $subE) {
                    Log::warning("Payment services sync skipped for Theme {$themeId}: " . $subE->getMessage());
                }
            }

            Log::debug("Synced " . count($themes) . " branding themes for Tenant #{$tenantId}.");
        } catch (\Exception $e) {
            Log::warning("Branding themes sync skipped for Tenant #{$tenantId}: " . $e->getMessage());
        }
    }

    /**
     * Sync budgets and their budget lines from Xero.
     */
    protected function syncBudgets(int $tenantId, TenantCredential $credential, $provider): void
    {
        try {
            $data = $provider->getBudgets($credential);
            $budgets = $data['Budgets'] ?? [];

            foreach ($budgets as $b) {
                $budgetId = $b['BudgetID'] ?? null;
                if (!$budgetId) continue;

                // Fetch individual budget details to get BudgetLines
                try {
                    $detailsData = $provider->getBudgetDetails($credential, $budgetId);
                    // The detail endpoint returns an array of Budgets, we just take the first one
                    if (!empty($detailsData['Budgets']) && is_array($detailsData['Budgets'])) {
                        $detailedBudget = $detailsData['Budgets'][0];
                    } else {
                        $detailedBudget = $b;
                    }
                } catch (\Exception $subE) {
                    Log::warning("Budget details fetch skipped for Budget {$budgetId}: " . $subE->getMessage());
                    $detailedBudget = $b; // Fallback to list data if detail fetch fails
                }

                \App\Models\Budget::updateOrCreate(
                    ['tenant_id' => $tenantId, 'external_id' => $budgetId],
                    [
                        'type'             => $detailedBudget['Type'] ?? null,
                        'description'      => $detailedBudget['Description'] ?? null,
                        'updated_date_utc' => $detailedBudget['UpdatedDateUTC'] ?? null,
                        'raw_data'         => $detailedBudget,
                    ]
                );
            }

            Log::debug("Synced " . count($budgets) . " budgets for Tenant #{$tenantId}.");
        } catch (\Exception $e) {
            Log::warning("Budgets sync skipped for Tenant #{$tenantId}: " . $e->getMessage());
        }
    }

    /**
     * Sync contact groups and their contacts from Xero.
     */
    protected function syncContactGroups(int $tenantId, TenantCredential $credential, $provider): void
    {
        try {
            $data = $provider->getContactGroups($credential);
            $groups = $data['ContactGroups'] ?? [];

            foreach ($groups as $g) {
                $groupId = $g['ContactGroupID'] ?? null;
                if (!$groupId) continue;

                // Fetch individual group details to get Contacts
                try {
                    $detailsData = $provider->getContactGroupDetails($credential, $groupId);
                    if (!empty($detailsData['ContactGroups']) && is_array($detailsData['ContactGroups'])) {
                        $detailedGroup = $detailsData['ContactGroups'][0];
                    } else {
                        $detailedGroup = $g;
                    }
                } catch (\Exception $subE) {
                    Log::warning("Contact group details fetch skipped for Group {$groupId}: " . $subE->getMessage());
                    $detailedGroup = $g;
                }

                \App\Models\ContactGroup::updateOrCreate(
                    ['tenant_id' => $tenantId, 'external_id' => $groupId],
                    [
                        'name'     => $detailedGroup['Name'] ?? null,
                        'status'   => $detailedGroup['Status'] ?? null,
                        'raw_data' => $detailedGroup,
                    ]
                );
            }

            Log::debug("Synced " . count($groups) . " contact groups for Tenant #{$tenantId}.");
        } catch (\Exception $e) {
            Log::warning("Contact groups sync skipped for Tenant #{$tenantId}: " . $e->getMessage());
        }
    }

    /**
     * Fetch credit notes and store them.
     */
    protected function syncCreditNotes(int $tenantId, TenantCredential $credential, $provider): void
    {
        Log::info("Fetching credit notes for tenant #{$tenantId}");
        try {
            $creditNotes = $provider->getCreditNotes($credential);

            $count = 0;
            foreach ($creditNotes as $dto) {
                $this->creditNoteRepo->updateOrCreate($tenantId, $dto);
                $count++;
            }

            Log::info("Synced {$count} credit notes for tenant #{$tenantId}");
        } catch (\Exception $e) {
            Log::warning("Credit notes sync failed for tenant #{$tenantId}: " . $e->getMessage());
        }
    }

    /**
     * Fetch currencies.
     */
    protected function syncCurrencies(int $tenantId, TenantCredential $credential, $provider): void
    {
        Log::info("Fetching currencies for tenant #{$tenantId}");
        try {
            $currencies = $provider->getCurrencies($credential);

            $count = 0;
            foreach ($currencies as $c) {
                \App\Models\Currency::updateOrCreate(
                    ['tenant_id' => $tenantId, 'code' => $c['Code']],
                    [
                        'description' => $c['Description'] ?? null,
                        'raw_data' => $c
                    ]
                );
                $count++;
            }

            Log::info("Synced {$count} currencies for tenant #{$tenantId}");
        } catch (\Exception $e) {
            Log::warning("Currencies sync failed for tenant #{$tenantId}: " . $e->getMessage());
        }
    }

    /**
     * Fetch items (products & services) and store them.
     */
    protected function syncItems(int $tenantId, TenantCredential $credential, $provider): void
    {
        Log::info("Fetching items for tenant #{$tenantId}");
        try {
            $dtos = $provider->getItems($credential);

            $count = 0;
            foreach ($dtos as $dto) {
                $this->itemRepo->updateOrCreate($tenantId, $dto);
                $count++;
            }

            Log::info("Synced {$count} items for tenant #{$tenantId}");
        } catch (\Exception $e) {
            Log::warning("Items sync failed for tenant #{$tenantId}: " . $e->getMessage());
        }
    }

    /**
     * Fetch ALL journals using offset-based pagination.
     * Xero returns max 100 per call; we loop until empty response.
     * Uses the highest stored JournalNumber as starting offset for
     * incremental syncs (only fetches new journals after last sync).
     */
    protected function syncJournals(int $tenantId, TenantCredential $credential, $provider): void
    {
        Log::info("Fetching journals for tenant #{$tenantId} (offset-paginated)");
        try {
            // Start from the highest already-synced JournalNumber (incremental sync)
            $offset = $this->journalRepo->getMaxJournalNumber($tenantId);
            $totalCount = 0;
            $maxIterations = 500; // safety cap (50,000 journals)
            $iteration = 0;

            do {
                $iteration++;
                if ($iteration > $maxIterations) {
                    Log::warning("Journals sync hit safety cap of {$maxIterations} iterations for tenant #{$tenantId}");
                    break;
                }

                Log::info("Journals sync page {$iteration} — offset={$offset} for tenant #{$tenantId}");
                $dtos = $provider->getJournals($credential, $offset);

                if (empty($dtos)) {
                    break; // no more journals
                }

                $lastJournalNumber = 0;
                foreach ($dtos as $dto) {
                    $this->journalRepo->updateOrCreate($tenantId, $dto);
                    $totalCount++;
                    if ($dto->journalNumber > $lastJournalNumber) {
                        $lastJournalNumber = $dto->journalNumber;
                    }
                }

                // Advance the offset to the last journal number in this batch
                $offset = $lastJournalNumber;

            } while (count($dtos) === 100); // if less than 100 returned, we're done

            Log::info("Synced {$totalCount} journals for tenant #{$tenantId}");
        } catch (\Exception $e) {
            Log::warning("Journals sync failed for tenant #{$tenantId}: " . $e->getMessage());
        }
    }

    /**
     * Fetch manual journals.
     */
    protected function syncManualJournals(int $tenantId, TenantCredential $credential, $provider): void
    {
        Log::info("Fetching manual journals for tenant #{$tenantId}");
        try {
            $dtos = $provider->getManualJournals($credential);

            $count = 0;
            foreach ($dtos as $dto) {
                $this->manualJournalRepo->updateOrCreate($tenantId, $dto);
                $count++;
            }

            Log::info("Synced {$count} manual journals for tenant #{$tenantId}");
        } catch (\Exception $e) {
            Log::warning("Manual journals sync failed for tenant #{$tenantId}: " . $e->getMessage());
        }
    }

    /**
     * Fetch linked transactions page-by-page.
     */
    protected function syncLinkedTransactions(int $tenantId, TenantCredential $credential, $provider): void
    {
        Log::info("Fetching linked transactions for tenant #{$tenantId}");
        try {
            $page = 1;
            $count = 0;
            $maxPages = 100; // safety ceiling

            do {
                Log::info("Fetching linked transactions page {$page} for tenant #{$tenantId}");
                $dtos = $provider->getLinkedTransactions($credential, $page);

                if (empty($dtos)) {
                    break;
                }

                foreach ($dtos as $dto) {
                    $this->linkedTransactionRepo->updateOrCreate($tenantId, $dto);
                    $count++;
                }

                // If we got exactly 100 items, check if there's a next page
                if (count($dtos) < 100) {
                    break;
                }

                $page++;
                if ($page > $maxPages) {
                    Log::warning("Linked transactions hit safety page cap of {$maxPages} for tenant #{$tenantId}");
                    break;
                }

            } while (true);

            Log::info("Synced {$count} linked transactions for tenant #{$tenantId}");
        } catch (\Exception $e) {
            Log::warning("Linked transactions sync failed for tenant #{$tenantId}: " . $e->getMessage());
        }
    }

    /**
     * Fetch organisation details and store/update them.
     */
    protected function syncOrganisation(int $tenantId, TenantCredential $credential, $provider): void
    {
        Log::info("Fetching organisation details for tenant #{$tenantId}");
        try {
            $dto = $provider->getOrganisation($credential);
            if ($dto) {
                $this->organisationRepo->updateOrCreate($tenantId, $dto);
                Log::info("Synced organisation details for tenant #{$tenantId}");
            }
        } catch (\Exception $e) {
            Log::warning("Organisation sync failed for tenant #{$tenantId}: " . $e->getMessage());
        }
    }

    /**
     * Fetch overpayments page-by-page.
     */
    protected function syncOverpayments(int $tenantId, TenantCredential $credential, $provider): void
    {
        Log::info("Fetching overpayments for tenant #{$tenantId}");
        try {
            $page = 1;
            $count = 0;
            $maxPages = 100; // safety ceiling

            do {
                Log::info("Fetching overpayments page {$page} for tenant #{$tenantId}");
                $dtos = $provider->getOverpayments($credential, $page);

                if (empty($dtos)) {
                    break;
                }

                foreach ($dtos as $dto) {
                    $this->overpaymentRepo->updateOrCreate($tenantId, $dto);
                    $count++;
                }

                if (count($dtos) < 100) {
                    break;
                }

                $page++;
                if ($page > $maxPages) {
                    Log::warning("Overpayments hit safety page cap of {$maxPages} for tenant #{$tenantId}");
                    break;
                }

            } while (true);

            Log::info("Synced {$count} overpayments for tenant #{$tenantId}");
        } catch (\Exception $e) {
            Log::warning("Overpayments sync failed for tenant #{$tenantId}: " . $e->getMessage());
        }
    }

    /**
     * Fetch prepayments page-by-page.
     */
    protected function syncPrepayments(int $tenantId, TenantCredential $credential, $provider): void
    {
        Log::info("Fetching prepayments for tenant #{$tenantId}");
        try {
            $page = 1;
            $count = 0;
            $maxPages = 100; // safety ceiling

            do {
                Log::info("Fetching prepayments page {$page} for tenant #{$tenantId}");
                $dtos = $provider->getPrepayments($credential, $page);

                if (empty($dtos)) {
                    break;
                }

                foreach ($dtos as $dto) {
                    $this->prepaymentRepo->updateOrCreate($tenantId, $dto);
                    $count++;
                }

                if (count($dtos) < 100) {
                    break;
                }

                $page++;
                if ($page > $maxPages) {
                    Log::warning("Prepayments hit safety page cap of {$maxPages} for tenant #{$tenantId}");
                    break;
                }

            } while (true);

            Log::info("Synced {$count} prepayments for tenant #{$tenantId}");
        } catch (\Exception $e) {
            Log::warning("Prepayments sync failed for tenant #{$tenantId}: " . $e->getMessage());
        }
    }

    /**
     * Fetch purchase orders page-by-page.
     */
    protected function syncPurchaseOrders(int $tenantId, TenantCredential $credential, $provider): void
    {
        Log::info("Fetching purchase orders for tenant #{$tenantId}");
        try {
            $page = 1;
            $count = 0;
            $maxPages = 100; // safety ceiling

            do {
                Log::info("Fetching purchase orders page {$page} for tenant #{$tenantId}");
                $dtos = $provider->getPurchaseOrders($credential, $page);

                if (empty($dtos)) {
                    break;
                }

                foreach ($dtos as $dto) {
                    $this->purchaseOrderRepo->updateOrCreate($tenantId, $dto);
                    $count++;
                }

                if (count($dtos) < 100) {
                    break;
                }

                $page++;
                if ($page > $maxPages) {
                    Log::warning("Purchase orders hit safety page cap of {$maxPages} for tenant #{$tenantId}");
                    break;
                }

            } while (true);

            Log::info("Synced {$count} purchase orders for tenant #{$tenantId}");
        } catch (\Exception $e) {
            Log::warning("Purchase orders sync failed for tenant #{$tenantId}: " . $e->getMessage());
        }
    }

    /**
     * Fetch quotes page-by-page.
     */
    protected function syncQuotes(int $tenantId, TenantCredential $credential, $provider): void
    {
        Log::info("Fetching quotes for tenant #{$tenantId}");
        try {
            $page = 1;
            $count = 0;
            $maxPages = 100; // safety ceiling

            do {
                Log::info("Fetching quotes page {$page} for tenant #{$tenantId}");
                $dtos = $provider->getQuotes($credential, $page);

                if (empty($dtos)) {
                    break;
                }

                foreach ($dtos as $dto) {
                    $this->quoteRepo->updateOrCreate($tenantId, $dto);
                    $count++;
                }

                if (count($dtos) < 100) {
                    break;
                }

                $page++;
                if ($page > $maxPages) {
                    Log::warning("Quotes hit safety page cap of {$maxPages} for tenant #{$tenantId}");
                    break;
                }

            } while (true);

            Log::info("Synced {$count} quotes for tenant #{$tenantId}");
        } catch (\Exception $e) {
            Log::warning("Quotes sync failed for tenant #{$tenantId}: " . $e->getMessage());
        }
    }

    /**
     * Fetch repeating invoices.
     */
    protected function syncRepeatingInvoices(int $tenantId, TenantCredential $credential, $provider): void
    {
        Log::info("Fetching repeating invoices for tenant #{$tenantId}");
        try {
            $dtos = $provider->getRepeatingInvoices($credential);
            $count = 0;

            foreach ($dtos as $dto) {
                $this->repeatingInvoiceRepo->updateOrCreate($tenantId, $dto);
                $count++;
            }

            Log::info("Synced {$count} repeating invoices for tenant #{$tenantId}");
        } catch (\Exception $e) {
            Log::warning("Repeating invoices sync failed for tenant #{$tenantId}: " . $e->getMessage());
        }
    }

    /**
     * Fetch Tax Rates and sync.
     */
    protected function syncTaxRates(int $tenantId, TenantCredential $credential, $provider): void
    {
        Log::info("Fetching tax rates for tenant #{$tenantId}");
        try {
            $dtos = $provider->getTaxRates($credential);
            $count = 0;

            foreach ($dtos as $dto) {
                $this->taxRateRepo->updateOrCreate($tenantId, $dto);
                $count++;
            }

            Log::info("Synced {$count} tax rates for tenant #{$tenantId}");
        } catch (\Exception $e) {
            Log::warning("Tax rates sync failed for tenant #{$tenantId}: " . $e->getMessage());
        }
    }

    /**
     * Fetch Users and sync.
     */
    protected function syncUsers(int $tenantId, TenantCredential $credential, $provider): void
    {
        Log::info("Fetching users for tenant #{$tenantId}");
        try {
            $dtos = $provider->getUsers($credential);
            $count = 0;

            foreach ($dtos as $dto) {
                $this->xeroUserRepo->updateOrCreate($tenantId, $dto);
                $count++;
            }

            Log::info("Synced {$count} users for tenant #{$tenantId}");
        } catch (\Exception $e) {
            Log::warning("Users sync failed for tenant #{$tenantId}: " . $e->getMessage());
        }
    }
}
