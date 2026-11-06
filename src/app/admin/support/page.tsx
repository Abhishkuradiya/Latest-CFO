"use client";

import React from 'react';
import { HelpCircle, MessageSquare, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function SuperAdminSupportPage() {
  const tickets = [
    { id: 'tkt-801', company: 'TechNova Solutions', subject: 'Xero OAuth sync retry needed', priority: 'High', status: 'Open', created: '2 hours ago' },
    { id: 'tkt-802', company: 'BrightFlow Ltd.', subject: 'GST invoice tax rate mapping question', priority: 'Medium', status: 'In Progress', created: '5 hours ago' },
    { id: 'tkt-803', company: 'GreenLeaf Accounting', subject: 'Add 3 extra sub-user seats', priority: 'Low', status: 'Resolved', created: '1 day ago' },
  ];

  return (
    <div className="space-y-6 select-none pb-12">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Client Support & Help Desk</h1>
        <p className="text-xs text-slate-500 font-medium mt-1">Tenant support requests, technical tickets, SLAs, and resolution logs.</p>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Ticket ID</th>
                <th className="py-3 px-4">Organization</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition">
                  <td className="py-3.5 px-4 font-mono font-bold text-blue-600">{t.id}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">{t.company}</td>
                  <td className="py-3.5 px-4 text-slate-700">{t.subject}</td>
                  <td className="py-3.5 px-4"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.priority === 'High' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}`}>{t.priority}</span></td>
                  <td className="py-3.5 px-4"><span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${t.status === 'Open' ? 'bg-rose-50 text-rose-700' : t.status === 'In Progress' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{t.status}</span></td>
                  <td className="py-3.5 px-4 text-right"><button onClick={() => toast.info(`Responding to ${t.id}`)} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition cursor-pointer">Reply</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
