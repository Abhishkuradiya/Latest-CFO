import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function formatModelOption(id: string) {
  if (!id) return { id: 'omega-plus', label: 'Ω Omega Plus', tag: 'Fast Proxy' };

  let tag = 'Omega Live';
  let cleanName = id.replace(/^claude-/, '');

  if (id === 'omega-plus' || cleanName === 'omega-plus') {
    return { id: 'omega-plus', label: 'Ω Omega Plus', tag: 'Fast Proxy' };
  }

  if (cleanName.includes('fable')) {
    tag = 'Vision Native';
  } else if (cleanName.includes('opus') || cleanName.includes('reasoning')) {
    tag = 'Reasoning';
  } else if (cleanName.includes('gpt')) {
    tag = 'OpenAI Vision';
  } else if (cleanName.includes('gemini')) {
    tag = 'Google AI';
  } else if (cleanName.includes('deepseek')) {
    tag = 'Bridge';
  } else if (cleanName.includes('qwen')) {
    tag = 'Alibaba AI';
  } else if (cleanName.includes('sonnet')) {
    tag = 'Anthropic';
  } else if (cleanName.includes('minimax')) {
    tag = 'Multimodal';
  }

  const formattedLabel = cleanName
    .split('-')
    .map(word => {
      if (word.toLowerCase() === 'v4' || word.toLowerCase() === 'v5' || word.toLowerCase() === 'gpt') return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');

  return {
    id,
    label: formattedLabel,
    tag
  };
}

export async function GET() {
  try {
    let enabledIds: string[] = [];
    let defaultModel = 'omega-plus';

    // 1. Read local file
    const localFile = path.join(process.cwd(), 'src', 'data', 'system_settings.json');
    if (fs.existsSync(localFile)) {
      try {
        const raw = fs.readFileSync(localFile, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.llmEnabledModels) && parsed.llmEnabledModels.length > 0) {
          enabledIds = parsed.llmEnabledModels;
        }
        if (parsed.llmDefaultModel) {
          defaultModel = parsed.llmDefaultModel;
        }
      } catch (e) {}
    }

    // 2. Read Postgres DB if active
    if (db.isPgActive()) {
      try {
        const res = await db.query('SELECT llm_enabled_models, llm_default_model FROM system_settings WHERE id = 1 LIMIT 1');
        if (res.rows.length > 0) {
          const row = res.rows[0];
          if (row.llm_enabled_models) {
            const parsed = JSON.parse(row.llm_enabled_models);
            if (Array.isArray(parsed) && parsed.length > 0) {
              enabledIds = parsed;
            }
          }
          if (row.llm_default_model) {
            defaultModel = row.llm_default_model;
          }
        }
      } catch (e) {
        console.warn('Postgres read model list warning:', e);
      }
    }

    if (!enabledIds || enabledIds.length === 0) {
      enabledIds = ['claude-fable-5'];
    }

    if (!enabledIds.includes(defaultModel)) {
      defaultModel = enabledIds[0];
    }

    const models = enabledIds.map(id => formatModelOption(id));

    return NextResponse.json({
      success: true,
      defaultModel,
      models
    });
  } catch (e) {
    return NextResponse.json({
      success: true,
      defaultModel: 'claude-fable-5',
      models: [formatModelOption('claude-fable-5')]
    });
  }
}
