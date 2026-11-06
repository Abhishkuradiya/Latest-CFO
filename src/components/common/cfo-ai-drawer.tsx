"use client";

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  Bot,
  User,
  Send,
  X,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  RotateCcw,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
  cardData?: {
    title?: string;
    metrics?: { label: string; value: string; color?: string }[];
    bullets?: string[];
  };
}

export function CFOAiDrawer() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isAllowed, setIsAllowed] = useState<boolean>(true);

  useEffect(() => {
    const checkDrawerPermission = async () => {
      if (typeof window === 'undefined') return;

      // 1. Try reading from localStorage cache
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('cfo_menu_permissions_')) {
            const userEmailFromKey = key.replace('cfo_menu_permissions_', '').trim();
            if (userEmailFromKey === 'admin@virtualcfo.com') {
              setIsAllowed(true);
              return;
            }
            const val = localStorage.getItem(key);
            if (val) {
              const parsed = JSON.parse(val);
              if (Array.isArray(parsed) && parsed.length > 0) {
                const drawerEntry = parsed.find((p: any) => p.menu_key === '/cfo-ai-drawer' || p.menu_key === 'cfo_ai_drawer');
                if (drawerEntry !== undefined) {
                  setIsAllowed(drawerEntry.is_enabled);
                  return;
                }
              }
            }
          }
        }
      } catch (e) {}

      // 2. Fetch from menu-permissions API
      try {
        const res = await fetch('/api/admin/menu-permissions');
        if (res.ok) {
          const data = await res.json();
          if (data.isSuperAdmin || data.userEmail === 'admin@virtualcfo.com') {
            setIsAllowed(true);
            return;
          }
          if (data.permissions && Array.isArray(data.permissions)) {
            const userEmail = (data.userEmail || '').toLowerCase().trim();
            const userPerms = data.permissions.filter((p: any) => p.role && p.role.toLowerCase().trim() === `user:${userEmail}`);
            if (userPerms.length > 0) {
              const drawerEntry = userPerms.find((p: any) => p.menu_key === '/cfo-ai-drawer' || p.menu_key === 'cfo_ai_drawer');
              if (drawerEntry !== undefined) {
                setIsAllowed(drawerEntry.is_enabled);
                return;
              }
            }
            const globalEntry = data.permissions.find((p: any) => p.role && p.role.toUpperCase() === 'ALL' && (p.menu_key === '/cfo-ai-drawer' || p.menu_key === 'cfo_ai_drawer'));
            if (globalEntry !== undefined) {
              setIsAllowed(globalEntry.is_enabled);
              return;
            }
          }
        }
      } catch (e) {}
    };

    checkDrawerPermission();

    const handlePermissionUpdate = () => {
      checkDrawerPermission();
    };

    window.addEventListener('cfo-menu-permissions-updated', handlePermissionUpdate);
    return () => {
      window.removeEventListener('cfo-menu-permissions-updated', handlePermissionUpdate);
    };
  }, []);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'ai',
      text: "Hello! I am your Virtual CFO AI Assistant. I am actively analyzing your 13-Week Cash Forecast UI and live database records.",
      timestamp: 'Just now',
      cardData: {
        title: 'Active 13-Week Liquidity Summary',
        metrics: [
          { label: 'Current Cash', value: '£420,000', color: 'text-slate-900' },
          { label: 'Minimum Floor (W9)', value: '£184,000', color: 'text-rose-600' },
          { label: 'Net 13-Wk Flow', value: '-£160,000', color: 'text-rose-600' }
        ],
        bullets: [
          'Cash pressure expected in Week 9 (Nov 26)',
          'Current safety threshold is set at £250,000',
          'Inflows cover 80% of projected operating outflows'
        ]
      }
    }
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsTyping(true);

    // Simulate AI response based on query keywords
    setTimeout(() => {
      let aiResponseText = "";
      let cardData: ChatMessage['cardData'] | undefined = undefined;

      const q = query.toLowerCase();

      if (q.includes('week 9') || q.includes('why') || q.includes('drop') || q.includes('pressure')) {
        aiResponseText = "Week 9 (Nov 26) experiences a cash floor drop to £184,000 because of three major converging outflows: 1) £120,000 supplier payments in Weeks 7-9, 2) £85,000 payroll in Week 8, and 3) £62,000 tax payment in Week 9. Meanwhile, customer receipt inflows drop to £25,000 in Week 9.";
        cardData = {
          title: 'Week 9 Cash Pressure Drivers',
          metrics: [
            { label: 'Supplier Outflow', value: '£120,000', color: 'text-rose-600' },
            { label: 'Payroll Outflow', value: '£85,000', color: 'text-rose-600' },
            { label: 'Tax Payment', value: '£62,000', color: 'text-rose-600' }
          ],
          bullets: [
            'Projected minimum is £66,000 below £250,000 safety threshold',
            'Action recommended: Accelerate AR collections or delay AP by 14 days'
          ]
        };
      } else if (q.includes('improve') || q.includes('increase') || q.includes('100k') || q.includes('250k')) {
        aiResponseText = "To bring Week 9 cash above your safety threshold (£250,000), you can execute these simulated actions: 1) Accelerate £100,000 of accounts receivable collections from top clients, 2) Negotiate 14-day extended payment terms with key suppliers, preserving £45,000 cash during Weeks 7-9.";
        cardData = {
          title: 'Simulated Improvement Outcome',
          metrics: [
            { label: 'New Min Cash', value: '£284,000', color: 'text-emerald-600' },
            { label: 'Net Uplift', value: '+£100,000', color: 'text-emerald-600' }
          ],
          bullets: [
            'Week 9 cash position increases from £184,000 to £284,000',
            'Safety buffer fully restored above target threshold'
          ]
        };
      } else if (q.includes('supplier') || q.includes('delay') || q.includes('payables')) {
        aiResponseText = "Delaying supplier payments by 14 days shifts £45,000 of cash outflows from Week 9 into Week 11. This immediately increases Week 9 ending cash from £184,000 to £229,000, keeping your liquidity above danger levels.";
      } else if (q.includes('receipt') || q.includes('customer') || q.includes('inflow')) {
        aiResponseText = "Customer receipts account for 44% of total 13-week inflows (£640,000 total). Top accounts owing payments in Weeks 1-6 are ABC Ltd (£120k) and XYZ Solutions (£95k).";
      } else {
        aiResponseText = "I have analyzed your active financial UI metrics. Based on your 13-week cash velocity, total projected inflows are £640,000 against £800,000 outflows. I recommend monitoring Week 9 closely or running a scenario simulation in the bottom panel.";
      }

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: aiResponseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        cardData
      };

      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 800);
  };

  const quickPrompts = [
    "Why is cash dropping in Week 9?",
    "How to improve Week 9 cash by £100k?",
    "Show summary of customer receipts",
    "What if we delay supplier payments?"
  ];

  if (!isAllowed) {
    return null;
  }

  return (
    <>
      {/* Floating Eye-Catching Nudge Handle Button on Right Edge of Viewport */}
      <div
        className={cn(
          "fixed -right-5 top-1/2 -translate-y-1/2 z-40 flex items-center transition-all duration-300",
          isOpen ? "translate-x-full" : "translate-x-0"
        )}
      >
        <button
          onClick={() => setIsOpen(true)}
          className="relative group flex items-center gap-1.5 bg-[#0b1329] hover:bg-[#0f172a] text-white py-2.5 pl-3.5 pr-8 rounded-l-full shadow-2xl border-l-2 border-y border-[#00b7e2]/70 hover:border-[#00b7e2] transition-all cursor-pointer backdrop-blur-md animate-ai-nudge hover:scale-105"
          title="Open Virtual CFO AI Assistant"
        >
          <ChevronLeft className="h-4 w-4 text-[#00b7e2] group-hover:-translate-x-0.5 transition-transform" />

          {/* Expand on hover text */}
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap text-[11px] font-bold text-white pr-1">
            CFO AI
          </span>
        </button>
      </div>

      {/* Embedded Dynamic Nudge Animation Keyframes */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes aiNudge {
          0%, 75%, 100% {
            transform: translateX(0px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          }
          83% {
            transform: translateX(-14px);
            box-shadow: -4px 0 22px rgba(0, 183, 226, 0.75);
          }
          90% {
            transform: translateX(-4px);
            box-shadow: -2px 0 12px rgba(0, 183, 226, 0.4);
          }
        }
        .animate-ai-nudge {
          animation: aiNudge 4.5s cubic-bezier(0.16, 1, 0.3, 1) infinite;
        }
      `}} />

      {/* Overlay Backdrop */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-40 transition-opacity"
        />
      )}

      {/* Slide-over Drawer Panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Drawer Header */}
        <div className="p-4 bg-[#0f172a] text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-[#00b7e2]/20 border border-[#00b7e2]/40 flex items-center justify-center text-[#00b7e2]">
              <Bot className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">CFO AI Copilot</h3>
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <p className="text-[10.5px] text-slate-400 font-medium">13-Week Cash Forecast Context Active</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setMessages([messages[0]]);
              }}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Reset Chat"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Close Drawer"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Chat History Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-2.5 max-w-[92%]",
                msg.sender === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              {/* Avatar */}
              <div
                className={cn(
                  "h-7 w-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold shadow-2xs mt-0.5",
                  msg.sender === 'user'
                    ? "bg-slate-900 text-white"
                    : "bg-[#00b7e2] text-slate-950"
                )}
              >
                {msg.sender === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
              </div>

              {/* Message Content */}
              <div className="space-y-2 text-xs">
                <div
                  className={cn(
                    "p-3 rounded-2xl shadow-2xs leading-relaxed",
                    msg.sender === 'user'
                      ? "bg-blue-600 text-white rounded-tr-xs"
                      : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 rounded-tl-xs"
                  )}
                >
                  <p>{msg.text}</p>
                </div>

                {/* Structured Card Data (if attached) */}
                {msg.cardData && (
                  <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-3 space-y-2.5 shadow-2xs">
                    {msg.cardData.title && (
                      <div className="text-[11px] font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-1.5 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-[#00b7e2]" />
                        <span>{msg.cardData.title}</span>
                      </div>
                    )}

                    {msg.cardData.metrics && (
                      <div className="grid grid-cols-3 gap-1.5 bg-slate-50 dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                        {msg.cardData.metrics.map((m, idx) => (
                          <div key={idx} className="space-y-0.5">
                            <span className="text-[9.5px] font-bold text-slate-400 block uppercase">{m.label}</span>
                            <span className={cn("text-xs font-extrabold block", m.color || "text-slate-900")}>
                              {m.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {msg.cardData.bullets && (
                      <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                        {msg.cardData.bullets.map((b, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <span className="text-[9.5px] text-slate-400 block px-1">
                  {msg.timestamp}
                </span>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-2.5 mr-auto">
              <div className="h-7 w-7 rounded-lg bg-[#00b7e2] text-slate-950 flex items-center justify-center shrink-0">
                <Bot className="h-3.5 w-3.5" />
              </div>
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-2xl rounded-tl-xs flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" />
                <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
                <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Suggested Queries</span>
          <div className="flex flex-wrap gap-1.5">
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(p)}
                className="text-[11px] bg-slate-100 hover:bg-[#00b7e2]/15 hover:text-[#00b7e2] hover:border-[#00b7e2]/40 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700 transition cursor-pointer text-left truncate max-w-full"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Input Box Area */}
        <div className="p-3.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask CFO Copilot about this cash forecast..."
              className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#00b7e2] transition"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="h-9 w-9 rounded-xl bg-[#00b7e2] hover:bg-[#009ec3] text-slate-950 flex items-center justify-center transition disabled:opacity-40 cursor-pointer shrink-0 shadow-2xs font-bold"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
