import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/auth';
import { updateBookkeepingCloseCheck, updateBookkeepingIssue } from '@/lib/services/bookkeeping-health';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await getAuthenticatedSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    if (typeof body.action !== 'string') {
      return NextResponse.json({ error: 'An action is required.' }, { status: 400 });
    }
    if (typeof body.checklistKey === 'string' && body.checklistKey.trim()) {
      const result = await updateBookkeepingCloseCheck(session.tenantId, session, body.checklistKey, body.action, typeof body.assignedTo === 'string' ? body.assignedTo : undefined, typeof body.expectedDate === 'string' ? body.expectedDate : undefined, typeof body.note === 'string' ? body.note : undefined);
      return NextResponse.json({ success: true, ...result });
    }
    if (typeof body.issueKey !== 'string' || !body.issueKey.trim()) return NextResponse.json({ error: 'Issue identifier is required.' }, { status: 400 });
    const result = await updateBookkeepingIssue(session.tenantId, session, body.issueKey, body.action, typeof body.note === 'string' ? body.note : undefined, typeof body.assignedTo === 'string' ? body.assignedTo : undefined);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'The issue action could not be saved.' }, { status: 400 });
  }
}
