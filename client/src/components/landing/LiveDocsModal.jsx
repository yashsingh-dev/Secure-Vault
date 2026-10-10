import React, { useState, useEffect } from 'react';
import {
  HiXMark,
  HiOutlineShieldCheck,
  HiOutlineKey,
  HiOutlineCircleStack,
  HiOutlineCommandLine,
  HiOutlineCheckCircle,
  HiOutlineArrowTopRightOnSquare,
  HiOutlineClipboardDocument,
  HiOutlineCheck,
  HiOutlineExclamationTriangle
} from 'react-icons/hi2';

export default function LiveDocsModal({ isOpen, onClose, theme = 'dark' }) {
  const [activeTab, setActiveTab] = useState('rfc6819');
  const [copiedKey, setCopiedKey] = useState(null);

  const isDark = theme === 'dark';

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const threatMatrix = [
    {
      threat: 'Refresh Token Leakage & Replay',
      vector: 'Attacker exfiltrates a refresh token and attempts to mint new access tokens.',
      mitigation: 'RFC 6819 Token Families (familyId). Once a rotated token is re-used, the entire family is revoked in RAM and DB. Innocent devices maintain separate family IDs.',
      status: 'Mitigated'
    },
    {
      threat: 'Frontend Concurrency Race Conditions',
      vector: 'React SPA triggers simultaneous API calls (e.g., Promise.all), sending multiple refresh requests at the same millisecond.',
      mitigation: '10-Second Concurrency Grace Window. Concurrent refreshes within the grace period return the active token pair rather than falsely flagging a breach.',
      status: 'Mitigated'
    },
    {
      threat: 'Stolen Access Token Window (Blind Spot)',
      vector: 'Stateless JWT remains valid until expiration even after the user triggers remote logout.',
      mitigation: 'Access Token Family Binding + Redis Blacklist. Access tokens carry familyId in payload. Remote revocation marks family as inactive in Redis RAM (< 1ms block).',
      status: 'Mitigated'
    },
    {
      threat: 'Cross-Pod CSRF Attacks',
      vector: 'Malicious site tricks user browser into sending cookies across domains.',
      mitigation: 'Dedicated x-csrf-token validation. Refresh cookie uses SameSite=None with httpOnly, coupled with mandatory cryptographic CSRF header check on mutating endpoints.',
      status: 'Mitigated'
    },
    {
      threat: 'Distributed Credential Stuffing & Proxy Botnets',
      vector: 'Attackers rotate thousands of residential IPs to bypass standard IP-based rate limiters.',
      mitigation: 'Context-Based Rate Limiting. Sensitive endpoints (OTP, login, password reset) are keyed by normalized email (req.body.email) in atomic Lua scripts.',
      status: 'Mitigated'
    },
    {
      threat: 'Redis Cluster Outage / Cache Eviction',
      vector: 'Redis crashes, reboots, or evicts keys under memory pressure.',
      mitigation: 'Self-Healing Cache-Aside + safeRedis wrapper. Queries fall back authoritatively to MongoDB, repopulate Redis with TTLs, and fail-open rate limiting ensures availability.',
      status: 'Mitigated'
    }
  ];

  const redisNamespaces = [
    {
      prefix: 'blacklist:<tokenHash>',
      purpose: 'Instant revocation of blacklisted access tokens',
      ttl: 'Dynamic (Remaining JWT exp in seconds)',
      storage: 'RAM (String "1")'
    },
    {
      prefix: 'user:profile:<userId>',
      purpose: 'Cached user metadata and authoritative tokenVersion counter',
      ttl: '86,400s (24 hours) or auto-refreshed',
      storage: 'RAM (JSON Object)'
    },
    {
      prefix: 'session:<familyId>',
      purpose: 'Active token family presence flag for instant zero-hit auth check',
      ttl: '604,800s (7 days / token lifespan)',
      storage: 'RAM (String "1")'
    },
    {
      prefix: 'user:block:<userId>',
      purpose: 'Progressive account temporary lockout state',
      ttl: 'Configurable lockout duration',
      storage: 'RAM (Integer timestamp)'
    },
    {
      prefix: 'user:otp:<userId>',
      purpose: 'Transient 6-digit verification code, attempt counters, cooldown',
      ttl: '300s (5 minutes OTP window)',
      storage: 'RAM (JSON with code, attempts)'
    },
    {
      prefix: 'email:to:id:<email>',
      purpose: 'Secondary lookup index for instant user ID resolution',
      ttl: '86,400s (24 hours)',
      storage: 'RAM (String userId)'
    },
    {
      prefix: 'rl:<scope>:<id>',
      purpose: 'Sliding window request hits counter for atomic rate limiting',
      ttl: 'Window size * 2 (Auto-eviction)',
      storage: 'RAM (Integer counter)'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        className={`relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-all duration-200 z-10 ${
          isDark
            ? 'bg-[#0e0e15] border-white/10 text-white'
            : 'bg-white border-black/10 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            isDark ? 'border-white/10 bg-[#12121c]' : 'border-black/5 bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <HiOutlineShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold tracking-tight">
                  Secure Vault Architecture & Threat Model Spec
                </h3>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  RFC 6819
                </span>
              </div>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                Production Distributed Session Security System Specifications
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-black/5 text-slate-500'
            }`}
          >
            <HiXMark className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div
          className={`flex border-b px-6 gap-6 overflow-x-auto ${
            isDark ? 'border-white/10 bg-[#0a0a0f]' : 'border-black/5 bg-slate-100/50'
          }`}
        >
          {[
            { id: 'rfc6819', label: 'Threat Matrix (RFC 6819)' },
            { id: 'redis', label: 'Redis Key Hierarchy' },
            { id: 'contract', label: 'HTTP Security Headers' },
            { id: 'quickstart', label: 'Verification Trace' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 text-xs font-mono font-medium border-b-2 whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'border-emerald-500 text-emerald-500'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm flex-1">
          {activeTab === 'rfc6819' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                  Formal threat mitigation analysis based on RFC 6819 (OAuth 2.0 Threat Model and Security Considerations).
                </p>
                <span className="text-[11px] font-mono text-emerald-500">6/6 Vectors Mitigated</span>
              </div>

              <div className="grid gap-3">
                {threatMatrix.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border transition-all ${
                      isDark
                        ? 'bg-[#14141e] border-white/5 hover:border-emerald-500/20'
                        : 'bg-slate-50 border-black/5 hover:border-emerald-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <h4 className="font-semibold text-xs tracking-tight">{item.threat}</h4>
                      </div>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-medium">
                        {item.status}
                      </span>
                    </div>
                    <p className={`text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                      <strong className={isDark ? 'text-gray-300' : 'text-slate-700'}>Attack Vector: </strong>
                      {item.vector}
                    </p>
                    <p className={`text-xs leading-relaxed ${isDark ? 'text-emerald-400/90' : 'text-emerald-700'}`}>
                      <strong>Defense Engine: </strong>
                      {item.mitigation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'redis' && (
            <div className="space-y-4">
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                Strict centralized key namespaces managed through <code className="font-mono text-emerald-500">REDIS_KEYS</code> helper.
                Guarantees zero database hits on verified and blacklisted requests.
              </p>

              <div className="overflow-x-auto rounded-xl border border-white/5">
                <table className="w-full text-left text-xs font-mono">
                  <thead className={isDark ? 'bg-white/5 text-gray-400' : 'bg-slate-100 text-slate-600'}>
                    <tr>
                      <th className="p-3">Redis Key Pattern</th>
                      <th className="p-3">Purpose & Responsibility</th>
                      <th className="p-3">TTL Policy</th>
                      <th className="p-3">Data Structure</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-black/5'}`}>
                    {redisNamespaces.map((ns, idx) => (
                      <tr key={idx} className={isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'}>
                        <td className="p-3 text-emerald-400 font-semibold">{ns.prefix}</td>
                        <td className={`p-3 font-sans ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>{ns.purpose}</td>
                        <td className="p-3 text-amber-400">{ns.ttl}</td>
                        <td className="p-3 text-cyan-400">{ns.storage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'contract' && (
            <div className="space-y-4">
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                Every API response adheres to standard IETF and OWASP security headers.
              </p>

              <div className={`p-4 rounded-xl border font-mono text-xs space-y-2 ${isDark ? 'bg-[#14141e] border-white/5' : 'bg-slate-50 border-black/5'}`}>
                <div className="text-gray-500">// Response Headers emitted by Secure Vault Middleware</div>
                <div><span className="text-emerald-400">RateLimit-Limit:</span> 5</div>
                <div><span className="text-emerald-400">RateLimit-Remaining:</span> 4</div>
                <div><span className="text-emerald-400">RateLimit-Reset:</span> 42</div>
                <div><span className="text-cyan-400">x-csrf-token:</span> &lt;cryptographic-csrf-proof&gt;</div>
                <div><span className="text-amber-400">Strict-Transport-Security:</span> max-age=63072000; includeSubDomains; preload</div>
                <div><span className="text-amber-400">X-Content-Type-Options:</span> nosniff</div>
                <div><span className="text-amber-400">X-Frame-Options:</span> DENY</div>
                <div><span className="text-amber-400">Content-Security-Policy:</span> default-src 'self'</div>
                <div>
                  <span className="text-pink-400">Set-Cookie:</span> refresh_token=...; HttpOnly; Secure; SameSite=None; Path=/api/v1/auth; Max-Age=604800
                </div>
              </div>
            </div>
          )}

          {activeTab === 'quickstart' && (
            <div className="space-y-4">
              {/* Important Notice: reCAPTCHA Requirement */}
              <div
                className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                  isDark
                    ? 'bg-amber-500/10 border-amber-500/25 text-amber-200'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold mb-1 text-amber-400">
                  <HiOutlineExclamationTriangle className="w-4 h-4 shrink-0" />
                  <span>Important Note: Google reCAPTCHA Verification Enforced</span>
                </div>
                <p className="text-[11px] mb-2 leading-relaxed opacity-90">
                  Executing direct terminal <code className="px-1 py-0.5 rounded font-mono bg-black/20 font-bold">curl</code> commands against <code className="px-1 py-0.5 rounded font-mono bg-black/20">/api/v1/auth/login</code> or <code className="px-1 py-0.5 rounded font-mono bg-black/20">/register</code> will return <strong className="font-semibold text-rose-400">400 Bad Request</strong> because Google reCAPTCHA v2 bot protection is active and expects a valid <code className="px-1 py-0.5 rounded font-mono bg-black/20">recaptchaToken</code>.
                </p>
                <div className="text-[11px] leading-relaxed pt-1.5 border-t border-amber-500/20">
                  💡 <strong>To test via terminal locally without reCAPTCHA keys:</strong> Fork or clone the repository from GitHub, set <code className="px-1 py-0.5 rounded font-mono bg-black/25 text-emerald-400 font-bold">RECAPTCHA: &#123; ENABLED: false &#125;</code> in <code className="px-1 py-0.5 rounded font-mono bg-black/25 text-amber-300">server/src/config/constants.js</code>, and run the server. It will execute seamlessly without requiring Google reCAPTCHA tokens.
                </div>
              </div>

              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                Test the API trace using curl from your terminal:
              </p>

              <div className="relative">
                <button
                  onClick={() =>
                    copyToClipboard(
                      'curl -i -X POST http://localhost:5000/api/v1/auth/login \\\n  -H "Content-Type: application/json" \\\n  -d \'{"email":"test@example.com","password":"Password123!"}\'',
                      'curl'
                    )
                  }
                  className="absolute top-3 right-3 p-1.5 rounded bg-white/10 hover:bg-white/20 text-gray-300 transition-colors flex items-center gap-1 text-[11px] font-mono"
                >
                  {copiedKey === 'curl' ? <HiOutlineCheck className="w-3.5 h-3.5 text-emerald-400" /> : <HiOutlineClipboardDocument className="w-3.5 h-3.5" />}
                  {copiedKey === 'curl' ? 'Copied' : 'Copy'}
                </button>
                <pre className={`p-4 rounded-xl border font-mono text-xs overflow-x-auto ${isDark ? 'bg-[#14141e] border-white/5 text-gray-300' : 'bg-slate-50 border-black/5 text-slate-800'}`}>
                  <code>{`curl -i -X POST http://localhost:5000/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"test@example.com","password":"Password123!"}'`}</code>
                </pre>
              </div>

              <div className={`p-4 rounded-xl border font-mono text-xs space-y-1.5 ${isDark ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300' : 'bg-emerald-50 border-emerald-500/30 text-emerald-800'}`}>
                <div className="font-semibold font-sans text-sm mb-1">Standard Execution Telemetry:</div>
                <div>➔ [0.12ms] Zod contract validation passed</div>
                <div>➔ [0.45ms] Redis sliding window counter evaluated via Lua: 1/5</div>
                <div>➔ [1.10ms] safeRedis user profile retrieved from RAM</div>
                <div>➔ [0.35ms] EdDSA/HMAC token pair issued with familyId: fam_c89b21</div>
                <div>➔ Total Round-Trip Server Latency: 2.02ms</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`flex items-center justify-between px-6 py-3 border-t text-xs ${
            isDark ? 'border-white/10 bg-[#12121c] text-gray-400' : 'border-black/5 bg-slate-50 text-slate-500'
          }`}
        >
          <span>Open Source RFC 6819 Architecture</span>
          <a
            href="https://github.com/yashsingh-dev/Secure-Vault"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-emerald-500 hover:underline font-mono"
          >
            github.com/yashsingh-dev/Secure-Vault
            <HiOutlineArrowTopRightOnSquare className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
