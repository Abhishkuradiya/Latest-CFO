"use client";
 
import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  SlidersHorizontal,
  Database,
  Link2,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Clock,
  Settings,
  MoreVertical,
  ExternalLink,
  FileText,
  PlayCircle,
  MessageSquare,
  ArrowRight,
  RefreshCw,
  FolderSync,
  X,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  Info,
  CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
 
interface Connector {
  id: string;
  name: string;
  subtitle: string;
  status: 'Connected' | 'Disconnected' | 'Not Connected';
  lastSync: string;
  syncDesc: string;
  syncedTypes: string;
  records: string;
  logoColor: string;
  logo: React.ReactNode;
}
 
export default function DataSourcesPage() {
  const [activeTab, setActiveTab] = useState<'All' | 'Connected' | 'Available' | 'Disconnected'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [xeroData, setXeroData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isInitialLoad = useRef(true);

  // Xero Modal & Credentials Configuration States
  const [isXeroModalOpen, setIsXeroModalOpen] = useState(false);
  const [xeroTab, setXeroTab] = useState<'oauth' | 'manual'>('oauth');
  const [showClientId, setShowClientId] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [oauthStep, setOauthStep] = useState<'idle' | 'redirecting'>('idle');
  const isAuthFlowActive = useRef(false); // Track if user is actively authenticating
  const hasShownConnectionToast = useRef(false); // Prevent duplicate toasts

  // Amazon Seller Central Modal & Credentials States
  const [isAmazonModalOpen, setIsAmazonModalOpen] = useState(false);
  const [amazonTab, setAmazonTab] = useState<'oauth' | 'manual'>('oauth');
  const [showAmazonSecret, setShowAmazonSecret] = useState(false);
  const [showAmazonToken, setShowAmazonToken] = useState(false);
  const [isSavingAmazon, setIsSavingAmazon] = useState(false);
  const [amazonConfig, setAmazonConfig] = useState({
    clientId: '',
    clientSecret: '',
    refreshToken: '',
    sellerId: '',
    region: 'eu-west-1',
    marketplaceId: 'A1F83G8C2ARO7P',
    environment: 'sandbox'
  });

  // eBay Seller Central Modal & Credentials States
  const [isEbayModalOpen, setIsEbayModalOpen] = useState(false);
  const [ebayTab, setEbayTab] = useState<'oauth' | 'manual'>('oauth');
  const [showEbaySecret, setShowEbaySecret] = useState(false);
  const [showEbayToken, setShowEbayToken] = useState(false);
  const [isSavingEbay, setIsSavingEbay] = useState(false);
  const [ebayConfig, setEbayConfig] = useState({
    appId: '',
    certId: '',
    refreshToken: '',
    ruName: '',
    environment: 'production'
  });

  // Stripe Payments Modal & Credentials States
  const [isStripeModalOpen, setIsStripeModalOpen] = useState(false);
  const [stripeTab, setStripeTab] = useState<'oauth' | 'manual'>('oauth');
  const [showStripeKey, setShowStripeKey] = useState(false);
  const [isSavingStripe, setIsSavingStripe] = useState(false);
  const [stripeConfig, setStripeConfig] = useState({
    apiKey: '',
    publishableKey: '',
    environment: 'test'
  });

  // PostgreSQL Database Inspection States
  const [dbInspectData, setDbInspectData] = useState<any>(null);
  const [isDbInspectModalOpen, setIsDbInspectModalOpen] = useState(false);
 
  const [xeroConfig, setXeroConfig] = useState({
    clientId: '',
    clientSecret: '',
    launcherUrl: '',
    redirectUri: typeof window !== 'undefined' ? `${window.location.origin}/api/xero/callback` : ''
  });
 
  // Function to manually trigger shimmer re-loading animation
  const triggerShimmerReload = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 700);
  };

  // Handle URL query parameters for locked connector redirection errors
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const connector = params.get('connector');
      const error = params.get('error');
      if (error === 'locked' && connector) {
        const connectorNames: Record<string, string> = {
          xero: 'Xero Integration',
          amazon: 'Amazon Seller Central',
          ebay: 'eBay Seller Central',
          stripe: 'Stripe Payments',
          shopify: 'Shopify Store',
          paypal: 'PayPal Settlement',
          woocommerce: 'WooCommerce',
          etsy: 'Etsy Seller',
          square: 'Square Payments',
          razorpay: 'Razorpay Global'
        };
        const name = connectorNames[connector] || connector.toUpperCase();
        toast.error(`${name} is Not Connected`, {
          description: `Please connect your ${name} account to unlock access to its dashboards and reports.`,
          duration: 6000,
          id: `ds-locked-${connector}`
        });
      }
    }
  }, []);

  // Polling effect to dynamically update connection state from the database
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setXeroConfig(prev => ({
        ...prev,
        redirectUri: `${window.location.origin}/api/xero/callback`
      }));
    }

    const checkConnection = async () => {
      try {
        await Promise.allSettled([
          (async () => {
            const res = await fetch('/api/xero');
            if (res.ok) {
              const data = await res.json();
              setXeroData(data);
              if (data.connected) {
                setConnectors(prev => {
                  const isReconnecting = isAuthFlowActive.current;
                  if (isReconnecting && !hasShownConnectionToast.current) {
                    hasShownConnectionToast.current = true;
                    isAuthFlowActive.current = false;
                    setIsXeroModalOpen(false);
                    setOauthStep('idle');
                    toast.success(`Xero connected/reconnected successfully to ${data.organisation}!`);
                  }
                  return prev.map(c => {
                    if (c.id === 'xero') {
                      return {
                        ...c,
                        subtitle: data.organisation,
                        status: 'Connected',
                        lastSync: 'Just now',
                        syncDesc: 'Auto sync enabled',
                        records: data.records.toLocaleString(),
                        syncedTypes: '4 / 14'
                      };
                    }
                    return c;
                  });
                });
              } else {
                setXeroData(null);
                hasShownConnectionToast.current = false;
                setConnectors(prev =>
                  prev.map(c => {
                    if (c.id === 'xero' && c.status === 'Connected') {
                      return {
                        ...c,
                        subtitle: 'Not connected',
                        status: 'Not Connected',
                        lastSync: '─',
                        syncDesc: 'Never synced',
                        records: '0',
                        syncedTypes: '0 / 14'
                      };
                    }
                    return c;
                  })
                );
              }
            }
          })(),
          (async () => {
            const aRes = await fetch('/api/amazon');
            if (aRes.ok) {
              const aData = await aRes.json();
              if (aData.connected) {
                setConnectors(prev =>
                  prev.map(c => {
                    if (c.id === 'amazon') {
                      return {
                        ...c,
                        subtitle: aData.sellerName || `Seller ID: ${aData.sellerId}`,
                        status: 'Connected',
                        lastSync: aData.lastSync || 'Just now',
                        syncDesc: 'SP-API Live Sync',
                        records: (aData.records || 0).toLocaleString(),
                        syncedTypes: '2 / 4'
                      };
                    }
                    return c;
                  })
                );
              } else {
                setConnectors(prev =>
                  prev.map(c => {
                    if (c.id === 'amazon' && c.status === 'Connected') {
                      return {
                        ...c,
                        subtitle: 'Not connected',
                        status: 'Not Connected',
                        lastSync: '─',
                        syncDesc: 'Never synced',
                        records: '0',
                        syncedTypes: '0 / 4'
                      };
                    }
                    return c;
                  })
                );
              }
            }
          })(),
          (async () => {
            const eRes = await fetch('/api/ebay');
            if (eRes.ok) {
              const eData = await eRes.json();
              if (eData.connected) {
                setConnectors(prev =>
                  prev.map(c => {
                    if (c.id === 'ebay') {
                      return {
                        ...c,
                        subtitle: eData.sellerName || 'eBay Account Connected',
                        status: 'Connected',
                        lastSync: eData.lastSync || 'Just now',
                        syncDesc: 'REST API Live Sync',
                        records: (eData.records || 0).toLocaleString(),
                        syncedTypes: '2 / 4'
                      };
                    }
                    return c;
                  })
                );
              } else {
                setConnectors(prev =>
                  prev.map(c => {
                    if (c.id === 'ebay' && c.status === 'Connected') {
                      return {
                        ...c,
                        subtitle: 'Not connected',
                        status: 'Not Connected',
                        lastSync: '─',
                        syncDesc: 'Never synced',
                        records: '0',
                        syncedTypes: '0 / 4'
                      };
                    }
                    return c;
                  })
                );
              }
            }
          })(),
          (async () => {
            const sRes = await fetch('/api/stripe');
            if (sRes.ok) {
              const sData = await sRes.json();
              if (sData.connected) {
                setConnectors(prev =>
                  prev.map(c => {
                    if (c.id === 'stripe') {
                      return {
                        ...c,
                        subtitle: sData.accountName || 'Stripe Account Connected',
                        status: 'Connected',
                        lastSync: sData.lastSync || 'Just now',
                        syncDesc: 'Stripe API Live Sync',
                        records: (sData.records || 0).toLocaleString(),
                        syncedTypes: '4 / 4'
                      };
                    }
                    return c;
                  })
                );
              } else {
                setConnectors(prev =>
                  prev.map(c => {
                    if (c.id === 'stripe' && c.status === 'Connected') {
                      return {
                        ...c,
                        subtitle: 'Not connected',
                        status: 'Not Connected',
                        lastSync: '─',
                        syncDesc: 'Never synced',
                        records: '0',
                        syncedTypes: '0 / 4'
                      };
                    }
                    return c;
                  })
                );
              }
            }
          })(),
          (async () => {
            const dbRes = await fetch('/api/database/inspect');
            if (dbRes.ok) {
              const dbData = await dbRes.json();
              setDbInspectData(dbData);
            }
          })()
        ]);
      } catch (err) {
      } finally {
        if (isInitialLoad.current) {
          setTimeout(() => {
            setIsLoading(false);
            isInitialLoad.current = false;
          }, 600);
        }
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 3000);
    return () => clearInterval(interval);
  }, []);
 
  // State-driven connectors for real-time interactive toggling
  const [connectors, setConnectors] = useState<Connector[]>([
    {
      id: 'xero',
      name: 'Xero',
      subtitle: 'Not connected',
      status: 'Not Connected',
      lastSync: '─',
      syncDesc: 'Never synced',
      syncedTypes: '0 / 14',
      records: '0',
      logoColor: 'bg-white p-1 border border-slate-200/80',
      logo: (
        <img src="/xero_logo.svg" alt="Xero" className="h-full w-full object-contain" />
      )
    },
    {
      id: 'amazon',
      name: 'Amazon Seller Central',
      subtitle: 'Not connected',
      status: 'Not Connected',
      lastSync: '─',
      syncDesc: 'Never synced',
      syncedTypes: '0 / 4',
      records: '0',
      logoColor: 'bg-white p-1 border border-slate-200/80',
      logo: (
        <img src="/amazon_logo.png" alt="Amazon" className="h-full w-full object-contain" />
      )
    },
    {
      id: 'ebay',
      name: 'eBay Seller Central',
      subtitle: 'Not connected',
      status: 'Not Connected',
      lastSync: '─',
      syncDesc: 'Never synced',
      syncedTypes: '0 / 4',
      records: '0',
      logoColor: 'bg-white p-1 border border-slate-200/80',
      logo: (
        <img src="/ebay_logo.svg" alt="eBay" className="h-full w-full object-contain" />
      )
    },
    {
      id: 'stripe',
      name: 'Stripe Payments',
      subtitle: 'Not connected',
      status: 'Not Connected',
      lastSync: '─',
      syncDesc: 'Never synced',
      syncedTypes: '0 / 4',
      records: '0',
      logoColor: 'bg-white p-1 border border-slate-200/80',
      logo: (
        <img src="/stripe_logo.png" alt="Stripe" className="h-full w-full object-contain" />
      )
    }
    /*
    ,
    {
      id: 'shopify',
      name: 'Shopify',
      subtitle: 'Not connected',
      status: 'Not Connected',
      lastSync: '─',
      syncDesc: 'Never synced',
      syncedTypes: '0 / 10',
      records: '0',
      logoColor: 'bg-[#96bf48]',
      logo: (
        <svg className="h-4.5 w-4.5 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.8 6.4c-.2-.6-.7-.9-1.3-1l-3.3-.5c-.2 0-.4-.2-.4-.4l-.8-3c-.1-.6-.6-1.1-1.2-1.1s-1.1.5-1.2 1.1l-.8 3c0 .2-.2.4-.4.4l-3.3.5c-.6.1-1.1.5-1.3 1L3.1 19c-.2.6 0 1.2.5 1.6.4.4.9.6 1.5.6h13.8c.6 0 1.1-.2 1.5-.6.5-.4.7-1 .5-1.6l-2.1-12.6z" />
        </svg>
      )
    },
    {
      id: 'amazon',
      name: 'Amazon Seller Central',
      subtitle: 'Not connected',
      status: 'Not Connected',
      lastSync: '─',
      syncDesc: 'Never synced',
      syncedTypes: '0 / 12',
      records: '0',
      logoColor: 'bg-[#ff9900]',
      logo: (
        <span className="text-[10px] font-black text-black">a</span>
      )
    },
    {
      id: 'stripe',
      name: 'Stripe',
      subtitle: 'Not connected',
      status: 'Not Connected',
      lastSync: '─',
      syncDesc: 'Never synced',
      syncedTypes: '0 / 8',
      records: '0',
      logoColor: 'bg-[#635bff]',
      logo: (
        <span className="font-extrabold text-[12px] text-white">S</span>
      )
    },
    {
      id: 'zoho',
      name: 'Zoho Books',
      subtitle: 'Not connected',
      status: 'Not Connected',
      lastSync: '─',
      syncDesc: 'Never synced',
      syncedTypes: '0 / 10',
      records: '0',
      logoColor: 'bg-[#e51a27]',
      logo: (
        <span className="font-black text-[12px] text-white">Z</span>
      )
    },
    {
      id: 'qbo',
      name: 'QuickBooks Online',
      subtitle: 'Not connected',
      status: 'Not Connected',
      lastSync: '─',
      syncDesc: 'Never synced',
      syncedTypes: '0 / 12',
      records: '0',
      logoColor: 'bg-[#2ca01c]',
      logo: (
        <span className="font-bold text-[12px] text-white">qb</span>
      )
    },
    {
      id: 'woo',
      name: 'WooCommerce',
      subtitle: 'Not connected',
      status: 'Not Connected',
      lastSync: '─',
      syncDesc: 'Never synced',
      syncedTypes: '0 / 8',
      records: '0',
      logoColor: 'bg-[#96588a]',
      logo: (
        <span className="font-extrabold text-[11px] text-white">W</span>
      )
    },
    {
      id: 'ga4',
      name: 'Google Analytics 4',
      subtitle: 'Not connected',
      status: 'Not Connected',
      lastSync: '─',
      syncDesc: 'Never synced',
      syncedTypes: '0 / 6',
      records: '0',
      logoColor: 'bg-[#e37400]',
      logo: (
        <span className="font-bold text-[11px] text-white">G4</span>
      )
    }
    */
  ]);
 
  // Click handler for connector row actions
  const handleActionClick = async (id: string, currentStatus: string) => {
    if (id === 'xero') {
      try {
        const res = await fetch('/api/xero/credentials');
        if (res.ok) {
          const data = await res.json();
          if (data.clientId) {
            setXeroConfig(prev => ({
              ...prev,
              clientId: data.clientId || '',
              clientSecret: data.clientSecret || ''
            }));
          }
        }
      } catch (err) {}
      setIsXeroModalOpen(true);
    } else if (id === 'amazon') {
      try {
        const res = await fetch('/api/amazon/credentials');
        if (res.ok) {
          const data = await res.json();
          setAmazonConfig({
            clientId: data.clientId || '',
            clientSecret: data.clientSecret || '',
            refreshToken: data.refreshToken || '',
            sellerId: data.sellerId || '',
            region: data.region || 'eu-west-1',
            marketplaceId: data.marketplaceId || 'A1F83G8C2ARO7P',
            environment: data.environment || 'sandbox'
          });
        }
      } catch (err) {}
      setIsAmazonModalOpen(true);
    } else if (id === 'ebay') {
      try {
        const res = await fetch('/api/ebay/credentials');
        if (res.ok) {
          const data = await res.json();
          setEbayConfig({
            appId: data.appId || '',
            certId: data.certId || '',
            refreshToken: data.refreshToken || '',
            ruName: data.ruName || '',
            environment: data.environment || 'production'
          });
        }
      } catch (err) {}
      setIsEbayModalOpen(true);
    } else if (id === 'stripe') {
      try {
        const res = await fetch('/api/stripe/credentials');
        if (res.ok) {
          const data = await res.json();
          setStripeConfig({
            apiKey: data.apiKey || '',
            publishableKey: data.publishableKey || '',
            environment: data.environment || 'test'
          });
        }
      } catch (err) {}
      setIsStripeModalOpen(true);
    } else {
      toast.info(`Configuring connection parameter for ${id.toUpperCase()} is mocked.`);
    }
  };

  const handleSaveStripe = async () => {
    if (!stripeConfig.apiKey) {
      toast.error('Please enter your Stripe Secret API Key (sk_live_... or sk_test_...)');
      return;
    }
    setIsSavingStripe(true);
    try {
      const res = await fetch('/api/stripe/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stripeConfig)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect Stripe account');

      toast.success(data.message || 'Stripe account connected successfully!');
      setIsStripeModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Stripe Connection failed');
    } finally {
      setIsSavingStripe(false);
    }
  };

  const handleDisconnectStripe = async () => {
    try {
      const res = await fetch('/api/stripe', { method: 'DELETE' });
      if (res.ok) {
        toast.success('Stripe Payments disconnected');
        setIsStripeModalOpen(false);
      }
    } catch (err) {
      toast.error('Failed to disconnect Stripe account');
    }
  };

  const handleSyncStripe = async () => {
    try {
      toast.info('Syncing Stripe charges, customers, invoices & payouts...');
      const res = await fetch('/api/stripe/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Stripe data synced successfully!');
      } else {
        toast.error(data.error || 'Stripe sync failed');
      }
    } catch (err) {
      toast.error('Stripe sync failed');
    }
  };

  const handleSaveEbay = async () => {
    if (!ebayConfig.appId || !ebayConfig.certId || !ebayConfig.refreshToken) {
      toast.error('Please enter all eBay credentials (App ID, Cert ID, and Refresh Token)');
      return;
    }
    setIsSavingEbay(true);
    try {
      const res = await fetch('/api/ebay/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ebayConfig)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect eBay account');

      toast.success(data.message || 'eBay Seller Central connected successfully!');
      setIsEbayModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'eBay OAuth Connection failed');
    } finally {
      setIsSavingEbay(false);
    }
  };

  const handleDisconnectEbay = async () => {
    try {
      const res = await fetch('/api/ebay', { method: 'DELETE' });
      if (res.ok) {
        toast.success('eBay Seller Central disconnected');
        setIsEbayModalOpen(false);
      }
    } catch (err) {
      toast.error('Failed to disconnect eBay account');
    }
  };

  const handleSyncEbay = async () => {
    try {
      toast.info('Syncing eBay orders & financial transactions...');
      const res = await fetch('/api/ebay/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'eBay data synced successfully!');
      } else {
        toast.error(data.error || 'eBay sync failed');
      }
    } catch (err) {
      toast.error('eBay sync failed');
    }
  };

  const handleSaveAmazon = async () => {
    if (!amazonConfig.clientId || !amazonConfig.clientSecret || !amazonConfig.refreshToken || !amazonConfig.sellerId) {
      toast.error('Please enter all Amazon credentials (LWA Client ID, Client Secret, Refresh Token, Seller ID)');
      return;
    }
    setIsSavingAmazon(true);
    try {
      const res = await fetch('/api/amazon/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(amazonConfig)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect Amazon account');

      toast.success(data.message || 'Amazon Seller Central connected successfully!');
      setIsAmazonModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Amazon SP-API Connection failed');
    } finally {
      setIsSavingAmazon(false);
    }
  };

  const handleDisconnectAmazon = async () => {
    try {
      const res = await fetch('/api/amazon', { method: 'DELETE' });
      if (res.ok) {
        toast.success('Amazon Seller Central disconnected');
        setIsAmazonModalOpen(false);
      }
    } catch (err) {
      toast.error('Failed to disconnect Amazon account');
    }
  };

  const handleSyncAmazon = async () => {
    try {
      toast.info('Syncing Amazon orders & settlements...');
      const res = await fetch('/api/amazon/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Amazon data synced successfully!');
      } else {
        toast.error(data.error || 'Amazon sync failed');
      }
    } catch (err) {
      toast.error('Amazon sync failed');
    }
  };
 
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };
 
  // Initiate Real OAuth Connection
  const startOAuthConnection = async () => {
    if (!xeroConfig.clientId.trim() || !xeroConfig.clientSecret.trim()) {
      toast.error('Please enter the Client ID and Client Secret generated from Xero developer app portal.');
      return;
    }
    
    try {
      // Save client credentials to database first
      const saveRes = await fetch('/api/xero', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: xeroConfig.clientId,
          clientSecret: xeroConfig.clientSecret
        })
      });
 
      if (!saveRes.ok) {
        toast.error('Failed to save Xero client configuration.');
        return;
      }
 
      // Set modal to waiting state and mark auth flow as active
      setOauthStep('redirecting');
      isAuthFlowActive.current = true;
      hasShownConnectionToast.current = false;
 
      // Open new tab to local Next.js redirect handler
      window.open('/api/xero/redirect', '_blank');
      
      toast.info('Xero Login screen opened in a new tab. Please complete authentication and select your organization.');
    } catch (err) {
      toast.error('Error initiating Xero OAuth flow.');
    }
  };

  const quickReconnect = () => {
    setOauthStep('redirecting');
    isAuthFlowActive.current = true;
    hasShownConnectionToast.current = false;
    window.open('/api/xero/redirect', '_blank');
    toast.info('Reconnecting with your saved Xero developer application credentials...');
  };
 
  const disconnectXero = async () => {
    try {
      const res = await fetch('/api/xero', {
        method: 'DELETE'
      });
      if (res.ok) {
        setConnectors(prev =>
          prev.map(c => {
            if (c.id === 'xero') {
              return {
                ...c,
                subtitle: 'Not connected',
                status: 'Not Connected',
                lastSync: '─',
                syncDesc: 'Never synced',
                records: '0',
                syncedTypes: '0 / 14'
              };
            }
            return c;
          })
         );
         setXeroConfig(prev => ({ ...prev, clientId: '', clientSecret: '' }));
         setIsXeroModalOpen(false);
         toast.success('Xero integration disconnected and database cache cleared.');
       } else {
         toast.error('Failed to disconnect Xero from integration platform.');
       }
     } catch (err) {
       toast.error('Error contacting integration platform to disconnect.');
     }
  };
 
  // Trigger general sync process
  const triggerSyncAll = async () => {
    const isConnected = connectors.find(c => c.id === 'xero')?.status === 'Connected';
    if (!isConnected) {
      toast.error('Please connect Xero before starting data synchronization.');
      return;
    }
 
    setIsSyncingAll(true);
    toast.promise(
      (async () => {
        const res = await fetch('/api/xero', {
          method: 'POST'
        });
        setIsSyncingAll(false);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || 'Sync failed');
        }
        
        const data = await res.json() as { counts: Record<string, number> };
        // Refresh list data immediately
        const totalRecords = Object.values(data.counts).reduce((a: number, b: number) => a + b, 0);
        
        setConnectors(prev =>
          prev.map(c => {
            if (c.id === 'xero') {
              return {
                ...c,
                lastSync: 'Just now',
                records: totalRecords.toLocaleString()
              };
            }
            return c;
          })
        );
        return `Sync successful! Synced ${totalRecords} records across database schemas.`;
      })(),
      {
        loading: 'Syncing data with Xero API...',
        success: (msg) => msg,
        error: (err) => err.message || 'Synchronization failed.'
      }
    );
  };
 
  // Count stats based on connector state
  const stats = useMemo(() => {
    const total = connectors.length;
    const connected = connectors.filter(c => c.status === 'Connected').length;
    const failed = connectors.filter(c => c.status === 'Disconnected').length;
    const pct = total > 0 ? ((connected / total) * 100).toFixed(1) : '0';
    return { total, connected, failed, pct };
  }, [connectors]);
 
  // Filtered connectors list
  const filteredConnectors = useMemo(() => {
    return connectors.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            c.subtitle.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (activeTab === 'Connected') return matchesSearch && c.status === 'Connected';
      if (activeTab === 'Disconnected') return matchesSearch && c.status === 'Disconnected';
      if (activeTab === 'Available') return matchesSearch && c.status === 'Not Connected';
      return matchesSearch;
    });
  }, [connectors, activeTab, searchQuery]);
 
  return (
    <div className="space-y-6 max-w-full pb-10">
      {/* 1. Sub Navigation Tabs & Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-end border-b border-slate-200/80 pb-0.5 select-none w-full gap-4">
        {/* Pills */}
        <div className="flex gap-6">
          {([
            { id: 'All', label: 'All Connectors' },
            { id: 'Connected', label: 'Connected' },
            { id: 'Available', label: 'Available' },
            { id: 'Disconnected', label: 'Disconnected' }
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-1 pb-3 text-[12.5px] font-semibold transition outline-none cursor-pointer border-b-2 -mb-[2px]",
                activeTab === tab.id
                  ? "border-[#0064eb] text-[#0064eb] font-bold"
                  : "border-transparent text-slate-400 hover:text-slate-650"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
 
        {/* Actions Toolbar */}
        <div className="flex items-center gap-2.5 pb-2.5 w-full md:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 md:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search connectors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/80 rounded-lg pl-8.5 pr-3 py-1.5 text-[10.5px] font-bold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-primary/50 transition h-8"
            />
          </div>
            <button
            onClick={triggerShimmerReload}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-200/80 text-[10.5px] font-bold text-slate-650 hover:bg-slate-50 h-8 cursor-pointer outline-none transition"
            title="Refresh Data & Show Shimmer Loading"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 text-slate-450", isLoading && "animate-spin text-blue-600")} />
            <span>{isLoading ? "Refreshing..." : "Filters"}</span>
          </button>
 
          <button
            onClick={() => toast.success("Add Connector catalog opened")}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-[#0064eb] hover:bg-[#0052c2] text-[10.5px] font-bold text-white h-8 cursor-pointer outline-none shadow-3xs shrink-0"
          >
            <Plus className="h-3.5 w-3.5 text-blue-100" />
            <span>Add Connector</span>
          </button>
        </div>
      </div>
 
      {/* 2. Summary Cards 1x6 Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 select-none">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="flex items-center gap-3.5 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs h-[96px] relative overflow-hidden">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 animate-pulse" />
              <div className="flex flex-col min-w-0 justify-center space-y-2 flex-1">
                <div className="h-2.5 w-20 bg-slate-200 animate-pulse rounded" />
                <div className="h-5 w-14 bg-slate-200 animate-pulse rounded" />
                <div className="h-2 w-16 bg-slate-150 animate-pulse rounded" />
              </div>
            </div>
          ))
        ) : (
          [
            { title: 'Total Connectors', val: stats.total, sub: 'All time', icon: <Database className="h-4.5 w-4.5 text-[#0064eb]" />, bg: 'bg-blue-50 border-blue-100/50' },
            { title: 'Connected', val: stats.connected, sub: `${stats.pct}% of total`, icon: <Link2 className="h-4.5 w-4.5 text-emerald-500" />, bg: 'bg-emerald-50 border-emerald-100/50' },
            { title: 'Sync Successful', val: stats.connected > 0 ? '100.0%' : '0.0%', sub: 'Last 30 days', icon: <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />, bg: 'bg-emerald-50 border-emerald-100/50' },
            { title: 'Failed Sync', val: stats.failed, sub: 'Last 30 days', icon: <AlertTriangle className="h-4.5 w-4.5 text-red-500" />, bg: 'bg-red-50 border-red-100/50' },
            { title: 'Data Sources', val: dbInspectData?.activeDataSourcesCount !== undefined ? dbInspectData.activeDataSourcesCount.toString() : (stats.connected > 0 ? '5' : '0'), sub: 'PostgreSQL Active Schemas', icon: <Layers className="h-4.5 w-4.5 text-purple-500" />, bg: 'bg-purple-50 border-purple-100/50' },
            { title: 'Last Sync', val: stats.connected > 0 ? 'Just now' : '─', sub: 'All connectors', icon: <Clock className="h-4.5 w-4.5 text-blue-500" />, bg: 'bg-blue-50 border-blue-100/50' }
          ].map((stat, idx) => (
            <div key={idx} className="flex items-center gap-3.5 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition duration-200 h-[96px]">
              <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-3xs", stat.bg)}>
                {stat.icon}
              </div>
              <div className="flex flex-col min-w-0 justify-center">
                <span className="text-[10px] font-bold text-slate-400 leading-none uppercase tracking-wider truncate">{stat.title}</span>
                <h4 className="text-[17px] font-extrabold text-slate-850 tracking-tight leading-none mt-1.5 truncate">{stat.val}</h4>
                <p className="text-[9.5px] font-bold text-slate-455 mt-1.5 leading-none whitespace-nowrap truncate">{stat.sub}</p>
              </div>
            </div>
          ))
        )}
      </div>
 
      {/* 3. Split Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Section: My Connectors Table */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between min-h-[500px]">
          <div className="flex flex-col pb-3 mb-2 border-b border-slate-100 select-none">
            <h3 className="text-[13.5px] font-bold text-slate-800">My Connectors</h3>
          </div>
 
          <div className="flex-1 overflow-x-auto no-scrollbar py-0.5">
            <table className="w-full text-left border-collapse text-[10.5px]">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase py-2.5">
                  <th className="py-2.5 px-2">Connector</th>
                  <th className="py-2.5 px-2">Status</th>
                  <th className="py-2.5 px-2">Last Sync</th>
                  <th className="py-2.5 px-2">Data Synced</th>
                  <th className="py-2.5 px-2 text-right">Records</th>
                  <th className="py-2.5 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2.5 min-w-[150px]">
                          <div className="h-8 w-8 rounded-lg bg-slate-200 shrink-0" />
                          <div className="flex flex-col space-y-1.5 min-w-0">
                            <div className="h-3 w-28 bg-slate-200 rounded" />
                            <div className="h-2 w-20 bg-slate-150 rounded" />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="h-5 w-20 bg-slate-200 rounded-full" />
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex flex-col space-y-1">
                          <div className="h-3 w-16 bg-slate-200 rounded" />
                          <div className="h-2 w-20 bg-slate-150 rounded" />
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex flex-col space-y-1">
                          <div className="h-3 w-10 bg-slate-200 rounded" />
                          <div className="h-2 w-14 bg-slate-150 rounded" />
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex flex-col items-end space-y-1">
                          <div className="h-3 w-12 bg-slate-200 rounded" />
                          <div className="h-2 w-10 bg-slate-150 rounded" />
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex justify-end">
                          <div className="h-7 w-16 bg-slate-200 rounded-lg" />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : filteredConnectors.length > 0 ? (
                  filteredConnectors.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/50">
                      {/* Logo and Label */}
                      <td className="py-3 px-2 font-bold text-slate-700">
                        <div className="flex items-center gap-2.5 min-w-[150px]">
                          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-3xs border border-white/10", row.logoColor)}>
                            {row.logo}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[11.5px] text-slate-800 font-bold leading-tight truncate">{row.name}</span>
                            <span className="text-[9px] text-slate-400 font-semibold mt-0.5 truncate">{row.subtitle}</span>
                          </div>
                        </div>
                      </td>
                      
                      {/* Status badge pill */}
                      <td className="py-3 px-2">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8.5px] font-bold border",
                          row.status === 'Connected' && "bg-emerald-50/70 text-emerald-600 border-emerald-100",
                          row.status === 'Disconnected' && "bg-red-50/70 text-red-500 border-red-100",
                          row.status === 'Not Connected' && "bg-slate-50 text-slate-400 border-slate-150"
                        )}>
                          <span className={cn(
                            "h-1 w-1 rounded-full shrink-0",
                            row.status === 'Connected' && "bg-emerald-500",
                            row.status === 'Disconnected' && "bg-red-500",
                            row.status === 'Not Connected' && "bg-slate-350"
                          )} />
                          {row.status}
                        </span>
                      </td>
 
                      {/* Last Sync Info */}
                      <td className="py-3 px-2 text-slate-500 font-bold">
                        <div className="flex items-center gap-1.5 min-w-[110px]">
                          <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] text-slate-750 font-bold truncate">{row.lastSync}</span>
                            <span className="text-[8.5px] text-slate-400 font-medium leading-none mt-0.5 truncate">{row.syncDesc}</span>
                          </div>
                        </div>
                      </td>
 
                      {/* Synced Ratio */}
                      <td className="py-3 px-2 text-slate-500 font-bold">
                        <div className="flex items-center gap-1.5">
                          <FolderSync className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] text-slate-750 font-bold">{row.syncedTypes}</span>
                            <span className="text-[8.5px] text-slate-400 font-medium leading-none mt-0.5">Data Types</span>
                          </div>
                        </div>
                      </td>
 
                      {/* Total Records */}
                      <td className="py-3 px-2 text-right font-extrabold text-slate-800 text-[11px] shrink-0">
                        <div className="flex flex-col">
                          <span>{row.records}</span>
                          <span className="text-[8.5px] text-slate-400 font-medium leading-none mt-0.5">Records</span>
                        </div>
                      </td>
 
                      {/* Connect / Settings Button */}
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center justify-end gap-1.5 select-none">
                          <button
                            onClick={() => handleActionClick(row.id, row.status)}
                            className={cn(
                              "px-3 py-1 rounded text-[9.5px] font-bold border transition cursor-pointer outline-none h-7 shrink-0",
                              row.status === 'Connected'
                                ? "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
                                : "bg-white hover:bg-slate-50 border-slate-200 text-[#0064eb]"
                            )}
                          >
                            {row.status === 'Connected' ? 'Settings' : 'Connect'}
                          </button>
                          
                          <button
                            onClick={() => toast.success(`Opening options for ${row.name}`)}
                            className="p-1 rounded text-slate-400 hover:text-slate-650 outline-none cursor-pointer"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-semibold select-none">
                      No connectors matched the search queries.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
 
        {/* Right Section: Connector Health & FAQ widgets */}
        <div className="lg:col-span-4 space-y-5 flex flex-col justify-between select-none">
          {/* Card 1: Connector Health Radial Chart */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between h-[210px]">
            <div className="flex justify-between items-center pb-1 border-b border-slate-50 shrink-0">
              <h4 className="text-[11.5px] font-bold text-slate-800">Connector Health</h4>
              <button onClick={() => setIsDbInspectModalOpen(true)} className="text-[9.5px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 cursor-pointer">
                <span>View DB</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
 
            {isLoading ? (
              <div className="flex items-center gap-4 flex-1 py-1.5 animate-pulse">
                <div className="h-20 w-20 rounded-full bg-slate-200 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-2.5 w-full bg-slate-200 rounded" />
                  <div className="h-2.5 w-full bg-slate-200 rounded" />
                  <div className="h-2.5 w-full bg-slate-200 rounded" />
                  <div className="h-2.5 w-full bg-slate-200 rounded" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 flex-1 py-1.5">
                {/* SVG Health Ring Chart on Left */}
                <div className="h-20 w-20 relative flex items-center justify-center shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    {/* Background Circle */}
                    <circle cx="18" cy="18" r="16" fill="none" className="text-slate-100" strokeWidth="3" stroke="currentColor" />
                    {/* Active Percentage Circle */}
                    <circle cx="18" cy="18" r="16" fill="none" className={cn(stats.connected > 0 ? "text-emerald-500" : "text-slate-300")} strokeWidth="3" strokeDasharray={stats.connected > 0 ? `${stats.pct}, 100` : "0, 100"} strokeLinecap="round" stroke="currentColor" />
                  </svg>
                  <div className="absolute text-center">
                    <div className="text-[13.5px] font-extrabold text-slate-800 leading-none">{stats.connected > 0 ? `${stats.pct}%` : '0%'}</div>
                    <div className={cn("text-[7.5px] font-bold leading-none mt-1", stats.connected > 0 ? "text-emerald-500" : "text-slate-400")}>{stats.connected > 0 ? 'Healthy' : 'Inactive'}</div>
                  </div>
                </div>
 
                {/* Legends on Right */}
                <div className="flex-1 space-y-1.5 text-[9px] font-bold">
                  <div className="flex justify-between items-center text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>Healthy</span>
                    </div>
                    <span className="text-slate-850">{stats.connected}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span>Warning</span>
                    </div>
                    <span className="text-slate-850">0</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                      <span>Error</span>
                    </div>
                    <span className="text-slate-850">{stats.failed}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                      <span>Disconnected</span>
                    </div>
                    <span className="text-slate-850">{stats.total - stats.connected}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
 
          {/* Card 2: Common Data Types (Live PostgreSQL Tables) */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between h-[210px]">
            <div className="flex justify-between items-center pb-1 border-b border-slate-50 shrink-0">
              <div className="flex items-center gap-1.5">
                <h4 className="text-[11.5px] font-bold text-slate-800">Common Data Types</h4>
                <span className="text-[8px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">PG Live</span>
              </div>
              <button 
                onClick={() => setIsDbInspectModalOpen(true)} 
                className="text-[9.5px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 cursor-pointer"
              >
                <span>Inspect DB</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
 
            {isLoading ? (
              <div className="flex-1 space-y-3 py-2 animate-pulse">
                <div className="h-3.5 w-full bg-slate-200 rounded" />
                <div className="h-3.5 w-full bg-slate-200 rounded" />
                <div className="h-3.5 w-full bg-slate-200 rounded" />
                <div className="h-3.5 w-full bg-slate-200 rounded" />
                <div className="h-3.5 w-full bg-slate-200 rounded" />
              </div>
            ) : (
              <div className="flex-1 space-y-1.5 py-2 overflow-y-auto no-scrollbar text-[9px] font-bold text-slate-500">
                {(dbInspectData?.tables || [
                  { displayName: 'Invoices', count: xeroData?.invoices || 0 },
                  { displayName: 'Customers (Contacts)', count: xeroData?.contacts || 0 },
                  { displayName: 'Chart of Accounts', count: xeroData?.accounts || 0 },
                  { displayName: 'Payments', count: xeroData?.payments || 0 },
                  { displayName: 'Amazon Sales Orders', count: 0 }
                ]).slice(0, 5).map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center py-0.5 border-b border-slate-50 last:border-0">
                    <span className="truncate pr-2">{item.displayName || item.name}</span>
                    <span className="text-slate-800 font-extrabold shrink-0">{(item.count || 0).toLocaleString()} <span className="text-slate-400 font-medium">records</span></span>
                  </div>
                ))}
              </div>
            )}
          </div>
 
          {/* Card 3: Need Help FAQ links */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between h-[210px]">
            <div className="pb-1 border-b border-slate-50 shrink-0">
              <h4 className="text-[11.5px] font-bold text-slate-800">Need Help?</h4>
              <p className="text-[8.5px] text-slate-400 font-semibold mt-0.5">Learn how to connect your data sources</p>
            </div>
 
            <div className="flex-1 flex flex-col justify-center space-y-2.5 py-1 text-[10px] font-bold">
              <Link href="/docs" className="flex items-center justify-between text-[#0064eb] hover:underline">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <span>View Documentation</span>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-blue-450" />
              </Link>
              <Link href="/video-guide" className="flex items-center justify-between text-[#0064eb] hover:underline">
                <div className="flex items-center gap-2">
                  <PlayCircle className="h-4 w-4 text-blue-500" />
                  <span>Watch Video Guide</span>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-blue-450" />
              </Link>
              <Link href="/support" className="flex items-center justify-between text-[#0064eb] hover:underline">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-500" />
                  <span>Contact Support</span>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-blue-450" />
              </Link>
            </div>
          </div>
        </div>
      </div>
 
      {/* ======================================================================= */}
      {/* 5. INTERACTIVE DYNAMIC XERO CONFIGURATION MODAL & OAUTH SYSTEM LAYOUTS */}
      {/* ======================================================================= */}
      {isXeroModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-200 relative">
            
            {/* Close Button */}
            <button 
              onClick={() => setIsXeroModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 outline-none cursor-pointer z-10 p-1 hover:bg-slate-50 rounded-full"
            >
              <X className="h-4.5 w-4.5" />
            </button>
 
            {/* Left Form Column (60% width) */}
            <div className="flex-1 p-6 md:p-8 overflow-y-auto no-scrollbar flex flex-col space-y-5">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200/80 p-1.5 shrink-0 shadow-2xs select-none">
                  <img src="/xero_logo.svg" alt="Xero Logo" className="h-full w-full object-contain" />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-slate-800 leading-tight">Xero Integration Center</h3>
                  <p className="text-[9.5px] text-slate-400 font-semibold mt-0.5">Authorize or configure application credentials to sync organisation records.</p>
                </div>
              </div>

              {/* Mode Switcher Tabs */}
              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
                <button
                  type="button"
                  onClick={() => setXeroTab('oauth')}
                  className={cn(
                    "flex-1 py-2 rounded-lg transition text-center cursor-pointer flex items-center justify-center gap-1.5",
                    xeroTab === 'oauth' ? "bg-white text-blue-600 shadow-2xs" : "hover:text-slate-900"
                  )}
                >
                  <Link2 className="h-3.5 w-3.5 text-blue-600" />
                  <span>1-Click Direct OAuth</span>
                </button>
                <button
                  type="button"
                  onClick={() => setXeroTab('manual')}
                  className={cn(
                    "flex-1 py-2 rounded-lg transition text-center cursor-pointer flex items-center justify-center gap-1.5",
                    xeroTab === 'manual' ? "bg-white text-blue-600 shadow-2xs" : "hover:text-slate-900"
                  )}
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>Custom App Credentials</span>
                </button>
              </div>

              {xeroTab === 'oauth' ? (
                /* Mode 1: 1-Click OAuth Direct Connect Card */
                <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-6 text-center space-y-5">
                  <div className="flex items-center justify-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-white border border-slate-200 p-2 shadow-2xs flex items-center justify-center">
                      <img src="/xero_logo.svg" alt="Xero" className="h-full w-full object-contain" />
                    </div>
                    <span className="text-slate-300 font-black text-lg">⇄</span>
                    <div className="h-12 w-12 rounded-2xl bg-[#0064eb] text-white font-black flex items-center justify-center text-xs shadow-2xs">
                      CFO
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="text-sm font-black text-slate-900">Direct Xero OAuth Authorization</h4>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-md mx-auto">
                      Click below to open Xero's official authorization page (<code className="text-blue-600 font-mono font-bold">login.xero.com</code>). Log in with your Xero account, choose your organization (e.g. <strong>MI Health Ltd</strong>), and click <strong>Allow Access</strong> to connect directly.
                    </p>
                  </div>

                  <div className="pt-2 max-w-sm mx-auto space-y-2.5">
                    <button
                      type="button"
                      onClick={quickReconnect}
                      className="w-full py-3 px-5 rounded-xl bg-[#00b7e2] hover:bg-[#009ec3] text-white font-extrabold text-xs shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    >
                      <img src="/xero_logo.svg" alt="Xero" className="h-4 w-4 filter brightness-0 invert" />
                      <span>Connect with Xero (OAuth 2.0)</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                    
                    <p className="text-[10px] text-slate-400 font-semibold">
                      ✓ Uses Official Xero OAuth 2.0 API • 256-bit Encrypted Token Storage
                    </p>
                  </div>
                </div>
              ) : (
                /* Mode 2: Custom App Credentials Form */
                <div className="space-y-4 text-[10.5px] font-bold text-slate-700">
                  {/* Connections Badge count */}
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>Connection Status</span>
                    </div>
                    <span className="text-[9px] bg-slate-200 text-slate-650 px-2 py-0.5 rounded-full">
                      {connectors.find(c => c.id === 'xero')?.status === 'Connected' ? '1 of 5 connections active' : '0 of 5 connections active'}
                    </span>
                  </div>

                  {/* Redirect URI (OAuth Callback) - READ-ONLY & COPYABLE */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span>Redirect URI (OAuth Callback)</span>
                      <span className="text-[9px] text-[#0064eb] font-semibold">Copy this URL</span>
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        readOnly
                        value={xeroConfig.redirectUri}
                        className="w-full bg-slate-100 border border-slate-200 rounded-lg pl-3 pr-12 py-1.5 text-[10px] font-medium text-slate-500 focus:outline-none h-8 select-all"
                      />
                      <button 
                        type="button"
                        onClick={() => copyToClipboard(xeroConfig.redirectUri)}
                        className="absolute right-1.5 p-1 text-slate-400 hover:text-slate-650 rounded cursor-pointer outline-none"
                        title="Copy Redirect URI"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-[8.5px] text-slate-400 font-semibold leading-normal">
                      Copy this callback URL and paste it under **Redirect URIs** inside your Xero Developer Portal app settings.
                    </p>
                  </div>

                  {/* Client ID - USER INPUT */}
                  <div className="space-y-1.5">
                    <span>Client ID</span>
                    <div className="relative flex items-center">
                      <input
                        type={showClientId ? 'text' : 'password'}
                        value={xeroConfig.clientId}
                        onChange={(e) => setXeroConfig(prev => ({ ...prev, clientId: e.target.value }))}
                        placeholder="Enter Client ID (obtained from Xero Developer Portal)"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-12 py-1.5 text-[10px] font-medium tracking-wide focus:outline-none focus:border-primary/50 h-8"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowClientId(!showClientId)}
                        className="absolute right-1.5 p-1 text-slate-400 hover:text-slate-650 rounded cursor-pointer outline-none"
                      >
                        {showClientId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Client Secret - USER INPUT */}
                  <div className="space-y-1.5">
                    <span>Client Secret</span>
                    <div className="relative flex items-center">
                      <input
                        type={showClientSecret ? 'text' : 'password'}
                        value={xeroConfig.clientSecret}
                        onChange={(e) => setXeroConfig(prev => ({ ...prev, clientSecret: e.target.value }))}
                        placeholder="Enter Client Secret (generated in Xero Developer Portal)"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-12 py-1.5 text-[10px] font-medium tracking-wide focus:outline-none focus:border-primary/50 h-8"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowClientSecret(!showClientSecret)}
                        className="absolute right-1.5 p-1 text-slate-400 hover:text-slate-650 rounded cursor-pointer outline-none"
                      >
                        {showClientSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
 
            {/* Right Guide Column (40% width) */}
            <div className="w-full md:w-[320px] bg-slate-50/70 border-t md:border-t-0 md:border-l border-slate-150 p-6 md:p-8 flex flex-col justify-between select-none">
              <div className="space-y-4">
                <div className="pb-1 border-b border-slate-150">
                  <h4 className="text-[11.5px] font-bold text-slate-800">Connection Checklist</h4>
                  <p className="text-[8.5px] text-slate-400 font-semibold mt-0.5">Steps to configure Xero API successfully</p>
                </div>
 
                <div className="space-y-3.5 text-[9.5px] font-semibold text-slate-500 leading-relaxed">
                  <div className="flex gap-2">
                    <span className="h-4.5 w-4.5 rounded-full bg-slate-200/80 text-slate-650 font-bold flex items-center justify-center shrink-0">1</span>
                    <p>Go to the <Link href="https://developer.xero.com/" target="_blank" className="text-[#0064eb] font-bold hover:underline flex inline-flex items-center gap-0.5">Xero Developer Console <ExternalLink className="h-2.5 w-2.5" /></Link> and sign in.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="h-4.5 w-4.5 rounded-full bg-slate-200/80 text-slate-650 font-bold flex items-center justify-center shrink-0">2</span>
                    <p>Click <strong className="font-bold text-slate-700">New App</strong> and configure a <strong className="font-bold text-slate-700">Web App</strong> pipeline.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="h-4.5 w-4.5 rounded-full bg-slate-200/80 text-slate-650 font-bold flex items-center justify-center shrink-0">3</span>
                    <p>Copy the <strong className="font-bold text-slate-700">Redirect URI</strong> shown on the left and paste it into your Xero Developer App settings.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="h-4.5 w-4.5 rounded-full bg-slate-200/80 text-slate-650 font-bold flex items-center justify-center shrink-0">4</span>
                    <p>Generate app credentials. Paste the <strong className="font-bold text-slate-700">Client ID</strong> and <strong className="font-bold text-slate-700">Client Secret</strong> into the inputs form.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="h-4.5 w-4.5 rounded-full bg-slate-200/80 text-slate-650 font-bold flex items-center justify-center shrink-0">5</span>
                    <p>Click <strong className="font-bold text-slate-700">Save & Authenticate</strong> to login to your live Xero dashboard organization.</p>
                  </div>
                </div>
              </div>
 
              {/* Bottom Action buttons */}
              <div className="flex flex-col gap-2 mt-6">
                <button
                  onClick={startOAuthConnection}
                  className="w-full text-center py-2 px-3 rounded-lg bg-[#0064eb] hover:bg-[#0052c2] text-[10.5px] font-bold text-white shadow-3xs cursor-pointer outline-none transition"
                >
                  Save & Authenticate
                </button>

                {connectors.find(c => c.id === 'xero')?.status === 'Connected' && (
                  <button
                    onClick={quickReconnect}
                    className="w-full text-center py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-[10.5px] font-bold text-white shadow-3xs cursor-pointer outline-none transition"
                  >
                    Quick Reconnect (Same Credentials)
                  </button>
                )}
 
                {connectors.find(c => c.id === 'xero')?.status === 'Connected' && (
                  <button
                    onClick={disconnectXero}
                    className="w-full text-center py-2 px-3 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-[10.5px] font-bold text-red-650 cursor-pointer outline-none transition"
                  >
                    Disconnect Integration
                  </button>
                )}
 
                <button
                  onClick={() => setIsXeroModalOpen(false)}
                  className="w-full text-center py-2 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[10.5px] font-bold text-slate-600 cursor-pointer outline-none transition"
                >
                  Cancel
                </button>
              </div>
            </div>
 
            {/* ======================================================================= */}
            {/* OAUTH MOCK POPUPS (SIMULATING PIPELINE LOGIN & CONSENT) */}
            {/* ======================================================================= */}
            {oauthStep === 'redirecting' && (
              <div className="absolute inset-0 bg-white/95 z-20 flex flex-col items-center justify-center space-y-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white border border-slate-200 p-2.5 shadow-md animate-bounce select-none">
                  <img src="/xero_logo.svg" alt="Xero" className="h-full w-full object-contain" />
                </div>
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-[#00b7e2]" />
                    <span className="text-[12px] font-bold text-slate-700">Waiting for Xero authorization...</span>
                  </div>
                  <p className="text-[9.5px] text-slate-400 font-semibold mt-1">Please complete authentication in the new browser tab.</p>
                </div>
                <button
                  onClick={() => setOauthStep('idle')}
                  className="px-4 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-[10px] font-bold text-slate-600 rounded-lg cursor-pointer outline-none transition mt-2 shadow-3xs"
                >
                  Cancel
                </button>
              </div>
            )}
            
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 6. INTERACTIVE AMAZON SELLER CENTRAL SP-API CONFIGURATION MODAL */}
      {/* ======================================================================= */}
      {isAmazonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-4xl w-full max-h-[88vh] overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-200 relative">
            
            {/* Close Button */}
            <button 
              onClick={() => setIsAmazonModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 outline-none cursor-pointer z-10 p-1 hover:bg-slate-50 rounded-full"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            {/* Left Form Column */}
            <div className="flex-1 p-6 md:p-8 overflow-y-auto no-scrollbar flex flex-col space-y-5">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200/80 p-1.5 shrink-0 shadow-2xs select-none">
                  <img src="/amazon_logo.png" alt="Amazon Logo" className="h-full w-full object-contain" />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-slate-800 leading-tight">Amazon Seller Central SP-API Connection</h3>
                  <p className="text-[9.5px] text-slate-400 font-semibold mt-0.5">Configure Login with Amazon (LWA) credentials to sync orders & settlements.</p>
                </div>
              </div>

              {/* Status Banner */}
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 flex items-center justify-between text-[10.5px] font-bold text-amber-900">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Selling Partner API (SP-API) Integration</span>
                </div>
                <span className="text-[9px] bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full font-extrabold">
                  {connectors.find(c => c.id === 'amazon')?.status === 'Connected' ? 'Connected' : 'Not Connected'}
                </span>
              </div>

              {/* Credentials Form Inputs */}
              <div className="space-y-3.5 text-[10.5px] font-bold text-slate-700">
                {/* Environment Mode Selector (Sandbox vs Production) */}
                <div className="space-y-1">
                  <span>Environment Mode</span>
                  <select
                    value={amazonConfig.environment}
                    onChange={(e) => setAmazonConfig(prev => ({ ...prev, environment: e.target.value as any }))}
                    className="w-full bg-amber-50/50 border border-amber-300/80 rounded-lg px-3 py-1.5 text-[10px] font-bold text-amber-900 focus:outline-none focus:border-amber-500 h-8 cursor-pointer"
                  >
                    <option value="sandbox">🧪 Sandbox API Mode (Testing / Mocked SP-API Data)</option>
                    <option value="production">🚀 Production API Mode (Live Seller Central Keys)</option>
                  </select>
                  <p className="text-[8.5px] text-amber-700 font-medium leading-none mt-0.5">Use Sandbox Mode to test SP-API data sync without live Amazon seller product keys.</p>
                </div>

                {/* Region / Marketplace Selector */}
                <div className="space-y-1">
                  <span>Region & Marketplace</span>
                  <select
                    value={amazonConfig.region}
                    onChange={(e) => setAmazonConfig(prev => ({ ...prev, region: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-medium text-slate-800 focus:outline-none focus:border-amber-500 h-8 cursor-pointer"
                  >
                    <option value="eu-west-1">Europe & UK (Amazon.co.uk, Amazon.de, Amazon.fr) - eu-west-1</option>
                    <option value="us-east-1">North America (Amazon.com, Amazon.ca, Amazon.com.mx) - us-east-1</option>
                    <option value="us-west-2">Far East & India (Amazon.in, Amazon.co.jp) - us-west-2</option>
                  </select>
                </div>

                {/* Seller ID / Merchant ID */}
                <div className="space-y-1">
                  <span>Seller ID (Merchant ID)</span>
                  <input
                    type="text"
                    value={amazonConfig.sellerId}
                    onChange={(e) => setAmazonConfig(prev => ({ ...prev, sellerId: e.target.value }))}
                    placeholder="e.g. A1F83G8C2ARO7P"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-medium text-slate-800 focus:outline-none focus:border-amber-500 h-8"
                  />
                  <p className="text-[8.5px] text-slate-400 font-semibold leading-none">Find your Seller ID in Seller Central under Account Info.</p>
                </div>

                {/* LWA Client ID */}
                <div className="space-y-1">
                  <span>LWA Client ID</span>
                  <input
                    type="text"
                    value={amazonConfig.clientId}
                    onChange={(e) => setAmazonConfig(prev => ({ ...prev, clientId: e.target.value }))}
                    placeholder="e.g. amzn1.application-oa2-client.xxxxxxxxxxxxxxxx"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-medium text-slate-800 focus:outline-none focus:border-amber-500 h-8"
                  />
                </div>

                {/* LWA Client Secret */}
                <div className="space-y-1">
                  <span>LWA Client Secret</span>
                  <div className="relative flex items-center">
                    <input
                      type={showAmazonSecret ? 'text' : 'password'}
                      value={amazonConfig.clientSecret}
                      onChange={(e) => setAmazonConfig(prev => ({ ...prev, clientSecret: e.target.value }))}
                      placeholder="e.g. amzn1.oa2-cs.v1.xxxxxxxxxxxxxxxx"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-10 py-1.5 text-[10px] font-medium text-slate-800 focus:outline-none focus:border-amber-500 h-8"
                    />
                    <button 
                      onClick={() => setShowAmazonSecret(!showAmazonSecret)}
                      className="absolute right-2 text-slate-400 hover:text-slate-600 outline-none cursor-pointer"
                    >
                      {showAmazonSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* LWA Refresh Token */}
                <div className="space-y-1">
                  <span>LWA Refresh Token</span>
                  <div className="relative flex items-center">
                    <input
                      type={showAmazonToken ? 'text' : 'password'}
                      value={amazonConfig.refreshToken}
                      onChange={(e) => setAmazonConfig(prev => ({ ...prev, refreshToken: e.target.value }))}
                      placeholder="e.g. Atzr|IQEBLz..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-10 py-1.5 text-[10px] font-medium text-slate-800 focus:outline-none focus:border-amber-500 h-8"
                    />
                    <button 
                      onClick={() => setShowAmazonToken(!showAmazonToken)}
                      className="absolute right-2 text-slate-400 hover:text-slate-600 outline-none cursor-pointer"
                    >
                      {showAmazonToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Guide Column */}
            <div className="w-full md:w-[320px] bg-slate-50/70 border-t md:border-t-0 md:border-l border-slate-150 p-6 md:p-8 flex flex-col justify-between select-none">
              <div className="space-y-4">
                <div className="pb-1 border-b border-slate-150">
                  <h4 className="text-[11.5px] font-bold text-slate-800">SP-API Setup Steps</h4>
                  <p className="text-[8.5px] text-slate-400 font-semibold mt-0.5">Login with Amazon (LWA) setup guide</p>
                </div>

                <div className="space-y-3 text-[9.5px] font-semibold text-slate-500 leading-relaxed">
                  <div className="flex gap-2">
                    <span className="h-4.5 w-4.5 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0">1</span>
                    <p>Go to <Link href="https://developer-docs.amazon.com/sp-api/" target="_blank" className="text-amber-700 font-bold hover:underline flex inline-flex items-center gap-0.5">Amazon SP-API Developer Portal <ExternalLink className="h-2.5 w-2.5" /></Link>.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="h-4.5 w-4.5 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0">2</span>
                    <p>Register your SP-API Application under <strong className="font-bold text-slate-700">Apps & Services</strong>.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="h-4.5 w-4.5 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0">3</span>
                    <p>Copy your <strong className="font-bold text-slate-700">LWA Client ID</strong> and <strong className="font-bold text-slate-700">LWA Client Secret</strong>.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="h-4.5 w-4.5 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0">4</span>
                    <p>Authorize your app in Seller Central to generate your <strong className="font-bold text-slate-700">LWA Refresh Token</strong>.</p>
                  </div>
                </div>
              </div>

              {/* Bottom Buttons */}
              <div className="flex flex-col gap-2 mt-6">
                <button
                  onClick={handleSaveAmazon}
                  disabled={isSavingAmazon}
                  className="w-full text-center py-2 px-3 rounded-lg bg-[#ff9900] hover:bg-[#e68a00] text-[10.5px] font-extrabold text-black shadow-3xs cursor-pointer outline-none transition flex items-center justify-center gap-2"
                >
                  {isSavingAmazon && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save & Test SP-API Connection</span>
                </button>

                {connectors.find(c => c.id === 'amazon')?.status === 'Connected' && (
                  <button
                    onClick={handleSyncAmazon}
                    className="w-full text-center py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-[10.5px] font-bold text-white shadow-3xs cursor-pointer outline-none transition"
                  >
                    Trigger Live Sync Now
                  </button>
                )}

                {connectors.find(c => c.id === 'amazon')?.status === 'Connected' && (
                  <button
                    onClick={handleDisconnectAmazon}
                    className="w-full text-center py-2 px-3 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-[10.5px] font-bold text-red-650 cursor-pointer outline-none transition"
                  >
                    Disconnect Integration
                  </button>
                )}

                <button
                  onClick={() => setIsAmazonModalOpen(false)}
                  className="w-full text-center py-2 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[10.5px] font-bold text-slate-600 cursor-pointer outline-none transition"
                >
                  Cancel
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 7. INTERACTIVE EBAY SELLER CENTRAL REST API CONFIGURATION MODAL */}
      {/* ======================================================================= */}
      {isEbayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-4xl w-full max-h-[88vh] overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-200 relative">
            
            {/* Close Button */}
            <button 
              onClick={() => setIsEbayModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 outline-none cursor-pointer z-10 p-1 hover:bg-slate-50 rounded-full"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            {/* Left Form Column */}
            <div className="flex-1 p-6 md:p-8 overflow-y-auto no-scrollbar flex flex-col space-y-5">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200/80 p-1.5 shrink-0 shadow-2xs select-none">
                  <img src="/ebay_logo.svg" alt="eBay Logo" className="h-full w-full object-contain" />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-slate-800 leading-tight">eBay Seller Central Integration</h3>
                  <p className="text-[9.5px] text-slate-400 font-semibold mt-0.5">Configure OAuth 2.0 credentials to sync orders & transactions.</p>
                </div>
              </div>

              {/* Status Banner */}
              <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3 flex items-center justify-between text-[10.5px] font-bold text-blue-900">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>eBay REST API (Fulfillment & Finances)</span>
                </div>
                <span className="text-[9px] bg-blue-200/80 text-blue-900 px-2 py-0.5 rounded-full font-extrabold">
                  {connectors.find(c => c.id === 'ebay')?.status === 'Connected' ? 'Connected' : 'Not Connected'}
                </span>
              </div>

              {/* Form Inputs */}
              <div className="space-y-3.5 text-[10.5px] font-bold text-slate-700">
                {/* Environment Selector */}
                <div className="space-y-1">
                  <span>Environment</span>
                  <select
                    value={ebayConfig.environment}
                    onChange={(e) => setEbayConfig(prev => ({ ...prev, environment: e.target.value as any }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-medium text-slate-800 focus:outline-none focus:border-blue-500 h-8 cursor-pointer"
                  >
                    <option value="production">Production Environment (api.ebay.com)</option>
                    <option value="sandbox">Sandbox Environment (api.sandbox.ebay.com)</option>
                  </select>
                </div>

                {/* App ID (Client ID) */}
                <div className="space-y-1">
                  <span>App ID (Client ID)</span>
                  <input
                    type="text"
                    value={ebayConfig.appId}
                    onChange={(e) => setEbayConfig(prev => ({ ...prev, appId: e.target.value }))}
                    placeholder="e.g. YourName-VirtualC-PRD-xxxxxxxxx-xxxx"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-medium text-slate-800 focus:outline-none focus:border-blue-500 h-8"
                  />
                  <p className="text-[8.5px] text-slate-400 font-semibold leading-none">Found under Application Keys in eBay Developer Portal.</p>
                </div>

                {/* Cert ID (Client Secret) */}
                <div className="space-y-1">
                  <span>Cert ID (Client Secret)</span>
                  <div className="relative flex items-center">
                    <input
                      type={showEbaySecret ? 'text' : 'password'}
                      value={ebayConfig.certId}
                      onChange={(e) => setEbayConfig(prev => ({ ...prev, certId: e.target.value }))}
                      placeholder="e.g. PRD-xxxxxxxxxxxx-xxxx-xxxx-xxxx"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-10 py-1.5 text-[10px] font-medium text-slate-800 focus:outline-none focus:border-blue-500 h-8"
                    />
                    <button 
                      onClick={() => setShowEbaySecret(!showEbaySecret)}
                      className="absolute right-2 text-slate-400 hover:text-slate-600 outline-none cursor-pointer"
                    >
                      {showEbaySecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* RuName (Redirect URL Name) */}
                <div className="space-y-1">
                  <span>RuName (Redirect URL Name)</span>
                  <input
                    type="text"
                    value={ebayConfig.ruName}
                    onChange={(e) => setEbayConfig(prev => ({ ...prev, ruName: e.target.value }))}
                    placeholder="e.g. YourName-YourApp-PRD-xxxxxxx"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-medium text-slate-800 focus:outline-none focus:border-blue-500 h-8"
                  />
                </div>

                {/* User Refresh Token */}
                <div className="space-y-1">
                  <span>User Refresh Token</span>
                  <div className="relative flex items-center">
                    <input
                      type={showEbayToken ? 'text' : 'password'}
                      value={ebayConfig.refreshToken}
                      onChange={(e) => setEbayConfig(prev => ({ ...prev, refreshToken: e.target.value }))}
                      placeholder="e.g. v^1.1#i^1#r^0#p^3#..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-10 py-1.5 text-[10px] font-medium text-slate-800 focus:outline-none focus:border-blue-500 h-8"
                    />
                    <button 
                      onClick={() => setShowEbayToken(!showEbayToken)}
                      className="absolute right-2 text-slate-400 hover:text-slate-600 outline-none cursor-pointer"
                    >
                      {showEbayToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Guide Column */}
            <div className="w-full md:w-[320px] bg-slate-50/70 border-t md:border-t-0 md:border-l border-slate-150 p-6 md:p-8 flex flex-col justify-between select-none">
              <div className="space-y-4">
                <div className="pb-1 border-b border-slate-150">
                  <h4 className="text-[11.5px] font-bold text-slate-800">eBay OAuth Setup</h4>
                  <p className="text-[8.5px] text-slate-400 font-semibold mt-0.5">Quick setup checklist</p>
                </div>

                <div className="space-y-3 text-[9.5px] font-semibold text-slate-500 leading-relaxed">
                  <div className="flex gap-2">
                    <span className="h-4.5 w-4.5 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center shrink-0">1</span>
                    <p>Go to <Link href="https://developer.ebay.com/" target="_blank" className="text-blue-700 font-bold hover:underline flex inline-flex items-center gap-0.5">eBay Developer Portal <ExternalLink className="h-2.5 w-2.5" /></Link>.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="h-4.5 w-4.5 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center shrink-0">2</span>
                    <p>Copy your <strong className="font-bold text-slate-700">App ID</strong>, <strong className="font-bold text-slate-700">Cert ID</strong>, and <strong className="font-bold text-slate-700">RuName</strong>.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="h-4.5 w-4.5 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center shrink-0">3</span>
                    <p>Generate a <strong className="font-bold text-slate-700">User Refresh Token</strong> in eBay Developer OAuth Tool.</p>
                  </div>
                </div>
              </div>

              {/* Bottom Action Buttons */}
              <div className="flex flex-col gap-2 mt-6">
                <button
                  onClick={handleSaveEbay}
                  disabled={isSavingEbay}
                  className="w-full text-center py-2 px-3 rounded-lg bg-[#e53238] hover:bg-[#c92429] text-[10.5px] font-extrabold text-white shadow-3xs cursor-pointer outline-none transition flex items-center justify-center gap-2"
                >
                  {isSavingEbay && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save & Test eBay Connection</span>
                </button>

                {connectors.find(c => c.id === 'ebay')?.status === 'Connected' && (
                  <button
                    onClick={handleSyncEbay}
                    className="w-full text-center py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-[10.5px] font-bold text-white shadow-3xs cursor-pointer outline-none transition"
                  >
                    Trigger Live Sync Now
                  </button>
                )}

                {connectors.find(c => c.id === 'ebay')?.status === 'Connected' && (
                  <button
                    onClick={handleDisconnectEbay}
                    className="w-full text-center py-2 px-3 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-[10.5px] font-bold text-red-650 cursor-pointer outline-none transition"
                  >
                    Disconnect Integration
                  </button>
                )}

                <button
                  onClick={() => setIsEbayModalOpen(false)}
                  className="w-full text-center py-2 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[10.5px] font-bold text-slate-600 cursor-pointer outline-none transition"
                >
                  Cancel
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 8. INTERACTIVE STRIPE PAYMENTS INTEGRATION MODAL */}
      {/* ======================================================================= */}
      {isStripeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-4xl w-full max-h-[88vh] overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-200 relative">
            
            {/* Close Button */}
            <button 
              onClick={() => setIsStripeModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 outline-none cursor-pointer z-10 p-1 hover:bg-slate-50 rounded-full"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            {/* Left Form Column */}
            <div className="flex-1 p-6 md:p-8 overflow-y-auto no-scrollbar flex flex-col space-y-5">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200/80 p-1.5 shrink-0 shadow-2xs select-none">
                  <img src="/stripe_logo.png" alt="Stripe Logo" className="h-full w-full object-contain" />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-slate-800 leading-tight">Stripe Payments Connection</h3>
                  <p className="text-[9.5px] text-slate-400 font-semibold mt-0.5">Configure API credentials to sync charges, invoices & payouts.</p>
                </div>
              </div>

              {/* Status Banner */}
              <div className="bg-purple-50/70 border border-purple-200/80 rounded-xl p-3 flex items-center justify-between text-[10.5px] font-bold text-purple-900">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-purple-600 shrink-0" />
                  <span>Stripe Payment Gateway Integration</span>
                </div>
                <span className="text-[9px] bg-purple-200/80 text-purple-900 px-2 py-0.5 rounded-full font-extrabold">
                  {connectors.find(c => c.id === 'stripe')?.status === 'Connected' ? 'Connected' : 'Not Connected'}
                </span>
              </div>

              {/* Form Inputs */}
              <div className="space-y-3.5 text-[10.5px] font-bold text-slate-700">
                <div className="space-y-1">
                  <span>Environment Mode</span>
                  <select
                    value={stripeConfig.environment}
                    onChange={(e) => setStripeConfig(prev => ({ ...prev, environment: e.target.value as any }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-medium text-slate-800 focus:outline-none focus:border-purple-500 h-8 cursor-pointer"
                  >
                    <option value="test">Test Mode (sk_test_...)</option>
                    <option value="live">Live Mode (sk_live_...)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <span>Secret API Key / Restricted Key</span>
                  <div className="relative flex items-center">
                    <input
                      type={showStripeKey ? 'text' : 'password'}
                      value={stripeConfig.apiKey}
                      onChange={(e) => setStripeConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                      placeholder="e.g. sk_live_51... or sk_test_51..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-10 py-1.5 text-[10px] font-medium text-slate-800 focus:outline-none focus:border-purple-500 h-8"
                    />
                    <button 
                      onClick={() => setShowStripeKey(!showStripeKey)}
                      className="absolute right-2 text-slate-400 hover:text-slate-600 outline-none cursor-pointer"
                    >
                      {showStripeKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <p className="text-[8.5px] text-slate-400 font-semibold leading-none">Find your API keys in Stripe Dashboard under Developers &gt; API Keys.</p>
                </div>

                <div className="space-y-1">
                  <span>Publishable Key (Optional)</span>
                  <input
                    type="text"
                    value={stripeConfig.publishableKey}
                    onChange={(e) => setStripeConfig(prev => ({ ...prev, publishableKey: e.target.value }))}
                    placeholder="e.g. pk_live_51... or pk_test_51..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-medium text-slate-800 focus:outline-none focus:border-purple-500 h-8"
                  />
                </div>
              </div>
            </div>

            {/* Right Guide Column */}
            <div className="w-full md:w-[320px] bg-slate-50/70 border-t md:border-t-0 md:border-l border-slate-150 p-6 md:p-8 flex flex-col justify-between select-none">
              <div className="space-y-4">
                <div className="pb-1 border-b border-slate-150">
                  <h4 className="text-[11.5px] font-bold text-slate-800">Stripe Setup Steps</h4>
                  <p className="text-[8.5px] text-slate-400 font-semibold mt-0.5">API key setup checklist</p>
                </div>

                <div className="space-y-3 text-[9.5px] font-semibold text-slate-500 leading-relaxed">
                  <div className="flex gap-2">
                    <span className="h-4.5 w-4.5 rounded-full bg-purple-100 text-purple-800 font-bold flex items-center justify-center shrink-0">1</span>
                    <p>Go to <Link href="https://dashboard.stripe.com/apikeys" target="_blank" className="text-purple-700 font-bold hover:underline flex inline-flex items-center gap-0.5">Stripe Dashboard API Keys <ExternalLink className="h-2.5 w-2.5" /></Link>.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="h-4.5 w-4.5 rounded-full bg-purple-100 text-purple-800 font-bold flex items-center justify-center shrink-0">2</span>
                    <p>Copy your <strong className="font-bold text-slate-700">Secret API Key</strong> (or Restricted Key).</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="h-4.5 w-4.5 rounded-full bg-purple-100 text-purple-800 font-bold flex items-center justify-center shrink-0">3</span>
                    <p>Paste credentials below and click <strong className="font-bold text-slate-700">Save & Test Connection</strong>.</p>
                  </div>
                </div>
              </div>

              {/* Bottom Action Buttons */}
              <div className="flex flex-col gap-2 mt-6">
                <button
                  onClick={handleSaveStripe}
                  disabled={isSavingStripe}
                  className="w-full text-center py-2 px-3 rounded-lg bg-[#635bff] hover:bg-[#5349e0] text-[10.5px] font-extrabold text-white shadow-3xs cursor-pointer outline-none transition flex items-center justify-center gap-2"
                >
                  {isSavingStripe && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save & Test Stripe Connection</span>
                </button>

                {connectors.find(c => c.id === 'stripe')?.status === 'Connected' && (
                  <button
                    onClick={handleSyncStripe}
                    className="w-full text-center py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-[10.5px] font-bold text-white shadow-3xs cursor-pointer outline-none transition"
                  >
                    Trigger Live Sync Now
                  </button>
                )}

                {connectors.find(c => c.id === 'stripe')?.status === 'Connected' && (
                  <button
                    onClick={handleDisconnectStripe}
                    className="w-full text-center py-2 px-3 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-[10.5px] font-bold text-red-650 cursor-pointer outline-none transition"
                  >
                    Disconnect Integration
                  </button>
                )}

                <button
                  onClick={() => setIsStripeModalOpen(false)}
                  className="w-full text-center py-2 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[10.5px] font-bold text-slate-600 cursor-pointer outline-none transition"
                >
                  Cancel
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 8. LIVE POSTGRESQL DATABASE INSPECTION MODAL */}
      {/* ======================================================================= */}
      {isDbInspectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 relative">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 border border-purple-100 text-purple-600 shadow-2xs">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-extrabold text-slate-850 leading-tight">PostgreSQL Live Data Inspector</h3>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[9px] font-extrabold border",
                      dbInspectData?.postgresConnected 
                        ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                        : "bg-amber-50 text-amber-600 border-amber-200"
                    )}>
                      {dbInspectData?.postgresConnected ? 'PG Live Active' : 'Fallback Engine'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    Real-time 1:1 schema verification & live row counts from {dbInspectData?.databaseName || 'PostgreSQL'}.
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setIsDbInspectModalOpen(false)}
                className="text-slate-400 hover:text-slate-650 outline-none cursor-pointer p-1.5 hover:bg-slate-100 rounded-full transition"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Diagnostics Stats Bar */}
            <div className="grid grid-cols-3 bg-slate-50 border-b border-slate-100 divide-x divide-slate-200/70 py-3 px-6 text-[10.5px]">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Database Connection</span>
                <span className="font-extrabold text-slate-750 flex items-center gap-1 mt-0.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                  {dbInspectData?.databaseHost || 'localhost'}:{dbInspectData?.databasePort || '5432'}
                </span>
              </div>
              <div className="px-4">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Active Schemas</span>
                <span className="font-extrabold text-purple-700 mt-0.5 block">
                  {dbInspectData?.activeDataSourcesCount ?? 0} active tables
                </span>
              </div>
              <div className="pl-4">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total Database Rows</span>
                <span className="font-extrabold text-slate-850 mt-0.5 block">
                  {(dbInspectData?.totalRecords ?? 0).toLocaleString()} records
                </span>
              </div>
            </div>

            {/* Tables List */}
            <div className="p-6 overflow-y-auto max-h-[50vh] space-y-3">
              <div className="flex justify-between items-center pb-1">
                <span className="text-[11px] font-bold text-slate-700">Database Tables & Live Record Counts</span>
                <button
                  onClick={async () => {
                    toast.info("Refreshing PostgreSQL stats...");
                    try {
                      const res = await fetch('/api/database/inspect');
                      if (res.ok) setDbInspectData(await res.json());
                    } catch (e) {}
                  }}
                  className="flex items-center gap-1 text-[9.5px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Refresh Now</span>
                </button>
              </div>

              <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-[10.5px]">
                  <thead className="bg-slate-50 text-slate-400 font-bold uppercase border-b border-slate-200/80">
                    <tr>
                      <th className="py-2.5 px-3">Table Name</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">Live Records</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {dbInspectData?.tables?.map((t: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50/60 transition">
                        <td className="py-2.5 px-3 font-bold text-slate-800">
                          <div className="flex flex-col">
                            <span>{t.displayName}</span>
                            <span className="text-[8.5px] text-slate-400 font-mono font-medium">{t.tableName}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-semibold">{t.category}</td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-slate-850">
                          {t.count.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[8.5px] font-extrabold border inline-block",
                            t.count > 0 
                              ? "bg-emerald-50 text-emerald-600 border-emerald-200" 
                              : "bg-slate-50 text-slate-400 border-slate-200"
                          )}>
                            {t.count > 0 ? 'Active Data' : 'Empty'}
                          </span>
                        </td>
                      </tr>
                    )) || (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400 font-semibold">
                          Loading PostgreSQL table statistics...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex justify-between items-center">
              <span className="text-[9.5px] text-slate-400 font-semibold">
                * All data shown is queried directly via <code className="font-mono bg-slate-200/60 px-1 py-0.5 rounded text-slate-700">COUNT(*)</code> on your active PostgreSQL database.
              </span>
              <button
                onClick={() => setIsDbInspectModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[10.5px] font-bold shadow-3xs cursor-pointer transition"
              >
                Close Inspector
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
