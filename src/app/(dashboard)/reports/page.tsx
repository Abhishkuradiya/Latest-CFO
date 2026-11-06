import React from 'react';
import { PageContainer } from '@/components/common/page-container';
import { SectionHeader } from '@/components/common/section-header';

export default function ReportsPage() {
  return (
    <PageContainer>
      <SectionHeader
        title="Reports"
        description="Scaffolded corporate reports dashboard cockpit."
      />
      <div className="rounded-lg border border-dashed p-12 text-center text-xs text-muted-foreground bg-card/30">
        Analytics metrics and grids for Reports will be integrated here.
      </div>
    </PageContainer>
  );
}
