import { NextRequest, NextResponse } from 'next/server';
import { isDeepStrictEqual } from 'node:util';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function getPlanKey(searchParams?: URLSearchParams, body?: Record<string, unknown>): string {
  if (searchParams?.get('planKey')) return searchParams.get('planKey')!;
  if (body?.planKey && typeof body.planKey === 'string') return body.planKey;

  const year = searchParams?.get('year') || (body?.year ? String(body.year) : null);
  if (year) return `plan_${year}`;

  return 'default_plan';
}

function removeLegacyDefaultBudgets(planData: any) {
  if (!planData || planData.planSchemaVersion === 2) return planData;

  const normalized = structuredClone(planData);
  const monthlyByMonth = normalized.monthlyByMonth;
  if (monthlyByMonth && typeof monthlyByMonth === 'object') {
    for (const month of Object.values(monthlyByMonth) as Record<string, any>[]) {
      for (const [category, values] of Object.entries(month)) {
        if (values && typeof values === 'object' && values.budget === 0) {
          delete values.budget;
          if (Object.keys(values).length === 0) delete month[category];
        }
      }
    }
  } else if (normalized.monthly && typeof normalized.monthly === 'object') {
    for (const [category, values] of Object.entries(normalized.monthly) as [string, any][]) {
      if (values && typeof values === 'object' && values.budget === 0) {
        delete values.budget;
        if (Object.keys(values).length === 0) delete normalized.monthly[category];
      }
    }
  }

  normalized.planSchemaVersion = 2;
  return normalized;
}

export async function GET(req: NextRequest) {
  try {
    if (!(await db.checkPgConnection())) {
      return NextResponse.json(
        { success: false, error: 'PostgreSQL is unavailable; saved budgets cannot be loaded.' },
        { status: 503 },
      );
    }
    const sessionTenantId = await getTenantIdFromSession();
    const tenantId = sessionTenantId || 1;

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    if (action === 'list') {
      const plans = await db.listCustomBudgetPlans(tenantId);
      const years = plans
        .map((p) => {
          const match = p.planKey.match(/^plan_(\d{4})$/);
          return match ? parseInt(match[1], 10) : null;
        })
        .filter((y): y is number => y !== null);

      return NextResponse.json({
        success: true,
        tenantId,
        plans,
        years,
      });
    }

    const planKey = getPlanKey(searchParams);
    const storedPlan = await db.getCustomBudgetPlan(tenantId, planKey);
    const planData = removeLegacyDefaultBudgets(storedPlan);
    if (planData && planData !== storedPlan) {
      const saved = await db.saveCustomBudgetPlan(tenantId, planData, planKey);
      const verifiedPlan = saved ? await db.getCustomBudgetPlan(tenantId, planKey) : null;
      if (!verifiedPlan || !isDeepStrictEqual(verifiedPlan, planData)) {
        return NextResponse.json(
          { success: false, error: 'Could not migrate legacy zero-default budgets in PostgreSQL.' },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      success: true,
      tenantId,
      planKey,
      plan: planData || null,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error fetching custom budget plan:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch budget plan' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await db.checkPgConnection())) {
      return NextResponse.json(
        { success: false, error: 'PostgreSQL is unavailable; the budget was not saved.' },
        { status: 503 },
      );
    }
    const sessionTenantId = await getTenantIdFromSession();
    const tenantId = sessionTenantId || 1;

    const body = await req.json();
    const planKey = getPlanKey(undefined, body);
    const planData = body?.plan || body?.plan_data;

    if (!planData) {
      return NextResponse.json(
        { success: false, error: 'Missing plan payload in request body' },
        { status: 400 }
      );
    }

    const saved = await db.saveCustomBudgetPlan(tenantId, planData, planKey);
    if (!saved) {
      return NextResponse.json(
        { success: false, error: 'Failed to persist the budget plan.' },
        { status: 500 },
      );
    }

    const persistedPlan = await db.getCustomBudgetPlan(tenantId, planKey);
    if (!persistedPlan || !isDeepStrictEqual(persistedPlan, planData)) {
      return NextResponse.json(
        { success: false, error: 'The saved budget plan did not match the submitted values when read back from PostgreSQL.' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Custom budget plan saved and verified in database storage',
      tenantId,
      planKey,
      updatedAt: new Date().toISOString(),
      plan: persistedPlan,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error saving custom budget plan to database:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to save budget plan to database' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!(await db.checkPgConnection())) {
      return NextResponse.json(
        { success: false, error: 'PostgreSQL is unavailable; the saved budget was not deleted.' },
        { status: 503 },
      );
    }
    const sessionTenantId = await getTenantIdFromSession();
    const tenantId = sessionTenantId || 1;

    const { searchParams } = new URL(req.url);
    let body: Record<string, unknown> | undefined;
    try {
      body = await req.json();
    } catch {
      // empty body
    }

    const planKey = getPlanKey(searchParams, body);
    const deleted = await db.deleteCustomBudgetPlan(tenantId, planKey);

    return NextResponse.json({
      success: Boolean(deleted),
      message: 'Custom budget plan removed from database',
      tenantId,
      planKey,
      deleted,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error deleting custom budget plan:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to delete budget plan from database' },
      { status: 500 }
    );
  }
}
