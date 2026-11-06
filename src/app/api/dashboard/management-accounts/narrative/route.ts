import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const settingsPath = path.join(process.cwd(), 'src', 'data', 'system_settings.json');
const requestedModel = 'claude-quantum-lite-1';

export async function POST(request: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const facts = body?.facts;
    if (!facts || typeof facts !== 'object' || typeof facts.fromDate !== 'string' || typeof facts.toDate !== 'string') {
      return NextResponse.json({ error: 'A report period and verified report figures are required.' }, { status: 400 });
    }

    let settings: Record<string, unknown> = {};
    try {
      if (fs.existsSync(settingsPath)) settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    } catch { /* Use the database settings when the local settings file is unavailable. */ }

    if (db.isPgActive()) {
      try {
        const result = await db.query('SELECT llm_api_key, llm_base_url, llm_enabled_models FROM system_settings WHERE id = 1 LIMIT 1');
        const row = result.rows[0];
        if (row) {
          settings.llmApiKey = row.llm_api_key || settings.llmApiKey;
          settings.llmBaseUrl = row.llm_base_url || settings.llmBaseUrl;
          if (row.llm_enabled_models) {
            try { settings.llmEnabledModels = JSON.parse(row.llm_enabled_models); } catch { /* Keep file setting. */ }
          }
        }
      } catch (error) {
        console.error('Management report model settings lookup failed:', error);
      }
    }

    const enabled = Array.isArray(settings.llmEnabledModels) && settings.llmEnabledModels.includes(requestedModel);
    const apiKey = typeof settings.llmApiKey === 'string' ? settings.llmApiKey.trim() : '';
    if (!enabled || !apiKey) return NextResponse.json({ available: false, reason: 'The requested report model is not configured.' });

    const baseUrl = typeof settings.llmBaseUrl === 'string' ? settings.llmBaseUrl.replace(/\/+$/, '') : '';
    if (!baseUrl) return NextResponse.json({ available: false, reason: 'The model gateway is not configured.' });

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: requestedModel,
        max_tokens: 550,
        temperature: 0.2,
        system: 'Write a concise, professional management accounts commentary for a board report. Use only the supplied report facts. Do not add, estimate, infer, or recalculate figures. Do not make forecasts, recommendations, or claims about causes or trends. If the facts do not support an observation, say the available report is insufficient. Return 3 to 5 short bullet points in plain text, with no markdown heading.',
        messages: [{ role: 'user', content: JSON.stringify(facts) }]
      }),
      signal: AbortSignal.timeout(20000)
    });

    if (!response.ok) {
      console.error('Management report model request failed:', response.status);
      return NextResponse.json({ available: false, reason: 'The report commentary could not be generated.' });
    }
    const result = await response.json();
    const text = Array.isArray(result.content) ? result.content.filter((part: { type?: string }) => part.type === 'text').map((part: { text?: string }) => part.text || '').join('\n').trim() : '';
    return NextResponse.json({ available: Boolean(text), model: requestedModel, text: text.slice(0, 5000) });
  } catch (error) {
    console.error('Management report commentary failed:', error);
    return NextResponse.json({ available: false, reason: 'The report commentary could not be generated.' });
  }
}
