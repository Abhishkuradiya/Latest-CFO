"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Mail, 
  Lock, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  BarChart3, 
  Zap, 
  Shield, 
  Link2, 
  Sun, 
  Moon, 
  Globe, 
  Search, 
  Sparkles, 
  ArrowUpRight, 
  Check, 
  ShieldCheck, 
  ChevronDown,
  Building2,
  TrendingUp,
  CreditCard,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';

// Translations Dictionary for 5 Languages
const translations: Record<string, {
  headline: string;
  smarter: string;
  and: string;
  faster: string;
  subtitle: string;
  goodMorning: string;
  overviewSub: string;
  revenue: string;
  profit: string;
  cash: string;
  ar: string;
  revenueTrend: string;
  aiInsightTitle: string;
  aiInsightBody: string;
  viewAnalysis: string;
  welcomeBack: string;
  signinSub: string;
  emailTab: string;
  ssoTab: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  rememberMe: string;
  forgotPassword: string;
  signInBtn: string;
  orContinue: string;
  ssoDesc: string;
  ssoBtn: string;
}> = {
  English: {
    headline: "From Data to Decisions,",
    smarter: "Smarter",
    and: " and ",
    faster: "Faster.",
    subtitle: "Automated financial insights, real-time Xero/QB integration, and AI-powered cash flow analytics for growing teams.",
    goodMorning: "Good morning, Alex",
    overviewSub: "Here's your live financial overview",
    revenue: "Total Revenue",
    profit: "Net Profit",
    cash: "Total Cash",
    ar: "AR Balance",
    revenueTrend: "Revenue Trend",
    aiInsightTitle: "AI CFO Insight",
    aiInsightBody: "Revenue increased by 55.9%, driven by strong core product sales.",
    viewAnalysis: "View Full Analysis",
    welcomeBack: "Welcome Back",
    signinSub: "Sign in to your account to continue",
    emailTab: "Email Login",
    ssoTab: "Single Sign-On",
    emailLabel: "Email Address",
    emailPlaceholder: "you@company.com",
    passwordLabel: "Password",
    passwordPlaceholder: "Enter your password",
    rememberMe: "Remember me",
    forgotPassword: "Forgot password?",
    signInBtn: "Sign In",
    orContinue: "or continue with",
    ssoDesc: "Enter your corporate email domain for SAML / SSO:",
    ssoBtn: "Continue with SSO",
  },
  Español: {
    headline: "De Datos a Decisiones,",
    smarter: "Más Inteligente",
    and: " y ",
    faster: "Más Rápido.",
    subtitle: "Informes financieros automatizados, integración con Xero/QB y análisis de flujo de caja impulsados por IA.",
    goodMorning: "Buenos días, Alex",
    overviewSub: "Aquí está su resumen financiero en vivo",
    revenue: "Ingresos Totales",
    profit: "Beneficio Neto",
    cash: "Efectivo Total",
    ar: "Saldo por Cobrar",
    revenueTrend: "Tendencia de Ingresos",
    aiInsightTitle: "Análisis IA del CFO",
    aiInsightBody: "Los ingresos aumentaron un 55,9% impulsados por fuertes ventas principales.",
    viewAnalysis: "Ver Análisis Completo",
    welcomeBack: "Bienvenido de Nuevo",
    signinSub: "Inicie sesión en su cuenta para continuar",
    emailTab: "Acceso con Email",
    ssoTab: "Inicio de Sesión Único (SSO)",
    emailLabel: "Correo Electrónico",
    emailPlaceholder: "tu@empresa.com",
    passwordLabel: "Contraseña",
    passwordPlaceholder: "Ingrese su contraseña",
    rememberMe: "Recordarme",
    forgotPassword: "¿Olvidó su contraseña?",
    signInBtn: "Iniciar Sesión",
    orContinue: "o continuar con",
    ssoDesc: "Ingrese el dominio de su empresa para autenticación SSO:",
    ssoBtn: "Continuar con SSO",
  },
  Deutsch: {
    headline: "Von Daten zu Entscheidungen,",
    smarter: "Intelligenter",
    and: " und ",
    faster: "Schneller.",
    subtitle: "Automatisierte Einblicke, Echtzeit-Xero/QB-Integration und KI-gestützte Cashflow-Analysen.",
    goodMorning: "Guten Morgen, Alex",
    overviewSub: "Hier ist Ihre aktuelle Finanzübersicht",
    revenue: "Gesamtertrag",
    profit: "Nettogewinn",
    cash: "Gesamtes Bargeld",
    ar: "Offene Forderungen",
    revenueTrend: "Umsatztrend",
    aiInsightTitle: "KI-CFO-Einblick",
    aiInsightBody: "Der Umsatz stieg um 55,9 %, getrieben durch stärkere Verkäufe.",
    viewAnalysis: "Vollständige Analyse anzeigen",
    welcomeBack: "Willkommen zurück",
    signinSub: "Melden Sie sich an, um fortzufahren",
    emailTab: "E-Mail-Anmeldung",
    ssoTab: "Single Sign-On (SSO)",
    emailLabel: "E-Mail-Adresse",
    emailPlaceholder: "sie@firma.de",
    passwordLabel: "Passwort",
    passwordPlaceholder: "Passwort eingeben",
    rememberMe: "Angemeldet bleiben",
    forgotPassword: "Passwort vergessen?",
    signInBtn: "Anmelden",
    orContinue: "oder fortfahren mit",
    ssoDesc: "Geben Sie Ihre Unternehmens-Domain für SSO ein:",
    ssoBtn: "Mit SSO fortfahren",
  },
  Français: {
    headline: "Des Données aux Décisions,",
    smarter: "Plus Intelligent",
    and: " et ",
    faster: "Plus Rapide.",
    subtitle: "Analyses financières automatisées, intégration Xero/QB en temps réel et prévisions de trésorerie IA.",
    goodMorning: "Bonjour, Alex",
    overviewSub: "Voici votre aperçu financier en direct",
    revenue: "Chiffre d'Affaires",
    profit: "Bénéfice Net",
    cash: "Trésorerie Totale",
    ar: "Créances Clients",
    revenueTrend: "Tendance des Revenus",
    aiInsightTitle: "Analyse CFO par IA",
    aiInsightBody: "Revenus en hausse de 55,9% grâce aux ventes de produits phares.",
    viewAnalysis: "Voir l'Analyse Complète",
    welcomeBack: "Bon Retour",
    signinSub: "Connectez-vous à votre compte pour continuer",
    emailTab: "Connexion E-mail",
    ssoTab: "Connexion Unique (SSO)",
    emailLabel: "Adresse E-mail",
    emailPlaceholder: "vous@entreprise.com",
    passwordLabel: "Mot de Passe",
    passwordPlaceholder: "Entrez votre mot de passe",
    rememberMe: "Se souvenir de moi",
    forgotPassword: "Mot de passe oublié ?",
    signInBtn: "Se Connecter",
    orContinue: "ou continuer avec",
    ssoDesc: "Entrez votre domaine d'entreprise pour le SSO :",
    ssoBtn: "Continuer avec SSO",
  },
  Hindi: {
    headline: "डेटा से निर्णयों तक,",
    smarter: "अधिक स्मार्ट",
    and: " और ",
    faster: "अधिक तेज़।",
    subtitle: "स्वचालित वित्तीय विश्लेषण, रीयल-टाइम Xero/QB एकीकरण, और AI-संचालित कैश फ़्लो अंतर्दृष्टि।",
    goodMorning: "शुभ प्रभात, एलेक्स",
    overviewSub: "यह आपका लाइव वित्तीय अवलोकन है",
    revenue: "कुल राजस्व (Revenue)",
    profit: "शुद्ध लाभ (Net Profit)",
    cash: "कुल नकद (Cash)",
    ar: "प्राप्य राशियाँ (AR Balance)",
    revenueTrend: "राजस्व रुझान (Revenue Trend)",
    aiInsightTitle: "AI CFO अंतर्दृष्टि",
    aiInsightBody: "मुख्य उत्पाद बिक्री में वृद्धि से राजस्व में 55.9% की वृद्धि हुई।",
    viewAnalysis: "पूरा विश्लेषण देखें",
    welcomeBack: "वापसी पर स्वागत है",
    signinSub: "जारी रखने के लिए अपने खाते में साइन इन करें",
    emailTab: "ईमेल लॉगिन",
    ssoTab: "सिंगल साइन-ऑन (SSO)",
    emailLabel: "ईमेल पता",
    emailPlaceholder: "you@company.com",
    passwordLabel: "पासवर्ड",
    passwordPlaceholder: "अपना पासवर्ड दर्ज करें",
    rememberMe: "मुझे याद रखें",
    forgotPassword: "पासवर्ड भूल गए?",
    signInBtn: "साइन इन करें",
    orContinue: "या इसके साथ जारी रखें",
    ssoDesc: "SAML/SSO के लिए अपना कॉर्पोरेट ईमेल डोमेन दर्ज करें:",
    ssoBtn: "SSO के साथ जारी रखें",
  }
};

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [activeTab, setActiveTab] = useState<'email' | 'sso'>('email');
  
  // Theme & Language State
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [selectedLang, setSelectedLang] = useState('English');
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  // Active Translated Texts
  const t = translations[selectedLang] || translations.English;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target as Node)) {
        setShowLangDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get('email');
      if (emailParam) setEmail(emailParam);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Welcome back! Logged in as ${data.user.email}`);
        
        login('session_token', {
          id: String(data.user.id),
          name: data.user.email.split('@')[0],
          email: data.user.email,
          role: 'owner',
          permissions: ['*']
        });

        const params = new URLSearchParams(window.location.search);
        const nextUrl = params.get('next');
        
        if (data.user.isOnboarded === false || nextUrl === '/onboarding') {
          window.location.href = '/onboarding';
        } else {
          window.location.href = '/overview';
        }
      } else {
        toast.error(data.message || 'Login failed. Please check credentials.');
      }
    } catch (err) {
      toast.error('An error occurred during login.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignIn = (provider: string) => {
    toast.info(`${provider} sign-in is coming soon for your organization.`);
  };

  const languages = [
    { code: 'EN', name: 'English' },
    { code: 'ES', name: 'Español' },
    { code: 'DE', name: 'Deutsch' },
    { code: 'FR', name: 'Français' },
    { code: 'HI', name: 'Hindi' },
  ];

  return (
    <div className={`min-h-screen w-full font-sans transition-colors duration-300 select-none flex flex-col justify-between relative overflow-x-hidden ${
      isDarkMode 
        ? 'bg-[#060c18] text-slate-100 selection:bg-cyan-500 selection:text-black' 
        : 'bg-gradient-to-br from-[#f8fafc] via-[#edf4ff] to-[#f1f5f9] text-slate-800 selection:bg-blue-600 selection:text-white'
    }`}>
      
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        {isDarkMode ? (
          <>
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[130px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[150px]" />
          </>
        ) : (
          <>
            <div className="absolute top-[-5%] left-[-5%] w-[500px] h-[500px] rounded-full bg-blue-400/15 blur-[120px]" />
            <div className="absolute bottom-[-5%] right-[-5%] w-[600px] h-[600px] rounded-full bg-cyan-400/15 blur-[140px]" />
          </>
        )}
      </div>

      {/* SLEEK INTEGRATED TOP HEADER */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-6 sm:px-10 py-6 flex items-center justify-between">
        
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group cursor-pointer">
          <div className="flex items-end gap-1.5 h-8 flex-shrink-0">
            <span className="w-2.5 h-4 bg-[#2563eb] rounded-full transition-transform group-hover:scale-110"></span>
            <span className="w-2.5 h-6 bg-[#3b82f6] rounded-full transition-transform group-hover:scale-110 delay-75"></span>
            <span className="w-2.5 h-8 bg-[#00b7e2] rounded-full transition-transform group-hover:scale-110 delay-150"></span>
          </div>
          <div className="flex flex-col">
            <span className={`font-black text-xl tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-[#0f172a]'}`}>
              Virtual CFO
            </span>
            <span className={`text-[10.5px] font-medium leading-none mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Your Financial Intelligence Partner
            </span>
          </div>
        </Link>

        {/* Center Header Nav Links */}
        <nav className={`hidden md:flex items-center gap-7 text-xs font-semibold ${
          isDarkMode ? 'text-slate-400' : 'text-slate-600'
        }`}>
          <Link href="#privacy" onClick={(e) => { e.preventDefault(); toast.info("Privacy Policy document"); }} className="hover:text-blue-500 dark:hover:text-cyan-400 transition">Privacy Policy</Link>
          <Link href="#terms" onClick={(e) => { e.preventDefault(); toast.info("Terms of Service document"); }} className="hover:text-blue-500 dark:hover:text-cyan-400 transition">Terms of Service</Link>
          <Link href="#security" onClick={(e) => { e.preventDefault(); toast.info("Security & Compliance portal"); }} className="hover:text-blue-500 dark:hover:text-cyan-400 transition">Security</Link>
          <Link href="#support" onClick={(e) => { e.preventDefault(); toast.info("Contact CFO Support"); }} className="hover:text-blue-500 dark:hover:text-cyan-400 transition">Help Center</Link>
        </nav>

        {/* Top Right Utilities: Minimal Icon Buttons */}
        <div className="flex items-center gap-3 text-xs font-medium">
          
          {/* Theme Toggle minimal icon button */}
          <button
            onClick={() => {
              setIsDarkMode(!isDarkMode);
              toast.success(isDarkMode ? 'Switched to Light Mode' : 'Switched to Dark Mode');
            }}
            className={`p-2.5 rounded-full transition-all duration-200 cursor-pointer ${
              isDarkMode 
                ? 'text-amber-400 hover:bg-slate-800/80' 
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
          </button>

          {/* Language Selector minimal dropdown button */}
          <div className="relative" ref={langDropdownRef}>
            <button
              onClick={() => setShowLangDropdown(!showLangDropdown)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold transition-all duration-200 cursor-pointer ${
                isDarkMode 
                  ? 'text-slate-200 hover:bg-slate-800/80' 
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <Globe className="h-4 w-4 text-[#00b7e2]" />
              <span>{selectedLang}</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showLangDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Language Menu Dropdown Box */}
            {showLangDropdown && (
              <div className={`absolute right-0 mt-2 w-40 rounded-2xl border shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-200 ${
                isDarkMode ? 'bg-[#0f172a] border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
              }`}>
                {languages.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => {
                      setSelectedLang(l.name);
                      setShowLangDropdown(false);
                      toast.success(`Language set to ${l.name}`);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                      selectedLang === l.name 
                        ? (isDarkMode ? 'bg-blue-600/30 text-cyan-400 font-bold' : 'bg-blue-50 text-blue-600 font-bold')
                        : (isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50')
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-700 font-mono text-slate-700 dark:text-slate-200">{l.code}</span>
                      <span>{l.name}</span>
                    </span>
                    {selectedLang === l.name && <Check className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>
      </header>

      {/* MAIN CONTENT GRID */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 py-2 lg:py-6 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        
        {/* LEFT COLUMN: CFO PRODUCT SHOWCASE */}
        <div className="lg:col-span-7 space-y-6">
          
          <div className="space-y-3">
            <h1 className={`text-4xl sm:text-5xl lg:text-[48px] font-black tracking-tight leading-[1.15] ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}>
              {t.headline}<br />
              <span className="text-[#2563eb]">{t.smarter}</span>{t.and}<span className="text-[#00b7e2]">{t.faster}</span>
            </h1>
            <p className={`text-sm sm:text-base max-w-xl leading-relaxed font-normal ${
              isDarkMode ? 'text-slate-400' : 'text-slate-600'
            }`}>
              {t.subtitle}
            </p>
          </div>

          {/* INTERACTIVE COMPACT DASHBOARD MOCKUP */}
          <div className={`rounded-3xl p-5 border shadow-2xl transition duration-300 ${
            isDarkMode 
              ? 'bg-slate-900/80 border-slate-800 shadow-cyan-950/20' 
              : 'bg-white/90 border-slate-200/90 shadow-slate-200/50'
          }`}>
            
            {/* Mock Header */}
            <div className={`flex items-center justify-between border-b pb-3 ${
              isDarkMode ? 'border-slate-800' : 'border-slate-100'
            }`}>
              <div className="flex items-center gap-2">
                <div className="flex items-end gap-1 h-5">
                  <span className="w-1.5 h-2.5 bg-[#2563eb] rounded-full"></span>
                  <span className="w-1.5 h-3.5 bg-[#3b82f6] rounded-full"></span>
                  <span className="w-1.5 h-5 bg-[#00b7e2] rounded-full"></span>
                </div>
                <span className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Virtual CFO</span>
              </div>

              <div className={`hidden sm:flex items-center gap-2 px-3 py-1 rounded-xl text-[11px] w-44 ${
                isDarkMode ? 'bg-slate-800/80 text-slate-400' : 'bg-slate-100/80 text-slate-400'
              }`}>
                <Search className="h-3 w-3" />
                <span>Search metrics...</span>
              </div>

              <div className="flex items-center gap-2 text-[11px]">
                <div className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 ${
                  isDarkMode ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'
                }`}>
                  Acme Ltd. <ChevronDown className="h-3 w-3 text-slate-400" />
                </div>
                <div className="h-6 w-6 rounded-full bg-[#00b7e2] text-white font-bold text-[10px] flex items-center justify-center">
                  A
                </div>
              </div>
            </div>

            {/* Mock Subheader */}
            <div className="flex items-center justify-between py-2.5">
              <div>
                <h3 className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {t.goodMorning}
                </h3>
                <p className={`text-[10.5px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.overviewSub}</p>
              </div>

              <div className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg ${
                isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
              }`}>
                01 Apr - 30 Sep
              </div>
            </div>

            {/* 4 Metric Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              
              <div className={`p-2.5 rounded-2xl border space-y-0.5 ${
                isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50/80 border-slate-100'
              }`}>
                <div className="flex items-center justify-between text-[10px]">
                  <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>{t.revenue}</span>
                  <BarChart3 className="h-3 w-3 text-blue-500" />
                </div>
                <div className={`text-xs font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>£3,998,930</div>
                <div className="text-[8.5px] font-bold text-emerald-500">↑ 55.9%</div>
              </div>

              <div className={`p-2.5 rounded-2xl border space-y-0.5 ${
                isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50/80 border-slate-100'
              }`}>
                <div className="flex items-center justify-between text-[10px]">
                  <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>{t.profit}</span>
                  <TrendingUp className="h-3 w-3 text-rose-500" />
                </div>
                <div className={`text-xs font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>-£7,740</div>
                <div className="text-[8.5px] font-bold text-rose-400">↑ 87.1%</div>
              </div>

              <div className={`p-2.5 rounded-2xl border space-y-0.5 ${
                isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50/80 border-slate-100'
              }`}>
                <div className="flex items-center justify-between text-[10px]">
                  <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>{t.cash}</span>
                  <Zap className="h-3 w-3 text-emerald-500" />
                </div>
                <div className={`text-xs font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>£144,417</div>
                <div className="text-[8.5px] font-bold text-emerald-500">↑ 83.7%</div>
              </div>

              <div className={`p-2.5 rounded-2xl border space-y-0.5 ${
                isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50/80 border-slate-100'
              }`}>
                <div className="flex items-center justify-between text-[10px]">
                  <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>{t.ar}</span>
                  <Building2 className="h-3 w-3 text-purple-500" />
                </div>
                <div className={`text-xs font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>£3,704,165</div>
                <div className="text-[8.5px] font-bold text-emerald-500">↑ 52.4%</div>
              </div>

            </div>

            {/* Revenue Trend Line & AI Box */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-3">
              <div className={`sm:col-span-7 p-2.5 rounded-2xl border ${
                isDarkMode ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50/60 border-slate-100'
              }`}>
                <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                  <span className={isDarkMode ? 'text-slate-200' : 'text-slate-800'}>{t.revenueTrend}</span>
                  <span className="text-blue-500">Current Year</span>
                </div>
                <div className="h-16 w-full">
                  <svg className="w-full h-full" viewBox="0 0 300 60" preserveAspectRatio="none">
                    <path d="M 10,50 C 50,45 80,30 120,25 C 160,20 200,10 290,5" fill="none" stroke="#2563eb" strokeWidth="2.5" />
                    <path d="M 10,55 C 50,50 80,48 120,40 C 160,35 200,30 290,25" fill="none" stroke="#00b7e2" strokeWidth="1.5" strokeDasharray="3 2" />
                  </svg>
                </div>
              </div>

              <div className={`sm:col-span-5 p-3 rounded-2xl border flex flex-col justify-between ${
                isDarkMode ? 'bg-blue-950/30 border-blue-800/50' : 'bg-blue-50/80 border-blue-100'
              }`}>
                <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-blue-500">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{t.aiInsightTitle}</span>
                </div>
                <p className={`text-[10px] leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  {t.aiInsightBody}
                </p>
              </div>
            </div>

          </div>

          {/* Testimonial Quote Footer */}
          <div className="flex items-center gap-3 pt-1">
            <div className="h-7 w-7 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0">
              TS
            </div>
            <div>
              <p className={`text-xs italic font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                "Virtual CFO has transformed how we understand and control our finances."
              </p>
              <span className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>TechNova Solutions • Growing smarter with Virtual CFO</span>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: ELEGANT & PERFECTLY PROPORTIONED LOGIN CARD */}
        <div className="lg:col-span-5 flex justify-center lg:justify-end">
          
          <div className={`w-full max-w-md rounded-3xl p-7 sm:p-8 border shadow-2xl transition-all duration-300 ${
            isDarkMode 
              ? 'bg-[#0f172a]/95 border-slate-800 text-slate-100 shadow-black/50' 
              : 'bg-white border-slate-200/80 text-slate-900 shadow-slate-200/60'
          }`}>
            
            {/* Header section inside card */}
            <div className="space-y-1 text-left mb-5">
              <h2 className="text-2xl font-black tracking-tight">{t.welcomeBack}</h2>
              <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {t.signinSub}
              </p>
            </div>

            {/* Email Login vs SSO Tabs */}
            <div className={`flex border-b text-xs font-bold text-center mb-5 ${
              isDarkMode ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => setActiveTab('email')}
                className={`flex-1 pb-2.5 transition border-b-2 cursor-pointer ${
                  activeTab === 'email'
                    ? 'border-[#00b7e2] text-[#00b7e2] font-extrabold'
                    : (isDarkMode ? 'border-transparent text-slate-400 hover:text-slate-200' : 'border-transparent text-slate-400 hover:text-slate-600')
                }`}
              >
                {t.emailTab}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('sso')}
                className={`flex-1 pb-2.5 transition border-b-2 cursor-pointer ${
                  activeTab === 'sso'
                    ? 'border-[#00b7e2] text-[#00b7e2] font-extrabold'
                    : (isDarkMode ? 'border-transparent text-slate-400 hover:text-slate-200' : 'border-transparent text-slate-400 hover:text-slate-600')
                }`}
              >
                {t.ssoTab}
              </button>
            </div>

            {/* Form */}
            {activeTab === 'email' ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Email Input */}
                <div className="space-y-1.5">
                  <label className={`text-[11px] font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{t.emailLabel}</label>
                  <div className="relative flex items-center">
                    <span className={`absolute left-3.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      <Mail className="h-4 w-4" />
                    </span>
                    <input
                      type="email"
                      placeholder={t.emailPlaceholder}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      className={`w-full pl-10 pr-4 py-2.5 text-xs border rounded-xl focus:outline-none transition ${
                        isDarkMode 
                          ? 'bg-slate-800/60 border-slate-700 text-white focus:border-[#00b7e2] focus:ring-1 focus:ring-[#00b7e2]' 
                          : 'bg-slate-50/50 border-slate-200 text-slate-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20'
                      }`}
                      required
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-1.5">
                  <label className={`text-[11px] font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{t.passwordLabel}</label>
                  <div className="relative flex items-center">
                    <span className={`absolute left-3.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      <Lock className="h-4 w-4" />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder={t.passwordPlaceholder}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      className={`w-full pl-10 pr-10 py-2.5 text-xs border rounded-xl focus:outline-none transition ${
                        isDarkMode 
                          ? 'bg-slate-800/60 border-slate-700 text-white focus:border-[#00b7e2] focus:ring-1 focus:ring-[#00b7e2]' 
                          : 'bg-slate-50/50 border-slate-200 text-slate-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20'
                      }`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute right-3.5 transition cursor-pointer ${
                        isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Options Row */}
                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                    />
                    <span className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{t.rememberMe}</span>
                  </label>
                  
                  <Link
                    href="#"
                    onClick={(e) => { e.preventDefault(); toast.info("Password reset link sent to your email."); }}
                    className="text-xs font-bold text-[#00b7e2] hover:underline transition"
                  >
                    {t.forgotPassword}
                  </Link>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#2563eb] hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Signing In...
                    </span>
                  ) : (
                    <>
                      {t.signInBtn}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="space-y-3 py-2 text-center">
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.ssoDesc}</p>
                <input
                  type="email"
                  placeholder="name@company.domain"
                  className={`w-full px-4 py-2.5 text-xs border rounded-xl focus:outline-none ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => toast.info("Redirecting to Corporate SSO Provider...")}
                  className="w-full py-2.5 bg-[#2563eb] text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-md"
                >
                  {t.ssoBtn}
                </button>
              </div>
            )}

            {/* Separator / Divider */}
            <div className="relative flex py-3 items-center">
              <div className={`flex-grow border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200/70'}`}></div>
              <span className={`flex-shrink mx-3 text-[10px] font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t.orContinue}</span>
              <div className={`flex-grow border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200/70'}`}></div>
            </div>

            {/* 3 Social Login Buttons (Google, Microsoft, Apple) */}
            <div className="grid grid-cols-3 gap-2">
              
              {/* Google */}
              <button
                type="button"
                onClick={() => handleSocialSignIn('Google')}
                className={`flex items-center justify-center py-2 px-2 border text-xs font-semibold rounded-xl transition cursor-pointer ${
                  isDarkMode 
                    ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700' 
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs'
                }`}
              >
                <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                Google
              </button>

              {/* Microsoft */}
              <button
                type="button"
                onClick={() => handleSocialSignIn('Microsoft')}
                className={`flex items-center justify-center py-2 px-2 border text-xs font-semibold rounded-xl transition cursor-pointer ${
                  isDarkMode 
                    ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700' 
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs'
                }`}
              >
                <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 23 23">
                  <rect x="0" y="0" width="11" height="11" fill="#F25022" />
                  <rect x="12" y="0" width="11" height="11" fill="#7FBA00" />
                  <rect x="0" y="12" width="11" height="11" fill="#00A1F1" />
                  <rect x="12" y="12" width="11" height="11" fill="#FFB900" />
                </svg>
                Microsoft
              </button>

              {/* Apple */}
              <button
                type="button"
                onClick={() => handleSocialSignIn('Apple')}
                className={`flex items-center justify-center py-2 px-2 border text-xs font-semibold rounded-xl transition cursor-pointer ${
                  isDarkMode 
                    ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700' 
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs'
                }`}
              >
                <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.36c.62-.75 1.04-1.8 1.04-2.86 0-.15-.01-.29-.04-.44-1.01.04-2.26.68-2.98 1.52-.57.65-.98 1.72-.98 2.78 0 .15.02.3.04.38 1.15.09 2.3-.63 2.92-1.38z" />
                </svg>
                Apple
              </button>

            </div>

          </div>

        </div>

      </main>

      {/* ULTRA-SLEEK CLEAN FOOTER */}
      <footer className={`relative z-20 w-full border-t py-4 px-6 sm:px-10 text-xs font-medium transition-colors ${
        isDarkMode ? 'border-slate-800/80 bg-[#040914] text-slate-400' : 'border-slate-200/80 bg-white/70 backdrop-blur-md text-slate-600'
      }`}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className={`font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Virtual CFO</span>
            <span>•</span>
            <span className="text-[11px]">© 2026 Virtual CFO Inc. All rights reserved.</span>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <span>Powered by <strong className="text-blue-500">Virtual CFO Intelligence Engine</strong></span>
          </div>
        </div>
      </footer>

    </div>
  );
}
