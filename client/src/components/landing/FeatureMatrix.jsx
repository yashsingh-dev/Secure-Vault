import React, { useState } from 'react';
import {
  HiShieldCheck,
  HiBolt,
  HiClock,
  HiLockClosed,
  HiMagnifyingGlass,
  HiCheckBadge,
  HiChevronDown,
  HiCodeBracket
} from 'react-icons/hi2';

const SECTIONS = [
  {
    id: 'token-arch',
    title: 'Advanced Token Architecture (RFC 6819)',
    shortTitle: 'Token Architecture',
    badge: '7 Specs',
    icon: HiShieldCheck,
    accentColor: '#22c55e',
    textColor: 'text-emerald-500',
    borderColor: 'border-emerald-500',
    desc: 'Stateless, cryptographically verifiable, and bound to isolated device families to solve RFC 6819 replay vectors.',
    features: [
      {
        name: 'Dual-Token Lifetime Design',
        tag: 'RFC 6749',
        desc: '15-minute ultra short-lived stateless JWT access tokens paired with 7-day cryptographically secure refresh tokens stored in `httpOnly: true`, `secure: true`, `sameSite: "None"` cookies.',
        rationale: 'Access tokens minimize database validation overhead; refresh tokens isolate longevity and credential renewal strictly to authenticated cookie channels.'
      },
      {
        name: 'Cross-Pod CSRF Shield',
        tag: 'Header Guard',
        desc: 'Dedicated CSRF protection header validation (`x-csrf-token`) engineered specifically for separate-domain client/API pod architectures.',
        rationale: 'Because modern microservices host API pods on different subdomains from SPAs, standard SameSite cookies require secondary cryptographic token verification on mutating requests.'
      },
      {
        name: 'Refresh Token Rotation (RTR - One-Time Use)',
        tag: 'One-Time Token',
        desc: 'Every token refresh call invalidates the existing refresh token and immediately mints a fresh pair. Stored in MongoDB with SHA-256 digests.',
        rationale: 'Enforces strict single-use semantics so any stale or exfiltrated token becomes useless the moment legitimate rotation occurs.'
      },
      {
        name: '10-Second Concurrency Grace Period',
        tag: 'Race Prevention',
        desc: 'Solves multi-request race conditions in React SPA applications without false-positive breach lockouts when multiple parallel requests hit /refresh simultaneously.',
        rationale: 'Concurrent network waterfalls (e.g. Promise.all) frequently exchange tokens within milliseconds. Grace period permits active token propagation without triggering a breach.'
      },
      {
        name: 'Token Family Architecture (RFC 6819 Breach Detection)',
        tag: 'RFC 6819 Spec',
        desc: 'Refresh tokens are grouped into isolated device families (`familyId`). Replay detection immediately terminates *only* the compromised token family in RAM and DB, keeping innocent devices safe.',
        rationale: 'If an attacker replays a previously used token, Secure Vault recognizes the family lineage, revokes all tokens within that family, but never penalizes the innocent user on other devices.'
      },
      {
        name: 'Token Versioning (`tokenVersion`)',
        tag: 'Global OCC Counter',
        desc: 'Global invalidation counter on the user entity for instant one-click "Logout from all devices" in $O(1)$ time.',
        rationale: 'Rather than iterating through dozens of database records, incrementing `tokenVersion` by 1 invalidates every outstanding access token globally upon next RAM check.'
      },
      {
        name: 'Access Token Family Binding (Zero Blind-Spot Revocation)',
        tag: 'Zero Blind-Spot',
        desc: 'Access tokens carry `familyId` in their payload. Remote session revocation from a mobile dashboard instantly blocks a stolen laptop access token on its very next API call.',
        rationale: 'Solves the classic stateless JWT blind-spot where revoked sessions remain usable until token expiration.'
      }
    ]
  },
  {
    id: 'redis',
    title: 'Distributed Redis In-Memory Acceleration & Resilient Caching',
    shortTitle: 'Redis Acceleration',
    badge: '5 Specs',
    icon: HiBolt,
    accentColor: '#06b6d4',
    textColor: 'text-cyan-500',
    borderColor: 'border-cyan-500',
    desc: 'Zero-database-hit RAM verification with centralized key namespaces and self-healing cache-aside fallbacks.',
    features: [
      {
        name: 'Zero-Database-Hit Middleware Verification',
        tag: '< 1ms Latency',
        desc: 'Validates session existence and token version in RAM in `< 1ms` instead of querying MongoDB on every request.',
        rationale: 'Saves 99.8% of database I/O by keeping user security state and active session flags in Redis RAM.'
      },
      {
        name: 'Dedicated Redis Multi-Bucket Namespaces',
        tag: 'Namespace Architecture',
        desc: 'Organized into strict key namespaces: `blacklist:<tokenHash>`, `user:profile:<userId>`, `session:<familyId>`, `user:block:<userId>`, `user:otp:<userId>`, and `email:to:id:<email>`.',
        rationale: 'Ensures data isolation, deterministic TTL expiration per security tier, and clean memory eviction semantics.'
      },
      {
        name: 'Soft-String Key Architecture',
        tag: 'DRY Key Generation',
        desc: 'Strict centralized Redis key generators via `REDIS_KEYS` avoiding hardcoded string sprawl across the backend.',
        rationale: 'Eliminates typo-induced cache leaks and standardizes key schemas across all controllers, services, and middleware.'
      },
      {
        name: 'Self-Healing Cache-Aside Fallback',
        tag: 'Resilience',
        desc: 'If Redis restarts or evicts a key, middleware seamlessly queries MongoDB as the authoritative source and automatically repopulates ("self-heals") Redis with proper TTLs.',
        rationale: 'Zero user disruption during Redis rolling restarts, memory eviction, or cache cold starts.'
      },
      {
        name: 'Fault-Tolerant `safeRedis` Wrapper',
        tag: 'Error Shield',
        desc: 'Graceful error recovery preventing Redis network errors or cluster downtime from taking down user authentication.',
        rationale: 'Wraps all Redis operations in structured try/catch blocks with Pino error reporting and seamless database fallbacks.'
      }
    ]
  },
  {
    id: 'rate-limit',
    title: 'Distributed Rate Limiting (Sliding Window Counter in Lua)',
    shortTitle: 'Rate Limiting',
    badge: '5 Specs',
    icon: HiClock,
    accentColor: '#f59e0b',
    textColor: 'text-amber-500',
    borderColor: 'border-amber-500',
    desc: 'Atomic sliding window counter approximation executing in Redis RAM to defeat distributed botnets.',
    features: [
      {
        name: 'Sliding Window Counter Approximation',
        tag: 'O(1) Memory Algorithm',
        desc: 'Eliminates Fixed Window $2\\times$ boundary burst vulnerabilities while avoiding Sliding Window Log $O(N)$ Redis memory explosion.',
        rationale: 'Uses mathematical weighting: `weightedPrev = floor((1 - percentage) * prevHits)` + `currentHits`. Fixed memory footprint of just 2 integer counters.'
      },
      {
        name: 'Atomic Redis Lua Scripting',
        tag: 'Zero Race Conditions',
        desc: 'Execution via `redis.eval` bundling counter estimation, comparison, `INCRBY`, and window TTL in one atomic server operation.',
        rationale: 'Guarantees thread-safe atomic evaluation in Redis without distributed locks or multi-step round-trips.'
      },
      {
        name: 'Dual-Tiered Login Defense',
        tag: 'Tiered Protection',
        desc: 'Burst Limiter (5 requests / 1 min) stops high-speed automated scripts; Sustained Limiter (10 requests / 5 mins) stops slow, distributed dictionary attacks.',
        rationale: 'Defends against both fast brute-force scripts and stealthy low-and-slow credential stuffing bots.'
      },
      {
        name: 'Identity-Aware Keying (Context-Based Rate Limiting)',
        tag: 'Proxy Botnet Killer',
        desc: 'OTP sending, OTP verification, and Password Reset are keyed by normalized email address (`req.body.email`), completely neutralizing rotating residential proxy botnets.',
        rationale: 'Attackers rotating thousands of residential IPs are blocked immediately because the rate limit tracks the target account rather than client IP.'
      },
      {
        name: 'IETF Compliance & Fail-Open Resilience',
        tag: 'RFC Standards',
        desc: 'Emits standard `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, and `Retry-After` headers. High-availability fail-open policy ensuring cache outages never lock out legitimate users.',
        rationale: 'Adheres to IETF draft-ietf-httpapi-ratelimit-headers while maintaining high system availability under cache failure.'
      }
    ]
  },
  {
    id: 'identity',
    title: 'Identity Protection & Defense-in-Depth',
    shortTitle: 'Identity & Defense',
    badge: '8 Specs',
    icon: HiLockClosed,
    accentColor: '#8b5cf6',
    textColor: 'text-violet-500',
    borderColor: 'border-violet-500',
    desc: 'Multi-layered perimeter defense featuring hybrid OAuth 2.0, OTP MFA, OCC, and Zod edge contracts.',
    features: [
      {
        name: 'Hybrid Google OAuth 2.0 Auth-Code Flow',
        tag: 'Local RS256 Verification',
        desc: 'Local RS256 signature verification of Google ID tokens and account segregation (`googleLogin: true`).',
        rationale: 'Verifies Google cryptographic public keys locally without making third-party HTTP requests on every session verification.'
      },
      {
        name: 'Multi-Factor OTP & Account Lockout Engine',
        tag: 'Progressive Locking',
        desc: '6-digit verification codes with rate limits, resend cooldowns, and automatic progressive account locking.',
        rationale: 'Stored transiently in Redis (`user:otp:<userId>`) with strict attempt counters, preventing brute force guessing.'
      },
      {
        name: 'User-Configurable Security Settings',
        tag: 'User Enforced MFA',
        desc: '"Always require OTP on login" toggle enforced on standard password logins as well as social Google logins.',
        rationale: 'Gives security-conscious users granular control over their authentication friction and perimeter requirements.'
      },
      {
        name: 'Bot Defense (reCAPTCHA v2)',
        tag: 'Perimeter Guard',
        desc: 'Integrated Google reCAPTCHA v2 verification protecting registration and login forms against automated spam engines.',
        rationale: 'Middleware strictly verifies the token before invoking password hashing or database querying.'
      },
      {
        name: 'Optimistic Concurrency Control (OCC)',
        tag: 'Atomic CAS',
        desc: 'Atomic Compare-And-Swap (CAS) on `logoutAll` preventing double-increment race conditions when revoking sessions.',
        rationale: 'Utilizes MongoDB document versioning and conditional matching to guarantee atomic version increments under high concurrency.'
      },
      {
        name: 'Edge Request Contract Validation (Zod)',
        tag: 'Boundary Validation',
        desc: 'Strict schema validation rejecting invalid payloads at the route boundary before controller execution.',
        rationale: 'Protects backend memory and prevents malformed parameters or prototype pollution from entering core service logic.'
      },
      {
        name: 'Redacted Structured Logging (Pino)',
        tag: 'Zero Log Leakage',
        desc: 'High-performance JSON request telemetry with automated mask filters for passwords, tokens, cookies, and OTPs.',
        rationale: 'Ensures PCI-DSS and SOC-2 compliance by preventing secrets and credentials from ever persisting into log pipelines.'
      },
      {
        name: 'Startup Guard (`validateSetup.js`)',
        tag: 'Failsafe Boot',
        desc: 'Failsafe environment validator halting boot if cryptographic keys, JWT secrets, or connection strings are missing.',
        rationale: 'Prevents the application from booting into an insecure or undefined state in production clusters.'
      }
    ]
  }
];

const formatTextWithCode = (text, isDark) => {
  if (!text) return null;
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      const codeContent = part.slice(1, -1);
      return (
        <code
          key={index}
          className={`font-mono text-[11px] px-1.5 py-0.5 rounded border ${
            isDark
              ? 'bg-white/5 border-white/10 text-emerald-400'
              : 'bg-black/5 border-black/10 text-emerald-700'
          }`}
        >
          {codeContent}
        </code>
      );
    }
    return <span key={index}>{part}</span>;
  });
};

export default function FeatureMatrix({ theme = 'dark' }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFeature, setExpandedFeature] = useState(null);

  const isDark = theme === 'dark';
  const ActiveSection = SECTIONS[activeIndex];
  const ActiveIcon = ActiveSection.icon;

  // Search filter across all sections
  const filteredFeatures = searchQuery.trim()
    ? SECTIONS.flatMap((sec) =>
        sec.features
          .filter(
            (f) =>
              f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              f.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
              f.tag.toLowerCase().includes(searchQuery.toLowerCase())
          )
          .map((f) => ({ ...f, sectionTitle: sec.title, sectionColor: sec.accentColor }))
      )
    : null;

  return (
    <section id="features" className={`py-24 font-sans transition-colors duration-300 ${isDark ? 'bg-[#0a0a0f]' : 'bg-slate-50'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-mono uppercase tracking-wider border mb-4 border-emerald-500/20 bg-emerald-500/5 text-emerald-400">
              Technical Specification Matrix
            </div>
            <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Complete Security Architecture
            </h2>
            <p className={`mt-2 text-sm sm:text-base font-mono ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              25 production-grade distributed specifications across 4 security domains
            </p>
          </div>

          {/* Quick Search & Filter Bar */}
          <div className="relative w-full md:w-80">
            <HiMagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search 25 specs (e.g. Lua, CSRF, Grace)..."
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs font-mono transition-all outline-none ${
                isDark
                  ? 'bg-[#12121c] border-white/10 text-white placeholder-slate-500 focus:border-emerald-500'
                  : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500 shadow-sm'
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Tab Controls (When not searching) */}
        {!filteredFeatures && (
          <div className={`flex overflow-x-auto mb-10 border-b scrollbar-hide ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
            {SECTIONS.map((sec, idx) => {
              const isActive = activeIndex === idx;
              const Icon = sec.icon;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveIndex(idx)}
                  className={`flex items-center gap-2.5 px-5 py-4 text-xs font-mono font-medium whitespace-nowrap border-b-2 transition-all outline-none ${
                    isActive
                      ? `${sec.borderColor} ${isDark ? 'text-white' : 'text-slate-900'}`
                      : `border-transparent ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? sec.textColor : 'opacity-60'}`} />
                  <span>{sec.shortTitle}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-black/5 dark:bg-white/5 text-slate-500'}`}>
                    {sec.badge}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Section Info Banner */}
        {!filteredFeatures && (
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${isDark ? 'bg-white/5' : 'bg-slate-200/50'}`}>
                <ActiveIcon className={`w-5 h-5 ${ActiveSection.textColor}`} />
              </div>
              <div>
                <h3 className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {ActiveSection.title}
                </h3>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {ActiveSection.desc}
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-block font-mono text-xs text-emerald-500">
              {ActiveSection.features.length} Features Loaded
            </span>
          </div>
        )}

        {/* Features Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(filteredFeatures || ActiveSection.features).map((feat, idx) => {
            const isExpanded = expandedFeature === feat.name;

            return (
              <div
                key={feat.name}
                onClick={() => setExpandedFeature(isExpanded ? null : feat.name)}
                className={`group relative p-5 rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden ${
                  isDark
                    ? 'bg-[#12121a] border-white/5 hover:border-white/15 hover:bg-[#151522]'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                {/* Accent Indicator Bar */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 rounded-r-full"
                  style={{ backgroundColor: feat.sectionColor || ActiveSection.accentColor }}
                />

                <div className="pl-2">
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <h4 className={`font-semibold text-sm tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {formatTextWithCode(feat.name, isDark)}
                    </h4>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                      {feat.tag}
                    </span>
                  </div>

                  <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {formatTextWithCode(feat.desc, isDark)}
                  </p>

                  {/* Expandable Engineering Rationale */}
                  {feat.rationale && (
                    <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/5">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-500 font-medium">
                        <HiCodeBracket className="w-3.5 h-3.5" />
                        <span>Engineering Rationale:</span>
                      </div>
                      <p className={`mt-1 text-[11px] leading-relaxed italic ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {feat.rationale}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredFeatures && filteredFeatures.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-400 text-sm font-mono">No security specifications matched "{searchQuery}"</p>
            <button onClick={() => setSearchQuery('')} className="mt-2 text-xs text-emerald-500 hover:underline">
              Clear search filter
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
