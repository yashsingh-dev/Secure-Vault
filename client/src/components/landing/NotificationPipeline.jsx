import React, { useState } from 'react';
import {
  HiOutlineEnvelope,
  HiOutlineQueueList,
  HiOutlineCpuChip,
  HiOutlineArrowPath,
  HiOutlineShieldCheck,
  HiOutlineKey,
  HiOutlineExclamationTriangle,
  HiOutlineSparkles,
  HiOutlineCheckCircle,
  HiOutlineArrowRight,
  HiOutlineHeart,
  HiOutlineClock,
  HiBolt,
  HiOutlineServerStack
} from 'react-icons/hi2';
import QueueAnimationSimulator from './QueueAnimationSimulator';

export default function NotificationPipeline({ theme = 'dark' }) {
  const isDark = theme === 'dark';
  const [activeDriver, setActiveDriver] = useState('custom'); // 'custom' | 'bullmq'
  const [selectedEvent, setSelectedEvent] = useState('otp'); // 'otp' | 'reset' | 'login' | 'welcome'

  const NOTIFICATION_EVENTS = [
    {
      id: 'otp',
      title: 'OTP Verification Code',
      icon: HiOutlineShieldCheck,
      priority: 'HIGH',
      priorityColor: 'emerald',
      ttl: '900s (15m)',
      payloadSample: '{ otp: 849201, userId: "66f4a8..." }',
      description: 'Time-critical multi-factor security code. Dispatched asynchronously so HTTP authentication endpoints respond in < 15ms.',
      protection: 'Auto-cleared from DB & Redis on DLQ delivery exhaustion.'
    },
    {
      id: 'reset',
      title: 'Password Reset Token',
      icon: HiOutlineKey,
      priority: 'HIGH',
      priorityColor: 'emerald',
      ttl: '900s (15m)',
      payloadSample: '{ tokenHash: "e3b0c4...", time: "UTC" }',
      description: 'Cryptographic single-use token link for emergency account recovery. Priority execution over background email traffic.',
      protection: 'Strict single-use invalidation upon execution.'
    },
    {
      id: 'login',
      title: 'Suspicious Login Alert',
      icon: HiOutlineExclamationTriangle,
      priority: 'LOW',
      priorityColor: 'cyan',
      ttl: '86400s (24h)',
      payloadSample: '{ ip: "203.0.113.195", device: "MacBook Pro" }',
      description: 'Real-time telemetry alert triggered on new device or IP detection. Batched in the low-priority queue to protect OTP bandwidth.',
      protection: 'Includes device, IP, and UTC timestamp audit logs.'
    },
    {
      id: 'welcome',
      title: 'Welcome & Onboarding',
      icon: HiOutlineSparkles,
      priority: 'LOW',
      priorityColor: 'cyan',
      ttl: '86400s (24h)',
      payloadSample: '{ name: "Alex", dashboardUrl: "/dashboard" }',
      description: 'New account onboarding message. Queued behind real-time security challenges with graceful background worker delivery.',
      protection: 'Idempotent delivery preventing duplicate welcomes.'
    }
  ];

  const CUSTOM_QUEUE_SPECS = [
    {
      title: 'Atomic Token Reservation via Lua',
      icon: HiBolt,
      tag: 'ACQUIRE_TOKENS_LUA',
      color: 'amber',
      detail: 'Worker nodes atomically claim dispatch tokens from Redis for the current second bucket (capped at 10 emails/sec). Unused tokens from empty queues are immediately refunded via DECRBY so other pods can utilize the quota.'
    },
    {
      title: 'Crash-Safe Atomic Dequeue (RPOPLPUSH)',
      icon: HiOutlineQueueList,
      tag: 'Zero-Job-Loss Guarantee',
      color: 'emerald',
      detail: 'Jobs are transferred from pending priority lists to queue:email:processing in a single atomic Redis command. If a worker pod crashes mid-flight during SMTP delivery, jobs remain safely stranded in processing for recovery.'
    },
    {
      title: 'Distributed Heartbeat & Auto-Recovery',
      icon: HiOutlineHeart,
      tag: 'queue:email:heartbeat (5s TTL)',
      color: 'red',
      detail: 'Living workers write a 5-second TTL heartbeat. When a restarting instance spins up, it only triggers stranded-job recovery if no active heartbeat is detected—preventing live in-flight jobs from being stolen by peers.'
    },
    {
      title: 'Weighted Priority Scheduling',
      icon: HiOutlineCpuChip,
      tag: '70% High / 30% Low Ratio',
      color: 'cyan',
      detail: 'Worker loops allocate token quotas dynamically between high and low priority lists. If the high-priority queue is empty, low-priority jobs (welcome, alerts) are allowed to borrow the remaining unused capacity.'
    },
    {
      title: 'Time-To-Live Expiration Guard',
      icon: HiOutlineClock,
      tag: 'Drop Expired Backlog',
      color: 'purple',
      detail: 'Before dispatch, workers verify job.expiresAt against Date.now(). If a surge delayed an OTP beyond its 15-minute validity window, the stale code is dropped rather than delivering an already-expired code to the user.'
    },
    {
      title: 'DLQ with Automatic State Rollback',
      icon: HiOutlineArrowPath,
      tag: '3x Retries → DLQ + DB Rollback',
      color: 'emerald',
      detail: 'Permanent SMTP delivery failures after 3 attempts are routed to queue:email:dlq with error traces. Critically, the worker automatically rolls back the user’s OTP state in MongoDB & Redis so the user is never trapped in a cooldown lock.'
    }
  ];

  const BULLMQ_SPECS = [
    {
      title: 'Stream-Backed Numerical Priority',
      icon: HiOutlineQueueList,
      tag: 'Priority 1 (High) vs 2 (Low)',
      color: 'cyan',
      detail: 'Jobs are indexed in Redis Streams and sorted sets using BullMQ’s native numerical priority flags. Security-sensitive OTPs (Priority 1) immediately preempt non-urgent marketing or login alert events (Priority 2).'
    },
    {
      title: 'Worker Concurrency Pools',
      icon: HiOutlineServerStack,
      tag: 'concurrency: 20 Parallel Streams',
      color: 'emerald',
      detail: 'The BullMQ worker maintains a concurrency pool of 20 parallel async event streams. High-throughput bursts are handled concurrently while maintaining distributed locks against Redis.'
    },
    {
      title: 'Sliding Token Bucket Limiter',
      icon: HiBolt,
      tag: 'limiter: { max: 7, duration: 1000 }',
      color: 'amber',
      detail: 'BullMQ enforces a distributed rate limiter directly at the worker level. Regardless of how many worker threads or cluster nodes exist, total SMTP calls never exceed 7 requests per second.'
    },
    {
      title: 'Exponential Backoff Engine',
      icon: HiOutlineArrowPath,
      tag: 'backoff: { exponential, 1000ms }',
      color: 'purple',
      detail: 'On transient SMTP transport failures, BullMQ delays job retries with exponential backoff (1s, 2s, 4s). This avoids hammering mail providers during upstream outages.'
    },
    {
      title: 'Job State Retention & Inspection',
      icon: HiOutlineClock,
      tag: 'removeOnComplete: 100, removeOnFail: false',
      color: 'cyan',
      detail: 'Successfully processed jobs retain the last 100 records for diagnostic metrics, while failed jobs are permanently preserved in the failed set for post-mortem debugging and admin inspection.'
    },
    {
      title: 'Event-Driven Telemetry & State Rollback',
      icon: HiOutlineShieldCheck,
      tag: 'worker.on("failed") Rollback',
      color: 'emerald',
      detail: 'Subscribes to native BullMQ lifecycle events (completed, failed, error). If an OTP job exhausts max attempts, the failed event listener automatically resets the user OTP state in MongoDB and Redis.'
    }
  ];

  const activeEventData = NOTIFICATION_EVENTS.find(e => e.id === selectedEvent) || NOTIFICATION_EVENTS[0];

  // Dynamic Pipeline Steps based on selected Driver
  const customSteps = [
    {
      step: '01',
      title: 'API Non-Blocking Push',
      meta: '< 15ms Response',
      detail: 'HTTP controller creates job and immediately returns 200 OK without waiting for SMTP.'
    },
    {
      step: '02',
      title: 'Priority LPUSH',
      meta: `queue:${activeEventData.priority.toLowerCase()}`,
      detail: `Pushed into Redis primitive list: ${activeEventData.priority === 'HIGH' ? 'queue:email:high' : 'queue:email:low'}.`
    },
    {
      step: '03',
      title: 'Lua Rate Limit Reservation',
      meta: 'Max 10 / sec (Refundable)',
      detail: 'Worker calls ACQUIRE_TOKENS_LUA to reserve tokens. Unused tokens refunded via DECRBY.'
    },
    {
      step: '04',
      title: 'Atomic RPOPLPUSH Transfer',
      meta: 'queue:email:processing',
      detail: 'Single-roundtrip transfer to in-flight processing list. Guarantees zero lost jobs on worker crash.'
    },
    {
      step: '05',
      title: 'LREM Ack or DLQ Rollback',
      meta: '3x Retries → DLQ + DB Reset',
      detail: 'Acknowledged via LREM on success. Permanent failure clears OTP in MongoDB & Redis.'
    }
  ];

  const bullmqSteps = [
    {
      step: '01',
      title: 'Queue Producer Dispatch',
      meta: 'emailQueue.add()',
      detail: 'Enqueues job into BullMQ singleton queue with default retry and backoff configurations.'
    },
    {
      step: '02',
      title: 'Numerical Priority Sorting',
      meta: `Priority: ${activeEventData.priority === 'HIGH' ? '1 (High)' : '2 (Low)'}`,
      detail: 'BullMQ indexes job in Redis Streams with numerical priority order (1 = highest urgency).'
    },
    {
      step: '03',
      title: 'Native Sliding Limiter',
      meta: 'limiter: { max: 7, 1000ms }',
      detail: 'BullMQ worker limiter throttles execution across all distributed instances automatically.'
    },
    {
      step: '04',
      title: 'Concurrent Worker Pool',
      meta: 'concurrency: 20 Streams',
      detail: 'Async worker executes dispatchEmailJob inside a non-blocking pool of 20 concurrent threads.'
    },
    {
      step: '05',
      title: 'worker.on("failed") Event',
      meta: 'Exponential Backoff (1s, 2s, 4s)',
      detail: 'Automated retry with exponential backoff. Failed listener resets MongoDB OTP state upon exhaustion.'
    }
  ];

  const currentSteps = activeDriver === 'custom' ? customSteps : bullmqSteps;
  const currentSpecs = activeDriver === 'custom' ? CUSTOM_QUEUE_SPECS : BULLMQ_SPECS;

  return (
    <section id="notification-pipeline" className={`w-full max-w-7xl 2xl:max-w-[94rem] mx-auto font-sans transition-colors duration-300 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
      {/* Section Header */}
      <div className="mb-14 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-mono uppercase tracking-wider border mb-4 border-cyan-500/20 bg-cyan-500/5 text-cyan-400">
          <HiOutlineEnvelope className="w-3.5 h-3.5" />
          <span>Asynchronous Messaging & Queue Engine</span>
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
          Dual-Driver Notification Pipeline
        </h2>
        <p className={`text-base sm:text-lg font-mono ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Decoupled asynchronous notification delivery powered by an in-house Redis queue and enterprise BullMQ worker.
        </p>

        {/* Interactive Driver Selector Pill */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="inline-flex p-1.5 rounded-2xl border font-mono text-xs transition-all shadow-lg bg-black/40 border-white/10">
            <button
              onClick={() => setActiveDriver('custom')}
              className={`px-5 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2.5 cursor-pointer ${
                activeDriver === 'custom'
                  ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)] scale-102 z-10'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${activeDriver === 'custom' ? 'bg-white animate-pulse' : 'bg-slate-600'}`} />
              <span>In-House Custom Redis Queue (Built From Scratch)</span>
            </button>

            <button
              onClick={() => setActiveDriver('bullmq')}
              className={`px-5 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2.5 cursor-pointer ${
                activeDriver === 'bullmq'
                  ? 'bg-cyan-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] scale-102 z-10'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${activeDriver === 'bullmq' ? 'bg-white animate-pulse' : 'bg-slate-600'}`} />
              <span>BullMQ Enterprise Worker</span>
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-12">
        {/* 1. Notification Event Types (4 Cards) */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="font-mono text-xs uppercase tracking-wider text-slate-500 font-semibold">
              Supported Notification Event Types
            </span>
            <span className="font-mono text-[11px] text-emerald-400">
              Zero-Blocking HTTP Dispatch (&lt; 15ms)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {NOTIFICATION_EVENTS.map((event) => {
              const Icon = event.icon;
              const isSelected = selectedEvent === event.id;

              return (
                <button
                  key={event.id}
                  onClick={() => setSelectedEvent(event.id)}
                  className={`text-left p-4 rounded-xl border transition-all duration-200 relative group cursor-pointer ${
                    isSelected
                      ? isDark
                        ? 'bg-[#151522] border-emerald-500 ring-1 ring-emerald-500 shadow-[0_0_20px_rgba(34,197,94,0.15)]'
                        : 'bg-white border-emerald-500 ring-1 ring-emerald-500 shadow-md'
                      : isDark
                        ? 'bg-[#101018] border-white/5 hover:border-white/15 text-slate-300'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2 rounded-lg ${
                      isSelected
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className={`font-mono text-[10px] px-2 py-0.5 rounded uppercase font-bold ${
                      event.priority === 'HIGH'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    }`}>
                      {event.priority}
                    </span>
                  </div>

                  <h3 className={`text-sm font-semibold mb-1 ${isSelected ? (isDark ? 'text-white' : 'text-slate-900') : ''}`}>
                    {event.title}
                  </h3>
                  <div className="font-mono text-[11px] text-slate-500 mb-2">
                    TTL: {event.ttl}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {event.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Interactive Job Traversal Flow (Dynamically updates with driver!) */}
        <div className={`p-6 rounded-2xl border transition-all duration-300 ${
          isDark ? 'bg-[#11111a] border-white/10' : 'bg-white border-slate-200 shadow-md'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <HiOutlineArrowRight className={`w-4 h-4 ${activeDriver === 'custom' ? 'text-emerald-400' : 'text-cyan-400'}`} />
              <span className="font-mono text-xs uppercase font-semibold">
                Execution Trace for: <strong className={activeDriver === 'custom' ? 'text-emerald-400' : 'text-cyan-400'}>{activeEventData.title}</strong>
              </span>
            </div>
            <div className="font-mono text-xs flex items-center gap-2">
              <span className="text-slate-400">Driver Implementation:</span>
              <code className={`px-2 py-0.5 rounded font-bold ${
                activeDriver === 'custom' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
              }`}>
                {activeDriver === 'custom' ? 'custom/producer.js + worker.js' : 'bullmq/producer.js + worker.js'}
              </code>
            </div>
          </div>

          {/* 5-Step Traversal Visual (Responsive Grid) */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs font-mono">
            {currentSteps.map((s, idx) => (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border transition-all duration-200 ${
                  isDark ? 'bg-black/30 border-white/5' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <span className="text-[10px] text-slate-500 uppercase block mb-1">
                  Step {s.step}
                </span>
                <div className="font-bold text-white mb-1">
                  {s.title}
                </div>
                <div className={`text-[11px] font-semibold mb-2 ${
                  activeDriver === 'custom' ? 'text-emerald-400' : 'text-cyan-400'
                }`}>
                  {s.meta}
                </div>
                <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                  {s.detail}
                </p>
              </div>
            ))}
          </div>

          {/* Active Driver Command Preview */}
          <div className={`mt-5 p-3.5 rounded-xl border font-mono text-[11px] flex flex-wrap items-center justify-between gap-2 ${
            isDark ? 'bg-black/50 border-white/5' : 'bg-slate-100 border-slate-200'
          }`}>
            <div className="flex items-center gap-2 text-slate-400">
              <span className="text-amber-400 font-bold">// Engine Syntax:</span>
              {activeDriver === 'custom' ? (
                <span>redis.lpush(queue) → redis.eval(ACQUIRE_TOKENS_LUA) → redis.rpoplpush(queue, proc)</span>
              ) : (
                <span>emailQueue.add(type, payload, opts) → Worker('email', handler, &#123; concurrency: 20, limiter &#125;)</span>
              )}
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
              activeDriver === 'custom' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-cyan-500/10 text-cyan-400'
            }`}>
              {activeDriver === 'custom' ? 'Zero 3rd-Party Dependencies' : 'Redis Streams Architecture'}
            </span>
          </div>
        </div>

        {/* 2.5 Live Multi-Queue Dispatch Simulator (Tri-Queue Architecture & Quota Math) */}
        <QueueAnimationSimulator theme={theme} />

        {/* 3. Deep-Dive: Architecture Showcase (Dynamically transforms with driver!) */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <div className={`inline-flex items-center gap-2 rounded-full px-3 py-0.5 text-xs font-mono uppercase tracking-wider border mb-2 ${
                activeDriver === 'custom'
                  ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                  : 'border-cyan-500/20 bg-cyan-500/5 text-cyan-400'
              }`}>
                <span>{activeDriver === 'custom' ? 'Core In-House Engineering Showcase' : 'Industrial Background Job Engine'}</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
                {activeDriver === 'custom' ? 'In-House Queue Architecture (Built Purely in Redis)' : 'BullMQ Enterprise Worker Architecture (Redis Streams)'}
              </h3>
            </div>
            <span className="font-mono text-xs text-slate-500">
              {activeDriver === 'custom' ? '6 Custom Distributed Systems Primitives' : 'Enterprise Redis Streams Engine'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {currentSpecs.map((spec, idx) => {
              const Icon = spec.icon;

              return (
                <div
                  key={idx}
                  className={`p-5 rounded-2xl border flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 ${
                    isDark ? 'bg-[#12121c] border-white/10 hover:border-white/20' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className={`p-2 rounded-xl ${
                        activeDriver === 'custom' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-cyan-500/10 text-cyan-400'
                      }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <code className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400">
                        {spec.tag}
                      </code>
                    </div>

                    <h4 className="text-sm font-semibold mb-2">
                      {spec.title}
                    </h4>

                    <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {spec.detail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Architectural Comparison: In-House vs BullMQ */}
        <div className={`p-6 rounded-2xl border transition-all ${
          isDark 
            ? 'bg-gradient-to-r from-[#12121e] to-[#0e1017] border-white/10' 
            : 'bg-slate-50 border-slate-200 shadow-sm'
        }`}>
          <div className="flex items-center gap-2 mb-4">
            <HiOutlineCheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="font-semibold text-sm">
              Unified Facade Adapter Pattern (<code className="font-mono text-xs text-emerald-400">emailNotificationService</code>)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs leading-relaxed">
            <div className={`p-4 rounded-xl border transition-all ${
              activeDriver === 'custom'
                ? isDark ? 'bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : 'bg-emerald-50 border-emerald-400'
                : isDark ? 'bg-black/20 border-white/5' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <strong className="text-emerald-400 font-mono text-sm">Driver A: In-House Custom Queue</strong>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Custom Lua + LPUSH
                </span>
              </div>
              <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                Engineered with pure Redis primitive lists and atomic Lua scripting. Gives 100% control over token refunding, stranded in-flight job recovery, and custom database state rollback on DLQ exhaustion with zero package bloat.
              </p>
            </div>

            <div className={`p-4 rounded-xl border transition-all ${
              activeDriver === 'bullmq'
                ? isDark ? 'bg-cyan-500/10 border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.1)]' : 'bg-cyan-50 border-cyan-400'
                : isDark ? 'bg-black/20 border-white/5' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <strong className="text-cyan-400 font-mono text-sm">Driver B: BullMQ Enterprise Worker</strong>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Redis Streams
                </span>
              </div>
              <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                Industrial-grade background job engine leveraging Redis Streams. Provides native numerical job priorities, delayed scheduling, distributed locks, and automated event telemetry across horizontal worker clusters.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
