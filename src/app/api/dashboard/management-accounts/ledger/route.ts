import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/auth';
import { getManagementLedgerExportData, listManagementLedger, loadLedgerAccountDetail } from '@/lib/services/ManagementAccountsLedgerService';

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
    const accountId = params.get('accountId');
    if (accountId) {
      const detail = await loadLedgerAccountDetail(session.tenantId, accountId, fromDate, toDate);
      return NextResponse.json({ ...detail, canManageManualJournals: true });
    }
    if (params.get('export') === 'true') {
      const ledger = await getManagementLedgerExportData(session.tenantId, fromDate, toDate);
      return NextResponse.json({ ...ledger, canManageManualJournals: true });
    }
    const ledger = await listManagementLedger(session.tenantId, fromDate, toDate);
    return NextResponse.json({ ...ledger, canManageManualJournals: true });
  } catch (error) {
    console.error('Management ledger retrieval failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Ledger details could not be loaded.' }, { status: 502 });
  }
}
