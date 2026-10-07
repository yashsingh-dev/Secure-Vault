import React from 'react';
import {
  HiOutlineQueueList,
  HiOutlineFingerPrint,
  HiOutlineUserGroup,
  HiOutlineGlobeAlt,
  HiOutlineSparkles,
  HiOutlineCpuChip
} from 'react-icons/hi2';

export const ROADMAP_ITEMS = [
  {
    title: 'Asynchronous OTP Dispatch Engine',
    subtitle: 'RabbitMQ / Message Queue & Worker Pool',
    status: 'In Pipeline',
    statusColor: 'emerald',
    icon: HiOutlineQueueList,
    phase: 'Phase 5.1',
    description: 'Decouple transactional email delivery from the synchronous HTTP request lifecycle. Dedicated dead-letter queues (DLQ) with exponential backoff retry workers ensure zero OTP delivery drops under mail service outages.',
    tags: ['RabbitMQ', 'AMQP 0-9-1', 'DLQ', 'Exponential Backoff', 'Worker Pool'],
    architectureDetails: 'HTTP endpoint produces message to exchanges in < 2ms; background consumers handle Resend/SMTP dispatch with circuit breaking.'
  },
  {
    title: 'Passkeys & WebAuthn / FIDO2',
    subtitle: 'Hardware-Backed Cryptographic Authentication',
    status: 'Research & PoC',
    statusColor: 'cyan',
    icon: HiOutlineFingerPrint,
    phase: 'Phase 5.2',
    description: 'Replace shared password secrets with public-key cryptography. Native platform authenticator support for TouchID, FaceID, Windows Hello, and YubiKey hardware tokens via the W3C WebAuthn standard.',
    tags: ['FIDO2', 'WebAuthn', 'Biometrics', 'Public-Key Auth', 'Hardware Tokens'],
    architectureDetails: 'Client challenges signed in device Secure Enclave; server verifies signature with stored public key cred ID.'
  },
  {
    title: 'Multi-Tenant Role-Based Access Control (RBAC)',
    subtitle: 'Hierarchical Permissions & Audit Streaming',
    status: 'Design Phase',
    statusColor: 'amber',
    icon: HiOutlineUserGroup,
    phase: 'Phase 5.3',
    description: 'Granular organization hierarchies with custom role matrices, inherited permission boundaries, and real-time SIEM audit log streaming for enterprise compliance (SOC 2, ISO 27001).',
    tags: ['RBAC', 'Multi-Tenant', 'Audit Log Streaming', 'Policy Engine', 'SOC-2'],
    architectureDetails: 'Tenant-scoped token family boundaries with policy enforcement evaluating in Redis RAM bitmap caches.'
  },
  {
    title: 'Enterprise Geo-Distributed Session Sharding',
    subtitle: 'Redis Cluster Multi-Region Replication',
    status: 'In Pipeline',
    statusColor: 'emerald',
    icon: HiOutlineGlobeAlt,
    phase: 'Phase 5.4',
    description: 'Multi-region Redis cluster replication with latency-based token family routing. Sub-5ms session validation from any global edge location with active-active write coordination.',
    tags: ['Redis Cluster', 'Multi-Region', 'Edge Routing', 'Active-Active', 'Sub-5ms'],
    architectureDetails: 'Global edge DNS routes user tokens to closest regional Redis shard with CRDT conflict resolution.'
  }
];

export default function FutureRoadmap({ theme = 'dark' }) {
  const isDark = theme === 'dark';

  const getStatusBadge = (color, text) => {
    if (color === 'emerald') {
      return (
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider ${
          isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-500/30'
        }`}>
          ● {text}
        </span>
      );
    }
    if (color === 'cyan') {
      return (
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider ${
          isDark ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-cyan-50 text-cyan-700 border border-cyan-500/30'
        }`}>
          ● {text}
        </span>
      );
    }
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider ${
        isDark ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-amber-50 text-amber-700 border border-amber-500/30'
      }`}>
        ● {text}
      </span>
    );
  };

  const getBorderAccent = (color) => {
    if (color === 'emerald') return isDark ? 'border-l-emerald-500' : 'border-l-emerald-600';
    if (color === 'cyan') return isDark ? 'border-l-cyan-500' : 'border-l-cyan-600';
    return isDark ? 'border-l-amber-500' : 'border-l-amber-600';
  };

  return (
    <section id="roadmap" className={`py-24 font-sans transition-colors duration-300 ${isDark ? 'bg-[#0a0a0f]' : 'bg-slate-50'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-mono uppercase tracking-wider border mb-4 border-emerald-500/20 bg-emerald-500/5 text-emerald-400">
              <HiOutlineSparkles className="w-3.5 h-3.5" />
              Scale & Evolution
            </div>
            <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Future Architecture & Pipeline
            </h2>
            <p className={`mt-2 text-sm sm:text-base font-mono ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Engineered with pluggable extensibility slots for enterprise hyperscale
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-slate-500">
            <HiOutlineCpuChip className="w-4 h-4 text-emerald-500" />
            <span>Active Roadmap: 4 Core Expansion Slots</span>
          </div>
        </div>

        {/* Modular Grid (2x2) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {ROADMAP_ITEMS.map((item, idx) => (
            <div
              key={idx}
              className={`relative flex flex-col p-6 rounded-2xl border border-l-4 transition-all duration-300 hover:-translate-y-1 ${getBorderAccent(item.statusColor)} ${
                isDark
                  ? 'bg-[#12121a] border-white/5 hover:border-white/15 hover:shadow-xl'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${
                    item.statusColor === 'emerald'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : item.statusColor === 'cyan'
                        ? 'bg-cyan-500/10 text-cyan-400'
                        : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="font-mono text-[10px] text-slate-500 uppercase tracking-wider block">
                      {item.phase}
                    </span>
                    <h3 className={`text-base font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {item.title}
                    </h3>
                  </div>
                </div>

                {getStatusBadge(item.statusColor, item.status)}
              </div>

              {/* Subtitle & Description */}
              <div className="mb-4 flex-1">
                <div className={`font-mono text-xs mb-2 ${
                  item.statusColor === 'emerald'
                    ? 'text-emerald-400'
                    : item.statusColor === 'cyan'
                      ? 'text-cyan-400'
                      : 'text-amber-400'
                }`}>
                  {item.subtitle}
                </div>
                <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {item.description}
                </p>

                {/* Architecture Blueprint Note */}
                <div className={`mt-3 p-3 rounded-xl border text-[11px] font-mono leading-relaxed ${
                  isDark ? 'bg-black/30 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}>
                  <strong className={isDark ? 'text-slate-300' : 'text-slate-700'}>System Blueprint: </strong>
                  {item.architectureDetails}
                </div>
              </div>

              {/* Tech Tags */}
              <div className="flex flex-wrap gap-1.5 pt-3 border-t border-black/5 dark:border-white/5 mt-auto">
                {item.tags.map((tag, tagIdx) => (
                  <span
                    key={tagIdx}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                      isDark
                        ? 'border-white/5 bg-white/5 text-slate-400'
                        : 'border-slate-200 bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
