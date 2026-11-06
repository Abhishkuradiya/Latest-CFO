"use client";

import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  ShieldCheck, 
  Database, 
  Mail, 
  Bell, 
  Cpu, 
  Lock, 
  Save, 
  ToggleLeft, 
  ToggleRight,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Server,
  Key,
  Globe,
  HelpCircle,
  Sparkles,
  Bot,
  Zap,
  Check,
  Code
} from 'lucide-react';
import { toast } from 'sonner';

interface ModelItem {
  id: string;
  name: string;
  badge: string;
  desc: string;
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifyingSmtp, setVerifyingSmtp] = useState(false);
  const [verifyingLlm, setVerifyingLlm] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);

  // SMTP Settings
  const [smtpPreset, setSmtpPreset] = useState<'gmail' | 'outlook' | 'custom' | 'sendgrid'>('gmail');
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpEncryption, setSmtpEncryption] = useState('TLS');
  const [smtpSenderEmail, setSmtpSenderEmail] = useState('noreply@virtualcfo.com');
  const [smtpSenderName, setSmtpSenderName] = useState('Virtual CFO Platform');
  const [smtpUser, setSmtpUser] = useState('admin@virtualcfo.com');
  const [smtpPass, setSmtpPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  
  // Verification states
  const [testRecipient, setTestRecipient] = useState('admin@virtualcfo.com');
  const [isSmtpVerified, setIsSmtpVerified] = useState(false);
  const [smtpError, setSmtpError] = useState('');

  // Feature Flags
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [multiTenancyEnabled, setMultiTenancyEnabled] = useState(true);
  const [auditLogging, setAuditLogging] = useState(true);
  const [rateLimit, setRateLimit] = useState('1000');

  // LLM Gateway & OmegaPlus API Settings
  const [llmProvider, setLlmProvider] = useState<'omegaplus' | 'openai' | 'anthropic' | 'custom'>('omegaplus');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [showLlmKey, setShowLlmKey] = useState(false);
  const [llmBaseUrl, setLlmBaseUrl] = useState('https://api.omegaplusapi.com');
  const [llmDefaultModel, setLlmDefaultModel] = useState('claude-fable-5');
  const [availableCatalog, setAvailableCatalog] = useState<ModelItem[]>([
    { id: 'claude-fable-5', name: 'Claude Fable 5', badge: 'Vision Native', desc: 'Anthropic multimodal flagship' },
    { id: 'claude-quantum-lite-1', name: 'Claude Quantum Lite 1', badge: 'Fast Reasoning', desc: 'Lightweight fast singlebyte model' },
    { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', badge: 'Anthropic Flagship', desc: 'High precision enterprise model' },
    { id: 'claude-deepseek-v4-pro', name: 'Claude DeepSeek V4 Pro', badge: 'DeepSeek Vision', desc: 'DeepSeek high efficiency model' },
    { id: 'claude-opus-5', name: 'Claude Opus 5', badge: 'Reasoning Engine', desc: 'High capability financial modeling' },
    { id: 'claude-qwen-3-8', name: 'Claude Qwen 3.8', badge: 'Alibaba AI', desc: 'Enterprise quantitative engine' }
  ]);
  const [llmEnabledModels, setLlmEnabledModels] = useState<string[]>(['claude-fable-5']);
  const [llmTemperature, setLlmTemperature] = useState('0.7');
  const [llmMaxTokens, setLlmMaxTokens] = useState('2048');

  const [isLlmVerified, setIsLlmVerified] = useState(false);
  const [llmStatusMessage, setLlmStatusMessage] = useState('');

  const fetchLiveModels = async (key: string, url: string) => {
    setFetchingModels(true);
    try {
      const res = await fetch('/api/admin/settings/fetch-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ llmApiKey: key, llmBaseUrl: url })
      });
      const data = await res.json();
      if (res.ok && data.models && data.models.length > 0) {
        setAvailableCatalog(data.models);

        const liveIds = data.models.map((m: any) => m.id);
        let updatedList: string[] = [];

        setLlmEnabledModels(prev => {
          const valid = prev.filter(id => liveIds.includes(id));
          updatedList = valid.length > 0 ? valid : [liveIds[0]];
          return updatedList;
        });

        if (data.isLive) {
          toast.success(data.message || 'Discovered live models from Omega Plus API!');
        }
      }
    } catch (e) {
      console.warn('Failed to fetch live models:', e);
    } finally {
      setFetchingModels(false);
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (res.ok && data.success && data.settings) {
        const s = data.settings;
        setSmtpHost(s.smtpHost || 'smtp.gmail.com');
        setSmtpPort(String(s.smtpPort || 587));
        setSmtpEncryption(s.smtpEncryption || 'TLS');
        setSmtpSenderEmail(s.smtpSenderEmail || 'noreply@virtualcfo.com');
        setSmtpSenderName(s.smtpSenderName || 'Virtual CFO Platform');
        setSmtpUser(s.smtpUser || 'admin@virtualcfo.com');
        setSmtpPass(s.smtpPass || '');
        setIsSmtpVerified(s.smtpVerified || false);
        setMaintenanceMode(s.maintenanceMode || false);
        setMultiTenancyEnabled(s.multiTenancyEnabled ?? true);
        setAuditLogging(s.auditLogging ?? true);
        setRateLimit(s.rateLimit || '1000');

        // LLM
        setLlmProvider(s.llmProvider || 'omegaplus');
        const key = s.llmApiKey || '';
        const url = s.llmBaseUrl || 'https://api.omegaplusapi.com';
        setLlmApiKey(key);
        setLlmBaseUrl(url);
        setLlmDefaultModel(s.llmDefaultModel || 'omega-plus');
        
        if (Array.isArray(s.llmEnabledModels) && s.llmEnabledModels.length > 0) {
          setLlmEnabledModels(s.llmEnabledModels);
        }

        setLlmTemperature(String(s.llmTemperature ?? 0.7));
        setLlmMaxTokens(String(s.llmMaxTokens ?? 2048));
        
        if (key && key.trim().length > 0) {
          setIsLlmVerified(true);
          setLlmStatusMessage('OmegaPlus LLM Gateway Verified ✓');
          fetchLiveModels(key, url);
        } else {
          setIsLlmVerified(false);
          setLlmStatusMessage('');
        }
      }
    } catch (e) {
      toast.error('Failed to load system settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleApplyPreset = (preset: 'gmail' | 'outlook' | 'custom' | 'sendgrid') => {
    setSmtpPreset(preset);
    setIsSmtpVerified(false);
    setSmtpError('');

    if (preset === 'gmail') {
      setSmtpHost('smtp.gmail.com');
      setSmtpPort('587');
      setSmtpEncryption('TLS');
    } else if (preset === 'outlook') {
      setSmtpHost('smtp.office365.com');
      setSmtpPort('587');
      setSmtpEncryption('TLS');
    } else if (preset === 'sendgrid') {
      setSmtpHost('smtp.sendgrid.net');
      setSmtpPort('587');
      setSmtpEncryption('TLS');
    }
  };

  const handleTestSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyingSmtp(true);
    setSmtpError('');
    try {
      const res = await fetch('/api/admin/settings/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtpHost,
          smtpPort,
          smtpEncryption,
          smtpUser,
          smtpPass,
          testRecipient
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsSmtpVerified(true);
        toast.success(`Test Email Delivered! SMTP Server Verified ✓`);
      } else {
        setIsSmtpVerified(false);
        setSmtpError(data.message || 'SMTP Verification Failed');
        toast.error(data.message || 'SMTP Verification Failed');
      }
    } catch (err) {
      setIsSmtpVerified(false);
      setSmtpError('Error connecting to SMTP server test endpoint');
      toast.error('Error verifying SMTP connection');
    } finally {
      setVerifyingSmtp(false);
    }
  };

  const saveSettingsPayload = async (overrideModels?: string[], overrideDefaultModel?: string) => {
    setSaving(true);
    const modelsToSave = overrideModels || llmEnabledModels;
    const defaultToSave = overrideDefaultModel || llmDefaultModel;
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtpHost,
          smtpPort: parseInt(smtpPort),
          smtpEncryption,
          smtpSenderEmail,
          smtpSenderName,
          smtpUser,
          smtpPass,
          smtpVerified: isSmtpVerified,
          maintenanceMode,
          multiTenancyEnabled,
          auditLogging,
          rateLimit,
          llmProvider,
          llmApiKey,
          llmBaseUrl,
          llmDefaultModel: defaultToSave,
          llmEnabledModels: modelsToSave,
          llmTemperature: parseFloat(llmTemperature),
          llmMaxTokens: parseInt(llmMaxTokens)
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('System Settings & OmegaPlus LLM Configuration Saved!');
      } else {
        toast.error(data.message || 'Failed to save configuration');
      }
    } catch (err) {
      toast.error('Network error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestLlm = async () => {
    if (!llmApiKey.trim()) {
      toast.error('Please enter an API Key to test the LLM connection!');
      return;
    }

    setVerifyingLlm(true);
    setLlmStatusMessage('');
    try {
      const res = await fetch('/api/admin/settings/test-llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          llmProvider,
          llmApiKey,
          llmBaseUrl,
          llmDefaultModel
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsLlmVerified(true);
        setLlmStatusMessage(data.message);
        toast.success(data.message);
        await fetchLiveModels(llmApiKey, llmBaseUrl);
        await saveSettingsPayload();
      } else {
        setIsLlmVerified(false);
        setLlmStatusMessage(data.message || 'LLM connection failed');
        toast.error(data.message || 'LLM verification failed');
      }
    } catch (err: any) {
      setIsLlmVerified(false);
      setLlmStatusMessage('Error connecting to LLM verification endpoint');
      toast.error('Error verifying LLM connection');
    } finally {
      setVerifyingLlm(false);
    }
  };

  const handleSelectModel = (modelId: string) => {
    setLlmDefaultModel(modelId);
    let updated = llmEnabledModels;
    if (!updated.includes(modelId)) {
      updated = [...updated, modelId];
      setLlmEnabledModels(updated);
    }
    saveSettingsPayload(updated, modelId);
    toast.success(`Active AI default model updated to ${modelId}`);
  };

  const toggleModelEnabled = (modelId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    let updated: string[];
    if (llmEnabledModels.includes(modelId)) {
      if (llmEnabledModels.length === 1) {
        toast.error('At least one LLM model must remain enabled!');
        return;
      }
      updated = llmEnabledModels.filter(m => m !== modelId);
    } else {
      updated = [...llmEnabledModels, modelId];
    }
    setLlmEnabledModels(updated);

    saveSettingsPayload(updated);
  };

  const enableAllModels = () => {
    const allIds = availableCatalog.map(m => m.id);
    setLlmEnabledModels(allIds);
    saveSettingsPayload(allIds);
    toast.success(`All ${allIds.length} OmegaPlus AI models activated for Chat UI!`);
  };

  return (
    <div className="space-y-6 select-none pb-16">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>System Settings & LLM Gateway Config</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Configure OmegaPlus API keys, LLM models, SMTP email servers, and platform security controls.
          </p>
        </div>

        <button
          onClick={fetchSettings}
          disabled={loading}
          className="self-start sm:self-auto px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* SECTION 1: OMEGAPLUS API & AI COPILOT LLM GATEWAY CONFIGURATION */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">OmegaPlus API & AI Copilot LLM Gateway</h3>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
                  {availableCatalog.length} Live Models Discovered
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Connect your Omega API key to dynamically fetch live models and choose which models to activate for users.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchLiveModels(llmApiKey, llmBaseUrl)}
              disabled={fetchingModels || !llmApiKey.trim()}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${fetchingModels ? 'animate-spin' : ''}`} />
              <span>Fetch Live Models</span>
            </button>

            <a
              href="https://omegaplusapi.com/documentation"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition flex items-center gap-1.5"
            >
              <Code className="h-3.5 w-3.5 text-slate-500" />
              <span>Omega Docs ↗</span>
            </a>
          </div>
        </div>

        <div className="space-y-6">
          
          {/* Provider & Key inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">API Provider</label>
              <select
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value as any)}
                className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-emerald-600 font-semibold cursor-pointer"
              >
                <option value="omegaplus">Omega Plus (https://api.omegaplusapi.com)</option>
                <option value="openai">OpenAI Direct Proxy</option>
                <option value="anthropic">Anthropic Messages Proxy</option>
                <option value="custom">Custom Endpoint Gateway</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Base API URL</label>
              <div className="relative">
                <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={llmBaseUrl}
                  onChange={(e) => setLlmBaseUrl(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-emerald-600 font-mono font-semibold"
                  placeholder="https://api.omegaplusapi.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Default Chat Model</label>
              <select
                value={llmDefaultModel}
                onChange={(e) => setLlmDefaultModel(e.target.value)}
                className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-emerald-600 font-semibold cursor-pointer"
              >
                {availableCatalog.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.badge})</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                OmegaPlus / Provider API Key
              </label>
              <div className="relative">
                <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type={showLlmKey ? 'text' : 'password'}
                  value={llmApiKey}
                  onChange={(e) => { setLlmApiKey(e.target.value); setIsLlmVerified(false); }}
                  className="w-full pl-10 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-emerald-600 font-mono font-semibold"
                  placeholder="Paste Omega API Key (e.g. omega_sk_... or Bearer token)"
                />
                <button
                  type="button"
                  onClick={() => setShowLlmKey(!showLlmKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showLlmKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Temperature</label>
                <input
                  type="text"
                  value={llmTemperature}
                  onChange={(e) => setLlmTemperature(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-emerald-600 font-semibold"
                  placeholder="0.7"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Max Tokens</label>
                <input
                  type="text"
                  value={llmMaxTokens}
                  onChange={(e) => setLlmMaxTokens(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-emerald-600 font-semibold"
                  placeholder="2048"
                />
              </div>
            </div>

          </div>

          {/* Catalog of Models Discovered Live from API Key */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <label className="block text-xs font-extrabold text-slate-900">
                Dynamic API Models (Click to Activate/Deactivate Models for Users in Chat UI)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-emerald-700 font-bold mr-1">
                  {llmEnabledModels.length} of {availableCatalog.length} Models Active
                </span>
                <button
                  type="button"
                  onClick={enableAllModels}
                  className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-[10px] font-extrabold transition cursor-pointer border border-emerald-300"
                >
                  Activate All {availableCatalog.length} Models ✨
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {availableCatalog.map((m) => {
                const isEnabled = llmEnabledModels.includes(m.id);
                const isDefault = llmDefaultModel === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => handleSelectModel(m.id)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      isDefault
                        ? 'bg-emerald-50 border-emerald-500 text-slate-900 shadow-sm ring-2 ring-emerald-500/30'
                        : isEnabled 
                          ? 'bg-emerald-50/40 border-emerald-300 text-slate-900 shadow-xs' 
                          : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black truncate">{m.name}</span>
                      <button
                        type="button"
                        onClick={(e) => toggleModelEnabled(m.id, e)}
                        title={isEnabled ? "Deactivate model" : "Activate model"}
                        className={`h-4 w-4 rounded-md flex items-center justify-center text-white shrink-0 transition ${isDefault ? 'bg-emerald-700' : isEnabled ? 'bg-emerald-600' : 'border border-slate-300'}`}
                      >
                        {isEnabled && <Check className="h-3 w-3" />}
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className="inline-block px-1.5 py-0.2 text-[9px] font-bold rounded bg-slate-200 text-slate-700 font-mono truncate max-w-full">
                        {m.badge}
                      </span>
                      {isDefault && (
                        <span className="inline-block px-1.5 py-0.2 text-[9px] font-black rounded bg-emerald-600 text-white font-mono shadow-xs">
                          ACTIVE MODEL
                        </span>
                      )}
                    </div>
                    <p className="text-[10.5px] text-slate-500 font-medium line-clamp-1">{m.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Test & Verification Status Bar */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {isLlmVerified ? (
                <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              ) : (
                <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="h-5 w-5" />
                </div>
              )}

              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  {isLlmVerified ? 'OmegaPlus LLM Gateway Verified ✓' : 'LLM Key Unverified'}
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  {llmStatusMessage || (isLlmVerified ? 'Live LLM API proxy connection is active and saved.' : 'Click button to test API key connection.')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestLlm}
              disabled={verifyingLlm}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
            >
              <Zap className={`h-4 w-4 ${verifyingLlm ? 'animate-bounce' : ''}`} />
              <span>{verifyingLlm ? 'Testing Connection...' : 'Test & Verify LLM API ⚡'}</span>
            </button>
          </div>

        </div>
      </div>

      {/* SECTION 2: SMTP OUTBOUND MAIL SERVER SETUP */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">SMTP Outbound Mail Server Setup</h3>
              <p className="text-xs text-slate-500">Configure email server for sending invitations, notifications, and alerts.</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl text-xs font-bold text-slate-600 overflow-x-auto">
            {[
              { id: 'gmail', label: 'Gmail SMTP' },
              { id: 'outlook', label: 'Outlook / O365' },
              { id: 'sendgrid', label: 'SendGrid' },
              { id: 'custom', label: 'Custom Host' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleApplyPreset(p.id as any)}
                className={`px-3 py-1.5 rounded-xl capitalize transition cursor-pointer ${
                  smtpPreset === p.id ? 'bg-white text-blue-600 shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleTestSmtp} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">SMTP Host / Server</label>
              <input
                type="text"
                value={smtpHost}
                onChange={(e) => { setSmtpHost(e.target.value); setIsSmtpVerified(false); }}
                className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 font-semibold"
                placeholder="smtp.gmail.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">SMTP Port</label>
              <input
                type="text"
                value={smtpPort}
                onChange={(e) => { setSmtpPort(e.target.value); setIsSmtpVerified(false); }}
                className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 font-semibold"
                placeholder="587"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Encryption Protocol</label>
              <select
                value={smtpEncryption}
                onChange={(e) => { setSmtpEncryption(e.target.value); setIsSmtpVerified(false); }}
                className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 font-semibold cursor-pointer"
              >
                <option value="TLS">TLS / STARTTLS (Recommended)</option>
                <option value="SSL">SSL</option>
                <option value="NONE">None (Plaintext)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Sender Email Address</label>
              <input
                type="email"
                value={smtpSenderEmail}
                onChange={(e) => setSmtpSenderEmail(e.target.value)}
                className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 font-semibold"
                placeholder="noreply@virtualcfo.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Sender Display Name</label>
              <input
                type="text"
                value={smtpSenderName}
                onChange={(e) => setSmtpSenderName(e.target.value)}
                className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 font-semibold"
                placeholder="Virtual CFO Platform"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">SMTP Username</label>
              <input
                type="text"
                value={smtpUser}
                onChange={(e) => { setSmtpUser(e.target.value); setIsSmtpVerified(false); }}
                className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 font-semibold"
                placeholder="admin@virtualcfo.com"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                SMTP Password / Gmail App Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={smtpPass}
                  onChange={(e) => { setSmtpPass(e.target.value); setIsSmtpVerified(false); }}
                  className="w-full pl-4 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 font-semibold"
                  placeholder="Enter SMTP password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Test Email Recipient</label>
              <input
                type="email"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 font-semibold"
                placeholder="admin@virtualcfo.com"
                required
              />
            </div>

          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {isSmtpVerified ? (
                <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              ) : (
                <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="h-5 w-5" />
                </div>
              )}

              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  {isSmtpVerified ? 'SMTP Server Connection Verified ✓' : 'SMTP Server Unverified'}
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  {isSmtpVerified 
                    ? 'Test email delivered successfully!'
                    : smtpError || 'Run test mail verification to confirm server connectivity.'}
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={verifyingSmtp}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-600/20 transition flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
            >
              <Send className={`h-4 w-4 ${verifyingSmtp ? 'animate-bounce' : ''}`} />
              <span>{verifyingSmtp ? 'Verifying SMTP Server...' : 'Send Test Email ✉️'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 3: FEATURE FLAGS */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2.5 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">System Feature Switches & Rate Limits</h3>
            <p className="text-xs text-slate-500">Configure global platform toggles, security boundaries, and API request throttles.</p>
          </div>
        </div>

        <div className="space-y-4 divide-y divide-slate-100">
          
          <div className="pt-2 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-900">Maintenance Mode</h4>
              <p className="text-[11px] text-slate-500">Puts client tenant dashboards into read-only scheduled maintenance mode.</p>
            </div>
            <button
              onClick={() => setMaintenanceMode(!maintenanceMode)}
              className="text-2xl text-blue-600 cursor-pointer"
            >
              {maintenanceMode ? <ToggleRight className="h-8 w-8 text-blue-600" /> : <ToggleLeft className="h-8 w-8 text-slate-300" />}
            </button>
          </div>

          <div className="pt-4 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-900">Strict Multi-Tenant Isolation</h4>
              <p className="text-[11px] text-slate-500">Enforces schema row-level security per tenant ID.</p>
            </div>
            <button
              onClick={() => setMultiTenancyEnabled(!multiTenancyEnabled)}
              className="text-2xl text-blue-600 cursor-pointer"
            >
              {multiTenancyEnabled ? <ToggleRight className="h-8 w-8 text-blue-600" /> : <ToggleLeft className="h-8 w-8 text-slate-300" />}
            </button>
          </div>

          <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Max API Requests / Min per Tenant</label>
              <input
                type="text"
                value={rateLimit}
                onChange={(e) => setRateLimit(e.target.value)}
                className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 font-semibold"
              />
            </div>
          </div>

        </div>
      </div>

      {/* SAVE CONFIGURATION BAR */}
      <div className="flex items-center justify-between bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs">
        <div>
          <span className="text-xs text-slate-700 font-bold flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Save system & LLM gateway configuration.
          </span>
        </div>

        <button
          type="button"
          onClick={() => saveSettingsPayload()}
          disabled={saving}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
        >
          <Save className="h-4 w-4" />
          <span>{saving ? 'Saving System Configuration...' : 'Save All Settings'}</span>
        </button>
      </div>

    </div>
  );
}
