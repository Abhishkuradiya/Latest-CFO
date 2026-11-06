<?php

namespace App\Integrations\Contracts;

use App\Models\TenantCredential;
use App\Integrations\DTOs\ProfitLossReportDTO;

interface AccountingProvider
{
    /**
     * Fetch credit notes from the provider and map them to CreditNoteDTOs.
     *
     * @param TenantCredential $credential
     * @return \App\Integrations\DTOs\CreditNoteDTO[]
     */
    public function getCreditNotes(TenantCredential $credential): array;

    /**
     * Fetch items (products & services) from the provider.
     *
     * @param TenantCredential $credential
     * @return \App\Integrations\DTOs\ItemDTO[]
     */
    public function getItems(TenantCredential $credential): array;

    /**
     * Fetch a page of journals with offset-based pagination.
     * Returns max 100 journals per call.
     *
     * @param TenantCredential $credential
     * @param int $offset JournalNumber to start after (0 = from beginning)
     * @return \App\Integrations\DTOs\JournalDTO[]
     */
    public function getJournals(TenantCredential $credential, int $offset = 0): array;

    /**
     * Fetch manual journals.
     *
     * @param TenantCredential $credential
     * @return \App\Integrations\DTOs\ManualJournalDTO[]
     */
    public function getManualJournals(TenantCredential $credential): array;

    /**
     * Fetch linked transactions with page-based pagination.
     *
     * @param TenantCredential $credential
     * @param int $page Page index to fetch (starts at 1)
     * @return \App\Integrations\DTOs\LinkedTransactionDTO[]
     */
    public function getLinkedTransactions(TenantCredential $credential, int $page = 1): array;

    /**
     * Fetch organisation details.
     *
     * @param TenantCredential $credential
     * @return \App\Integrations\DTOs\OrganisationDTO|null
     */
    public function getOrganisation(TenantCredential $credential): ?\App\Integrations\DTOs\OrganisationDTO;

    /**
     * Fetch overpayments with page-based pagination.
     *
     * @param TenantCredential $credential
     * @param int $page Page index to fetch (starts at 1)
     * @return \App\Integrations\DTOs\OverpaymentDTO[]
     */
    public function getOverpayments(TenantCredential $credential, int $page = 1): array;

    /**
     * Fetch prepayments with page-based pagination.
     *
     * @param TenantCredential $credential
     * @param int $page Page index to fetch (starts at 1)
     * @return \App\Integrations\DTOs\PrepaymentDTO[]
     */
    public function getPrepayments(TenantCredential $credential, int $page = 1): array;

    /**
     * Fetch purchase orders with page-based pagination.
     *
     * @param TenantCredential $credential
     * @param int $page Page index to fetch (starts at 1)
     * @return \App\Integrations\DTOs\PurchaseOrderDTO[]
     */
    public function getPurchaseOrders(TenantCredential $credential, int $page = 1): array;

    /**
     * Fetch quotes with page-based pagination.
     *
     * @param TenantCredential $credential
     * @param int $page Page index to fetch (starts at 1)
     * @return \App\Integrations\DTOs\QuoteDTO[]
     */
    public function getQuotes(TenantCredential $credential, int $page = 1): array;

    /**
     * Fetch repeating invoices.
     *
     * @param TenantCredential $credential
     * @return \App\Integrations\DTOs\RepeatingInvoiceDTO[]
     */
    public function getRepeatingInvoices(TenantCredential $credential): array;

    /**
     * Fetch a credit note as a PDF.
     *
     * @param TenantCredential $credential
     * @param string $creditNoteId
     * @return \Illuminate\Http\Client\Response
     */
    public function getCreditNoteAsPdf(TenantCredential $credential, string $creditNoteId);
    /**
     * Fetch invoices from the provider and map them to InvoiceDTOs.
     *
     * @param TenantCredential $credential
     * @return \App\Integrations\DTOs\InvoiceDTO[]
     */
    public function getInvoices(TenantCredential $credential): array;

    /**
     * Fetch payments from the provider and map them to PaymentDTOs.
     *
     * @param TenantCredential $credential
     * @return \App\Integrations\DTOs\PaymentDTO[]
     */
    public function getPayments(TenantCredential $credential): array;

    /**
     * Fetch ledger accounts from the provider and map them to AccountDTOs.
     *
     * @param TenantCredential $credential
     * @return \App\Integrations\DTOs\AccountDTO[]
     */
    public function getAccounts(TenantCredential $credential): array;

    /**
     * Fetch Profit & Loss report from the provider and map to ProfitLossReportDTO.
     *
     * @param TenantCredential $credential
     * @param string $startDate
     * @param string $endDate
     * @return ProfitLossReportDTO
     */
    public function getProfitLossReport(TenantCredential $credential, string $startDate, string $endDate): ProfitLossReportDTO;

    /**
     * Fetch Aged Payables By Contact report from the provider.
     *
     * @param TenantCredential $credential
     * @param string $contactId
     * @param string|null $date
     * @param string|null $fromDate
     * @param string|null $toDate
     * @return \App\Integrations\DTOs\AgedPayablesReportDTO
     */
    public function getAgedPayablesByContact(TenantCredential $credential, string $contactId, ?string $date = null, ?string $fromDate = null, ?string $toDate = null): \App\Integrations\DTOs\AgedPayablesReportDTO;

    /**
     * Fetch Aged Receivables By Contact report from the provider.
     */
    public function getAgedReceivablesByContact(TenantCredential $credential, string $contactId, ?string $date = null, ?string $fromDate = null, ?string $toDate = null): \App\Integrations\DTOs\StandardReportDTO;

    /**
     * Fetch Balance Sheet report from the provider.
     */
    public function getBalanceSheetReport(TenantCredential $credential, ?string $date = null, ?int $periods = null, ?string $timeframe = null, ?bool $paymentsOnly = null): \App\Integrations\DTOs\StandardReportDTO;

    /**
     * Fetch Bank Summary report from the provider.
     */
    public function getBankSummaryReport(TenantCredential $credential, ?string $fromDate = null, ?string $toDate = null): \App\Integrations\DTOs\StandardReportDTO;

    /**
     * Fetch Trial Balance report from the provider.
     */
    public function getTrialBalanceReport(TenantCredential $credential, ?string $date = null, ?bool $paymentsOnly = null): \App\Integrations\DTOs\StandardReportDTO;

    /**
     * Fetch Tax Rates from Xero.
     *
     * @param TenantCredential $credential
     * @return \App\Integrations\DTOs\TaxRateDTO[]
     */
    public function getTaxRates(TenantCredential $credential): array;

    /**
     * Fetch Users from Xero.
     *
     * @param TenantCredential $credential
     * @return \App\Integrations\DTOs\XeroUserDTO[]
     */
    public function getUsers(TenantCredential $credential): array;

    /**
     * Fetch bank transactions from the provider and map them to BankTransactionDTOs.
     *
     * @param TenantCredential $credential
     * @return \App\Integrations\DTOs\BankTransactionDTO[]
     */
    public function getBankTransactions(TenantCredential $credential): array;

    /**
     * Fetch bank statements from the provider.
     *
     * @param TenantCredential $credential
     * @param string $bankAccountId
     * @param string $fromDate
     * @param string $toDate
     * @return array
     */
    public function getBankStatements(TenantCredential $credential, string $bankAccountId, string $fromDate, string $toDate): array;

    /**
     * Fetch bank transfers from the provider.
     *
     * @param TenantCredential $credential
     * @return array
     */
    public function getBankTransfers(TenantCredential $credential): array;

    public function getCurrencies(TenantCredential $credential): array;
    public function addCurrency(TenantCredential $credential, string $code, string $description = null): array;

    /**
     * Fetch batch payments from the provider.
     *
     * @param TenantCredential $credential
     * @return array
     */
    public function getBatchPayments(TenantCredential $credential): array;

    /**
     * Fetch branding themes from the provider.
     *
     * @param TenantCredential $credential
     * @return array
     */
    public function getBrandingThemes(TenantCredential $credential): array;

    /**
     * Fetch payment services for a branding theme from the provider.
     *
     * @param TenantCredential $credential
     * @param string $themeId
     * @return array
     */
    public function getPaymentServices(TenantCredential $credential, string $themeId): array;

    /**
     * Fetch all contacts from the provider.
     *
     * @param TenantCredential $credential
     * @return array
     */
    public function getAllContacts(TenantCredential $credential): array;

    /**
     * Fetch all budgets from the provider.
     *
     * @param TenantCredential $credential
     * @return array
     */
    public function getBudgets(TenantCredential $credential): array;

    /**
     * Fetch details of a specific budget including BudgetLines.
     *
     * @param TenantCredential $credential
     * @param string $budgetId
     * @return array
     */
    public function getBudgetDetails(TenantCredential $credential, string $budgetId): array;

    /**
     * Fetch all contact groups from the provider.
     *
     * @param TenantCredential $credential
     * @return array
     */
    public function getContactGroups(TenantCredential $credential): array;

    /**
     * Fetch details of a specific contact group including its contacts.
     *
     * @param TenantCredential $credential
     * @param string $groupId
     * @return array
     */
    public function getContactGroupDetails(TenantCredential $credential, string $groupId): array;
}
