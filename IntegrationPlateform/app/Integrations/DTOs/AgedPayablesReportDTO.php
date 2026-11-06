<?php

namespace App\Integrations\DTOs;

class AgedPayablesReportDTO
{
    public function __construct(
        public readonly string $reportName,
        public readonly array $reportTitles,
        public readonly string $reportDate,
        public readonly array $headers,
        public readonly array $rows,
        public readonly array $summaryRow
    ) {}

    public function toArray(): array
    {
        return [
            'report_name' => $this->reportName,
            'report_titles' => $this->reportTitles,
            'report_date' => $this->reportDate,
            'headers' => $this->headers,
            'rows' => $this->rows,
            'summary_row' => $this->summaryRow,
        ];
    }
}
