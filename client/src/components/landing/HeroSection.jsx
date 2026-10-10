import React, { useState } from 'react';
import {
  HiArrowDown,
  HiOutlineArrowTopRightOnSquare,
  HiOutlineShieldCheck,
  HiOutlineKey,
  HiOutlineDevicePhoneMobile,
  HiOutlineComputerDesktop,
  HiOutlineExclamationTriangle,
  HiOutlineCheckBadge,
  HiOutlineCodeBracket,
  HiOutlineBolt,
  HiOutlineClock,
  HiOutlineServerStack
} from 'react-icons/hi2';
import { SiGithub } from 'react-icons/si';
import { TbRoute } from 'react-icons/tb';

export default function HeroSection({ theme = 'dark', onOpenDocs }) {
  const [activeTab, setActiveTab] = useState('access');
  const [tokenFormat, setTokenFormat] = useState('decoded'); // 'decoded' | 'raw'
  const [simulatedBreach, setSimulatedBreach] = useState(false);
  const [tokenVersionCounter, setTokenVersionCounter] = useState(2);

  const isDark = theme === 'dark';

  const metrics = [
    { value: '100%', label: 'Stateless JWT Validation', desc: 'Instant zero-delay verification' },
    { value: '< 1ms', label: 'Redis RAM Latency', desc: 'In-memory session & version check' },
    { value: '0', label: 'DB Hits on Blacklist', desc: 'Shielded by Redis bloom/RAM keys' },
    { value: '10s', label: 'Concurrency Grace Period', desc: 'Zero false-positive race locks' },
    { value: 'O(1)', label: 'Rate Limiter Memory', desc: 'Sliding window Lua counter' },
  ];

  const rawHeader = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
  const rawPayload = 'eyJfaWQiOiI2NmY0YThiMSIsImZhbWlseUlkIjoiZmFtXzllOCIsInRva2VuVmVyc2lvbiI6MiwiaWF0IjoxNzI3MzQxMjAwLCJleHAiOjE3MjczNDIxMDB9';
  const rawSignature = 'k8X9PqZ3mLwRtYuIaOpSdFgHjKlZxVbNmQ4z';

  return (
    <section className={`min-h-screen pt-28 pb-16 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 transition-colors duration-300 relative overflow-hidden ${isDark ? 'bg-[#0a0a0f] text-white' : 'bg-white text-slate-900'}`}>
      {/* Background Subtle Radial Glow */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] pointer-events-none rounded-full blur-[120px] opacity-25"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse at center, rgba(34, 197, 94, 0.35), transparent 70%)'
            : 'radial-gradient(ellipse at center, rgba(34, 197, 94, 0.2), transparent 70%)'
        }}
      />

      {/* Top Badge */}
      <div className="relative z-10 mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-mono uppercase tracking-wider border transition-colors duration-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className={isDark ? 'text-emerald-400' : 'text-emerald-700'}>
          RFC 6819 Compliant
        </span>
        <span className="opacity-40">·</span>
        <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>
          Enterprise Distributed Session Security
        </span>
      </div>

      {/* Main Headline */}
      <h1 className="relative z-10 text-center text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 max-w-5xl">
        <span className={isDark ? 'bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-transparent' : 'text-[#0f172a]'}>
          High-Performance Enterprise Session Security & Auth
        </span>
      </h1>

      {/* Subheadline & Quick-Scan Technical Highlights */}
      <div className="relative z-10 text-center max-w-3xl mb-10">
        <p className={`text-base sm:text-lg mb-5 font-normal leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Distributed session security engineered for zero-trust architectures.
        </p>

        {/* 4 Instant-Scan Technical Highlight Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
            isDark ? 'bg-[#12121c]/90 border-white/10 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            <HiOutlineShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className={isDark ? 'text-white font-semibold' : 'text-slate-900 font-semibold'}>RTR Token Rotation</span>
            <span className="text-[10px] opacity-60 font-sans">(RFC 6819)</span>
          </div>

          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
            isDark ? 'bg-[#12121c]/90 border-white/10 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            <HiOutlineBolt className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className={isDark ? 'text-white font-semibold' : 'text-slate-900 font-semibold'}>Atomic Lua</span>
            <span className="text-[10px] opacity-60 font-sans">Rate Limiter</span>
          </div>

          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
            isDark ? 'bg-[#12121c]/90 border-white/10 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            <HiOutlineClock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className={isDark ? 'text-white font-semibold' : 'text-slate-900 font-semibold'}>10s Grace Period</span>
            <span className="text-[10px] opacity-60 font-sans">Race Safe</span>
          </div>

          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
            isDark ? 'bg-[#12121c]/90 border-white/10 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            <HiOutlineServerStack className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className={isDark ? 'text-white font-semibold' : 'text-slate-900 font-semibold'}>Zero-DB Hit</span>
            <span className="text-[10px] opacity-60 font-sans">RAM Auth</span>
          </div>
        </div>
      </div>

      {/* Primary & Secondary Call to Actions with Authentic Logos */}
      <div className="relative z-10 flex flex-wrap items-center justify-center gap-3.5 mb-14 w-full sm:w-auto">
        <button
          onClick={() => document.getElementById('architecture')?.scrollIntoView({ behavior: 'smooth' })}
          className="inline-flex items-center justify-center gap-2.5 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-sm rounded-xl shadow-[0_0_25px_rgba(34,197,94,0.3)] transition-all duration-200 hover:-translate-y-0.5 group"
        >
          <TbRoute className="w-4 h-4 text-emerald-100 group-hover:scale-110 transition-transform shrink-0" />
          <span>Explore Architecture Pipeline</span>
          <HiArrowDown className="w-3.5 h-3.5 opacity-70 group-hover:translate-y-0.5 transition-transform shrink-0" />
        </button>

        <a
          href="https://github.com/yashsingh-dev/Secure-Vault"
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center justify-center gap-2.5 px-5 py-3 font-medium text-sm rounded-xl border transition-all duration-200 hover:-translate-y-0.5 group ${isDark
              ? 'border-white/10 hover:border-white/20 bg-[#12121a] text-slate-200 hover:text-white'
              : 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-800'
            }`}
        >
          <SiGithub className="w-4 h-4 text-current group-hover:scale-110 transition-transform shrink-0" />
          <span>View Source on GitHub</span>
          <HiOutlineArrowTopRightOnSquare className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
        </a>

        {onOpenDocs && (
          <button
            onClick={onOpenDocs}
            className={`inline-flex items-center justify-center gap-2 px-4 py-3 font-mono text-xs rounded-xl border transition-all duration-200 ${isDark
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                : 'border-emerald-500/30 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
          >
            <HiOutlineCodeBracket className="w-4 h-4" />
            Threat Model Spec
          </button>
        )}
      </div>

      {/* Telemetry Metrics Bar (Mandatory Section 7.3) */}
      <div className={`relative z-10 w-full max-w-5xl mx-auto rounded-2xl border mb-12 overflow-hidden transition-colors duration-300 ${isDark ? 'bg-[#111118]/80 border-white/10 backdrop-blur-xl' : 'bg-slate-50/90 border-slate-200 shadow-sm'}`}>
        <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 lg:divide-x ${isDark ? 'divide-white/5' : 'divide-slate-200'}`}>
          {metrics.map((stat, idx) => (
            <div key={idx} className="p-5 text-center flex flex-col items-center justify-center group hover:bg-emerald-500/[0.02] transition-colors">
              <div className={`font-mono text-2xl lg:text-3xl font-bold mb-1 tracking-tight ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                {stat.value}
              </div>
              <div className={`text-xs font-mono font-medium mb-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {stat.label}
              </div>
              <div className={`text-[10px] leading-tight ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {stat.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Token Inspector Widget (Mandatory Section 7.2) */}
      <div className={`relative z-10 w-full max-w-3xl mx-auto rounded-2xl border overflow-hidden transition-all duration-300 ${isDark ? 'bg-[#14141f] border-white/10 shadow-2xl' : 'bg-white border-slate-200 shadow-lg'}`}>
        {/* Widget Top Bar */}
        <div className={`flex flex-wrap items-center justify-between border-b px-4 py-3 gap-3 ${isDark ? 'border-white/10 bg-[#101018]' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex items-center gap-2">
            <HiOutlineShieldCheck className="w-5 h-5 text-emerald-500" />
            <span className="font-mono text-xs font-semibold tracking-wide uppercase">
              Live Token & Session Inspector
            </span>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-1.5">
            {[
              { id: 'access', label: 'Access Token (JWT)' },
              { id: 'refresh', label: 'Refresh Cookie (RTR)' },
              { id: 'family', label: 'Token Family (RFC 6819)' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${activeTab === tab.id
                    ? isDark
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-500/30'
                    : isDark
                      ? 'text-slate-400 hover:text-white hover:bg-white/5'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Sub-controls */}
        {activeTab === 'access' && (
          <div className={`flex items-center justify-between px-5 py-2 border-b text-xs font-mono ${isDark ? 'border-white/5 bg-[#0e0e16] text-slate-400' : 'border-slate-100 bg-slate-50 text-slate-500'}`}>
            <div className="flex items-center gap-2">
              <span>View Mode:</span>
              <button
                onClick={() => setTokenFormat('decoded')}
                className={`px-2 py-0.5 rounded text-[11px] ${tokenFormat === 'decoded' ? 'bg-emerald-500/20 text-emerald-400 font-semibold' : 'hover:text-white'}`}
              >
                Decoded Claims
              </button>
              <button
                onClick={() => setTokenFormat('raw')}
                className={`px-2 py-0.5 rounded text-[11px] ${tokenFormat === 'raw' ? 'bg-emerald-500/20 text-emerald-400 font-semibold' : 'hover:text-white'}`}
              >
                Base64URL Segments
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-500 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Verified in safeRedis RAM
            </div>
          </div>
        )}

        {/* Tab 1: Access Token Content */}
        {activeTab === 'access' && (
          <div className={`p-6 font-mono text-xs overflow-x-auto ${isDark ? 'bg-[#0f0f18] text-slate-300' : 'bg-white text-slate-800'}`}>
            {tokenFormat === 'decoded' ? (
              <div className="space-y-4">
                <div>
                  <div className="text-[11px] text-cyan-400 font-semibold mb-1">// 1. Header (Cryptographic Spec)</div>
                  <pre className={`p-3 rounded-lg border ${isDark ? 'bg-black/30 border-white/5 text-cyan-300' : 'bg-slate-50 border-slate-200 text-cyan-800'}`}>
                    {`{
  "alg": "HS256",
  "typ": "JWT"
}`}
                  </pre>
                </div>

                <div>
                  <div className="text-[11px] text-emerald-400 font-semibold mb-1">// 2. Payload (Bound to Device Family & Version Counter)</div>
                  <pre className={`p-3 rounded-lg border ${isDark ? 'bg-black/30 border-white/5 text-emerald-300' : 'bg-slate-50 border-slate-200 text-emerald-800'}`}>
                    {`{
  "userId": "66f4a8b1c9d2e3f4a5b6c7d8",
  "familyId": "fam_9e83b4c1",         // Bound to client device session
  "tokenVersion": ${tokenVersionCounter},             // Global revocation counter (OCC)
  "iat": 1727341200,                  // Issued at
  "exp": 1727342100                   // 15-Minute Short Lifespan (900s)
}`}
                  </pre>
                </div>

                <div>
                  <div className="text-[11px] text-amber-400 font-semibold mb-1">// 3. HMAC-SHA256 Signature Proof</div>
                  <div className={`p-3 rounded-lg border flex items-center justify-between ${isDark ? 'bg-black/30 border-white/5 text-amber-300' : 'bg-slate-50 border-slate-200 text-amber-800'}`}>
                    <span className="truncate">HMACSHA256(base64Url(header) + "." + base64Url(payload), JWT_ACCESS_KEY)</span>
                    <span className="text-emerald-400 text-[10px] ml-2 shrink-0 font-sans px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                      Valid
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[11px] text-slate-400">
                  Click or hover any segment to see how Secure Vault parses RFC 7519 tokens:
                </p>
                <div className={`p-4 rounded-xl border leading-relaxed break-all ${isDark ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-cyan-400 font-bold hover:underline cursor-pointer" title="Header: { alg: 'HS256', typ: 'JWT' }">
                    {rawHeader}
                  </span>
                  <span className="text-slate-500 font-bold">.</span>
                  <span className="text-emerald-400 font-bold hover:underline cursor-pointer" title="Payload: { userId, familyId, tokenVersion, exp: 15m }">
                    {rawPayload}
                  </span>
                  <span className="text-slate-500 font-bold">.</span>
                  <span className="text-amber-400 font-bold hover:underline cursor-pointer" title="Signature: Verified with Server Secret">
                    {rawSignature}
                  </span>
                </div>
                <div className="flex gap-4 text-[10px] pt-1">
                  <span className="text-cyan-400">■ Header</span>
                  <span className="text-emerald-400">■ Payload (Claims)</span>
                  <span className="text-amber-400">■ Cryptographic Signature</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Refresh Token Content */}
        {activeTab === 'refresh' && (
          <div className={`p-6 font-mono text-xs overflow-x-auto space-y-4 ${isDark ? 'bg-[#0f0f18] text-slate-300' : 'bg-white text-slate-800'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-white/5">
              <div className="text-[11px] text-emerald-400 font-semibold">// HTTP Cookie Specification</div>
              <button
                onClick={() => setTokenVersionCounter(v => v + 1)}
                className="px-3 py-1 rounded text-[11px] font-sans font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors"
                title="Increments tokenVersion to globally invalidate all sessions"
              >
                OCC Logout All (v{tokenVersionCounter})
              </button>
            </div>

            <pre className={`p-4 rounded-xl border leading-relaxed ${isDark ? 'bg-black/30 border-white/5 text-emerald-300' : 'bg-slate-50 border-slate-200 text-emerald-800'}`}>
              {`Set-Cookie: __Host-sv_rt=eyJhbGciOi...;
  Max-Age=604800;                 // 7-day cryptographically secure lifetime
  Path=/api/v1/auth;              // Scoped strictly to authentication route
  HttpOnly;                       // Completely inaccessible to JavaScript (XSS Immune)
  Secure;                         // Transported over HTTPS TLS only
  SameSite=None;                  // Engineered for separate client/API cloud pods`}
            </pre>

            {/* OCC Invalidation Banner triggered by button */}
            {tokenVersionCounter > 2 && (
              <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>
                    <strong>OCC Global Invalidation Active:</strong> User <code>tokenVersion</code> updated to <strong>{tokenVersionCounter}</strong>.
                  </span>
                </div>
                <span className="text-[10px] font-sans px-2 py-0.5 rounded bg-amber-500/20 font-semibold">
                  All prior access tokens invalidated
                </span>
              </div>
            )}

            <div>
              <div className="text-[11px] text-cyan-400 font-semibold mb-1">// Authoritative MongoDB Record with Rotation Metadata</div>
              <pre className={`p-4 rounded-xl border leading-relaxed ${isDark ? 'bg-black/30 border-white/5 text-cyan-300' : 'bg-slate-50 border-slate-200 text-cyan-800'}`}>
                {`{
  "token": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", // SHA256 hashed
  "userId": "66f4a8b1c9d2e3f4a5b6c7d8",
  "familyId": "fam_9e83b4c1",
  "isRotated": ${tokenVersionCounter > 2 ? 'true' : 'false'},
  "rotatedAt": ${tokenVersionCounter > 2 ? '"2026-10-07T11:21:42Z"' : 'null'},
  "device": "MacBook Pro",
  "browser": "Chrome 129.0",
  "os": "macOS Sequoia",
  "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...",
  "ip": "203.0.113.195",
  "lastActive": "2026-10-07T11:20:00Z"
}`}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 3: Token Family Content with Live Simulation */}
        {activeTab === 'family' && (
          <div className={`p-6 font-mono text-xs overflow-x-auto space-y-4 ${isDark ? 'bg-[#0f0f18] text-slate-300' : 'bg-white text-slate-800'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-white/5">
              <div className="text-[11px] text-slate-400">
                RFC 6819 Token Family Breach Simulation Engine:
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSimulatedBreach(!simulatedBreach)}
                  className={`px-3 py-1 rounded text-[11px] font-sans font-medium transition-all ${simulatedBreach
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25'
                    }`}
                >
                  {simulatedBreach ? 'Reset Family State' : 'Simulate Stolen Token Replay'}
                </button>
                <button
                  onClick={() => setTokenVersionCounter(v => v + 1)}
                  className="px-3 py-1 rounded text-[11px] font-sans font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
                  title="Increments tokenVersion to globally invalidate all sessions"
                >
                  OCC Logout All (v{tokenVersionCounter})
                </button>
              </div>
            </div>

            <div className={`p-4 rounded-xl border space-y-3 ${isDark ? 'bg-black/30 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <HiOutlineShieldCheck className="w-4 h-4" />
                User Entity: usr_7x9k2m (tokenVersion: {tokenVersionCounter})
              </div>

              {/* Device 1 */}
              <div className="pl-4 border-l-2 border-emerald-500/50 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <HiOutlineComputerDesktop className="w-4 h-4 text-emerald-400" />
                    <span>MacBook Pro (Chrome)</span>
                    <span className="text-[10px] text-emerald-400 font-mono">[Current Device]</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded ${tokenVersionCounter > 2 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    {tokenVersionCounter > 2 ? `Invalidated by OCC (v${tokenVersionCounter})` : 'Active'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 pl-6">
                  Family ID: <code className="text-emerald-400">fam_9e83b4c1</code>
                </div>
              </div>

              {/* Device 2 */}
              <div className="pl-4 border-l-2 border-emerald-500/50 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <HiOutlineDevicePhoneMobile className="w-4 h-4 text-cyan-400" />
                    <span>iPhone 14 Pro (Safari)</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded ${tokenVersionCounter > 2 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    {tokenVersionCounter > 2 ? `Invalidated by OCC (v${tokenVersionCounter})` : 'Active'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 pl-6">
                  Family ID: <code className="text-cyan-400">fam_4a71d2e9</code> · Device Isolated
                </div>
              </div>

              {/* Device 3 (Breach Target) */}
              <div className={`pl-4 border-l-2 space-y-1 transition-all ${simulatedBreach ? 'border-red-500 bg-red-500/[0.03] p-2 rounded-r-lg' : 'border-slate-700'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <HiOutlineExclamationTriangle className={`w-4 h-4 ${simulatedBreach ? 'text-red-400' : 'text-slate-500'}`} />
                    <span className={simulatedBreach ? 'line-through text-slate-400' : 'text-slate-300'}>
                      Compromised Laptop (Stolen Token)
                    </span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded ${simulatedBreach ? 'bg-red-500/20 text-red-400 font-bold' : tokenVersionCounter > 2 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                    {simulatedBreach ? 'REVOKED (BREACH DETECTED)' : tokenVersionCounter > 2 ? `Invalidated by OCC (v${tokenVersionCounter})` : 'Active (fam_1c3f98a2)'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 pl-6">
                  {simulatedBreach ? (
                    <span className="text-red-400">
                      🚨 Replay of rotated token detected! Family <code className="text-red-300">fam_1c3f98a2</code> immediately purged from Redis & MongoDB. Innocent devices remain unaffected.
                    </span>
                  ) : (
                    <span>Family ID: <code className="text-slate-400">fam_1c3f98a2</code> · Awaiting verification</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
