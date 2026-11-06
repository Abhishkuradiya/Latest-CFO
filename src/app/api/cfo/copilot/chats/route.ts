import { NextRequest, NextResponse } from 'next/server';
import { 
  getChatSessions, 
  createChatSession, 
  deleteChatSession, 
  getChatMessages,
  getChatSession
} from '@/lib/services/cfo-copilot/copilot-db';
import { getAuthenticatedSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authSession = await getAuthenticatedSession();
    if (!authSession || !authSession.tenantId) {
      return NextResponse.json({ error: 'Unauthorized: Session authentication required.' }, { status: 401 });
    }

    const tenantId = authSession.tenantId;
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');

    if (chatId) {
      const chatSession = getChatSession(chatId);
      if (chatSession && String(chatSession.tenantId) !== String(tenantId)) {
        return NextResponse.json({ error: 'Forbidden: Access denied to requested chat session.' }, { status: 403 });
      }
      const messages = getChatMessages(chatId);
      return NextResponse.json({ chatId, messages });
    }

    const sessions = getChatSessions(tenantId);
    return NextResponse.json({ sessions });
  } catch (error: any) {
    console.error('Error in /api/cfo/copilot/chats GET:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authSession = await getAuthenticatedSession();
    if (!authSession || !authSession.tenantId) {
      return NextResponse.json({ error: 'Unauthorized: Session authentication required.' }, { status: 401 });
    }

    const tenantId = authSession.tenantId;
    const body = await request.json();
    const { action, title, chatId } = body;

    if (action === 'DELETE' && chatId) {
      const chatSession = getChatSession(chatId);
      if (chatSession && String(chatSession.tenantId) !== String(tenantId)) {
        return NextResponse.json({ error: 'Forbidden: Access denied to requested chat session.' }, { status: 403 });
      }
      deleteChatSession(chatId);
      return NextResponse.json({ success: true, message: 'Chat deleted' });
    }

    const newSession = createChatSession(tenantId, title);
    return NextResponse.json({ success: true, session: newSession });
  } catch (error: any) {
    console.error('Error in /api/cfo/copilot/chats POST:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

