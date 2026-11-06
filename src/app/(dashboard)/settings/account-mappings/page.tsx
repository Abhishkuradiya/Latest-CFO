import React from 'react';
import { PageContainer } from '@/components/common/page-container';
import { SectionHeader } from '@/components/common/section-header';
import AccountMappingSettings from '@/components/settings/AccountMappingSettings';

export default function AccountMappingsSettingsPage() {
  return (
    <PageContainer>
      <SectionHeader
        title="Account Mappings"
        description="Configure tenant-isolated general ledger classifications and CFO analytical categories."
      />
      <AccountMappingSettings />
    </PageContainer>
  );
}
