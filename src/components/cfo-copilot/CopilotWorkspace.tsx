"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Sparkles, 
  Send, 
  Plus, 
  Trash2, 
  MessageSquare, 
  TrendingUp, 
  AlertTriangle, 
  Search, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  Building2, 
  Activity, 
  FileText, 
  RefreshCw, 
  ArrowUpRight, 
  Copy, 
  Check, 
  ArrowLeft, 
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatSession {
  chatId: string;
  tenantId: string | number;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: string;
}

interface ToolActivity {
  toolName: string;
  args: any;
  status: 'SUCCESS' | 'ERROR';
  resultSummary: string;
  recordsCount: number;
}

interface ChatMessage {
  id: string;
  chatId: string;
  tenantId: string | number;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  debugActivities?: ToolActivity[];
  isStreaming?: boolean;
}

interface ModelOption {
  id: string;
  label: string;
  tag: string;
}

const CHAT_PROMPTS = [
  {
    id: 'risk_scan',
    title: 'Financial Risk & Anomaly Audit',
    subtitle: 'Scan for unusual vendor outlays, duplicate expense entries & cost spikes',
    prompt: 'Run a deep anomaly scan to identify unusual transactions, cost spikes, or suspicious payments across my accounts.',
    badge: 'Audit & Risks',
    icon: AlertTriangle,
    iconColor: 'text-amber-700 bg-amber-50 border-amber-200'
  },
  {
    id: 'cash_drivers',
    title: 'Cashflow Inflows & Outflows Breakdown',
    subtitle: 'Identify top customer collections, supplier payments & 30-day liquidity buffer',
    prompt: 'Show me top customer collections (cash inflows) and top supplier payments (cash outflows) for this period.',
    badge: 'Cash Velocity',
    icon: TrendingUp,
    iconColor: 'text-emerald-700 bg-emerald-50 border-emerald-200'
  },
  {
    id: 'pnl_review',
    title: 'Profit & Loss & Margin Review',
    subtitle: 'Analyze gross margin, net profit variance, revenue channels & OpEx growth',
    prompt: 'Analyze my Profit & Loss performance, revenue margins, gross profit, and main operating expense breakdown.',
    badge: 'P&L Performance',
    icon: Activity,
    iconColor: 'text-sky-700 bg-sky-50 border-sky-200'
  },
  {
    id: 'ar_recovery',
    title: 'Overdue Invoices & AR Recovery Status',
    subtitle: 'List overdue customer invoices, days outstanding (DSO) & recovery action plan',
    prompt: 'Which customer sales invoices are currently overdue and what is our accounts receivable collection status?',
    badge: 'AR / Receivables',
    icon: FileText,
    iconColor: 'text-purple-700 bg-purple-50 border-purple-200'
  }
];

// Refined CFO Mark SVG Logo
function CfoBrandLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <div className={cn("rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-xs border border-emerald-400/30 shrink-0", className)}>
      <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    </div>
  );
}

// Executive CFO Markdown & Data Table Renderer
function CfoReportRenderer({ content }: { content: string }) {
  const formattedContent = (content || '')
    .replace(/\|\|/g, '|\n|')
    .replace(/\\n/g, '\n');

  return (
    <div className="prose prose-slate max-w-none text-xs leading-relaxed font-sans space-y-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-base font-bold text-slate-900 tracking-tight border-b border-slate-200 pb-2 mb-3 mt-4 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              <span>{children}</span>
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-bold text-slate-900 tracking-tight border-b border-slate-100 pb-1.5 mb-2.5 mt-4 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>{children}</span>
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs font-bold text-slate-800 tracking-tight mb-2 mt-3 flex items-center gap-1.5">
              <span>{children}</span>
            </h3>
          ),
          p: ({ children }) => {
            const textStr = String(children);
            // Check for callouts / annotations
            if (textStr.startsWith('FACT:') || textStr.startsWith('Key Fact:') || textStr.startsWith('[ACTUAL]')) {
              return (
                <div className="bg-sky-50/70 border-l-4 border-l-sky-600 border border-sky-100 p-3.5 rounded-r-xl text-slate-800 text-xs font-medium my-3 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-sky-800 uppercase tracking-wider mb-1">
                    <Info className="h-3.5 w-3.5 text-sky-600" />
                    <span>Fact / Authoritative Baseline</span>
                  </div>
                  <div>{children}</div>
                </div>
              );
            }
            if (textStr.startsWith('INSIGHT:') || textStr.startsWith('DERIVED INSIGHT:') || textStr.startsWith('Pattern Observation:') || textStr.startsWith('[SCENARIO]') || textStr.startsWith('[IMPACT]')) {
              return (
                <div className="bg-emerald-50/80 border-l-4 border-l-emerald-600 border border-emerald-100 p-3.5 rounded-r-xl text-slate-800 text-xs font-medium my-3 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                    <span>CFO Insight & Pattern Analysis</span>
                  </div>
                  <div>{children}</div>
                </div>
              );
            }
            if (textStr.startsWith('RECOMMENDATION:') || textStr.startsWith('ACTIONABLE RECOMMENDATION:') || textStr.startsWith('[ASSUMPTION]')) {
              return (
                <div className="bg-amber-50/80 border-l-4 border-l-amber-500 border border-amber-100 p-3.5 rounded-r-xl text-slate-800 text-xs font-medium my-3 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-amber-600" />
                    <span>Executive Recommendation / Next Steps</span>
                  </div>
                  <div>{children}</div>
                </div>
              );
            }
            if (textStr.startsWith('TEMPORAL ANOMALY:') || textStr.startsWith('WARNING:') || textStr.startsWith('[LIMITATION]')) {
              return (
                <div className="bg-rose-50/80 border-l-4 border-l-rose-500 border border-rose-100 p-3.5 rounded-r-xl text-slate-800 text-xs font-medium my-3 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-800 uppercase tracking-wider mb-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                    <span>Audit Review & Anomaly Notice</span>
                  </div>
                  <div>{children}</div>
                </div>
              );
            }
            return <p className="my-2 text-xs text-slate-700 leading-relaxed font-normal">{children}</p>;
          },
          blockquote: ({ children }) => (
            <blockquote className="bg-slate-50 border-l-4 border-l-slate-300 italic px-4 py-2 my-3 text-slate-700 text-xs rounded-r-lg">
              {children}
            </blockquote>
          ),
          ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1 text-xs text-slate-700">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1 text-xs text-slate-700">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          hr: () => <hr className="my-4 border-slate-200" />,
          code: ({ children }) => (
            <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-mono text-[11px] font-semibold border border-slate-200">
              {children}
            </code>
          ),
          // Executive Financial Table Component
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs custom-table-scrollbar max-h-[460px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="sticky top-0 bg-slate-100/90 backdrop-blur text-slate-700 font-bold text-[11px] uppercase tracking-wider border-b border-slate-200 z-10 select-none">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-slate-50/90 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-3.5 py-2.5 font-bold whitespace-nowrap">
              {children}
            </th>
          ),
          td: ({ children }) => {
            const cellStr = String(children || '').trim();
            const isCurrency = cellStr.includes('£') || cellStr.includes('GBP') || cellStr.includes('$');
            const isDays = cellStr.toLowerCase().includes('days');
            const isAnomaly = cellStr.includes('TEMPORAL ANOMALY') || (cellStr.includes('-') && isDays);
            
            return (
              <td className={cn(
                "px-3.5 py-2.5 whitespace-nowrap text-xs",
                isCurrency || isDays ? "text-right font-mono" : "text-left",
                isCurrency ? "font-semibold text-slate-900" : "",
                isAnomaly ? "text-rose-600 font-bold bg-rose-50/50" : ""
              )}>
                {children}
              </td>
            );
          }
        }}
      >
        {formattedContent}
      </ReactMarkdown>
    </div>
  );
}

export function CopilotWorkspace({ initialChatId }: { initialChatId?: string }) {
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>(initialChatId || '');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [loadingSessions, setLoadingSessions] = useState<boolean>(true);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Dynamic Model Selection from Admin Settings
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([
    { id: 'omega-plus', label: 'Ω Omega Plus', tag: 'Fast Proxy' }
  ]);
  const [selectedModel, setSelectedModel] = useState<string>('omega-plus');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialChatId && initialChatId !== activeChatId) {
      setActiveChatId(initialChatId);
    }
  }, [initialChatId]);

  // Fetch Admin Enabled Models
  const fetchAvailableModels = async () => {
    try {
      const res = await fetch(`/api/cfo/copilot/models?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.models) && data.models.length > 0) {
          setAvailableModels(data.models);
          if (data.defaultModel && data.models.some((m: any) => m.id === data.defaultModel)) {
            setSelectedModel(data.defaultModel);
          } else {
            setSelectedModel(data.models[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load active LLM models:', err);
    }
  };

  const fetchSessions = async (autoSelect = false) => {
    try {
      const res = await fetch('/api/cfo/copilot/chats');
      if (res.ok) {
        const data = await res.json();
        const list = data.sessions || [];
        setSessions(list);

        if (list.length > 0) {
          if ((!activeChatId && autoSelect) || (initialChatId && !list.some((s: any) => s.chatId === initialChatId))) {
            setActiveChatId(list[0].chatId);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load chat sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const fetchMessages = async (chatId: string) => {
    if (!chatId || isGenerating) {
      return;
    }
    try {
      const res = await fetch(`/api/cfo/copilot/chats?chatId=${chatId}`);
      if (res.ok) {
        const data = await res.json();
        if (!isGenerating) {
          setMessages(data.messages || []);
        }
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  useEffect(() => {
    fetchAvailableModels();
    fetchSessions(true);
  }, []);

  useEffect(() => {
    if (activeChatId && !isGenerating) {
      fetchMessages(activeChatId);
    } else if (!activeChatId && !isGenerating) {
      setMessages([]);
    }
  }, [activeChatId, isGenerating]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const createNewChat = async () => {
    if (isGenerating) return;
    try {
      const res = await fetch('/api/cfo/copilot/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CREATE', title: 'New Financial Analysis' })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.session) {
          const newChatId = data.session.chatId;
          setActiveChatId(newChatId);
          setMessages([]);
          fetchSessions();
          router.push(`/cfo-copilot/${newChatId}`);
        }
      }
    } catch (err) {
      toast.error('Failed to create new chat session');
    }
  };

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGenerating) return;
    try {
      const res = await fetch('/api/cfo/copilot/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DELETE', chatId })
      });
      if (res.ok) {
        toast.success('Chat thread deleted');
        const remaining = sessions.filter(s => s.chatId !== chatId);
        setSessions(remaining);
        if (activeChatId === chatId) {
          if (remaining.length > 0) {
            const nextId = remaining[0].chatId;
            setActiveChatId(nextId);
            router.push(`/cfo-copilot/${nextId}`);
          } else {
            setActiveChatId('');
            router.push('/cfo-copilot');
          }
        }
      }
    } catch (err) {
      toast.error('Failed to delete chat');
    }
  };

  const selectChatThread = (chatId: string) => {
    if (isGenerating) return;
    setActiveChatId(chatId);
    router.push(`/cfo-copilot/${chatId}`);
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputPrompt).trim();
    if (!textToSend || isGenerating) return;

    let targetChatId = activeChatId;

    if (!targetChatId) {
      try {
        const res = await fetch('/api/cfo/copilot/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'CREATE', title: textToSend.substring(0, 35) + '...' })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.session) {
            targetChatId = data.session.chatId;
            setActiveChatId(targetChatId);
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', `/cfo-copilot/${targetChatId}`);
            }
          }
        }
      } catch (e) {}
    }

    if (!targetChatId) targetChatId = 'chat_' + Date.now();

    setInputPrompt('');
    setIsGenerating(true);

    const userMsg: ChatMessage = {
      id: 'msg_user_' + Date.now(),
      chatId: targetChatId,
      tenantId: '',
      role: 'user',
      text: textToSend,
      timestamp: new Date().toISOString()
    };

    const assistantMsgId = 'msg_asst_' + Date.now();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      chatId: targetChatId,
      tenantId: '',
      role: 'assistant',
      text: '',
      timestamp: new Date().toISOString(),
      debugActivities: [],
      isStreaming: true
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);

    try {
      const response = await fetch('/api/cfo/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: targetChatId,
          message: textToSend,
          model: selectedModel
        })
      });

      if (!response.ok) throw new Error('Failed to execute financial investigation.');
      if (!response.body) throw new Error('ReadableStream not supported.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        streamBuffer += decoder.decode(value, { stream: true });
        const lines = streamBuffer.split('\n');
        streamBuffer = lines.pop() || '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.substring(6).trim();
              if (!jsonStr) continue;
              const evt = JSON.parse(jsonStr);

              if (evt.type === 'tool_done') {
                setMessages(prev => prev.map(m => {
                  if (m.id === assistantMsgId) {
                    const currentLogs = m.debugActivities || [];
                    const exists = currentLogs.some(l => l.toolName === evt.name && l.resultSummary === evt.summary);
                    if (!exists) {
                      return {
                        ...m,
                        debugActivities: [
                          ...currentLogs,
                          {
                            toolName: evt.name,
                            args: {},
                            status: evt.status || 'SUCCESS',
                            resultSummary: evt.summary || 'Completed',
                            recordsCount: evt.count || 1
                          }
                        ]
                      };
                    }
                  }
                  return m;
                }));
              } else if (evt.type === 'token') {
                setMessages(prev => prev.map(m => {
                  if (m.id === assistantMsgId) {
                    return { ...m, text: m.text + evt.content };
                  }
                  return m;
                }));
              } else if (evt.type === 'done') {
                setMessages(prev => prev.map(m => {
                  if (m.id === assistantMsgId) {
                    return {
                      ...m,
                      isStreaming: false,
                      debugActivities: evt.debugActivities || m.debugActivities
                    };
                  }
                  return m;
                }));
              } else if (evt.type === 'error') {
                setMessages(prev => prev.map(m => {
                  if (m.id === assistantMsgId) {
                    return {
                      ...m,
                      text: m.text + `\n\n> ⚠️ **Error**: ${evt.error}`,
                      isStreaming: false
                    };
                  }
                  return m;
                }));
              }
            } catch (e) {
              console.warn('Error parsing SSE event:', e);
            }
          }
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Error executing AI analysis');
      setMessages(prev => prev.map(m => {
        if (m.id === assistantMsgId) {
          return {
            ...m,
            text: m.text + `\n\n> ⚠️ **Error**: Unable to complete analysis. (${err.message})`,
            isStreaming: false
          };
        }
        return m;
      }));
    } finally {
      setIsGenerating(false);
      fetchSessions();
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied report to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredSessions = sessions.filter(s => 
    !searchFilter || s.title.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const activeSessionTitle = sessions.find(s => s.chatId === activeChatId)?.title || 'New Financial Chat';

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-slate-50 text-slate-900 font-sans relative antialiased">
      
      {/* ========================================================================= */}
      {/* LEFT SIDEBAR — PREMIUM EXECUTIVE NAVIGATION */}
      {/* ========================================================================= */}
      <div
        className={cn(
          "bg-white border-r border-slate-200/90 flex flex-col shrink-0 transition-all duration-300 relative z-20 shadow-xs",
          isSidebarCollapsed ? "w-16" : "w-72"
        )}
      >
        {/* Top App Branding */}
        <div className="p-3.5 border-b border-slate-200 flex items-center justify-between">
          {!isSidebarCollapsed ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2.5">
                <CfoBrandLogo />
                <div>
                  <h2 className="text-xs font-bold text-slate-900 tracking-wider uppercase">Virtual CFO</h2>
                  <p className="text-[10.5px] text-emerald-700 font-semibold">Intelligence Hub</p>
                </div>
              </div>

              <button
                onClick={() => router.push('/')}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition cursor-pointer border border-slate-200/80"
                title="Return to Main Dashboard"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => router.push('/')}
              className="h-9 w-9 mx-auto rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition cursor-pointer border border-slate-200"
              title="Return to Main Dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* New Chat Primary Action Button */}
        <div className="p-3 border-b border-slate-200/60">
          {isSidebarCollapsed ? (
            <button
              onClick={createNewChat}
              className="h-10 w-10 mx-auto rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-xs transition cursor-pointer"
              title="New Chat (⌘N)"
            >
              <Plus className="h-5 w-5" />
            </button>
          ) : (
            <button
              onClick={createNewChat}
              className="w-full flex items-center justify-between py-2.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold tracking-wide shadow-xs transition cursor-pointer group"
            >
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-white group-hover:rotate-90 transition-transform duration-300" />
                <span>New Financial Chat</span>
              </span>
              <span className="text-[10px] bg-emerald-800/40 px-1.5 py-0.5 rounded font-mono text-emerald-100">⌘N</span>
            </button>
          )}
        </div>

        {/* Search Input */}
        {!isSidebarCollapsed && (
          <div className="px-3 py-2 border-b border-slate-100">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search history..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition font-medium placeholder:text-slate-400"
              />
            </div>
          </div>
        )}

        {/* Threads List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-slim-scrollbar">
          {loadingSessions ? (
            <div className="p-4 text-center text-xs text-slate-400 font-medium animate-pulse">
              {!isSidebarCollapsed && "Loading chat threads..."}
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400 font-medium">
              {!isSidebarCollapsed && "No past chats yet."}
            </div>
          ) : (
            filteredSessions.map((s) => {
              const isActive = s.chatId === activeChatId;

              if (isSidebarCollapsed) {
                return (
                  <button
                    key={s.chatId}
                    onClick={() => selectChatThread(s.chatId)}
                    className={cn(
                      "h-9 w-9 mx-auto rounded-xl flex items-center justify-center transition cursor-pointer my-1",
                      isActive ? "bg-emerald-600 text-white shadow-xs" : "text-slate-500 hover:bg-slate-100"
                    )}
                    title={s.title}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </button>
                );
              }

              return (
                <div
                  key={s.chatId}
                  onClick={() => selectChatThread(s.chatId)}
                  className={cn(
                    "group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all text-xs border my-0.5",
                    isActive
                      ? "bg-emerald-50/70 text-emerald-950 border-slate-200 border-l-3 border-l-emerald-600 font-semibold shadow-2xs"
                      : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border-transparent"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <MessageSquare className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-emerald-700" : "text-slate-400")} />
                    <span className="truncate text-xs">{s.title || 'Financial Analysis'}</span>
                  </div>

                  <button
                    onClick={(e) => handleDeleteChat(s.chatId, e)}
                    className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded hover:bg-rose-100 text-slate-400 hover:text-rose-600 flex items-center justify-center transition shrink-0 ml-1 cursor-pointer"
                    title="Delete Thread"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Tenant Status Indicator */}
        {!isSidebarCollapsed && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <p className="font-bold text-slate-900 truncate">Connected Xero organisation</p>
                <p className="text-[10px] text-slate-500 font-medium truncate">Live Xero accounting connection</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300/60 text-[10px] font-bold flex items-center gap-1 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
              Live
            </span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MAIN EXECUTIVE WORKSPACE CANVAS */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden h-full">
        
        {/* Top Executive Toolbar */}
        <div className="px-4 md:px-8 py-3 bg-white/90 backdrop-blur border-b border-slate-200 flex items-center justify-between gap-4 z-10 shrink-0 shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition border border-slate-200 cursor-pointer shrink-0"
              title={isSidebarCollapsed ? "Expand History" : "Collapse Sidebar"}
            >
              {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-xs md:text-sm font-bold text-slate-900 tracking-tight truncate">
                {messages.length > 0 ? activeSessionTitle : "Virtual CFO AI Copilot"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            
            {/* Dynamic Model Selector Dropdown */}
            <div className="relative">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800 rounded-lg px-3 py-1.5 outline-none cursor-pointer transition pr-7 appearance-none"
              >
                {availableModels.map(m => (
                  <option key={m.id} value={m.id} className="bg-white text-slate-900">
                    {m.label} ({m.tag})
                  </option>
                ))}
              </select>
              <ChevronDown className="h-3.5 w-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* System Status Pill */}
            <span className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse"></span>
              Autonomous CFO · Live Xero
            </span>

            <button
              onClick={createNewChat}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition border border-slate-200 cursor-pointer text-xs font-semibold flex items-center gap-1.5"
              title="Start New Thread"
            >
              <Plus className="h-4 w-4 text-emerald-600" />
              <span className="hidden md:inline">New Chat</span>
            </button>
          </div>
        </div>

        {/* Central Chat Stream Area */}
        <div className="flex-1 overflow-y-auto px-4 md:px-10 py-8 space-y-6">
          
          {/* Executive Empty State Cockpit (When thread is empty) */}
          {messages.length === 0 && (
            <div className="max-w-3xl mx-auto my-6 text-center space-y-8 animate-fadeIn">
              
              <div className="relative inline-block">
                <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md border border-emerald-400/30">
                  <Sparkles className="h-8 w-8" />
                </div>
              </div>

              <div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Virtual CFO Decision Support</h2>
                <p className="text-xs text-slate-500 font-normal mt-2 max-w-lg mx-auto leading-relaxed">
                  Ask about your company's financial performance, cash position, receivables, payables, profitability, or financial risks.
                </p>
              </div>

              {/* 4 Executive Suggestion Cards (2x2 Grid) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left pt-2">
                {CHAT_PROMPTS.map((sp) => {
                  const IconComp = sp.icon;
                  return (
                    <div
                      key={sp.id}
                      onClick={() => handleSendMessage(sp.prompt)}
                      className="bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-emerald-500/60 p-5 rounded-xl cursor-pointer transition-all duration-200 group shadow-2xs hover:shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className={cn("px-2.5 py-0.5 rounded-md text-[10px] font-bold border", sp.iconColor)}>
                            {sp.badge}
                          </span>
                          <IconComp className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                        </div>

                        <h3 className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors flex items-center justify-between">
                          <span>{sp.title}</span>
                          <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-600" />
                        </h3>
                        <p className="text-[11.5px] text-slate-500 mt-1.5 line-clamp-2 leading-relaxed font-normal">{sp.subtitle}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-emerald-700 font-bold">
                        <span>Ask CFO →</span>
                        <span className="text-slate-400 font-mono text-[10px]">Live Xero API</span>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* Active Messages List */}
          {messages.map((m) => {
            const isUser = m.role === 'user';

            if (isUser) {
              return (
                <div key={m.id} className="max-w-3xl mx-auto flex justify-end">
                  <div className="bg-slate-100 text-slate-900 border border-slate-200/90 rounded-xl px-4 py-3 text-xs font-medium shadow-2xs max-w-xl">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      <span>YOU</span>
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                    <div className="text-[9.5px] text-slate-400 mt-1 font-mono text-right">
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            }

            // Executive CFO Report Surface for Assistant Response
            return (
              <div key={m.id} className="max-w-3xl mx-auto">
                <div className="bg-white border border-slate-200 shadow-xs rounded-xl p-5 md:p-7 space-y-4 relative group/report">
                  
                  {/* Executive Briefing Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold text-xs shadow-2xs">
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <h2 className="text-xs font-bold text-slate-900 tracking-tight">Virtual CFO Executive Briefing</h2>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Live Xero Data
                        </p>
                      </div>
                    </div>

                    {!m.isStreaming && (
                      <button
                        onClick={() => copyToClipboard(m.text, m.id)}
                        className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition cursor-pointer border border-slate-200 text-xs flex items-center gap-1"
                        title="Copy Report"
                      >
                        {copiedId === m.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-[10.5px] text-emerald-700 font-bold">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span className="text-[10.5px] font-semibold">Copy Report</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Report Content */}
                  <div>
                    <CfoReportRenderer content={m.text} />
                    {m.isStreaming && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700 font-medium">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Analyzing live financial data & generating CFO response...</span>
                      </div>
                    )}
                  </div>

                  {/* Provenance & Source Footer */}
                  {!m.isStreaming && m.text && (
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10.5px] text-slate-500 font-mono">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="font-semibold text-slate-700">Source: Xero Live API</span>
                        <span>· Verified Grounding Engine</span>
                      </div>
                      <span className="text-slate-400">100% Live Xero Accounting Evidence</span>
                    </div>
                  )}

                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* Sticky Command Bar Composer */}
        <div className="p-4 bg-gradient-to-t from-slate-50 via-slate-50/90 to-transparent z-10 shrink-0">
          <div className="max-w-3xl mx-auto bg-white border border-slate-300 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-500/20 rounded-xl p-3 shadow-xs relative transition-all">
            
            <textarea
              ref={textareaRef}
              rows={2}
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask your Virtual CFO about Cashflow, P&L, AR/AP, or Financial Anomalies..."
              className="w-full bg-transparent border-0 outline-none text-xs text-slate-900 placeholder:text-slate-400 resize-none font-medium leading-relaxed pr-12"
            />

            <button
              onClick={() => handleSendMessage()}
              disabled={!inputPrompt.trim() || isGenerating}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 h-9 w-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white flex items-center justify-center transition cursor-pointer shadow-xs"
            >
              {isGenerating ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="max-w-3xl mx-auto mt-2 flex items-center justify-between text-[10.5px] text-slate-400 font-sans px-1">
            <div className="flex items-center gap-2 font-medium">
              <span className="text-slate-500 font-semibold">Financial Scope:</span>
              <span className="hover:text-slate-700 cursor-pointer" onClick={() => handleSendMessage("What is our current cash position and bank balance?")}>Cashflow</span>
              <span>·</span>
              <span className="hover:text-slate-700 cursor-pointer" onClick={() => handleSendMessage("Analyze our Profit & Loss performance and gross margin")}>P&L</span>
              <span>·</span>
              <span className="hover:text-slate-700 cursor-pointer" onClick={() => handleSendMessage("Which customer sales invoices are overdue?")}>AR Recovery</span>
              <span>·</span>
              <span className="hover:text-slate-700 cursor-pointer" onClick={() => handleSendMessage("How many days difference between invoice date and paid date for each supplier?")}>AP Timing</span>
              <span>·</span>
              <span className="hover:text-slate-700 cursor-pointer" onClick={() => handleSendMessage("Run a financial risk and unusual transaction audit")}>Risk Scan</span>
            </div>
            <p className="font-mono">
              Press <kbd className="bg-slate-100 px-1 py-0.5 rounded border border-slate-200 text-slate-600">Enter</kbd> to send
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
