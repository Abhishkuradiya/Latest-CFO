"use client";

import { use } from 'react';
import { CopilotWorkspace } from '@/components/cfo-copilot/CopilotWorkspace';

export default function CFOCopilotThreadPage({ params }: { params: Promise<{ chatId: string }> }) {
  const resolvedParams = use(params);
  return <CopilotWorkspace initialChatId={resolvedParams.chatId} />;
}
