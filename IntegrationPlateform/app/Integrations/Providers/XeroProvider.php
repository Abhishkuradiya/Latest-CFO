<?php

namespace App\Integrations\Providers;

use App\Integrations\Contracts\AccountingProvider;
use App\Integrations\DTOs\ProfitLossReportDTO;
use App\Integrations\DTOs\AgedPayablesReportDTO;
use App\Integrations\DTOs\StandardReportDTO;
use App\Integrations\DTOs\TaxRateDTO;
use App\Integrations\DTOs\XeroUserDTO;
use App\Integrations\Mappers\TaxRateMapper;
use App\Integrations\Mappers\XeroUserMapper;
use App\Integrations\Mappers\AccountMapper;
use App\Integrations\Mappers\CustomerMapper;
use App\Integrations\Mappers\InvoiceMapper;
use App\Integrations\Mappers\PaymentMapper;
use App\Integrations\OAuth\OAuthManager;
use App\Models\TenantCredential;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class XeroProvider implements AccountingProvider
{
    public function __construct(
        protected OAuthManager $oauthManager
    ) {}

    /**
     * Helper to perform HTTP GET request with automatic token refresh.
     *
     * @param TenantCredential $credential
     * @param string $endpoint
     * @param array $query
     * @return array
     */
    protected function get(TenantCredential $credential, string $endpoint, array $query = []): array
    {
        // 1. Automatically refresh token if expired
        $credential = $this->oauthManager->refreshIfNeeded($credential);

        // 2. Perform API call
        $response = Http::withToken($credential->access_token)
            ->withHeaders([
                'Xero-Tenant-Id' => $credential->tenant_identifier,
                'Accept' => 'application/json',
            ])
            ->get("https://api.xero.com/api.xro/2.0/{$endpoint}", $query);

        if ($response->failed()) {
            Log::error("Xero API GET request failed on endpoint {$endpoint}", [
                'tenant_id' => $credential->tenant_id,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new \Exception("Xero API request failed: " . $response->body());
        }

        return $response->json();
    }

    /**
     * Fetch all contacts.
     *
     * @param TenantCredential $credential
     * @return \App\Integrations\DTOs\ContactDTO[]
     */
    public function getAllContacts(TenantCredential $credential): array
    {
        $allContacts = [];
        $page = 1;
        $hasMore = true;

        while ($hasMore) {
            $response = $this->get($credential, 'Contacts', [
                'page' => $page
            ]);

            $contacts = $response['Contacts'] ?? [];
            $allContacts = array_merge($allContacts, $contacts);

            if (count($contacts) < 100) {
                $hasMore = false;
            } else {
                $page++;
            }
        }

        return array_map(function ($item) {
            return \App\Integrations\Mappers\ContactMapper::toDTO($item);
        }, $allContacts);
    }

    /**
     * Fetch invoices.
     *
     * @param TenantCredential $credential
     * @return \App\Integrations\DTOs\InvoiceDTO[]
     */
    public function getInvoices(TenantCredential $credential): array
    {
        $response = $this->get($credential, 'Invoices');
        $invoices = $response['Invoices'] ?? [];

        return array_map(function ($item) {
            return InvoiceMapper::toDTO($item);
        }, $invoices);
    }

    /**
     * Fetch credit notes from the provider and map them to CreditNoteDTOs.
     *
     * @param TenantCredential $credential
     * @return \App\Integrations\DTOs\CreditNoteDTO[]
     */
    public function getCreditNotes(TenantCredential $credential): array
    {
        $response = $this->get($credential, 'CreditNotes');
        $creditNotes = $response['CreditNotes'] ?? [];

        return array_map(function ($item) {
            return \App\Integrations\Mappers\CreditNoteMapper::toDTO($item);
        }, $creditNotes);
    }

    /**
     * Fetch items (products & services).
     *
     * @param TenantCredential $credential
     * @return \App\Integrations\DTOs\ItemDTO[]
     */
    public function getItems(TenantCredential $credential): array
    {
        $response = $this->get($credential, 'Items');
        $items = $response['Items'] ?? [];

        return array_map(function ($item) {
            return \App\Integrations\Mappers\ItemMapper::toDTO($item);
        }, $items);
    }

    /**
     * Fetch a single page of journals (max 100) using offset-based pagination.
     * offset = JournalNumber to start after. 0 means from the beginning.
     *
     * @param TenantCredential $credential
     * @param int $offset
     * @return \App\Integrations\DTOs\JournalDTO[]
     */
    public function getJournals(TenantCredential $credential, int $offset = 0): array
    {
        $query = $offset > 0 ? ['offset' => $offset] : [];
        $response = $this->get($credential, 'Journals', $query);
        $journals = $response['Journals'] ?? [];

        return array_map(function ($journal) {
            return \App\Integrations\Mappers\JournalMapper::toDTO($journal);
        }, $journals);
    }

    /**
     * Fetch manual journals.
     *
     * @param TenantCredential $credential
     * @return \App\Integrations\DTOs\ManualJournalDTO[]
     */
    public function getManualJournals(TenantCredential $credential): array
    {
        $response = $this->get($credential, 'ManualJournals');
        $manualJournals = $response['ManualJournals'] ?? [];

        return array_map(function ($mj) {
            return \App\Integrations\Mappers\ManualJournalMapper::toDTO($mj);
        }, $manualJournals);
    }

    /**
     * Fetch linked transactions with page-based pagination.
     *
     * @param TenantCredential $credential
     * @param int $page
     * @return \App\Integrations\DTOs\LinkedTransactionDTO[]
     */
    public function getLinkedTransactions(TenantCredential $credential, int $page = 1): array
    {
        $response = $this->get($credential, 'LinkedTransactions', [
            'page' => $page
        ]);
        $linkedTransactions = $response['LinkedTransactions'] ?? [];

        return array_map(function ($item) {
            return \App\Integrations\Mappers\LinkedTransactionMapper::toDTO($item);
        }, $linkedTransactions);
    }

    /**
     * Fetch organisation details.
     *
     * @param TenantCredential $credential
     * @return \App\Integrations\DTOs\OrganisationDTO|null
     */
    public function getOrganisation(TenantCredential $credential): ?\App\Integrations\DTOs\OrganisationDTO
    {
        $response = $this->get($credential, 'Organisation');
        $organisations = $response['Organisations'] ?? [];

        if (empty($organisations)) {
            return null;
        }

        return \App\Integrations\Mappers\OrganisationMapper::toDTO($organisations[0]);
    }

    /**
     * Fetch overpayments with page-based pagination.
     *
     * @param TenantCredential $credential
     * @param int $page
     * @return \App\Integrations\DTOs\OverpaymentDTO[]
     */
    public function getOverpayments(TenantCredential $credential, int $page = 1): array
    {
        $response = $this->get($credential, 'Overpayments', [
            'page' => $page
        ]);
        $overpayments = $response['Overpayments'] ?? [];

        return array_map(function ($item) {
            return \App\Integrations\Mappers\OverpaymentMapper::toDTO($item);
        }, $overpayments);
    }

    /**
     * Fetch prepayments with page-based pagination.
     *
     * @param TenantCredential $credential
     * @param int $page
     * @return \App\Integrations\DTOs\PrepaymentDTO[]
     */
    public function getPrepayments(TenantCredential $credential, int $page = 1): array
    {
        $response = $this->get($credential, 'Prepayments', [
            'page' => $page
        ]);
        $prepayments = $response['Prepayments'] ?? [];

        return array_map(function ($item) {
            return \App\Integrations\Mappers\PrepaymentMapper::toDTO($item);
        }, $prepayments);
    }

    /**
     * Fetch purchase orders with page-based pagination.
     *
     * @param TenantCredential $credential
     * @param int $page
     * @return \App\Integrations\DTOs\PurchaseOrderDTO[]
     */
    public function getPurchaseOrders(TenantCredential $credential, int $page = 1): array
    {
        $response = $this->get($credential, 'PurchaseOrders', [
            'page' => $page
        ]);
        $purchaseOrders = $response['PurchaseOrders'] ?? [];

        return array_map(function ($item) {
            return \App\Integrations\Mappers\PurchaseOrderMapper::toDTO($item);
        }, $purchaseOrders);
    }

    /**
     * Fetch quotes with page-based pagination.
     *
     * @param TenantCredential $credential
     * @param int $page
     * @return \App\Integrations\DTOs\QuoteDTO[]
     */
    public function getQuotes(TenantCredential $credential, int $page = 1): array
    {
        $response = $this->get($credential, 'Quotes', [
            'page' => $page
        ]);
        $quotes = $response['Quotes'] ?? [];

        return array_map(function ($item) {
            return \App\Integrations\Mappers\QuoteMapper::toDTO($item);
        }, $quotes);
    }

    /**
     * Fetch repeating invoices.
     *
     * @param TenantCredential $credential
     * @return \App\Integrations\DTOs\RepeatingInvoiceDTO[]
     */
    public function getRepeatingInvoices(TenantCredential $credential): array
    {
        $response = $this->get($credential, 'RepeatingInvoices');
        $repeatingInvoices = $response['RepeatingInvoices'] ?? [];

        return array_map(function ($item) {
            return \App\Integrations\Mappers\RepeatingInvoiceMapper::toDTO($item);
        }, $repeatingInvoices);
    }

    /**
     * Fetch a credit note as a PDF.
     *
     * @param TenantCredential $credential
     * @param string $creditNoteId
     * @return \Illuminate\Http\Client\Response
     */
    public function getCreditNoteAsPdf(TenantCredential $credential, string $creditNoteId)
    {
        $credential = $this->oauthManager->refreshIfNeeded($credential);

        $response = \Illuminate\Support\Facades\Http::withToken($credential->access_token)
            ->withHeaders([
                'Xero-Tenant-Id' => $credential->tenant_identifier,
                'Accept' => 'application/pdf',
            ])
            ->get("https://api.xero.com/api.xro/2.0/CreditNotes/{$creditNoteId}");

        if ($response->failed()) {
            \Illuminate\Support\Facades\Log::error("Xero API GET CreditNote PDF failed for ID {$creditNoteId}", [
                'tenant_id' => $credential->tenant_id,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new \Exception('Failed to download Credit Note PDF from Xero.');
        }

        return $response;
    }

    /**
     * Fetch payments.
     *
     * @param TenantCredential $credential
     * @return \App\Integrations\DTOs\PaymentDTO[]
     */
    public function getPayments(TenantCredential $credential): array
    {
        $response = $this->get($credential, 'Payments');
        $payments = $response['Payments'] ?? [];

        return array_map(function ($item) {
            return PaymentMapper::toDTO($item);
        }, $payments);
    }

    /**
     * Fetch ledger accounts.
     *
     * @param TenantCredential $credential
     * @return \App\Integrations\DTOs\AccountDTO[]
     */
    public function getAccounts(TenantCredential $credential): array
    {
        $response = $this->get($credential, 'Accounts');
        $accounts = $response['Accounts'] ?? [];

        return array_map(function ($item) {
            return AccountMapper::toDTO($item);
        }, $accounts);
    }

    /**
     * Fetch Profit & Loss report and parse it.
     *
     * @param TenantCredential $credential
     * @param string $startDate
     * @param string $endDate
     * @return ProfitLossReportDTO
     */
    public function getProfitLossReport(TenantCredential $credential, string $startDate, string $endDate): ProfitLossReportDTO
    {
        $response = $this->get($credential, 'Reports/ProfitAndLoss', [
            'fromDate' => $startDate,
            'toDate' => $endDate,
        ]);

        return $this->parseProfitLoss($response, $startDate, $endDate);
    }

    /**
     * Fetch Aged Payables By Contact report and parse it.
     */
    public function getAgedPayablesByContact(
        TenantCredential $credential,
        string $contactId,
        ?string $date = null,
        ?string $fromDate = null,
        ?string $toDate = null
    ): AgedPayablesReportDTO {
        $params = ['contactID' => $contactId];
        if ($date) $params['date'] = $date;
        if ($fromDate) $params['fromDate'] = $fromDate;
        if ($toDate) $params['toDate'] = $toDate;

        $response = $this->get($credential, 'Reports/AgedPayablesByContact', $params);

        return $this->parseAgedPayables($response);
    }

    /**
     * Parse Xero Aged Payables By Contact Report.
     */
    protected function parseAgedPayables(array $rawReport): AgedPayablesReportDTO
    {
        $report = $rawReport['Reports'][0] ?? [];
        $reportName = $report['ReportName'] ?? 'Aged Payables By Contact';
        $reportTitles = $report['ReportTitles'] ?? [];
        $reportDate = $report['ReportDate'] ?? '';

        $headers = [];
        $rows = [];
        $summaryRow = [];

        $rawRows = $report['Rows'] ?? [];
        foreach ($rawRows as $row) {
            $rowType = $row['RowType'] ?? '';

            if ($rowType === 'Header') {
                foreach ($row['Cells'] ?? [] as $cell) {
                    $headers[] = $cell['Value'] ?? '';
                }
            } elseif ($rowType === 'Section') {
                $sectionRows = $row['Rows'] ?? [];
                foreach ($sectionRows as $sRow) {
                    $sRowType = $sRow['RowType'] ?? '';
                    $rowData = [];
                    
                    if ($sRowType === 'Row') {
                        foreach ($sRow['Cells'] ?? [] as $cell) {
                            $rowData[] = [
                                'value' => $cell['Value'] ?? '',
                                'attributes' => $cell['Attributes'] ?? []
                            ];
                        }
                        $rows[] = $rowData;
                    } elseif ($sRowType === 'SummaryRow') {
                        foreach ($sRow['Cells'] ?? [] as $cell) {
                            $summaryRow[] = $cell['Value'] ?? '';
                        }
                    }
                }
            }
        }

        return new AgedPayablesReportDTO(
            reportName: $reportName,
            reportTitles: $reportTitles,
            reportDate: $reportDate,
            headers: $headers,
            rows: $rows,
            summaryRow: $summaryRow
        );
    }

    /**
     * Fetch Aged Receivables By Contact report and parse it.
     */
    public function getAgedReceivablesByContact(
        TenantCredential $credential,
        string $contactId,
        ?string $date = null,
        ?string $fromDate = null,
        ?string $toDate = null
    ): StandardReportDTO {
        $params = ['contactID' => $contactId];
        if ($date) $params['date'] = $date;
        if ($fromDate) $params['fromDate'] = $fromDate;
        if ($toDate) $params['toDate'] = $toDate;

        $response = $this->get($credential, 'Reports/AgedReceivablesByContact', $params);
        return $this->parseStandardReport($response);
    }

    /**
     * Fetch Balance Sheet report and parse it.
     */
    public function getBalanceSheetReport(
        TenantCredential $credential,
        ?string $date = null,
        ?int $periods = null,
        ?string $timeframe = null,
        ?bool $paymentsOnly = null
    ): StandardReportDTO {
        $params = [];
        if ($date) $params['date'] = $date;
        if ($periods) $params['periods'] = $periods;
        if ($timeframe) $params['timeframe'] = $timeframe;
        if ($paymentsOnly) $params['paymentsOnly'] = $paymentsOnly ? 'true' : 'false';

        $response = $this->get($credential, 'Reports/BalanceSheet', $params);
        return $this->parseStandardReport($response);
    }

    /**
     * Fetch Bank Summary report and parse it.
     */
    public function getBankSummaryReport(
        TenantCredential $credential,
        ?string $fromDate = null,
        ?string $toDate = null
    ): StandardReportDTO {
        $params = [];
        if ($fromDate) $params['fromDate'] = $fromDate;
        if ($toDate) $params['toDate'] = $toDate;

        $response = $this->get($credential, 'Reports/BankSummary', $params);
        return $this->parseStandardReport($response);
    }

    /**
     * Fetch Trial Balance report and parse it.
     */
    public function getTrialBalanceReport(
        TenantCredential $credential,
        ?string $date = null,
        ?bool $paymentsOnly = null
    ): StandardReportDTO {
        $params = [];
        if ($date) $params['date'] = $date;
        if ($paymentsOnly) $params['paymentsOnly'] = $paymentsOnly ? 'true' : 'false';

        $response = $this->get($credential, 'Reports/TrialBalance', $params);
        return $this->parseStandardReport($response);
    }

    /**
     * Parse Xero complex grid reports to a StandardReportDTO
     */
    protected function parseStandardReport(array $rawReport): StandardReportDTO
    {
        $report = $rawReport['Reports'][0] ?? [];
        $reportId = $report['ReportID'] ?? '';
        $reportName = $report['ReportName'] ?? '';
        $reportType = $report['ReportType'] ?? '';
        $reportTitles = $report['ReportTitles'] ?? [];
        $reportDate = $report['ReportDate'] ?? '';
        $updatedDateUtc = $report['UpdatedDateUTC'] ?? '';
        $fields = $report['Fields'] ?? [];
        $attributes = $report['Attributes'] ?? [];

        $headers = [];
        $rows = [];
        $summaryRow = [];

        $rawRows = $report['Rows'] ?? [];
        foreach ($rawRows as $row) {
            $rowType = $row['RowType'] ?? '';

            if ($rowType === 'Header') {
                foreach ($row['Cells'] ?? [] as $cell) {
                    $headers[] = $cell['Value'] ?? '';
                }
            } elseif ($rowType === 'Section') {
                $sectionRows = $row['Rows'] ?? [];
                
                // If it's a section with a title but no nested Rows direct (Balance Sheet structure)
                // We'll append a pseudo row showing the Section Title
                if (isset($row['Title'])) {
                    $rows[] = [['value' => $row['Title'], 'is_section_title' => true]];
                }

                foreach ($sectionRows as $sRow) {
                    $sRowType = $sRow['RowType'] ?? '';
                    $rowData = [];
                    
                    if ($sRowType === 'Row') {
                        foreach ($sRow['Cells'] ?? [] as $cell) {
                            $rowData[] = [
                                'value' => $cell['Value'] ?? '',
                                'attributes' => $cell['Attributes'] ?? []
                            ];
                        }
                        $rows[] = $rowData;
                    } elseif ($sRowType === 'SummaryRow') {
                        foreach ($sRow['Cells'] ?? [] as $cell) {
                            $summaryRow[] = $cell['Value'] ?? '';
                        }
                    }
                }
            } elseif ($rowType === 'Row') {
                $rowData = [];
                foreach ($row['Cells'] ?? [] as $cell) {
                    $rowData[] = [
                        'value' => $cell['Value'] ?? '',
                        'attributes' => $cell['Attributes'] ?? []
                    ];
                }
                $rows[] = $rowData;
            } elseif ($rowType === 'SummaryRow') {
                foreach ($row['Cells'] ?? [] as $cell) {
                    $summaryRow[] = $cell['Value'] ?? '';
                }
            }
        }

        return new StandardReportDTO(
            reportId: $reportId,
            reportName: $reportName,
            reportType: $reportType,
            reportTitles: $reportTitles,
            reportDate: $reportDate,
            updatedDateUtc: $updatedDateUtc,
            headers: $headers,
            rows: $rows,
            summaryRow: $summaryRow,
            fields: $fields,
            attributes: $attributes
        );
    }

    /**
     * Fetch all Tax Rates for a tenant.
     */
    public function getTaxRates(TenantCredential $credential): array
    {
        $response = $this->get($credential, 'TaxRates');
        return TaxRateMapper::toDTOCollection($response);
    }

    /**
     * Fetch all Users for a tenant.
     */
    public function getUsers(TenantCredential $credential): array
    {
        $response = $this->get($credential, 'Users');
        return XeroUserMapper::toDTOCollection($response);
    }

    /**
     * Parse the complex cell/row grid structure of Xero's Profit and Loss report.
     *
     * @param array $rawReport
     * @param string $startDate
     * @param string $endDate
     * @return ProfitLossReportDTO
     */
    protected function parseProfitLoss(array $rawReport, string $startDate, string $endDate): ProfitLossReportDTO
    {
        $report = $rawReport['Reports'][0] ?? [];
        $orgName = $report['ReportTitles'][0] ?? 'Unknown Organization';
        
        $revenueSections = [];
        $totalRevenue = 0.0;
        $cogsSections = [];
        $totalCogs = 0.0;
        $grossProfit = 0.0;
        $expenseSections = [];
        $totalExpenses = 0.0;
        $netProfit = 0.0;

        $rows = $report['Rows'] ?? [];

        foreach ($rows as $row) {
            $rowType = $row['RowType'] ?? '';

            if ($rowType === 'Section') {
                $title = strtolower($row['Title'] ?? '');
                $sectionRows = $row['Rows'] ?? [];
                
                $items = [];
                $sectionTotal = 0.0;
                
                foreach ($sectionRows as $sRow) {
                    $sRowType = $sRow['RowType'] ?? '';

                    if ($sRowType === 'Row') {
                        $cells = $sRow['Cells'] ?? [];
                        $label = $cells[0]['Value'] ?? '';
                        $val = (float) ($cells[1]['Value'] ?? 0.0);
                        if ($label !== '') {
                            $items[] = ['name' => $label, 'value' => $val];
                        }
                    } elseif ($sRowType === 'SummaryRow') {
                        $cells = $sRow['Cells'] ?? [];
                        $sectionTotal = (float) ($cells[1]['Value'] ?? 0.0);
                    }
                }

                if (str_contains($title, 'revenue') || str_contains($title, 'income') || str_contains($title, 'trading')) {
                    $revenueSections = array_merge($revenueSections, $items);
                    $totalRevenue += $sectionTotal ?: $this->sumValues($items);
                } elseif (str_contains($title, 'cost of sales') || str_contains($title, 'direct cost') || str_contains($title, 'cogs')) {
                    $cogsSections = array_merge($cogsSections, $items);
                    $totalCogs += $sectionTotal ?: $this->sumValues($items);
                } elseif (str_contains($title, 'expense') || str_contains($title, 'operating')) {
                    $expenseSections = array_merge($expenseSections, $items);
                    $totalExpenses += $sectionTotal ?: $this->sumValues($items);
                }
            } elseif ($rowType === 'SummaryRow') {
                $cells = $row['Cells'] ?? [];
                $label = strtolower($cells[0]['Value'] ?? '');
                $val = (float) ($cells[1]['Value'] ?? 0.0);
                
                if (str_contains($label, 'gross profit')) {
                     $grossProfit = $val;
                } elseif (str_contains($label, 'net profit') || str_contains($label, 'net income')) {
                     $netProfit = $val;
                }
            }
        }

        // Logical fallback in case summary fields are missing or not matched explicitly
        if ($grossProfit === 0.0) {
            $grossProfit = $totalRevenue - $totalCogs;
        }
        if ($netProfit === 0.0) {
            $netProfit = $grossProfit - $totalExpenses;
        }

        return new ProfitLossReportDTO(
            organizationName: $orgName,
            startDate: $startDate,
            endDate: $endDate,
            revenueSections: $revenueSections,
            totalRevenue: $totalRevenue,
            costOfGoodsSoldSections: $cogsSections,
            totalCostOfGoodsSold: $totalCogs,
            grossProfit: $grossProfit,
            expenseSections: $expenseSections,
            totalExpenses: $totalExpenses,
            netProfit: $netProfit
        );
    }

    /**
     * Helper to sum values in sub sections.
     *
     * @param array $items
     * @return float
     */
    private function sumValues(array $items): float
    {
        return array_reduce($items, function ($carry, $item) {
            return $carry + $item['value'];
        }, 0.0);
    }

    /**
     * Fetch bank transactions.
     *
     * @param TenantCredential $credential
     * @return \App\Integrations\DTOs\BankTransactionDTO[]
     */
    public function getBankTransactions(TenantCredential $credential): array
    {
        $response = $this->get($credential, 'BankTransactions');
        $bankTransactions = $response['BankTransactions'] ?? [];

        return array_map(function ($item) {
            return \App\Integrations\Mappers\BankTransactionMapper::toDTO($item);
        }, $bankTransactions);
    }

    /**
     * Formats the filename for Xero. Only encodes brackets/parentheses, leaving other chars unencoded.
     *
     * @param string $filename
     * @return string
     */
    protected function formatFilenameForXero(string $filename): string
    {
        $replacements = [
            '[' => '%5B',
            ']' => '%5D',
            '(' => '%28',
            ')' => '%29',
        ];
        return str_replace(array_keys($replacements), array_values($replacements), $filename);
    }

    /**
     * Get list of attachments for a document.
     *
     * @param TenantCredential $credential
     * @param string $endpoint
     * @param string $guid
     * @return array
     */
    public function getAttachments(TenantCredential $credential, string $endpoint, string $guid): array
    {
        $credential = $this->oauthManager->refreshIfNeeded($credential);

        $response = Http::withToken($credential->access_token)
            ->withHeaders([
                'Xero-Tenant-Id' => $credential->tenant_identifier,
                'Accept' => 'application/json',
            ])
            ->get("https://api.xero.com/api.xro/2.0/{$endpoint}/{$guid}/Attachments");

        if ($response->failed()) {
            Log::error("Xero API GET attachments failed on endpoint {$endpoint}/{$guid}", [
                'tenant_id' => $credential->tenant_id,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new \Exception("Xero Get Attachments failed: " . $response->body());
        }

        return $response->json();
    }

    /**
     * Download specific attachment raw content.
     *
     * @param TenantCredential $credential
     * @param string $endpoint
     * @param string $guid
     * @param string $filename
     * @return \Illuminate\Http\Client\Response
     */
    public function downloadAttachment(TenantCredential $credential, string $endpoint, string $guid, string $filename): \Illuminate\Http\Client\Response
    {
        $credential = $this->oauthManager->refreshIfNeeded($credential);
        $formattedFilename = $this->formatFilenameForXero($filename);

        $response = Http::withToken($credential->access_token)
            ->withHeaders([
                'Xero-Tenant-Id' => $credential->tenant_identifier,
            ])
            ->get("https://api.xero.com/api.xro/2.0/{$endpoint}/{$guid}/Attachments/{$formattedFilename}");

        if ($response->failed()) {
            Log::error("Xero API GET attachment content failed on endpoint {$endpoint}/{$guid}/Attachments/{$filename}", [
                'tenant_id' => $credential->tenant_id,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new \Exception("Xero Download Attachment failed: " . $response->body());
        }

        return $response;
    }

    /**
     * Upload an attachment to Xero.
     *
     * @param TenantCredential $credential
     * @param string $endpoint
     * @param string $guid
     * @param string $filename
     * @param string $fileContent
     * @param string $mimeType
     * @param bool $includeOnline
     * @return array
     */
    public function uploadAttachment(
        TenantCredential $credential,
        string $endpoint,
        string $guid,
        string $filename,
        string $fileContent,
        string $mimeType,
        bool $includeOnline = false
    ): array {
        $credential = $this->oauthManager->refreshIfNeeded($credential);
        $formattedFilename = $this->formatFilenameForXero($filename);

        $url = "https://api.xero.com/api.xro/2.0/{$endpoint}/{$guid}/Attachments/{$formattedFilename}";
        if ($includeOnline) {
            $url .= "?IncludeOnline=true";
        }

        $response = Http::withToken($credential->access_token)
            ->withHeaders([
                'Xero-Tenant-Id' => $credential->tenant_identifier,
                'Accept' => 'application/json',
            ])
            ->withBody($fileContent, $mimeType)
            ->post($url);

        if ($response->failed()) {
            Log::error("Xero API POST attachment failed on endpoint {$endpoint}/{$guid}/Attachments/{$filename}", [
                'tenant_id' => $credential->tenant_id,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new \Exception("Xero Upload Attachment failed: " . $response->body());
        }

        return $response->json();
    }

    /**
     * Fetch bank statements from the provider.
     *
     * @param TenantCredential $credential
     * @param string $bankAccountId
     * @param string $fromDate
     * @param string $toDate
     * @return array
     */
    public function getBankStatements(TenantCredential $credential, string $bankAccountId, string $fromDate, string $toDate): array
    {
        $credential = $this->oauthManager->refreshIfNeeded($credential);

        $response = Http::withToken($credential->access_token)
            ->withHeaders([
                'Xero-Tenant-Id' => $credential->tenant_identifier,
                'Accept' => 'application/json',
            ])
            ->get("https://api.xero.com/finance.xro/1.0/BankStatementsPlus/statements", [
                'BankAccountID' => $bankAccountId,
                'FromDate' => $fromDate,
                'ToDate' => $toDate,
            ]);

        if ($response->failed()) {
            Log::error("Xero Finance API GET BankStatements failed", [
                'tenant_id' => $credential->tenant_id,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new \Exception("Xero Finance API BankStatements failed: " . $response->body());
        }

        return $response->json();
    }

    /**
     * Fetch bank transfers from the provider.
     *
     * @param TenantCredential $credential
     * @return array
     */
    public function getBankTransfers(TenantCredential $credential): array
    {
        return $this->get($credential, 'BankTransfers');
    }

    /**
     * Fetch currencies.
     */
    public function getCurrencies(TenantCredential $credential): array
    {
        $response = $this->get($credential, 'Currencies');
        return $response['Currencies'] ?? [];
    }

    /**
     * Add a currency.
     */
    public function addCurrency(TenantCredential $credential, string $code, string $description = null): array
    {
        $payload = [
            'Code' => $code,
        ];
        if ($description) {
            $payload['Description'] = $description;
        }

        $credential = $this->oauthManager->refreshIfNeeded($credential);

        $response = \Illuminate\Support\Facades\Http::withToken($credential->access_token)
            ->withHeaders([
                'Xero-Tenant-Id' => $credential->tenant_identifier,
                'Accept' => 'application/json',
                'Content-Type' => 'application/json'
            ])
            ->put('https://api.xero.com/api.xro/2.0/Currencies', $payload);

        if ($response->failed()) {
            \Illuminate\Support\Facades\Log::error('Xero API PUT Currencies failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new \Exception('Failed to add Currency to Xero: ' . $response->body());
        }

        return $response->json();
    }

    /**
     * Fetch batch payments from the provider.
     *
     * @param TenantCredential $credential
     * @return array
     */
    public function getBatchPayments(TenantCredential $credential): array
    {
        return $this->get($credential, 'BatchPayments', [
            'order' => 'Date DESC',
        ]);
    }

    /**
     * Fetch branding themes from the provider.
     *
     * @param TenantCredential $credential
     * @return array
     */
    public function getBrandingThemes(TenantCredential $credential): array
    {
        return $this->get($credential, 'BrandingThemes');
    }

    /**
     * Fetch payment services for a branding theme from the provider.
     *
     * @param TenantCredential $credential
     * @param string $themeId
     * @return array
     */
    public function getPaymentServices(TenantCredential $credential, string $themeId): array
    {
        return $this->get($credential, "BrandingThemes/{$themeId}/PaymentServices");
    }

    /**
     * Fetch all budgets from the provider.
     *
     * @param TenantCredential $credential
     * @return array
     */
    public function getBudgets(TenantCredential $credential): array
    {
        return $this->get($credential, 'Budgets');
    }

    /**
     * Fetch details of a specific budget including BudgetLines.
     *
     * @param TenantCredential $credential
     * @param string $budgetId
     * @return array
     */
    public function getBudgetDetails(TenantCredential $credential, string $budgetId): array
    {
        return $this->get($credential, "Budgets/{$budgetId}");
    }

    /**
     * Fetch all contact groups from the provider.
     *
     * @param TenantCredential $credential
     * @return array
     */
    public function getContactGroups(TenantCredential $credential): array
    {
        return $this->get($credential, 'ContactGroups');
    }

    /**
     * Fetch details of a specific contact group including its contacts.
     *
     * @param TenantCredential $credential
     * @param string $groupId
     * @return array
     */
    public function getContactGroupDetails(TenantCredential $credential, string $groupId): array
    {
        return $this->get($credential, "ContactGroups/{$groupId}");
    }
}
