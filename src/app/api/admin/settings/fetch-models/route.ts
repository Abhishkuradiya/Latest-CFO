import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Fallback known models if live fetching needs default baseline
const BASE_MODELS_FALLBACK = [
  { id: 'omega-plus', name: 'Omega Plus', badge: 'Default Proxy', desc: 'Primary fast reasoning model' },
  { id: 'claude-fable-5', name: 'Claude Fable 5', badge: 'Vision Native', desc: 'Anthropic multimodal flagship' },
  { id: 'claude-opus-4.8', name: 'Claude Opus 4.8', badge: 'Deep Reasoning', desc: 'High capability financial modeling' },
  { id: 'gpt-5.5', name: 'GPT 5.5', badge: 'OpenAI Vision', desc: 'OpenAI latest frontier model' },
  { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', badge: 'Google AI', desc: 'Long context GLM analytics' },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', badge: 'Omega Vision Bridge', desc: 'DeepSeek high efficiency model' },
  { id: 'qwen-3.7-plus', name: 'Qwen 3.7 Plus', badge: 'Alibaba AI', desc: 'Enterprise quantitative engine' },
  { id: 'minimax-m3', name: 'MiniMax M3', badge: 'Multimodal', desc: 'Fast chat & code intelligence' }
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { llmApiKey, llmBaseUrl } = body;

    if (!llmApiKey || typeof llmApiKey !== 'string' || !llmApiKey.trim()) {
      return NextResponse.json({
        success: false,
        message: 'API Key is required to fetch live models from Omega Plus',
        models: BASE_MODELS_FALLBACK
      });
    }

    const baseUrl = (llmBaseUrl || 'https://api.omegaplusapi.com').replace(/\/+$/, '');
    const apiKey = llmApiKey.trim();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'Authorization': `Bearer ${apiKey}`
    };

    // Try live models endpoint from Omega Plus API
    let modelsUrl = `${baseUrl}/v1/models`;
    if (baseUrl.endsWith('/v1') || baseUrl.includes('openai')) {
      modelsUrl = `${baseUrl}/models`;
    }

    try {
      const res = await fetch(modelsUrl, { method: 'GET', headers });
      if (res.ok) {
        const data = await res.json();
        const rawList = data.data || data.models || data;

        if (Array.isArray(rawList) && rawList.length > 0) {
          const fetchedModels = rawList.map((m: any) => {
            const id = typeof m === 'string' ? m : (m.id || m.name);
            const name = typeof m === 'string' ? m : (m.name || m.id);
            return {
              id,
              name,
              badge: m.owned_by || m.badge || 'Live Omega Model',
              desc: m.description || `Omega API Model (${id})`
            };
          });

          return NextResponse.json({
            success: true,
            isLive: true,
            message: `Fetched ${fetchedModels.length} live models from Omega Plus API!`,
            models: fetchedModels
          });
        }
      }
    } catch (apiErr) {
      console.warn('Unable to reach /v1/models endpoint, returning catalog:', apiErr);
    }

    // Return fallback catalog if live endpoint was unreachable but API key is present
    return NextResponse.json({
      success: true,
      isLive: false,
      message: 'Loaded Omega Plus supported model catalog.',
      models: BASE_MODELS_FALLBACK
    });

  } catch (err: any) {
    return NextResponse.json({
      success: false,
      message: err.message || 'Error fetching models',
      models: BASE_MODELS_FALLBACK
    }, { status: 500 });
  }
}
