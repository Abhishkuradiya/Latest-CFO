import fs from 'fs';
import path from 'path';

export interface ChatMessage {
  id: string;
  chatId: string;
  tenantId: string | number;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  debugActivities?: Array<{
    toolName: string;
    args: any;
    status: 'SUCCESS' | 'ERROR';
    resultSummary: string;
    recordsCount: number;
  }>;
}

export interface ChatSession {
  chatId: string;
  tenantId: string | number;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: string;
}

export interface EvidenceSnapshot {
  tenantId: string | number;
  retrievedAt: string;
  sourceTools: string[];
  period?: { startDate: string; endDate: string; label: string };
  toolOutputs: Record<string, any>;
  authoritativeFacts?: any[];
  validatedCalculations?: any[];
  dataQuality: 'COMPLETE' | 'PARTIAL' | 'NO_DATA' | 'ZERO_CONFIRMED' | 'INCOMPLETE_DATA' | 'CONFLICTING';
  lastAnswerText?: string;
}

export interface CfoConversationContext {
  conversationId: string;
  tenantId: string | number;
  userId?: string;
  recentUserMessages: string[];
  recentAssistantResponses: string[];
  activeTopic?: string;
  activeMetrics?: string[];
  activeEntities?: {
    customers?: string[];
    vendors?: string[];
    invoices?: string[];
    accounts?: string[];
    glCategories?: string[];
    bankAccounts?: string[];
  };
  activePeriods?: {
    startDate: string;
    endDate: string;
    label: string;
  };
  activeComparisonPeriod?: {
    startDate: string;
    endDate: string;
    label: string;
  };
  relevantFacts: string[];
  relevantCalculations: string[];
  activeHypotheses: Array<{
    id: string;
    statement: string;
    status: 'TESTING' | 'SUPPORTED' | 'REJECTED';
    evidence: string[];
  }>;
  unresolvedQuestions: string[];
  lastToolResultsSummary?: string;
  lastConfidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  dataQuality?: 'COMPLETE' | 'PARTIAL' | 'NO_DATA' | 'ZERO_CONFIRMED' | 'INCOMPLETE_DATA' | 'CONFLICTING';
  lastEvidenceSnapshot?: EvidenceSnapshot;
  updatedAt: string;
}

const DB_PATH = path.join(process.cwd(), 'src', 'data', 'copilot_db.json');

function ensureDbFile(): void {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DB_PATH)) {
      const initialData = {
        sessions: [],
        messages: [],
        contexts: []
      };
      fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf8');
    }
  } catch (err) {
    console.error('[Copilot DB] Error ensuring db file:', err);
  }
}

function readCopilotDb(): { sessions: ChatSession[]; messages: ChatMessage[]; contexts?: CfoConversationContext[] } {
  ensureDbFile();
  try {
    const content = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(content);
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      contexts: Array.isArray(parsed.contexts) ? parsed.contexts : []
    };
  } catch (err) {
    console.error('[Copilot DB] Error reading db:', err);
    return { sessions: [], messages: [], contexts: [] };
  }
}

function writeCopilotDb(data: { sessions: ChatSession[]; messages: ChatMessage[]; contexts?: CfoConversationContext[] }): void {
  ensureDbFile();
  try {
    const raw = JSON.stringify(data, null, 2);
    try {
      const tmpPath = DB_PATH + '.tmp';
      fs.writeFileSync(tmpPath, raw, 'utf8');
      fs.renameSync(tmpPath, DB_PATH);
    } catch (e) {
      fs.writeFileSync(DB_PATH, raw, 'utf8');
    }
  } catch (err) {
    console.error('[Copilot DB] Error writing db:', err);
  }
}

export function getChatSession(chatId: string): ChatSession | undefined {
  const db = readCopilotDb();
  return db.sessions.find(s => s.chatId === chatId);
}

export function getChatSessions(tenantId?: string | number): ChatSession[] {
  const db = readCopilotDb();
  let sessions = db.sessions;
  if (tenantId !== undefined && tenantId !== 'ALL') {
    sessions = sessions.filter(s => String(s.tenantId) === String(tenantId));
  }
  return sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function createChatSession(tenantId: string | number, title?: string): ChatSession {
  const db = readCopilotDb();
  const chatId = 'chat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const now = new Date().toISOString();
  const newSession: ChatSession = {
    chatId,
    tenantId: tenantId || 1,
    title: title || 'New Financial Analysis',
    createdAt: now,
    updatedAt: now
  };

  db.sessions.unshift(newSession);
  writeCopilotDb(db);
  return newSession;
}

export function deleteChatSession(chatId: string): void {
  const db = readCopilotDb();
  db.sessions = db.sessions.filter(s => s.chatId !== chatId);
  db.messages = db.messages.filter(m => m.chatId !== chatId);
  writeCopilotDb(db);
}

export function getChatMessages(chatId: string): ChatMessage[] {
  const db = readCopilotDb();
  return db.messages
    .filter(m => m.chatId === chatId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function saveChatMessage(
  chatId: string,
  tenantId: string | number,
  role: 'user' | 'assistant',
  text: string,
  debugActivities?: any[]
): ChatMessage {
  const db = readCopilotDb();
  const now = new Date().toISOString();
  const message: ChatMessage = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    chatId,
    tenantId,
    role,
    text,
    timestamp: now,
    debugActivities
  };

  db.messages.push(message);

  // Update session updatedAt and title if it's default
  const session = db.sessions.find(s => s.chatId === chatId);
  if (session) {
    session.updatedAt = now;
    session.lastMessage = text.substring(0, 80);
    if (role === 'user' && (session.title === 'New Financial Analysis' || !session.title)) {
      session.title = text.length > 35 ? text.substring(0, 35) + '...' : text;
    }
  } else {
    // Auto-create session if missing
    db.sessions.unshift({
      chatId,
      tenantId,
      title: text.length > 35 ? text.substring(0, 35) + '...' : text,
      createdAt: now,
      updatedAt: now,
      lastMessage: text.substring(0, 80)
    });
  }

  writeCopilotDb(db);
  return message;
}

export function getConversationContext(chatId: string, tenantId: string | number): CfoConversationContext | undefined {
  const db = readCopilotDb();
  const ctx = (db.contexts || []).find(c => c.conversationId === chatId);
  if (!ctx) return undefined;
  if (String(ctx.tenantId) !== String(tenantId)) {
    const err = new Error(`403: Forbidden - Access denied to conversation context of tenant ${ctx.tenantId} for user of tenant ${tenantId}.`);
    (err as any).statusCode = 403;
    throw err;
  }
  return ctx;
}

export function saveConversationContext(context: CfoConversationContext): void {
  const db = readCopilotDb();
  if (!db.contexts) db.contexts = [];
  const idx = db.contexts.findIndex(c => c.conversationId === context.conversationId);
  if (idx >= 0) {
    db.contexts[idx] = context;
  } else {
    db.contexts.push(context);
  }
  writeCopilotDb(db);
}

