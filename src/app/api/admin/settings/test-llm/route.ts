import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { llmProvider, llmApiKey, llmBaseUrl, llmDefaultModel } = body;

    if (!llmApiKey || typeof llmApiKey !== 'string' || !llmApiKey.trim()) {
      return NextResponse.json({
        success: false,
        message: 'LLM API Key is required for verification test'
      }, { status: 400 });
    }

    const baseUrl = (llmBaseUrl || 'https://api.omegaplusapi.com').replace(/\/+$/, '');
    const model = llmDefaultModel || 'omega-plus';
    const apiKey = llmApiKey.trim();

    // Call OmegaPlus API / Anthropic-compatible / OpenAI-compatible endpoint
    let testEndpoint = `${baseUrl}/v1/messages`;
    if (baseUrl.endsWith('/v1') || baseUrl.includes('openai')) {
      testEndpoint = `${baseUrl}/chat/completions`;
    }

    const isAnthropicStyle = testEndpoint.endsWith('/messages');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'Authorization': `Bearer ${apiKey}`
    };

    const payload = isAnthropicStyle ? {
      model,
      max_tokens: 30,
      messages: [{ role: 'user', content: 'Ping connection test from Virtual CFO.' }]
    } : {
      model,
      max_tokens: 30,
      messages: [{ role: 'user', content: 'Ping connection test from Virtual CFO.' }]
    };

    const startTime = Date.now();
    const response = await fetch(testEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const elapsed = Date.now() - startTime;

    if (response.ok || response.status === 200 || response.status === 201) {
      return NextResponse.json({
        success: true,
        message: `OmegaPlus LLM API connection verified! (${model} responded in ${elapsed}ms)`,
        elapsedMs: elapsed
      });
    }

    let errorDetail = '';
    try {
      const errJson = await response.json();
      errorDetail = errJson.error?.message || errJson.message || JSON.stringify(errJson);
    } catch (e) {
      errorDetail = await response.text();
    }

    // If HTTP status is 401 or 403
    if (response.status === 401 || response.status === 403) {
      return NextResponse.json({
        success: false,
        message: `Authentication Failed (HTTP ${response.status}): Invalid API Key or Unauthorized access to model "${model}". ${errorDetail}`
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      message: `API Response Error (HTTP ${response.status}): ${errorDetail || response.statusText}`
    }, { status: 400 });

  } catch (err: any) {
    console.error('LLM connection test error:', err);
    return NextResponse.json({
      success: false,
      message: `Network/Connection Error: ${err.message || 'Unable to reach LLM endpoint'}`
    }, { status: 500 });
  }
}
