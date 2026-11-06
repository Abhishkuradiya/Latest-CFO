import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';
import { AccountMappingService, TenantAccountMapping } from '@/lib/services/AccountMappingService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = (searchParams.get('status') || 'ALL').toUpperCase();
  const categoryFilter = (searchParams.get('category') || 'ALL').toUpperCase();
  const activeFilter = (searchParams.get('active') || 'true').toLowerCase();
  const searchQuery = (searchParams.get('search') || '').toLowerCase().trim();
  const includeUnmapped = searchParams.get('unmapped') === 'true';

  try {
    let allMappings = await AccountMappingService.getMappings(tenantId);
    
    // Auto-seed initial mappings if DB mappings are completely empty
    if (allMappings.length === 0) {
      const cachedAccounts = await db.getAccounts(tenantId).catch(() => []);
      if (Array.isArray(cachedAccounts) && cachedAccounts.length > 0) {
        await AccountMappingService.seedMappingsForTenant(tenantId, cachedAccounts);
        allMappings = await AccountMappingService.getMappings(tenantId);
      }
    }

    const cachedAccounts = await db.getAccounts(tenantId).catch(() => []);
    const unmappedAccounts = await AccountMappingService.findUnmappedAccounts(tenantId, cachedAccounts);

    const summary = {
      totalCount: allMappings.length,
      confirmedCount: allMappings.filter(m => m.status === 'CONFIRMED').length,
      suggestedCount: allMappings.filter(m => m.status === 'SUGGESTED').length,
      customCount: allMappings.filter(m => m.status === 'CUSTOM_OVERRIDE').length,
      unmappedCount: unmappedAccounts.length
    };

    let filtered = allMappings;

    // Filter by Active Status
    if (activeFilter === 'true') {
      filtered = filtered.filter(m => m.active !== false);
    } else if (activeFilter === 'false') {
      filtered = filtered.filter(m => m.active === false);
    }

    // Filter by Mapping Lifecycle Status
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(m => m.status === statusFilter);
    }

    // Filter by Financial Statement Category
    if (categoryFilter !== 'ALL') {
      filtered = filtered.filter(m => m.financial_statement_category === categoryFilter);
    }

    // Filter by Search Query
    if (searchQuery) {
      filtered = filtered.filter(m => 
        (m.account_code || '').toLowerCase().includes(searchQuery) ||
        (m.account_name || '').toLowerCase().includes(searchQuery) ||
        (m.source_account_type || '').toLowerCase().includes(searchQuery) ||
        (m.subcategory || '').toLowerCase().includes(searchQuery)
      );
    }

    const formattedMappings = filtered.map(m => ({
      id: m.id,
      source: m.source,
      sourceAccountId: m.source_account_id,
      accountCode: m.account_code,
      accountName: m.account_name,
      sourceAccountType: m.source_account_type,
      sourceAccountClass: m.source_account_class,
      financialStatementCategory: m.financial_statement_category,
      subcategory: m.subcategory,
      cfoAnalyticalTag: m.cfo_analytical_tag || 'UNSPECIFIED',
      status: m.status,
      confidenceScore: typeof m.confidence_score === 'string' ? parseFloat(m.confidence_score) : (m.confidence_score || 0.5),
      userConfirmed: Boolean(m.user_confirmed),
      active: Boolean(m.active),
      createdAt: m.created_at,
      updatedAt: m.updated_at
    }));

    return NextResponse.json({
      tenantId,
      summary,
      mappings: formattedMappings,
      unmappedAccounts: includeUnmapped ? unmappedAccounts : []
    });
  } catch (err: any) {
    console.error('Error fetching account mappings:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, mappingId, financialStatementCategory, subcategory, cfoAnalyticalTag } = body;

    if (action === 'seed') {
      const cachedAccounts = await db.getAccounts(tenantId).catch(() => []);
      const seedResult = await AccountMappingService.seedMappingsForTenant(tenantId, cachedAccounts);
      return NextResponse.json({ success: true, action: 'seed', ...seedResult });
    }

    if (!mappingId) {
      return NextResponse.json({ error: 'Missing mappingId' }, { status: 400 });
    }

    // Strict Tenant Ownership Check
    const existingMappings = await AccountMappingService.getMappings(tenantId);
    const targetMapping = existingMappings.find(m => String(m.id) === String(mappingId));

    if (!targetMapping) {
      return NextResponse.json({ error: 'Mapping record not found or access denied for this tenant.' }, { status: 403 });
    }

    let updatedRecord: TenantAccountMapping | null = null;

    if (action === 'confirm') {
      updatedRecord = await AccountMappingService.confirmMapping(tenantId, mappingId);
    } else if (action === 'override') {
      if (!financialStatementCategory) {
        return NextResponse.json({ error: 'Missing financialStatementCategory for override' }, { status: 400 });
      }
      updatedRecord = await AccountMappingService.overrideMapping(tenantId, mappingId, {
        financial_statement_category: financialStatementCategory,
        subcategory: subcategory || targetMapping.subcategory,
        cfo_analytical_tag: cfoAnalyticalTag !== undefined ? cfoAnalyticalTag : targetMapping.cfo_analytical_tag
      });
    } else {
      return NextResponse.json({ error: 'Invalid action. Supported: confirm, override, seed' }, { status: 400 });
    }

    if (!updatedRecord) {
      return NextResponse.json({ error: 'Failed to update mapping record' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      action,
      mapping: {
        id: updatedRecord.id,
        source: updatedRecord.source,
        sourceAccountId: updatedRecord.source_account_id,
        accountCode: updatedRecord.account_code,
        accountName: updatedRecord.account_name,
        sourceAccountType: updatedRecord.source_account_type,
        sourceAccountClass: updatedRecord.source_account_class,
        financialStatementCategory: updatedRecord.financial_statement_category,
        subcategory: updatedRecord.subcategory,
        cfoAnalyticalTag: updatedRecord.cfo_analytical_tag || 'UNSPECIFIED',
        status: updatedRecord.status,
        confidenceScore: updatedRecord.confidence_score,
        userConfirmed: Boolean(updatedRecord.user_confirmed),
        active: Boolean(updatedRecord.active)
      }
    });
  } catch (err: any) {
    console.error('Error updating account mapping:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
