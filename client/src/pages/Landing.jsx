import React, { useState, useEffect } from 'react';
import Navbar from '../components/landing/Navbar';
import HeroSection from '../components/landing/HeroSection';
import ArchitectureFlow from '../components/landing/ArchitectureFlow';
import FeatureMatrix from '../components/landing/FeatureMatrix';
import RateLimitingDeepDive from '../components/landing/RateLimitingDeepDive';
import FutureRoadmap from '../components/landing/FutureRoadmap';
import Footer from '../components/landing/Footer';
import LiveDocsModal from '../components/landing/LiveDocsModal';

export default function Landing() {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('sv-theme');
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('sv-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  };

  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0a0a0f]' : 'bg-white'} transition-colors duration-300 relative`}>
      {/* Navigation Header */}
      <Navbar
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenDocs={() => setIsDocsModalOpen(true)}
      />

      {/* Hero Section with Interactive Token Inspector */}
      <HeroSection
        theme={theme}
        onOpenDocs={() => setIsDocsModalOpen(true)}
      />

      {/* 7-Layer Interactive Pipeline Flow */}
      <ArchitectureFlow theme={theme} />

      {/* 25-Feature Security Matrix with Live Search */}
      <FeatureMatrix theme={theme} />

      {/* Rate Limiting Deep Dive (Mathematical Model + Slider Simulator + Lua Script) */}
      <section className={`py-24 px-4 sm:px-6 lg:px-8 ${isDark ? 'bg-[#08080d]' : 'bg-white'} border-t border-b border-black/5 dark:border-white/5 transition-colors duration-300`}>
        <RateLimitingDeepDive theme={theme} />
      </section>

      {/* Future Scalability Roadmap */}
      <FutureRoadmap theme={theme} />

      {/* Engineering Footer */}
      <Footer
        theme={theme}
        onOpenDocs={() => setIsDocsModalOpen(true)}
      />

      {/* Live Architecture & Threat Model Modal */}
      <LiveDocsModal
        isOpen={isDocsModalOpen}
        onClose={() => setIsDocsModalOpen(false)}
        theme={theme}
      />
    </div>
  );
}
