import { NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/auth';
import { deleteManagementManualJournal } from '@/lib/services/ManagementManualJournalService';

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getAuthenticatedSession();
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const { id } = await context.params;
  const journalId = Number(id);
  if (!Number.isSafeInteger(journalId) || journalId <= 0) {
    return NextResponse.json({ error: 'Choose a valid management journal.' }, { status: 400 });
  }

  try {
    const reference = await deleteManagementManualJournal(session.tenantId, journalId);
    if (!reference) return NextResponse.json({ error: 'This management-only journal was not found.' }, { status: 404 });
    return NextResponse.json({ success: true, reference });
  } catch (error) {
    console.error('Management-only journal deletion failed:', error);
    return NextResponse.json({ error: 'The management-only journal could not be deleted.' }, { status: 500 });
  }
}
