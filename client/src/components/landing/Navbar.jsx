import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  HiShieldCheck,
  HiSun,
  HiMoon,
  HiBars3,
  HiXMark,
  HiOutlineDocumentText,
  HiOutlineArrowTopRightOnSquare
} from 'react-icons/hi2';

const Navbar = ({ theme = 'dark', onToggleTheme, onOpenDocs }) => {
  const { isAuthenticated } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isLight = theme === 'light';

  const navLinks = [
    { label: 'Architecture', href: '#architecture' },
    { label: 'Security Specs', href: '#features' },
    { label: 'Rate Limiter', href: '#rate-limiting' },
    { label: 'Async Queue', href: '#notification-pipeline' },
    { label: 'Roadmap', href: '#roadmap' },
  ];

  const handleScroll = (e, href) => {
    e.preventDefault();
    setIsMobileMenuOpen(false);
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const ThemeToggleBtn = () => (
    <button
      onClick={onToggleTheme}
      className={`relative w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
        isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/10 text-slate-300'
      }`}
      aria-label="Toggle Theme"
      title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
    >
      <div className={`absolute transition-all duration-300 ${theme === 'dark' ? 'scale-100 opacity-100 rotate-0' : 'scale-0 opacity-0 -rotate-90'}`}>
        <HiSun size={18} />
      </div>
      <div className={`absolute transition-all duration-300 ${theme === 'light' ? 'scale-100 opacity-100 rotate-0' : 'scale-0 opacity-0 rotate-90'}`}>
        <HiMoon size={18} />
      </div>
    </button>
  );

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-40 backdrop-blur-xl h-16 transition-colors duration-300 ${
        isLight
          ? 'bg-white/85 text-slate-900 border-b border-black/[0.07]'
          : 'bg-[#0a0a0f]/85 text-white border-b border-white/[0.07]'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex items-center justify-between h-full">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500/20 transition-all">
              <HiShieldCheck size={20} />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold tracking-tight text-sm flex items-center gap-1.5">
                Secure Vault
                <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-medium">
                  v2.0
                </span>
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleScroll(e, link.href)}
                className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                  isLight
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Right Header Action Items */}
          <div className="hidden md:flex items-center gap-3">
            {/* Live Docs Modal Trigger */}
            <button
              onClick={onOpenDocs}
              className={`inline-flex items-center gap-1.5 text-xs font-mono font-medium px-2.5 py-1.5 rounded-lg border transition-all ${
                isLight
                  ? 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  : 'border-white/10 text-slate-300 hover:bg-white/5 hover:border-white/20'
              }`}
            >
              <HiOutlineDocumentText className="w-3.5 h-3.5 text-emerald-500" />
              Live Docs
            </button>

            {/* GitHub Repo */}
            <a
              href="https://github.com/yashsingh-dev/Secure-Vault"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                isLight
                  ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              GitHub
              <HiOutlineArrowTopRightOnSquare className="w-3 h-3 opacity-60" />
            </a>

            <div className={`w-px h-4 ${isLight ? 'bg-slate-200' : 'bg-white/10'}`} />

            <ThemeToggleBtn />

            {/* Auth CTAs */}
            <div className="flex items-center gap-2 ml-1">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 text-xs font-medium bg-emerald-500 text-white px-3.5 py-2 rounded-lg hover:bg-emerald-600 transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                  </span>
                  Go to Dashboard →
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                      isLight
                        ? 'text-slate-700 hover:bg-slate-100'
                        : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="text-xs font-medium bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg hover:bg-emerald-600 transition-all shadow-[0_0_15px_rgba(34,197,94,0.25)]"
                  >
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile Menu & Theme Buttons */}
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggleBtn />
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`p-2 rounded-lg transition-colors ${
                isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 hover:bg-white/10'
              }`}
              aria-label="Open Navigation Menu"
            >
              {isMobileMenuOpen ? <HiXMark size={20} /> : <HiBars3 size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      <div
        className={`md:hidden absolute top-16 inset-x-0 transition-all duration-200 border-b ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        } ${
          isLight ? 'bg-white border-black/10 text-slate-900' : 'bg-[#0a0a0f] border-white/10 text-white'
        }`}
      >
        <div className="px-4 py-4 space-y-3">
          <div className="space-y-1">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleScroll(e, link.href)}
                className={`block text-xs font-medium px-3 py-2 rounded-lg ${
                  isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/5 text-slate-300'
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="pt-2 border-t border-black/5 dark:border-white/5 flex gap-2">
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                onOpenDocs();
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-mono rounded-lg border ${
                isLight ? 'border-slate-200 text-slate-700' : 'border-white/10 text-slate-300'
              }`}
            >
              <HiOutlineDocumentText className="w-3.5 h-3.5 text-emerald-500" />
              Live Docs
            </button>
            <a
              href="https://github.com/yashsingh-dev/Secure-Vault"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs rounded-lg border ${
                isLight ? 'border-slate-200 text-slate-700' : 'border-white/10 text-slate-300'
              }`}
            >
              GitHub
              <HiOutlineArrowTopRightOnSquare className="w-3 h-3 opacity-60" />
            </a>
          </div>

          <div className="pt-2">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 text-xs font-medium bg-emerald-500 text-white px-4 py-2.5 rounded-lg w-full"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                </span>
                Go to Dashboard →
              </Link>
            ) : (
              <div className="flex gap-2">
                <Link
                  to="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex-1 text-center text-xs font-medium py-2 rounded-lg border ${
                    isLight ? 'border-slate-200 text-slate-700' : 'border-white/10 text-slate-300'
                  }`}
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex-1 text-center text-xs font-medium bg-emerald-500 text-white py-2 rounded-lg"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
