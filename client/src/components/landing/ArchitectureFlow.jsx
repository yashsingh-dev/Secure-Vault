import React, { useState, useEffect } from 'react';
import {
  HiComputerDesktop,
  HiClock,
  HiShieldCheck,
  HiKey,
  HiBolt,
  HiFingerPrint,
  HiCircleStack,
  HiPlay,
  HiArrowPath,
  HiCheckCircle,
  HiXCircle
} from 'react-icons/hi2';

const PIPELINE_STEPS = [
  {
    id: 'client',
    title: 'Client Browser',
    subtitle: 'HTTPS + Cookies',
    layer: 'Layer 01',
    icon: HiComputerDesktop,
    latency: '+0.1ms',
    summary: 'Single Page Application (React 19) issuing authenticated requests with credentials and custom headers.',
    specs: [
      'Origin validation with strict CORS credentials configuration',
      'Encrypted httpOnly & Secure cookie transmission across domains',
      'Automatic token refresh handling with 10-second concurrency grace period'
    ],
    codeSnippet: `// Client Request Contract (axios interceptor)
headers: {
  'Content-Type': 'application/json',
  'x-csrf-token': getStoredCsrfToken() // Stored in React Memory (not in localStorage/sessionStorage)
},
withCredentials: true // Transmits httpOnly cookies`
  },
  {
    id: 'ratelimit',
    title: 'Rate Limiter',
    subtitle: 'Sliding Window Lua',
    layer: 'Layer 02',
    icon: HiClock,
    latency: '+0.3ms',
    summary: 'Distributed sliding window counter evaluated atomically in Redis RAM via redis.eval Lua script.',
    specs: [
      'Dual-tiered defense: 5 req/min burst limiter + 10 req/5min sustained limiter',
      'Context-aware keying by normalized email (req.body.email) neutralizing rotating proxy botnets',
      'IETF compliance: RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset headers emitted'
    ],
    codeSnippet: `-- Atomic Redis Lua Evaluation
local estimated = math.floor(weight * prev_count) + curr_count
if estimated >= max_requests then
  return { 0, estimated, max_requests } -- 429 BLOCKED
end
redis.call('INCRBY', current_key, 1)`
  },
  {
    id: 'csrf',
    title: 'CSRF Guard',
    subtitle: 'x-csrf-token Header',
    layer: 'Layer 03',
    icon: HiShieldCheck,
    latency: '+0.2ms',
    summary: 'Custom cryptographic CSRF verification engineered specifically for multi-pod separate domain architectures.',
    specs: [
      'Validates x-csrf-token header against server session token',
      'Completely neutralizes cross-origin state-changing exploits on POST, PUT, DELETE',
      'Bypasses safe read-only idempotent methods (GET, HEAD, OPTIONS)'
    ],
    codeSnippet: `// CSRF Guard Middleware
const csrfToken = req.headers['x-csrf-token'];
if (!csrfToken || csrfToken !== sessionCsrfProof) {
  throw new ApiError(403, 'Invalid or missing CSRF token');
}`
  },
  {
    id: 'jwt',
    title: 'JWT Verify',
    subtitle: 'Stateless RS256/HS256',
    layer: 'Layer 04',
    icon: HiKey,
    latency: '+0.2ms',
    summary: 'Cryptographic signature verification on the 15-minute ultra-short lived access token without disk I/O.',
    specs: [
      'Cryptographically unpacks _id, tokenVersion, and familyId claims',
      'Fails immediately if token signature is forged or token has expired past 900s',
      'Passes familyId down to middleware pipeline for zero blind-spot revocation'
    ],
    codeSnippet: `// Stateless Token Verification
const decoded = jwt.verify(token, process.env.JWT_ACCESS_KEY);
req.user = {
  _id: decoded._id,
  tokenVersion: decoded.tokenVersion,
  familyId: decoded.familyId
};`
  },
  {
    id: 'redis',
    title: 'Redis Cache Check',
    subtitle: '< 1ms RAM RAM Check',
    layer: 'Layer 05',
    icon: HiBolt,
    latency: '+0.4ms',
    summary: 'RAM verification of session existence, tokenVersion counter, and blacklist status in under 1 millisecond.',
    specs: [
      'Checks blacklist:<tokenHash> to ensure token was not individually revoked',
      'Compares decoded.tokenVersion against user:profile:<userId>.tokenVersion in RAM',
      'Zero database hit guarantee: 99.8% of requests resolve strictly within RAM'
    ],
    codeSnippet: `// safeRedis In-Memory Verification
const isBlacklisted = await safeRedis.get(REDIS_KEYS.blacklist(tokenHash));
if (isBlacklisted) throw new ApiError(401, 'Token revoked');

const profile = await safeRedis.getUserProfile(decoded._id);
if (profile && profile.tokenVersion !== decoded.tokenVersion) {
  throw new ApiError(401, 'Session invalidated globally');
}`
  },
  {
    id: 'family',
    title: 'Token Family',
    subtitle: 'Breach Detection',
    layer: 'Layer 06',
    icon: HiFingerPrint,
    latency: '+0.5ms',
    summary: 'RFC 6819 token family isolation engine. Detects replay attacks and revokes the compromised device lineage.',
    specs: [
      'Checks session:<familyId> flag to ensure device family is active',
      'If rotated token is reused, all tokens in familyId are purged immediately',
      'Other devices belonging to the user remain safe and unaffected'
    ],
    codeSnippet: `// Token Family Breach Detection (RFC 6819)
const sessionActive = await safeRedis.get(REDIS_KEYS.session(decoded.familyId));
if (!sessionActive) {
  // Replay detected -> Revoke family & trigger security alert
  await safeRedis.del(REDIS_KEYS.session(decoded.familyId));
  throw new ApiError(403, 'Session breach detected');
}`
  },
  {
    id: 'mongo',
    title: 'Mongo Authoritative Fallback',
    subtitle: 'Self-Healing Source',
    layer: 'Layer 07',
    icon: HiCircleStack,
    latency: '+12.4ms',
    summary: 'Authoritative persistent data store with optimistic concurrency control (CAS) and self-healing Redis repopulation.',
    specs: [
      'Invoked only on cache misses, token rotation minting, or cold starts',
      'Optimistic Concurrency Control (CAS) on logoutAll prevents double-increment race conditions',
      'Self-healing cache-aside repopulates Redis RAM with proper TTLs automatically'
    ],
    codeSnippet: `// Self-Healing Authoritative Fallback
let user = await safeRedis.getUserProfile(userId);
if (!user) {
  user = await UserModel.findById(userId).lean();
  if (user) await safeRedis.setUserProfile(userId, user, 86400); // Self-heal
}`
  }
];

export default function ArchitectureFlow({ theme = 'dark' }) {
  const [activeStep, setActiveStep] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationScenario, setSimulationScenario] = useState('hit'); // 'hit' | 'breach' | 'miss'
  const [simulationLog, setSimulationLog] = useState(null);

  const isDark = theme === 'dark';

  const runSimulation = (scenario) => {
    setSimulationScenario(scenario);
    setIsSimulating(true);
    setActiveStep(0);
    setSimulationLog(null);

    const stepsToRun = scenario === 'hit' ? 5 : scenario === 'breach' ? 6 : 7;
    let current = 0;

    const interval = setInterval(() => {
      current += 1;
      if (current < stepsToRun) {
        setActiveStep(current);
      } else {
        clearInterval(interval);
        setIsSimulating(false);
        setActiveStep(current - 1);
        if (scenario === 'hit') {
          setSimulationLog({
            status: '200 OK',
            type: 'success',
            msg: 'Fast-Path In-Memory Verification complete in 1.2ms (Zero Database Hits).'
          });
        } else if (scenario === 'breach') {
          setSimulationLog({
            status: '403 FORBIDDEN',
            type: 'breach',
            msg: 'RFC 6819 Breach Detected: Reused token family purged in RAM without touching DB.'
          });
        } else {
          setSimulationLog({
            status: '200 OK',
            type: 'healing',
            msg: 'Cache-Aside Fallback: MongoDB queried authoritatively and Redis self-healed in 14.1ms.'
          });
        }
      }
    }, 450);
  };

  return (
    <section id="architecture" className={`py-24 transition-colors duration-300 ${isDark ? 'bg-[#0a0a0f] text-white' : 'bg-slate-50 text-slate-900'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-mono uppercase tracking-wider border mb-4 border-emerald-500/20 bg-emerald-500/5 text-emerald-400">
            Request Traversal Pipeline
          </div>
          <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Security Pipeline Architecture
          </h2>
          <p className={`text-base sm:text-lg font-mono ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Every incoming request traverses seven discrete layers of distributed defense
          </p>
        </div>

        {/* Interactive Trace Simulator Bar */}
        <div className={`p-4 rounded-2xl border mb-10 flex flex-wrap items-center justify-between gap-4 transition-colors ${isDark ? 'bg-[#12121c] border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase font-semibold tracking-wider text-emerald-500">
              Live Pipeline Trace:
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={isSimulating}
                onClick={() => runSimulation('hit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                  simulationScenario === 'hit' && !isSimulating
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : isDark
                      ? 'bg-white/5 text-slate-300 hover:bg-white/10'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <HiPlay className="w-3.5 h-3.5" />
                Scenario A: RAM Cache Hit (1.2ms)
              </button>
              <button
                disabled={isSimulating}
                onClick={() => runSimulation('breach')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                  simulationScenario === 'breach' && !isSimulating
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : isDark
                      ? 'bg-white/5 text-slate-300 hover:bg-white/10'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <HiPlay className="w-3.5 h-3.5" />
                Scenario B: Token Replay Breach (403)
              </button>
              <button
                disabled={isSimulating}
                onClick={() => runSimulation('miss')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                  simulationScenario === 'miss' && !isSimulating
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : isDark
                      ? 'bg-white/5 text-slate-300 hover:bg-white/10'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <HiArrowPath className="w-3.5 h-3.5" />
                Scenario C: Self-Healing Cache Miss
              </button>
            </div>
          </div>

          {/* Trace Status / Simulation Indicator */}
          <div className="flex items-center gap-2 text-xs font-mono">
            {isSimulating ? (
              <span className="flex items-center gap-2 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                Tracing Packet: Layer 0{activeStep + 1}
              </span>
            ) : simulationLog ? (
              <span className={`flex items-center gap-1.5 font-semibold ${
                simulationLog.type === 'breach' ? 'text-red-400' : 'text-emerald-400'
              }`}>
                {simulationLog.type === 'breach' ? <HiXCircle className="w-4 h-4" /> : <HiCheckCircle className="w-4 h-4" />}
                {simulationLog.status}
              </span>
            ) : (
              <span className="text-slate-400">Select scenario to execute live trace</span>
            )}
          </div>
        </div>

        {/* Step Diagram Cards (Horizontal scroll on mobile, responsive flex on desktop) */}
        <div className="relative mb-10 overflow-x-auto pb-6 pt-2 px-2 sm:px-4 -mx-2 sm:mx-0 scrollbar-thin">
          <div className="flex items-center gap-2 min-w-[960px] lg:min-w-full justify-between px-2">
            {PIPELINE_STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isActive = idx === activeStep;
              const isPast = idx < activeStep;

              return (
                <React.Fragment key={step.id}>
                  {/* Step Card Button */}
                  <button
                    onClick={() => setActiveStep(idx)}
                    className={`relative flex flex-col items-center justify-center p-3.5 w-32 h-36 rounded-2xl border transition-all duration-300 text-center outline-none group shrink-0 ${
                      isActive
                        ? isDark
                          ? 'bg-[#151522] border-emerald-500 shadow-[0_0_25px_rgba(34,197,94,0.25)] ring-1 ring-emerald-500 scale-105 z-10'
                          : 'bg-white border-emerald-500 shadow-[0_0_20px_rgba(34,197,94,0.2)] ring-1 ring-emerald-500 scale-105 z-10'
                        : isPast
                          ? isDark
                            ? 'bg-[#101018] border-emerald-500/30 text-slate-300'
                            : 'bg-white border-emerald-500/30 text-slate-700'
                          : isDark
                            ? 'bg-[#111118] border-white/5 text-slate-400 hover:border-white/20'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-mono text-[9px] uppercase tracking-wider mb-2 text-slate-500 font-semibold">
                      {step.layer}
                    </span>
                    <div className={`p-2 rounded-xl mb-2 transition-colors ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : isPast
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`text-xs font-semibold tracking-tight leading-tight line-clamp-1 ${
                      isActive ? (isDark ? 'text-white' : 'text-slate-900') : ''
                    }`}>
                      {step.title}
                    </span>
                    <span className="font-mono text-[9px] text-slate-500 mt-1">
                      {step.subtitle}
                    </span>
                  </button>

                  {/* Connecting Line */}
                  {idx < PIPELINE_STEPS.length - 1 && (
                    <div className="flex-1 h-[2px] mx-1 relative shrink-0 min-w-[16px] bg-slate-800">
                      <div
                        className={`h-full transition-all duration-300 ${
                          idx < activeStep ? 'bg-emerald-500' : 'bg-transparent'
                        }`}
                      />
                      {idx === activeStep && isSimulating && (
                        <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      )}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Active Step Deep Detail & Code Panel */}
        <div className={`rounded-2xl border p-6 lg:p-8 transition-all duration-300 ${isDark ? 'bg-[#11111a] border-white/10 shadow-2xl' : 'bg-white border-slate-200 shadow-md'}`}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: Deep Specification */}
            <div className="lg:col-span-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  {React.createElement(PIPELINE_STEPS[activeStep].icon, { className: 'w-6 h-6' })}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {PIPELINE_STEPS[activeStep].title}
                    </h3>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      {PIPELINE_STEPS[activeStep].layer}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-slate-500">
                    Expected Overhead: {PIPELINE_STEPS[activeStep].latency}
                  </span>
                </div>
              </div>

              <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {PIPELINE_STEPS[activeStep].summary}
              </p>

              <div className="space-y-2 pt-2">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-500 font-semibold">
                  Architectural Guarantees:
                </div>
                {PIPELINE_STEPS[activeStep].specs.map((spec, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-emerald-500 mt-0.5">✔</span>
                    <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{spec}</span>
                  </div>
                ))}
              </div>

              {simulationLog && (
                <div className={`p-3.5 rounded-xl border text-xs font-mono mt-4 ${
                  simulationLog.type === 'breach'
                    ? 'bg-red-500/10 border-red-500/30 text-red-400'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                }`}>
                  <strong>Telemetry Result: </strong>{simulationLog.msg}
                </div>
              )}
            </div>

            {/* Right: Actual Code Contract Preview */}
            <div className="lg:col-span-6 flex flex-col justify-center">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
                <span className="font-mono text-xs text-slate-500">Implementation Contract</span>
                <span className="font-mono text-[10px] text-emerald-400">Source: server/src</span>
              </div>
              <pre className={`p-4 rounded-xl border font-mono text-xs leading-relaxed overflow-x-auto ${isDark ? 'bg-black/50 border-white/5 text-emerald-300' : 'bg-slate-50 border-slate-200 text-emerald-800'}`}>
                <code>{PIPELINE_STEPS[activeStep].codeSnippet}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
