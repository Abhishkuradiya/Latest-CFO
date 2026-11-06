import { db } from '@/lib/db';

export async function getOrFetchManagementReport(
  tenantId: number,
  reportType: string,
  fetchFromXero: () => Promise<unknown | null>,
) {
  let report = await db.getPostgresReport(tenantId, reportType);
  if (report !== null) return report;

  const fetched = await fetchFromXero();
  if (fetched === null || fetched === undefined) return null;

  await db.savePostgresReport(tenantId, reportType, fetched);
  report = await db.getPostgresReport(tenantId, reportType);
  if (report === null) throw new Error(`Xero report ${reportType} was not available after saving to PostgreSQL.`);
  return report;
}
