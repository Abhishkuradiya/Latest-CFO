"use client";

import React from 'react';
import { Navbar } from '@/components/landing/Navbar';
import { Hero } from '@/components/landing/Hero';
import { IntegrationMarquee } from '@/components/landing/IntegrationMarquee';
import { ProblemSection } from '@/components/landing/ProblemSection';
import { ProductShowcase } from '@/components/landing/ProductShowcase';
import { AICFOSection } from '@/components/landing/AICFOSection';
import { InsightsSection } from '@/components/landing/InsightsSection';
import { AutomationSection } from '@/components/landing/AutomationSection';
import { IntelligenceSection } from '@/components/landing/IntelligenceSection';
import { DataSourcesSection } from '@/components/landing/DataSourcesSection';
import { ReportingSection, SecuritySection } from '@/components/landing/ReportingSection';
import { PricingSection, Testimonials } from '@/components/landing/PricingSection';
import { FinalCTA, Footer } from '@/components/landing/Footer';

export default function RootLandingPage() {
  return (
    <main className="min-h-screen bg-[#FFFFFF] text-[#0B1736] font-sans select-none overflow-x-hidden relative">
      
      {/* Navbar */}
      <Navbar />

      {/* Hero Section */}
      <Hero />

      {/* Integration Marquee */}
      <IntegrationMarquee />

      {/* Problem Section: Data Streams Convergence */}
      <ProblemSection />

      {/* One Financial Command Center Product Showcase */}
      <ProductShowcase />

      {/* AI CFO Section (Dark Navy Contrast) */}
      <AICFOSection />

      {/* AI Anomaly Insights Section */}
      <InsightsSection />

      {/* Workflow Automation Engine */}
      <AutomationSection />

      {/* Business Health Intelligence Index */}
      <IntelligenceSection />

      {/* Multi-Source Data Network */}
      <DataSourcesSection />

      {/* Executive Financial Reporting */}
      <ReportingSection />

      {/* Minimal Security Guarantees */}
      <SecuritySection />

      {/* SaaS Pricing */}
      <PricingSection />

      {/* Customer Executive Stories */}
      <Testimonials />

      {/* Final Call To Action */}
      <FinalCTA />

      {/* Multi-Column Footer */}
      <Footer />

    </main>
  );
}
