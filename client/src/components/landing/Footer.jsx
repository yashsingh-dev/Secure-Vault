import React from 'react';
import {
  HiOutlineShieldCheck,
  HiOutlineArrowTopRightOnSquare,
  HiOutlineDocumentText,
  HiOutlineCodeBracket
} from 'react-icons/hi2';

export default function Footer({ theme = 'dark', onOpenDocs }) {
  const isDark = theme === 'dark';

  const techStack = [
    'React 19',
    'Tailwind CSS v4',
    'Vite 8',
    'Node.js (ESM)',
    'Express',
    'Redis (ioredis)',
    'MongoDB',
    'Mongoose ODM',
    'Zod Contracts',
    'Pino Redacted Logger',
    'Vitest Suite',
    'Atomic Lua Scripting'
  ];

  const archBadges = [
    'RFC 6819 Compliant',
    'IETF Rate Limit Headers',
    'OAuth 2.0 Auth-Code Flow',
    'Dual-Token RTR',
    'Zero-Trust RAM Verification',
    'Optimistic Concurrency Control'
  ];

  const handleScroll = (e, href) => {
    e.preventDefault();
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className={`w-full py-16 px-4 sm:px-6 lg:px-8 border-t transition-colors duration-300 ${
      isDark
        ? 'bg-[#08080d] border-white/5 text-slate-200'
        : 'bg-white border-slate-200 text-slate-800'
    }`}>
      <div className="max-w-7xl mx-auto flex flex-col gap-12">
        {/* Top Section */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12">
          {/* Brand & Purpose */}
          <div className="md:col-span-5 flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                <HiOutlineShieldCheck className="w-5 h-5" />
              </div>
              <span className="font-bold text-base tracking-tight">Secure Vault</span>
              <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-medium">
                Production System
              </span>
            </div>
            <p className={`text-xs leading-relaxed max-w-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              High-performance enterprise session security and distributed authentication platform.
              Engineered to resolve RFC 6819 threat models, frontend concurrency race conditions, and high-throughput cache bottlenecks.
            </p>
          </div>

          {/* Quick Navigation Links */}
          <div className="md:col-span-3 flex flex-col gap-2">
            <h4 className={`text-xs font-mono font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
              System Architecture
            </h4>
            <a
              href="#architecture"
              onClick={(e) => handleScroll(e, '#architecture')}
              className="text-xs text-slate-400 hover:text-emerald-500 transition-colors w-fit"
            >
              Request Pipeline (7 Layers)
            </a>
            <a
              href="#features"
              onClick={(e) => handleScroll(e, '#features')}
              className="text-xs text-slate-400 hover:text-emerald-500 transition-colors w-fit"
            >
              Security Specs Matrix (25 Features)
            </a>
            <a
              href="#rate-limiting"
              onClick={(e) => handleScroll(e, '#rate-limiting')}
              className="text-xs text-slate-400 hover:text-emerald-500 transition-colors w-fit"
            >
              Sliding Window Lua Limiter
            </a>
            <a
              href="#roadmap"
              onClick={(e) => handleScroll(e, '#roadmap')}
              className="text-xs text-slate-400 hover:text-emerald-500 transition-colors w-fit"
            >
              Future Scaling Pipeline
            </a>
          </div>

          {/* Developer Resources & Links */}
          <div className="md:col-span-4 flex flex-col gap-2">
            <h4 className={`text-xs font-mono font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
              Resources & Repos
            </h4>
            <a
              href="https://github.com/yashsingh-dev/Secure-Vault"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-emerald-500 hover:underline w-fit"
            >
              GitHub Repository
              <HiOutlineArrowTopRightOnSquare className="w-3.5 h-3.5" />
            </a>

            {onOpenDocs && (
              <button
                onClick={onOpenDocs}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-500 transition-colors w-fit font-mono"
              >
                <HiOutlineDocumentText className="w-3.5 h-3.5 text-emerald-500" />
                Live Architecture & Threat Model Spec
              </button>
            )}

            <div className="flex flex-wrap gap-1.5 pt-2">
              {archBadges.map((badge) => (
                <span
                  key={badge}
                  className={`font-mono text-[9px] px-2 py-0.5 rounded border ${
                    isDark
                      ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                      : 'border-emerald-500/30 bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Tech Stack Horizontal Pills */}
        <div className="flex flex-col gap-3 pt-6 border-t border-black/5 dark:border-white/5">
          <div className="flex items-center gap-2">
            <HiOutlineCodeBracket className="w-4 h-4 text-emerald-500" />
            <h4 className={`text-xs font-mono font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
              Core Technology Stack
            </h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {techStack.map((tech) => (
              <span
                key={tech}
                className={`font-mono text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${
                  isDark
                    ? 'bg-[#12121a] border-white/5 text-slate-300'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                {tech}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-black/5 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
          <div>
            Crafted for Staff/Senior Engineering benchmarks by{' '}
            <strong className={isDark ? 'text-slate-300' : 'text-slate-700'}>Yash Singh</strong>
          </div>
          <div className="flex items-center gap-4">
            <span>RFC 6819 Compliant</span>
            <span>·</span>
            <span>Zero-Trust Architecture</span>
            <span>·</span>
            <span>&copy; {new Date().getFullYear()}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
