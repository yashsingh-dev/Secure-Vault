import React, { useState, useEffect } from 'react';
import Navbar from '../components/landing/Navbar';
import HeroSection from '../components/landing/HeroSection';
import ArchitectureFlow from '../components/landing/ArchitectureFlow';
import FeatureMatrix from '../components/landing/FeatureMatrix';
import RateLimitingDeepDive from '../components/landing/RateLimitingDeepDive';
import NotificationPipeline from '../components/landing/NotificationPipeline';
import FutureRoadmap from '../components/landing/FutureRoadmap';
import Footer from '../components/landing/Footer';
import LiveDocsModal from '../components/landing/LiveDocsModal';

export default function Landing() {
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);

  useEffect(() => {
    // Enforce dark mode permanently across application
    document.documentElement.classList.remove('light');
    localStorage.removeItem('sv-theme');
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white relative">
      {/* Navigation Header */}
      <Navbar
        onOpenDocs={() => setIsDocsModalOpen(true)}
      />

      {/* Hero Section with Interactive Token Inspector */}
      <HeroSection
        onOpenDocs={() => setIsDocsModalOpen(true)}
      />

      {/* 7-Layer Interactive Pipeline Flow */}
      <ArchitectureFlow />

      {/* 25-Feature Security Matrix with Live Search */}
      <FeatureMatrix />

      {/* Rate Limiting Architecture Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-[#08080d] border-t border-white/5">
        <RateLimitingDeepDive />
      </section>

      {/* Asynchronous Notification & Queue Pipeline */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-[#0a0a0f] border-t border-b border-white/5">
        <NotificationPipeline />
      </section>

      {/* Future Scalability Roadmap */}
      <FutureRoadmap />

      {/* Engineering Footer */}
      <Footer
        onOpenDocs={() => setIsDocsModalOpen(true)}
      />

      {/* Live Architecture & Threat Model Modal */}
      <LiveDocsModal
        isOpen={isDocsModalOpen}
        onClose={() => setIsDocsModalOpen(false)}
      />
    </div>
  );
}
