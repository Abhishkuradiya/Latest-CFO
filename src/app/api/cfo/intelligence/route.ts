import { NextRequest, NextResponse } from 'next/server';
import { CFOIntelligenceEngine } from '@/lib/services/CFOIntelligenceEngine';
import { getTenantIdFromSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionTenantId = await getTenantIdFromSession();
    if (!sessionTenantId) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }
    const tenantId = String(sessionTenantId);
    const today = new Date();
    const defaultEndDate = today.toISOString().slice(0, 10);
    const defaultStartDate = `${today.getFullYear()}-01-01`;
    const startDate = searchParams.get('startDate') || defaultStartDate;
    const endDate = searchParams.get('endDate') || defaultEndDate;
    const section = searchParams.get('section') || 'all';

    const result = await CFOIntelligenceEngine.getIntelligence(tenantId, startDate, endDate);

    const baseHeader = {
      period: result.period,
      currency: result.currency,
      calculationSource: result.calculationSource,
      dataCoverage: result.dataCoverage,
      mappingCoverage: result.mappingCoverage,
      warnings: result.warnings,
      traceability: result.traceability
    };

    if (section === 'profitability') {
      return NextResponse.json({ ...baseHeader, profitability: result.profitability });
    }
    if (section === 'expenses') {
      return NextResponse.json({ ...baseHeader, expenses: result.expenses });
    }
    if (section === 'revenue') {
      return NextResponse.json({ ...baseHeader, revenue: result.revenue });
    }
    if (section === 'cash-flow') {
      return NextResponse.json({ ...baseHeader, cashFlow: result.cashFlow });
    }
    if (section === 'working-capital') {
      return NextResponse.json({ ...baseHeader, workingCapital: result.workingCapital });
    }
    if (section === 'alerts') {
      return NextResponse.json({ ...baseHeader, alerts: result.alerts, insights: result.insights });
    }
    if (section === 'summary') {
      return NextResponse.json({
        ...baseHeader,
        profitability: {
          revenue: result.profitability.revenue,
          grossProfit: result.profitability.grossProfit,
          operatingProfit: result.profitability.operatingProfit,
          netProfit: result.profitability.netProfit
        },
        alertCount: result.alerts.length,
        insightCount: result.insights.length
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in /api/cfo/intelligence API route:', error);
    return NextResponse.json(
      {
        error: error.message || 'Internal Server Error',
        warnings: ['An error occurred while generating CFO intelligence.']
      },
      { status: 500 }
    );
  }
}
