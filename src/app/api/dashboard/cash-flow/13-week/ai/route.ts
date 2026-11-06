import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';
import { getCashForecast } from '@/lib/cashForecast';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const settingsPath = path.join(process.cwd(), 'src', 'data', 'system_settings.json');
const requestedModel = 'claude-quantum-lite-1';
type ForecastWeek = { index: number; start: string; end: string; opening: number; inflows: number; outflows: number; net: number; closing: number };
type ForecastMovement = { amount: number; party: string; reference: string; dueDate: string | null; expectedDate: string; status: string; currency: string };
type AnalysisSection = { title: string; items: string[] };

function structureAnalysis(raw: string): AnalysisSection[] {
  const titles = ['Outlook', 'Key drivers', 'Risks', 'Management actions'];
  const headingPattern = new RegExp(`(?:^|\\s)(?:\\*\\*)?(${titles.join('|')})(?:\\*\\*)?\\s*[:\\-\\u2013\\u2014]\\s*`, 'gi');
  const matches = Array.from(raw.matchAll(headingPattern));
  if (matches.length) {
    const sections = matches.map((match, index) => {
      const start = (match.index ?? 0) + match[0].length;
      const end = index + 1 < matches.length ? matches[index + 1].index ?? raw.length : raw.length;
      const content = raw.slice(start, end).trim();
      return { title: match[1], items: content.split(/\s+(?=[*\-\u2022]\s)|\n+/).map(item => item.replace(/^[\s*\-\u2022]+/, '').trim()).filter(Boolean) };
    }).filter(section => section.items.length);
    if (sections.length) return sections;
  }

  const paragraphs = raw.split(/\n+/).map(line => line.replace(/^\s*(?:[*\-\u2022]|\d+[.)])\s*/, '').trim()).filter(Boolean);
  return paragraphs.length ? [{ title: 'Cash forecast analysis', items: paragraphs }] : [];
}

async function getSettings() {
  const settings: Record<string, unknown> = {};
  try {
    if (fs.existsSync(settingsPath)) Object.assign(settings, JSON.parse(fs.readFileSync(settingsPath, 'utf-8')));
  } catch { /* PostgreSQL remains the authoritative runtime source when available. */ }

  if (db.isPgActive()) {
    try {
      const result = await db.query('SELECT llm_api_key, llm_base_url, llm_enabled_models FROM system_settings WHERE id = 1 LIMIT 1');
      const row = result.rows[0];
      if (row) {
        if (row.llm_api_key) settings.llmApiKey = row.llm_api_key;
        if (row.llm_base_url) settings.llmBaseUrl = row.llm_base_url;
        if (row.llm_enabled_models) {
          try { settings.llmEnabledModels = JSON.parse(row.llm_enabled_models); } catch { /* Keep file setting. */ }
        }
      }
    } catch (error) {
      console.error('13-week forecast AI settings lookup failed:', error);
    }
  }
  return settings;
}

export async function POST() {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const settings = await getSettings();
    const apiKey = typeof settings.llmApiKey === 'string' ? settings.llmApiKey.trim() : '';
    const enabled = Array.isArray(settings.llmEnabledModels) && settings.llmEnabledModels.includes(requestedModel);
    const baseUrl = typeof settings.llmBaseUrl === 'string' ? settings.llmBaseUrl.replace(/\/+$/, '') : '';

    if (!enabled || !apiKey) {
      return NextResponse.json({ available: false, reason: `${requestedModel} is not enabled or its provider key is unavailable.` });
    }
    if (!baseUrl) return NextResponse.json({ available: false, reason: 'The AI provider URL is not configured.' });

    const forecast = await getCashForecast(tenantId);
    if (!forecast.weeks.length || forecast.summary.currentCash === null) {
      return NextResponse.json({ available: false, reason: 'A complete opening cash balance is required before AI analysis can run.' });
    }

    const facts = {
      currency: forecast.currency,
      period: forecast.period,
      dataQuality: forecast.dataQuality,
      summary: forecast.summary,
      weeks: forecast.weeks.map((week: ForecastWeek) => ({
        week: week.index,
        start: week.start,
        end: week.end,
        opening: week.opening,
        inflows: week.inflows,
        outflows: week.outflows,
        net: week.net,
        closing: week.closing
      })),
      largestReceipts: forecast.receipts.slice().sort((a: ForecastMovement, b: ForecastMovement) => b.amount - a.amount).slice(0, 5),
      largestPayments: forecast.payments.slice().sort((a: ForecastMovement, b: ForecastMovement) => b.amount - a.amount).slice(0, 5)
    };

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: requestedModel,
        max_tokens: 900,
        temperature: 0.2,
        system: 'You are a professional CFO cash-management analyst. Analyse only the verified 13-week cash forecast facts supplied by the application. Do not invent values, dates, customers, assumptions, funding, or causes. Do not call this a guarantee. Clearly distinguish observed forecast figures from risks. Return 4 concise sections with short bullets: Outlook, Key drivers, Risks, Management actions. If source coverage is incomplete, explicitly state which facts are incomplete. Use the supplied currency and preserve all numeric values accurately. Plain text only; no markdown tables.',
        messages: [{ role: 'user', content: JSON.stringify(facts) }]
      }),
      signal: AbortSignal.timeout(20000)
    });

    if (!response.ok) {
      console.error('13-week forecast AI request failed:', response.status);
      return NextResponse.json({ available: false, reason: 'The configured AI model did not return an analysis.' });
    }
    const result = await response.json();
    const text = Array.isArray(result.content)
      ? result.content.filter((part: { type?: string }) => part.type === 'text').map((part: { text?: string }) => part.text || '').join('\n').trim()
      : '';
    const sections = structureAnalysis(text.slice(0, 12000));
    return NextResponse.json({ available: sections.length > 0, model: requestedModel, sections });
  } catch (error) {
    console.error('13-week forecast AI analysis failed:', error);
    return NextResponse.json({ available: false, reason: 'The AI forecast analysis could not be generated.' });
  }
}
