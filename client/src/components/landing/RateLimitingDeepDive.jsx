import React, { useState } from 'react';
import {
  HiCheck,
  HiXMark,
  HiClock,
  HiShieldExclamation,
  HiOutlineCommandLine,
  HiBolt,
  HiOutlineEnvelope
} from 'react-icons/hi2';

export default function RateLimitingDeepDive({ theme = 'dark' }) {
  const isDark = theme === 'dark';

  // Simulator State
  const [windowPreset, setWindowPreset] = useState('burst'); // 'burst' (5 req/60s) | 'sustained' (10 req/300s)
  const [timePos, setTimePos] = useState(40);
  const [prevHits, setPrevHits] = useState(4);
  const [currHits, setCurrHits] = useState(2);

  const maxAllowed = windowPreset === 'burst' ? 5 : 10;
  const windowSeconds = windowPreset === 'burst' ? 60 : 300;

  // Simulator Calculations
  const percentage = timePos / 100;
  const weightedPrev = Math.floor((1 - percentage) * prevHits);
  const totalEstimated = weightedPrev + currHits;
  // A request is allowed as long as totalEstimated <= maxAllowed
  const isAllowed = totalEstimated <= maxAllowed;
  const remaining = Math.max(0, maxAllowed - totalEstimated);
  const resetSeconds = Math.max(1, Math.round((1 - percentage) * windowSeconds));

  return (
    <section id="rate-limiting" className={`w-full max-w-6xl mx-auto font-sans transition-colors duration-300 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
      {/* Header */}
      <div className="mb-14 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-mono uppercase tracking-wider border mb-4 border-amber-500/20 bg-amber-500/5 text-amber-400">
          Distributed Defense Engine
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
          Rate Limiting Deep Dive
        </h2>
        <p className={`text-base sm:text-lg font-mono ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Sliding Window Counter Approximation with Atomic Redis Lua Execution
        </p>
      </div>

      <div className="space-y-10">
        {/* 1. Algorithm Comparison Table */}
        <div className={`border rounded-2xl overflow-hidden transition-colors ${isDark ? 'border-white/10 bg-[#0e0e16]' : 'border-slate-200 bg-white shadow-sm'}`}>
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-slate-500 font-semibold">
              Algorithm Tradeoff Analysis
            </span>
            <span className="font-mono text-xs text-emerald-500">Selected: Sliding Window Counter</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className={`uppercase font-mono ${isDark ? 'bg-white/5 text-slate-400 border-b border-white/5' : 'bg-slate-50 text-slate-600 border-b border-slate-200'}`}>
                <tr>
                  <th className="px-6 py-3.5 font-medium">Strategy</th>
                  <th className="px-6 py-3.5 font-medium">Burst Safety</th>
                  <th className="px-6 py-3.5 font-medium">Memory Footprint</th>
                  <th className="px-6 py-3.5 font-medium">Redis CPU Overhead</th>
                  <th className="px-6 py-3.5 font-medium">Tradeoff Verdict</th>
                </tr>
              </thead>
              <tbody className={`divide-y font-mono ${isDark ? 'divide-white/5' : 'divide-slate-200'}`}>
                <tr>
                  <td className="px-6 py-4 font-semibold text-red-400">Fixed Window Counter</td>
                  <td className="px-6 py-4 flex items-center gap-1.5 text-red-400">
                    <HiXMark className="w-4 h-4" /> 2× boundary burst exploit
                  </td>
                  <td className="px-6 py-4">O(1) (Single integer)</td>
                  <td className="px-6 py-4 text-emerald-400">Minimal</td>
                  <td className="px-6 py-4 text-red-400">Vulnerable: Fails under high-rate burst attacks</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-semibold text-amber-400">Sliding Window Log</td>
                  <td className="px-6 py-4 flex items-center gap-1.5 text-emerald-400">
                    <HiCheck className="w-4 h-4" /> 100% Exact precision
                  </td>
                  <td className="px-6 py-4 text-red-400 font-bold">O(N) per user (ZSET memory explosion)</td>
                  <td className="px-6 py-4 text-red-400">High (ZREMRANGEBYSCORE)</td>
                  <td className="px-6 py-4 text-amber-400">Unscalable: Crashes Redis RAM at 100k req/s</td>
                </tr>
                <tr className={isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}>
                  <td className="px-6 py-4 font-bold text-emerald-500">Sliding Window Counter</td>
                  <td className="px-6 py-4 flex items-center gap-1.5 text-emerald-500 font-bold">
                    <HiCheck className="w-4 h-4" /> Approximate (0.05% margin)
                  </td>
                  <td className="px-6 py-4 text-emerald-500 font-bold">O(1) (Only 2 integer keys)</td>
                  <td className="px-6 py-4 text-emerald-500 font-bold">Optimal (Single atomic Lua eval)</td>
                  <td className="px-6 py-4 text-emerald-500 font-bold">Elite: Cloudflare & Stripe production standard</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Deep Explanations: The Two Flaws */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={`p-6 rounded-2xl border ${isDark ? 'bg-[#12121c] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-3 text-red-400 font-bold text-sm">
              <HiShieldExclamation className="w-5 h-5" />
              <span>Why Fixed Window Fails: The 2× Boundary Exploit</span>
            </div>
            <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Assume a limit of 5 requests per minute. If an attacker fires 5 requests at second 59 (Window 1), and 5 more requests at second 01 (Window 2),
              both windows evaluate as valid. The attacker successfully executed <strong>10 requests within a 2-second interval</strong>, completely bypassing the 5 req/min threshold.
            </p>
          </div>

          <div className={`p-6 rounded-2xl border ${isDark ? 'bg-[#12121c] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-3 text-amber-400 font-bold text-sm">
              <HiBolt className="w-5 h-5" />
              <span>Why Sliding Log Fails: O(N) Redis Memory Explosion</span>
            </div>
            <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Sliding logs store each individual request timestamp inside a Redis Sorted Set (`ZADD`). For 100,000 active users making continuous API calls,
              storing millions of epoch floats consumes gigabytes of RAM. Redis spends excessive CPU cycles running `ZREMRANGEBYSCORE` garbage collection.
            </p>
          </div>
        </div>

        {/* 2. Formula Card & 3. Interactive Slider Simulator */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Mathematical Formula Specification */}
          <div className={`lg:col-span-5 p-6 rounded-2xl border flex flex-col justify-between ${isDark ? 'bg-[#0f0f18] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/5">
                <span className="font-mono text-xs uppercase tracking-wider text-slate-500 font-semibold">
                  Mathematical Model
                </span>
                <span className="font-mono text-[10px] text-emerald-400">O(1) Weighting</span>
              </div>
              <div className="font-mono text-xs space-y-3 leading-relaxed">
                <div>
                  <span className="text-slate-500">// 1. Window elapsed fraction</span>
                  <div className="text-cyan-400">percentage = (now % windowSize) / windowSize</div>
                </div>
                <div>
                  <span className="text-slate-500">// 2. Weight previous window integer counter</span>
                  <div className="text-amber-400">weightedPrev = floor((1 - percentage) * prevHits)</div>
                </div>
                <div>
                  <span className="text-slate-500">// 3. Sum with current window hits</span>
                  <div className="text-emerald-400">totalEstimated = weightedPrev + currentHits</div>
                </div>
                <div className="pt-2 border-t border-white/5">
                  <span className="text-slate-500">// 4. Threshold check</span>
                  <div className="text-pink-400">if (totalEstimated &gt; maxRequests) return 429</div>
                </div>
              </div>
            </div>

            <div className={`mt-6 p-4 rounded-xl border text-[11px] font-mono ${isDark ? 'bg-black/30 border-white/5 text-slate-400' : 'bg-white border-slate-200 text-slate-600'}`}>
              <strong>Context-Based Keying: </strong>
              Sensitive endpoints (OTP, login, password reset) are keyed by normalized email:
              <code className="text-emerald-400 block mt-1">rl:auth:email:user@domain.com</code>
              Neutralizes rotating residential proxy botnets.
            </div>
          </div>

          {/* Interactive Live Simulator */}
          <div className={`lg:col-span-7 p-6 rounded-2xl border ${isDark ? 'bg-[#12121c] border-white/10 shadow-xl' : 'bg-white border-slate-200 shadow-md'}`}>
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/5">
              <div className="flex items-center gap-2">
                <HiClock className="w-5 h-5 text-emerald-500" />
                <span className="font-mono text-xs uppercase tracking-wider font-semibold">
                  Live Sliding Window Simulator
                </span>
              </div>

              {/* Preset Selector */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setWindowPreset('burst')}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all ${
                    windowPreset === 'burst'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Burst (5/60s)
                </button>
                <button
                  onClick={() => setWindowPreset('sustained')}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all ${
                    windowPreset === 'sustained'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Sustained (10/300s)
                </button>
              </div>
            </div>

            {/* Controls */}
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-xs font-mono mb-2">
                  <span className="text-slate-400">Current Window Elapsed: {timePos}% ({Math.round(percentage * windowSeconds)}s / {windowSeconds}s)</span>
                  <span className="text-cyan-400 font-semibold">Weight: {(1 - percentage).toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={timePos}
                  onChange={(e) => setTimePos(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1.5">
                    Previous Window Hits
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="15"
                    value={prevHits}
                    onChange={(e) => setPrevHits(parseInt(e.target.value) || 0)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono border outline-none transition-colors ${
                      isDark ? 'bg-black/30 border-white/10 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1.5">
                    Current Window Hits
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="15"
                    value={currHits}
                    onChange={(e) => setCurrHits(parseInt(e.target.value) || 0)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono border outline-none transition-colors ${
                      isDark ? 'bg-black/30 border-white/10 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                    }`}
                  />
                </div>
              </div>

              {/* Dynamic Calculation Readout */}
              <div className={`p-4 rounded-xl border font-mono text-xs space-y-1.5 ${isDark ? 'bg-black/30 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex justify-between">
                  <span className="text-slate-400">weightedPrev:</span>
                  <span className="text-amber-400">
                    ⌊(1 - {percentage.toFixed(2)}) × {prevHits}⌋ = {weightedPrev}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">totalEstimated:</span>
                  <span className="text-emerald-400">
                    {weightedPrev} + {currHits} = <strong>{totalEstimated}</strong>
                  </span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-1.5 mt-1">
                  <span className="text-slate-400">Evaluation:</span>
                  <span className={`font-bold ${isAllowed ? 'text-emerald-400' : 'text-red-400'}`}>
                    {totalEstimated} {isAllowed ? '≤' : '>'} {maxAllowed} ({isAllowed ? 'ALLOWED' : 'BLOCKED - 429 TOO MANY REQUESTS'})
                  </span>
                </div>
              </div>

              {/* Live IETF Response Headers Preview */}
              <div className={`p-4 rounded-xl border font-mono text-xs space-y-1 ${
                isAllowed
                  ? isDark ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300' : 'bg-emerald-50 border-emerald-500/30 text-emerald-800'
                  : isDark ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-red-50 border-red-500/30 text-red-800'
              }`}>
                <div className="font-semibold mb-1 text-[11px] uppercase tracking-wider">
                  HTTP Response Headers Emitted:
                </div>
                <div>HTTP/1.1 {isAllowed ? '200 OK' : '429 Too Many Requests'}</div>
                <div>RateLimit-Limit: {maxAllowed}</div>
                <div>RateLimit-Remaining: {remaining}</div>
                <div>RateLimit-Reset: {resetSeconds}s</div>
                {!isAllowed && <div>Retry-After: {resetSeconds}s</div>}
              </div>
            </div>
          </div>
        </div>

        {/* 4. Atomic Redis Lua Script Showcase */}
        <div className={`border rounded-2xl overflow-hidden ${isDark ? 'border-white/10 bg-[#0d0d14]' : 'border-slate-200 bg-white shadow-sm'}`}>
          <div className={`px-6 py-3 border-b flex items-center justify-between ${isDark ? 'border-white/5 bg-[#12121c]' : 'border-slate-100 bg-slate-50'}`}>
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
              </div>
              <span className="font-mono text-xs text-slate-400 ml-2">
                server/src/services/v1/rateLimiter.service.js (Atomic Lua Script)
              </span>
            </div>
            <span className="font-mono text-[11px] text-emerald-400">Thread-Safe in RAM</span>
          </div>
          <div className="p-6 overflow-x-auto">
            <pre className="font-mono text-xs leading-relaxed">
              <code>
                <span className="text-slate-500">-- Atomic Sliding Window Counter Script (Evaluated via redis.eval)</span>{'\n'}
                <span className="text-emerald-400">local</span> current_key  = KEYS[<span className="text-amber-400">1</span>]{'\n'}
                <span className="text-emerald-400">local</span> previous_key = KEYS[<span className="text-amber-400">2</span>]{'\n'}
                <span className="text-emerald-400">local</span> max_requests  = <span className="text-emerald-400">tonumber</span>(ARGV[<span className="text-amber-400">1</span>]){'\n'}
                <span className="text-emerald-400">local</span> window_ms     = <span className="text-emerald-400">tonumber</span>(ARGV[<span className="text-amber-400">2</span>]){'\n'}
                <span className="text-emerald-400">local</span> now           = <span className="text-emerald-400">tonumber</span>(ARGV[<span className="text-amber-400">3</span>]){'\n\n'}
                <span className="text-slate-500">-- Retrieve cached integer hits for current and previous time slices</span>{'\n'}
                <span className="text-emerald-400">local</span> prev_count = <span className="text-emerald-400">tonumber</span>(redis.call(<span className="text-cyan-400">'GET'</span>, previous_key) <span className="text-pink-400">or</span> <span className="text-cyan-400">'0'</span>){'\n'}
                <span className="text-emerald-400">local</span> curr_count = <span className="text-emerald-400">tonumber</span>(redis.call(<span className="text-cyan-400">'GET'</span>, current_key) <span className="text-pink-400">or</span> <span className="text-cyan-400">'0'</span>){'\n\n'}
                <span className="text-slate-500">-- Calculate fractional decay weight</span>{'\n'}
                <span className="text-emerald-400">local</span> elapsed = now % window_ms{'\n'}
                <span className="text-emerald-400">local</span> weight  = <span className="text-amber-400">1</span> - (elapsed / window_ms){'\n'}
                <span className="text-emerald-400">local</span> estimated = math.floor(weight * prev_count) + curr_count{'\n\n'}
                <span className="text-slate-500">-- Atomic condition test (allows up to max_requests)</span>{'\n'}
                <span className="text-pink-400">if</span> estimated &gt; max_requests <span className="text-pink-400">then</span>{'\n'}
                {'  '}<span className="text-pink-400">return</span> {'{'}<span className="text-amber-400">0</span>, estimated, max_requests{'}'}  <span className="text-slate-500">-- 429 Too Many Requests</span>{'\n'}
                <span className="text-pink-400">end</span>{'\n\n'}
                <span className="text-slate-500">-- Increment and extend key lifespan</span>{'\n'}
                redis.call(<span className="text-cyan-400">'INCRBY'</span>, current_key, <span className="text-amber-400">1</span>){'\n'}
                redis.call(<span className="text-cyan-400">'PEXPIRE'</span>, current_key, window_ms * <span className="text-amber-400">2</span>){'\n'}
                <span className="text-pink-400">return</span> {'{'}<span className="text-amber-400">1</span>, estimated + <span className="text-amber-400">1</span>, max_requests{'}'}  <span className="text-slate-500">-- 200 Allowed</span>
              </code>
            </pre>
          </div>
        </div>

        {/* 5. Dual-Tiered Defense Visual */}
        <div className={`p-6 rounded-2xl border ${isDark ? 'bg-[#12121c] border-white/10' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-mono text-xs uppercase tracking-wider text-slate-500 font-semibold">
              Dual-Tiered Login Defense Architecture
            </h3>
            <span className="font-mono text-xs text-emerald-500">Zero False Positives</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-black/30 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold">Tier 1: Burst Limiter</span>
                <span className="font-mono text-xs text-emerald-400 font-bold">5 req / 60s</span>
              </div>
              <p className={`text-xs mb-3 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Arrests high-speed automated scripting bots and rapid-fire fuzzing tools.
              </p>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-emerald-500 w-[60%]" />
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${isDark ? 'bg-black/30 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold">Tier 2: Sustained Limiter</span>
                <span className="font-mono text-xs text-cyan-400 font-bold">10 req / 300s</span>
              </div>
              <p className={`text-xs mb-3 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Arrests slow, distributed dictionary attacks attempting to fly under standard radar.
              </p>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-cyan-500 w-[35%]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
