/* eslint-disable @typescript-eslint/no-explicit-any -- Provider settings and response payloads are JSON APIs. */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { getAuthenticatedSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { buildBookkeepingAiContext, updateRecommendation } from '@/lib/services/bookkeeping-health';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MODEL = 'claude-quantum-lite-1';
const settingsPath = path.join(process.cwd(), 'src', 'data', 'system_settings.json');

async function getAiSettings() {
  const settings: Record<string, any> = {};
  try {
    if (fs.existsSync(settingsPath)) Object.assign(settings, JSON.parse(fs.readFileSync(settingsPath, 'utf8')));
  } catch { /* PostgreSQL settings are preferred when available. */ }
  if (db.isPgActive()) {
    const result = await db.query('SELECT llm_api_key, llm_base_url, llm_enabled_models FROM system_settings WHERE id = 1 LIMIT 1');
    const row = result.rows[0];
    if (row) {
      if (row.llm_api_key) settings.llmApiKey = row.llm_api_key;
      if (row.llm_base_url) settings.llmBaseUrl = row.llm_base_url;
      if (row.llm_enabled_models) {
        try { settings.llmEnabledModels = typeof row.llm_enabled_models === 'string' ? JSON.parse(row.llm_enabled_models) : row.llm_enabled_models; } catch { /* Use the configured file value. */ }
      }
    }
  }
  return settings;
}

function parseRecommendations(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(cleaned);
  return Array.isArray(parsed) ? parsed : parsed.recommendations;
}

export async function POST(request: NextRequest) {
  const session = await getAuthenticatedSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    if (body.action === 'decision') {
      const decision = String(body.decision ?? '').toUpperCase();
      if (!['ACCEPTED', 'REJECTED', 'REVIEW'].includes(decision) || !Number.isInteger(Number(body.id))) {
        return NextResponse.json({ error: 'A valid recommendation and decision are required.' }, { status: 400 });
      }
      const result = await updateRecommendation(session.tenantId, session, Number(body.id), decision as 'ACCEPTED' | 'REJECTED' | 'REVIEW');
      return NextResponse.json({ success: true, status: result.status });
    }

    const settings = await getAiSettings();
    const apiKey = typeof settings.llmApiKey === 'string' ? settings.llmApiKey.trim() : '';
    const baseUrl = typeof settings.llmBaseUrl === 'string' ? settings.llmBaseUrl.replace(/\/+$/, '') : '';
    const enabled = Array.isArray(settings.llmEnabledModels) && settings.llmEnabledModels.includes(MODEL);
    if (!enabled || !apiKey || !baseUrl) return NextResponse.json({ error: `${MODEL} is not enabled or the AI provider URL/key is not configured.` }, { status: 503 });

    const periodStart = /^\d{4}-\d{2}-\d{2}$/.test(body.periodStart ?? '') ? body.periodStart : undefined;
    const periodEnd = /^\d{4}-\d{2}-\d{2}$/.test(body.periodEnd ?? '') ? body.periodEnd : undefined;
    const facts = await buildBookkeepingAiContext(session.tenantId, { startDate: periodStart, endDate: periodEnd });
    const references = new Set<string>();
    for (const finding of facts.findings) if (finding.id) references.add(finding.id);
    for (const record of facts.accountingRecords) if (record.sourceId) references.add(record.sourceId);
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1600,
        temperature: 0.1,
        system: 'You are a bookkeeping review assistant. Analyse only the supplied database-backed Xero facts. Never invent a transaction, cause, tax conclusion, or resolution. Do not propose automatic edits to accounting data. Return valid JSON only in the shape {"recommendations":[{"title":"...","explanation":"...","supportingReferences":["IDs exactly as supplied"],"suggestedAction":"..."}]}. Return at most 6 concise recommendations. Each recommendation must cite at least one supplied issue id or source transaction id. If there are no evidence-supported actions, return an empty recommendations array. This is operational guidance, not tax or accounting advice.',
        messages: [{ role: 'user', content: JSON.stringify(facts) }]
      }),
      signal: AbortSignal.timeout(25000)
    });
    if (!response.ok) return NextResponse.json({ error: `AI provider returned HTTP ${response.status}. No recommendation was saved.` }, { status: 502 });
    const payload = await response.json();
    const text = Array.isArray(payload.content) ? payload.content.filter((part: any) => part.type === 'text').map((part: any) => part.text ?? '').join('\n') : '';
    const recommendations = parseRecommendations(text);
    if (!Array.isArray(recommendations)) throw new Error('The AI response did not contain a valid recommendations list.');
    const saved = [];
    for (const item of recommendations.slice(0, 6)) {
      if (typeof item.title !== 'string' || typeof item.explanation !== 'string' || typeof item.suggestedAction !== 'string' || !Array.isArray(item.supportingReferences)) continue;
      const evidence = item.supportingReferences.filter((ref: unknown): ref is string => typeof ref === 'string' && references.has(ref));
      if (!evidence.length) continue;
      const row = await db.query(
        `INSERT INTO bookkeeping_health_ai_recommendations (tenant_id, scan_id, title, explanation, evidence, suggested_action, model, status)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,'REVIEW') RETURNING id, scan_id, title, explanation, evidence, suggested_action, confidence, model, status, created_at`,
        [session.tenantId, facts.scanId, item.title.slice(0, 255), item.explanation.slice(0, 5000), JSON.stringify(evidence), item.suggestedAction.slice(0, 2000), MODEL]
      );
      saved.push(row.rows[0]);
    }
    if (!saved.length && recommendations.length) return NextResponse.json({ error: 'The AI response did not cite any valid supplied record identifiers.' }, { status: 502 });
    await db.query(`INSERT INTO bookkeeping_health_audit_logs (tenant_id, actor_user_id, actor_email, action, metadata) VALUES ($1,$2,$3,'AI_ANALYSIS_COMPLETED',$4::jsonb)`, [session.tenantId, session.userId, session.email, JSON.stringify({ scanId: facts.scanId, model: MODEL, recommendationCount: saved.length })]);
    return NextResponse.json({ success: true, model: MODEL, recommendations: saved });
  } catch (error) {
    console.error('Bookkeeping Health AI analysis failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'AI analysis failed. No static recommendations were substituted.' }, { status: 502 });
  }
}
