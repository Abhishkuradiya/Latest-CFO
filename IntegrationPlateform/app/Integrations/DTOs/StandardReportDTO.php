<?php

namespace App\Integrations\DTOs;

class StandardReportDTO
{
    public function __construct(
        public readonly string $reportId,
        public readonly string $reportName,
        public readonly string $reportType,
        public readonly array $reportTitles,
        public readonly string $reportDate,
        public readonly string $updatedDateUtc,
        public readonly array $headers,
        public readonly array $rows,
        public readonly array $summaryRow,
        public readonly array $fields = [],
        public readonly array $attributes = []
    ) {}

    public function toArray(): array
    {
        return [
            'report_id' => $this->reportId,
            'report_name' => $this->reportName,
            'report_type' => $this->reportType,
            'report_titles' => $this->reportTitles,
            'report_date' => $this->reportDate,
            'updated_date_utc' => $this->updatedDateUtc,
            'headers' => $this->headers,
            'rows' => $this->rows,
            'summary_row' => $this->summaryRow,
            'fields' => $this->fields,
            'attributes' => $this->attributes,
        ];
    }
}
