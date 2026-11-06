import { NextRequest } from 'next/server';
import { runCopilotInvestigation } from '@/lib/services/cfo-copilot/copilot-engine';
import { saveChatMessage, createChatSession, getChatSession } from '@/lib/services/cfo-copilot/copilot-db';
import { getAuthenticatedSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const authSession = await getAuthenticatedSession();
    if (!authSession || !authSession.tenantId) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Session authentication required.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const tenantId = authSession.tenantId;

    const body = await request.json();
    const { chatId: inputChatId, message, model } = body;

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let chatId = inputChatId;
    if (chatId) {
      const existingSession = getChatSession(chatId);
      if (existingSession && String(existingSession.tenantId) !== String(tenantId)) {
        return new Response(JSON.stringify({ error: 'Forbidden: Access denied to this chat session.' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else {
      const newSession = createChatSession(tenantId, message.substring(0, 35));
      chatId = newSession.chatId;
    }

    // Save user message in DB under authorized tenantId
    saveChatMessage(chatId, tenantId, 'user', message);

    // Setup SSE Response Stream
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendSSE = (evt: { type: string; [key: string]: any }) => {
          try {
            const dataStr = `data: ${JSON.stringify(evt)}\n\n`;
            controller.enqueue(encoder.encode(dataStr));
          } catch (e) {
            // Stream may be closed
          }
        };

        try {
          await runCopilotInvestigation({
            chatId,
            tenantId,
            message,
            selectedModel: model,
            onSSEEvent: sendSSE
          });
        } catch (err: any) {
          sendSSE({ type: 'error', error: err.message || 'Error executing copilot investigation' });
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive'
      }
    });
  } catch (error: any) {
    console.error('Error in /api/cfo/copilot POST:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500 });
  }
}
