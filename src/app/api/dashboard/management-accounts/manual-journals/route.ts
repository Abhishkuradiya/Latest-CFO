import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/auth';
import { createManagementManualJournal, listManagementManualJournals } from '@/lib/services/ManagementManualJournalService';

function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function GET(request: NextRequest) {
  const session = await getAuthenticatedSession();
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const params = request.nextUrl.searchParams;
  const fromDate = params.get('fromDate');
  const toDate = params.get('toDate');
  if (!validDate(fromDate) || !validDate(toDate) || fromDate > toDate) return NextResponse.json({ error: 'Choose a valid reporting period.' }, { status: 400 });
  try {
    const journals = await listManagementManualJournals(session.tenantId, fromDate, toDate);
    return NextResponse.json({ journals });
  } catch (error) {
    console.error('Management-only journals could not be loaded:', error);
    return NextResponse.json({ error: 'Management-only journals could not be loaded.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getAuthenticatedSession();
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    const journal = await createManagementManualJournal(session.tenantId, { userId: session.userId, email: session.email }, await request.json());
    return NextResponse.json({ journal }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Journal could not be saved.' }, { status: 400 });
  }
}
