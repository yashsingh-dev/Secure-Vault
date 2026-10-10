import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  HiOutlinePlay,
  HiOutlinePause,
  HiOutlineArrowPath,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiBolt,
  HiOutlineQueueList,
  HiOutlineClock,
  HiOutlineServerStack,
  HiOutlineXMark,
  HiOutlineInformationCircle
} from 'react-icons/hi2';

export default function QueueAnimationSimulator({ theme = 'dark' }) {
  const isDark = theme === 'dark';

  // 1. Fixed Compulsory System Rules (From server/src/config/constfants.js)
  const SYSTEM_CONFIG = {
    EMAIL_RATE_LIMIT_PER_SEC: 7,
    HIGH_PRIORITY_WEIGHT: 5,
    LOW_PRIORITY_WEIGHT: 2,
    MAX_ATTEMPTS: 3
  };

  // 2. User Input State (Predefined default: High = 10, Low = 8)
  const [inputHigh, setInputHigh] = useState(10);
  const [inputLow, setInputLow] = useState(8);

  // Parse numeric values safely
  const highCountNum = inputHigh === '' ? 0 : Math.max(0, parseInt(inputHigh, 10) || 0);
  const lowCountNum = inputLow === '' ? 0 : Math.max(0, parseInt(inputLow, 10) || 0);

  // Validation: cannot enter 0 into both queues, but can enter 0 into one of them
  const isValidInputs = !(highCountNum <= 0 && lowCountNum <= 0);

  // 3. Simulation & Queues State (Stopped/Idle by default)
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [status, setStatus] = useState('IDLE'); // 'IDLE' | 'ACQUIRING_TOKENS' | 'PROCESSING_PARALLEL' | 'BATCH_RESOLVED' | 'COMPLETED'
  const [simSeconds, setSimSeconds] = useState(0.0);
  const [currentCycle, setCurrentCycle] = useState(0);

  const [highQueue, setHighQueue] = useState([]);
  const [lowQueue, setLowQueue] = useState([]);
  const [processingQueue, setProcessingQueue] = useState([]); // All jobs running in parallel
  const [dlqQueue, setDlqQueue] = useState([]);
  const [deliveredCount, setDeliveredCount] = useState(0);

  // Parallel Progress (1.5s simulated third-party latency)
  const [parallelProgress, setParallelProgress] = useState(0);

  // Redis Token Bucket State
  const [bucketTokens, setBucketTokens] = useState(7);
  const [assignedTokensHigh, setAssignedTokensHigh] = useState(0);
  const [assignedTokensLow, setAssignedTokensLow] = useState(0);

  // Selectable Speeds (0.5x, 1x, 1.5x, 2x)
  const [speedMultiplier, setSpeedMultiplier] = useState(1);

  // Second-by-Second Stepper Logs
  const [secondEvents, setSecondEvents] = useState([
    {
      id: 'init-1',
      time: 'T = 0.0s',
      title: 'Engine Idle',
      detail: 'Configure input job counts above and click "Run Simulation" to execute.',
      type: 'info'
    }
  ]);

  // Synchronous State Refs to prevent closure staleness and re-render loops
  const highQueueRef = useRef([]);
  const lowQueueRef = useRef([]);
  const processingQueueRef = useRef([]);
  const parallelProgressRef = useRef(0);
  const dlqQueueRef = useRef([]);
  const deliveredCountRef = useRef(0);
  const simSecondsRef = useRef(0.0);
  const currentCycleRef = useRef(0);
  const speedMultiplierRef = useRef(1);

  useEffect(() => {
    speedMultiplierRef.current = speedMultiplier;
  }, [speedMultiplier]);

  // Add event helper (Preserve up to 150 events for complete scrollable audit trace)
  const recordEvent = useCallback((timeStr, title, detail, type = 'info') => {
    setSecondEvents(prev => [
      { id: Date.now() + Math.random(), time: timeStr, title, detail, type },
      ...prev.slice(0, 150)
    ]);
  }, []);

  // Initialize or Reset Queues from Input
  const initQueues = useCallback((highVal = inputHigh, lowVal = inputLow) => {
    const highCount = highVal === '' ? 0 : Math.max(0, parseInt(highVal, 10) || 0);
    const lowCount = lowVal === '' ? 0 : Math.max(0, parseInt(lowVal, 10) || 0);

    let id = 1;
    const initialHigh = Array.from({ length: highCount }, () => ({
      id: id++,
      priority: 'HIGH',
      attempts: 1,
      maxAttempts: SYSTEM_CONFIG.MAX_ATTEMPTS,
      willFail: false,
      isRetry: false
    }));

    const initialLow = Array.from({ length: lowCount }, () => ({
      id: id++,
      priority: 'LOW',
      attempts: 1,
      maxAttempts: SYSTEM_CONFIG.MAX_ATTEMPTS,
      willFail: false,
      isRetry: false
    }));

    // Update refs
    highQueueRef.current = initialHigh;
    lowQueueRef.current = initialLow;
    processingQueueRef.current = [];
    parallelProgressRef.current = 0;
    dlqQueueRef.current = [];
    deliveredCountRef.current = 0;
    simSecondsRef.current = 0.0;
    currentCycleRef.current = 0;

    // Update state
    setHighQueue(initialHigh);
    setLowQueue(initialLow);
    setProcessingQueue([]);
    setDlqQueue([]);
    setDeliveredCount(0);
    setSimSeconds(0.0);
    setCurrentCycle(0);
    setParallelProgress(0);
    setBucketTokens(7);
    setAssignedTokensHigh(0);
    setAssignedTokensLow(0);
    setStatus('IDLE');
    setIsRunning(false);
    setIsPaused(false);

    recordEvent(
      'T = 0.0s',
      'Queues Initialized',
      `Staged ${highCount} High Priority jobs and ${lowCount} Low Priority jobs. Ready to run.`,
      'info'
    );
  }, [inputHigh, inputLow, SYSTEM_CONFIG.MAX_ATTEMPTS, recordEvent]);

  // Initial stage on mount with predefined defaults (10 High, 8 Low)
  useEffect(() => {
    initQueues(10, 8);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Immediate UI update on input typing (automatically corrects leading zeros like "03" -> 3)
  const handleHighInputChange = (val) => {
    if (val === '') {
      setInputHigh('');
      initQueues(0, lowCountNum);
      return;
    }
    // Parse integer to immediately eliminate leading zeros (e.g. "03" -> 3)
    const cleanNum = Math.max(0, parseInt(val, 10) || 0);
    setInputHigh(cleanNum);
    initQueues(cleanNum, lowCountNum);
  };

  const handleLowInputChange = (val) => {
    if (val === '') {
      setInputLow('');
      initQueues(highCountNum, 0);
      return;
    }
    const cleanNum = Math.max(0, parseInt(val, 10) || 0);
    setInputLow(cleanNum);
    initQueues(highCountNum, cleanNum);
  };

  // Default Settings handler (Resets to predefined defaults: 10 High & 8 Low)
  const handleLoadDefaults = () => {
    setInputHigh(10);
    setInputLow(8);
    initQueues(10, 8);
  };

  // Interactive Toggle: Mark Job in High Priority Queue to fail or succeed
  const toggleJobFailureHigh = (jobId) => {
    const updated = highQueueRef.current.map((j) => {
      if (j.id === jobId) {
        const nextState = !j.willFail;
        recordEvent(
          `T = ${simSecondsRef.current.toFixed(1)}s`,
          nextState ? `Job #${j.id} (High) Armed to Fail` : `Job #${j.id} (High) Restored`,
          nextState
            ? `Job #${j.id} will fail with SMTP error on all attempts. It will retry to High queue and eject to DLQ after 3 attempts.`
            : `Job #${j.id} returned to normal. Will deliver successfully (200 OK).`,
          nextState ? 'retry' : 'info'
        );
        return { ...j, willFail: nextState };
      }
      return j;
    });
    highQueueRef.current = updated;
    setHighQueue(updated);
  };

  // Interactive Toggle: Mark Job in Low Priority Queue to fail or succeed
  const toggleJobFailureLow = (jobId) => {
    const updated = lowQueueRef.current.map((j) => {
      if (j.id === jobId) {
        const nextState = !j.willFail;
        recordEvent(
          `T = ${simSecondsRef.current.toFixed(1)}s`,
          nextState ? `Job #${j.id} (Low) Armed to Fail` : `Job #${j.id} (Low) Restored`,
          nextState
            ? `Job #${j.id} will fail with SMTP error on all attempts. It will retry to High queue and eject to DLQ after 3 attempts.`
            : `Job #${j.id} returned to normal. Will deliver successfully (200 OK).`,
          nextState ? 'retry' : 'info'
        );
        return { ...j, willFail: nextState };
      }
      return j;
    });
    lowQueueRef.current = updated;
    setLowQueue(updated);
  };

  // Start / Resume Simulation Handler
  const handleStartRun = () => {
    if (!isValidInputs) return;

    // If starting fresh from empty or already completed, reinitialize with current values
    if (
      status === 'COMPLETED' ||
      (highQueueRef.current.length === 0 &&
       lowQueueRef.current.length === 0 &&
       processingQueueRef.current.length === 0)
    ) {
      initQueues(highCountNum, lowCountNum);
    }

    const wasPaused = isPaused;
    setIsPaused(false);
    setIsRunning(true);

    if (processingQueueRef.current.length > 0) {
      setStatus('PROCESSING_PARALLEL');
    } else {
      setStatus('RUNNING');
    }

    // Clear previous logs on new / restarted simulation run
    if (!wasPaused) {
      setSecondEvents([
        {
          id: Date.now(),
          time: 'T = 0.0s',
          title: 'Simulation Started',
          detail: `Beginning multi-queue parallel dispatch with Max Rate Limit = ${SYSTEM_CONFIG.EMAIL_RATE_LIMIT_PER_SEC} emails/sec. Click any queued job to arm failure.`,
          type: 'start'
        }
      ]);
    } else {
      recordEvent(
        `T = ${simSecondsRef.current.toFixed(1)}s`,
        'Simulation Resumed',
        `Resuming parallel execution (${processingQueueRef.current.length} in processing pool, ${highQueueRef.current.length} High, ${lowQueueRef.current.length} Low remaining).`,
        'start'
      );
    }
  };

  const handlePause = () => {
    setIsRunning(false);
    setIsPaused(true);
    recordEvent(
      `T = ${simSecondsRef.current.toFixed(1)}s`,
      'Simulation Paused',
      'Engine paused by user. In-flight jobs and timeline preserved. Click "Resume Simulation" to continue.',
      'pause'
    );
  };

  // Bulletproof Deterministic Sequential Execution Loop
  useEffect(() => {
    if (!isRunning) return;

    let cancelled = false;

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms / (speedMultiplierRef.current || 1)));

    const runSimulationLoop = async () => {
      while (!cancelled) {
        // 1. Check if there is already an in-flight batch from before pause
        let combinedBatch = processingQueueRef.current;
        const isResumingBatch = combinedBatch.length > 0;

        if (!isResumingBatch) {
          const currentHigh = highQueueRef.current;
          const currentLow = lowQueueRef.current;

          // Check if both queues are drained AND no in-flight jobs
          if (currentHigh.length === 0 && currentLow.length === 0) {
            setStatus('COMPLETED');
            setIsRunning(false);
            setIsPaused(false);
            recordEvent(
              `T = ${simSecondsRef.current.toFixed(1)}s`,
              'All Queues Drained',
              `Completed! Total delivered: ${deliveredCountRef.current} jobs across ${currentCycleRef.current} batch cycles.`,
              'success'
            );
            break;
          }

          const cycleNum = currentCycleRef.current + 1;
          currentCycleRef.current = cycleNum;
          setCurrentCycle(cycleNum);

          // --- STEP A: TOKEN RESERVATION VIA LUA (ACQUIRE_TOKENS_LUA) ---
          setStatus('ACQUIRING_TOKENS');

          // Calculate quota: 5 High, 2 Low. If High has fewer, Low borrows.
          let highToTake = Math.min(currentHigh.length, SYSTEM_CONFIG.HIGH_PRIORITY_WEIGHT);
          let budget = SYSTEM_CONFIG.EMAIL_RATE_LIMIT_PER_SEC - highToTake;

          let lowToTake = Math.min(currentLow.length, budget);
          budget -= lowToTake;

          // If Low did not need its full 2 quota, give remaining to High if High still has jobs
          if (budget > 0 && currentHigh.length > highToTake) {
            const extra = Math.min(currentHigh.length - highToTake, budget);
            highToTake += extra;
          }

          const totalBatch = highToTake + lowToTake;
          if (totalBatch === 0) {
            setStatus('COMPLETED');
            setIsRunning(false);
            setIsPaused(false);
            break;
          }

          setBucketTokens(7);
          setAssignedTokensHigh(highToTake);
          setAssignedTokensLow(lowToTake);

          recordEvent(
            `T = ${simSecondsRef.current.toFixed(1)}s`,
            `Cycle #${cycleNum}: Redis Token Allocation`,
            `Lua script reserved ${totalBatch} tokens: ${highToTake} High + ${lowToTake} Low from 7/sec limit.`,
            'token'
          );

          // Hold visually for token checkout
          await sleep(400);
          if (cancelled) break;

          // --- STEP B: ATOMIC RPOPLPUSH TRANSFER TO PROCESSING QUEUE ---
          const batchHigh = currentHigh.slice(0, highToTake);
          const remainingHigh = currentHigh.slice(highToTake);

          const batchLow = currentLow.slice(0, lowToTake);
          const remainingLow = currentLow.slice(lowToTake);

          combinedBatch = [...batchHigh, ...batchLow];

          highQueueRef.current = remainingHigh;
          lowQueueRef.current = remainingLow;
          processingQueueRef.current = combinedBatch;

          setHighQueue(remainingHigh);
          setLowQueue(remainingLow);
          setProcessingQueue(combinedBatch);
          setBucketTokens(7 - totalBatch);
          setStatus('PROCESSING_PARALLEL');
          parallelProgressRef.current = 0;
          setParallelProgress(0);

          const dispatchTime = simSecondsRef.current + 0.1;
          simSecondsRef.current = dispatchTime;
          setSimSeconds(dispatchTime);

          recordEvent(
            `T = ${dispatchTime.toFixed(1)}s`,
            `Cycle #${cycleNum}: Atomic RPOPLPUSH Transfer`,
            `Pushed ${totalBatch} jobs into processing queue. Executing 1.5s parallel SMTP delivery.`,
            'transfer'
          );
        } else {
          // Resuming an existing batch already in processing queue
          setStatus('PROCESSING_PARALLEL');
        }

        // --- STEP C: PARALLEL EXECUTION (1.5 SECONDS THIRD-PARTY LATENCY) ---
        const latencyMs = 1500;
        const tickInterval = 50;
        const totalSteps = latencyMs / tickInterval; // 30 steps
        const currentPct = parallelProgressRef.current || 0;
        const startStep = Math.min(totalSteps, Math.floor((currentPct / 100) * totalSteps) + 1);

        for (let s = startStep; s <= totalSteps; s++) {
          await sleep(tickInterval);
          if (cancelled) break;

          const pct = (s / totalSteps) * 100;
          parallelProgressRef.current = pct;
          setParallelProgress(pct);

          const advancedTime = simSecondsRef.current + (tickInterval / 1000);
          simSecondsRef.current = advancedTime;
          setSimSeconds(advancedTime);
        }

        if (cancelled) break;

        // --- STEP D: BATCH RESOLUTION ---
        let succeededCount = 0;
        const failedJobs = [];
        const requeuedHigh = [];
        const requeuedLow = [];
        const ejectedDlq = [];

        combinedBatch.forEach((job) => {
          if (job.willFail) {
            failedJobs.push(job);
            const nextAttempts = job.attempts + 1;
            if (nextAttempts > job.maxAttempts) {
              ejectedDlq.push({
                ...job,
                attempts: job.maxAttempts,
                failedAt: `T = ${simSecondsRef.current.toFixed(1)}s`
              });
            } else {
              const updatedJob = {
                ...job,
                attempts: nextAttempts,
                isRetry: true,
                willFail: true // Stays marked to fail on next retry until 3 attempts exhausted
              };
              if (job.priority === 'HIGH') {
                requeuedHigh.push(updatedJob);
              } else {
                requeuedLow.push(updatedJob);
              }
            }
          } else {
            succeededCount += 1;
          }
        });

        deliveredCountRef.current += succeededCount;
        setDeliveredCount(deliveredCountRef.current);

        if (requeuedHigh.length > 0) {
          highQueueRef.current = [...requeuedHigh, ...highQueueRef.current];
          setHighQueue(highQueueRef.current);
        }

        if (requeuedLow.length > 0) {
          lowQueueRef.current = [...requeuedLow, ...lowQueueRef.current];
          setLowQueue(lowQueueRef.current);
        }

        if (ejectedDlq.length > 0) {
          dlqQueueRef.current = [...ejectedDlq, ...dlqQueueRef.current];
          setDlqQueue(dlqQueueRef.current);
        }

        if (failedJobs.length > 0) {
          if (ejectedDlq.length > 0) {
            recordEvent(
              `T = ${simSecondsRef.current.toFixed(1)}s`,
              'Parallel Batch: Ejected to DLQ',
              `${succeededCount} delivered. ${ejectedDlq.map((j) => `Job #${j.id} (${j.priority === 'HIGH' ? 'High' : 'Low'})`).join(', ')} exhausted 3/3 attempts → Ejected to DLQ + DB Rollback (user.otp = null)!`,
              'error'
            );
          }
          if (requeuedHigh.length > 0 || requeuedLow.length > 0) {
            const highMsg = requeuedHigh.length > 0
              ? `${requeuedHigh.map((j) => `Job #${j.id} (Attempt ${j.attempts}/3)`).join(', ')} → Requeued to High Priority`
              : null;
            const lowMsg = requeuedLow.length > 0
              ? `${requeuedLow.map((j) => `Job #${j.id} (Attempt ${j.attempts}/3)`).join(', ')} → Requeued to Low Priority`
              : null;
            const requeueSummary = [highMsg, lowMsg].filter(Boolean).join('; ');

            recordEvent(
              `T = ${simSecondsRef.current.toFixed(1)}s`,
              'Parallel Batch: SMTP Failure & Requeue',
              `${succeededCount} delivered. ${requeueSummary}!`,
              'retry'
            );
          }
        } else {
          recordEvent(
            `T = ${simSecondsRef.current.toFixed(1)}s`,
            'Parallel Batch Resolved (1.5s Elapsed)',
            `All ${combinedBatch.length} parallel jobs succeeded! Acknowledged via LREM from processing queue.`,
            'success'
          );
        }

        // Instantly mark in-flight batch as done in refs so pause during settle won't re-execute it
        processingQueueRef.current = [];
        parallelProgressRef.current = 0;

        // Brief settle time to visualize completion
        await sleep(350);
        if (cancelled) break;

        setProcessingQueue([]);
        setParallelProgress(0);
        setBucketTokens(7);
        setAssignedTokensHigh(0);
        setAssignedTokensLow(0);
        setStatus('BATCH_RESOLVED');

        // Inter-cycle rate limit window gap (0.2s)
        await sleep(200);
      }
    };

    runSimulationLoop();

    return () => {
      cancelled = true;
    };
  }, [isRunning, recordEvent]);

  return (
    <div className={`w-full rounded-2xl border transition-all duration-300 font-sans ${
      isDark ? 'bg-[#0d0d16] border-white/10 shadow-2xl' : 'bg-slate-50 border-slate-200 shadow-xl'
    }`}>
      {/* 1. Header Bar: Engine Status & Second Clock */}
      <div className={`p-5 border-b flex flex-wrap items-center justify-between gap-4 ${
        isDark ? 'border-white/5 bg-black/30' : 'border-slate-200 bg-white'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <HiOutlineQueueList className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base sm:text-lg tracking-tight">
                Multi-Queue Parallel Dispatch Simulator
              </h3>
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isPaused
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40'
                  : status === 'PROCESSING_PARALLEL'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40 animate-pulse'
                  : isRunning
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40'
                  : status === 'COMPLETED'
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/40'
                  : 'bg-slate-500/15 text-slate-400 border border-slate-500/30'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  isPaused
                    ? 'bg-amber-400'
                    : status === 'PROCESSING_PARALLEL'
                    ? 'bg-amber-400 animate-ping'
                    : isRunning
                    ? 'bg-emerald-400'
                    : status === 'COMPLETED'
                    ? 'bg-cyan-400'
                    : 'bg-slate-500'
                }`} />
                <span>
                  {isPaused
                    ? '❚❚ Paused (Click Resume)'
                    : status === 'PROCESSING_PARALLEL'
                    ? '● Parallel SMTP In-Flight'
                    : isRunning
                    ? '● Engine Running'
                    : status === 'COMPLETED'
                    ? '✓ Complete (All Drained)'
                    : '❚❚ Stopped (Waiting for Run)'}
                </span>
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Live Token Bucket · Parallel Processing Pool (1.5s Latency) · Second-by-Second Execution Trace
            </p>
          </div>
        </div>

        {/* Live Timeline Clock & Cycle Badge */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="px-3 py-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 flex items-center gap-2">
            <HiOutlineClock className="w-4 h-4 text-cyan-400" />
            <span>Timeline Clock: <strong className="text-white text-sm">{simSeconds.toFixed(1)}s</strong></span>
          </div>
          <div className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-slate-300">
            <span>Cycle: <strong className="text-amber-400">#{currentCycle}</strong></span>
          </div>
        </div>
      </div>

      {/* 2. Interactive Inputs & Core Rules Bar */}
      <div className={`p-5 border-b space-y-4 ${
        isDark ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-slate-100/70'
      }`}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          
          {/* User Inputs (High & Low Job Counts) */}
          <div className="lg:col-span-6 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold uppercase text-slate-400">Input Jobs:</span>
            </div>

            {/* High Priority Input */}
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-1.5">
              <label htmlFor="high-input" className="text-xs font-mono font-bold text-emerald-400">
                High Priority:
              </label>
              <input
                id="high-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                disabled={isRunning || isPaused}
                value={inputHigh}
                onChange={(e) => handleHighInputChange(e.target.value)}
                placeholder="0"
                className="w-16 bg-black/50 border border-emerald-500/40 rounded-lg px-2 py-1 text-center font-mono text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-emerald-400 disabled:opacity-50"
              />
            </div>

            {/* Low Priority Input */}
            <div className="flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl px-3 py-1.5">
              <label htmlFor="low-input" className="text-xs font-mono font-bold text-cyan-400">
                Low Priority:
              </label>
              <input
                id="low-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                disabled={isRunning || isPaused}
                value={inputLow}
                onChange={(e) => handleLowInputChange(e.target.value)}
                placeholder="0"
                className="w-16 bg-black/50 border border-cyan-500/40 rounded-lg px-2 py-1 text-center font-mono text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-50"
              />
            </div>

            {/* Validation Notice */}
            {!isValidInputs && (
              <span className="text-[11px] font-mono text-rose-400">
                * Cannot set 0 for both queues (one must be &gt; 0).
              </span>
            )}
          </div>

          {/* Action Buttons: Run / Pause / Resume / Default Settings / Simulate Failure */}
          <div className="lg:col-span-6 flex flex-wrap items-center justify-end gap-2.5">
            {/* Run / Resume / Pause Button */}
            {isRunning ? (
              <button
                onClick={handlePause}
                className="px-4 py-2 rounded-xl font-mono text-xs font-bold flex items-center gap-2 cursor-pointer bg-amber-500 hover:bg-amber-400 text-white shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all"
              >
                <HiOutlinePause className="w-4 h-4" />
                <span>Pause</span>
              </button>
            ) : isPaused ? (
              <button
                onClick={handleStartRun}
                disabled={!isValidInputs}
                className="px-4 py-2 rounded-xl font-mono text-xs font-bold flex items-center gap-2 cursor-pointer bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)] disabled:opacity-40 transition-all animate-pulse"
              >
                <HiOutlinePlay className="w-4 h-4" />
                <span>Resume Simulation</span>
              </button>
            ) : status === 'COMPLETED' ? (
              <button
                onClick={handleStartRun}
                disabled={!isValidInputs}
                className="px-4 py-2 rounded-xl font-mono text-xs font-bold flex items-center gap-2 cursor-pointer bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)] disabled:opacity-40 transition-all"
              >
                <HiOutlineArrowPath className="w-4 h-4" />
                <span>Restart Simulation</span>
              </button>
            ) : (
              <button
                onClick={handleStartRun}
                disabled={!isValidInputs}
                className="px-4 py-2 rounded-xl font-mono text-xs font-bold flex items-center gap-2 cursor-pointer bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)] disabled:opacity-40 transition-all"
              >
                <HiOutlinePlay className="w-4 h-4" />
                <span>Run Simulation</span>
              </button>
            )}

            {/* Default Settings Button (Loads Predefined 10 High & 8 Low) */}
            <button
              onClick={handleLoadDefaults}
              className="px-3.5 py-2 rounded-xl font-mono text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 cursor-pointer flex items-center gap-1.5 transition-all"
              title="Set predefined defaults: 10 High & 8 Low"
            >
              <HiOutlineArrowPath className="w-4 h-4 text-emerald-400" />
              <span>Default Settings (10 &amp; 8)</span>
            </button>

            {/* Multi-Speed Selector (0.5x, 1x, 1.5x, 2x) */}
            <div className="flex items-center rounded-xl border border-white/10 bg-white/5 p-1 text-xs font-mono">
              <span className="text-[10px] text-slate-400 px-1.5 uppercase font-semibold">Speed:</span>
              {[0.5, 1, 1.5, 2].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setSpeedMultiplier(spd)}
                  className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    speedMultiplier === spd
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* 4. Core Rate Limiter & Dispatch Rules (Plain English) */}
        <div className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
          isDark ? 'bg-black/40 border-white/5 text-slate-400' : 'bg-white border-slate-200 text-slate-600 shadow-sm'
        }`}>
          <div className="flex items-center gap-2">
            <HiOutlineInformationCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-bold text-slate-200 font-sans">Core Rate Limiter &amp; Dispatch Rules:</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] font-sans">
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/25">
              Max Dispatch Rate: <strong className="font-mono text-white">7 emails / sec</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
              High Priority Quota: <strong className="font-mono text-white">5 jobs / sec</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/25">
              Low Priority Quota: <strong className="font-mono text-white">2 jobs / sec</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/25">
              Retry Limit: <strong className="font-mono text-white">3 attempts</strong> (then Dead-Letter Queue)
            </span>
          </div>
        </div>
      </div>

      {/* 3. The Visual Architecture: 3-Column Parallel Pipeline Stage + Full-Width Terminal */}
      <div className="p-4 sm:p-5 space-y-4">
        
        {/* 3-COLUMN DESKTOP STAGE (Column 1: Inbound Queues | Column 2: Redis Token Bucket | Column 3: Processing & DLQ) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          
          {/* COLUMN 1: High Priority & Low Priority Queues (Stacked in Col 1) */}
          <div className="lg:col-span-4 flex flex-col gap-3 justify-between">
            {/* High Priority Queue Card */}
            <div className={`p-3.5 rounded-xl border relative transition-all duration-300 flex-1 flex flex-col justify-between ${
              status === 'ACQUIRING_TOKENS' && assignedTokensHigh > 0
                ? 'border-emerald-500 ring-1 ring-emerald-500/40 bg-emerald-500/5'
                : isDark ? 'bg-black/30 border-white/10' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="font-mono text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    High Priority Queue
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[11px] font-bold">
                  {highQueue.length} Pending
                </span>
              </div>
              <div className="text-[10px] font-mono text-slate-500 mb-1.5 flex items-center justify-between">
                <span className="text-emerald-400/90 font-semibold">Quota: 5 jobs / sec</span>
              </div>

              {/* Conveyor Track for High Priority */}
              <div className="w-full flex items-center gap-2 overflow-x-auto py-2 px-1 min-h-[58px] scrollbar-thin rounded-lg bg-black/20 border border-white/[0.04]">
                {highQueue.length === 0 ? (
                  <div className="text-xs font-mono text-slate-500 italic py-2 text-center w-full">
                    Queue Empty (Borrowable by Low)
                  </div>
                ) : (
                  highQueue.map((job) => (
                    <div
                      key={job.id}
                      onClick={() => toggleJobFailureHigh(job.id)}
                      className="shrink-0 transition-all duration-300 cursor-pointer group"
                      title={
                        job.willFail
                          ? `Job #${job.id} is ARMED TO FAIL (Click to make normal)`
                          : `Job #${job.id} is NORMAL (Click to arm as failure)`
                      }
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex flex-col items-center justify-center relative font-mono font-bold text-xs shadow-md transition-all group-hover:scale-110 active:scale-95 ${
                          job.willFail
                            ? 'bg-rose-500/25 border-2 border-rose-500 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.5)] ring-2 ring-rose-400/30'
                            : job.isRetry
                            ? 'bg-amber-500/20 border border-amber-400 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                            : 'bg-emerald-500/15 border border-emerald-400 text-emerald-300 shadow-[0_0_10px_rgba(34,197,94,0.25)]'
                        }`}
                      >
                        <span className="leading-tight">#{job.id}</span>
                        {job.willFail && (
                          <span className="text-[7px] font-extrabold text-rose-300 uppercase tracking-tight -mt-0.5">
                            FAIL
                          </span>
                        )}
                        {job.attempts > 1 && (
                          <span className="absolute -top-1 -right-1 text-[8px] font-mono font-bold bg-amber-500 text-black px-1 rounded-full border border-black shadow">
                            {job.attempts}/3
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Low Priority Queue Card */}
            <div className={`p-3.5 rounded-xl border relative transition-all duration-300 flex-1 flex flex-col justify-between ${
              status === 'ACQUIRING_TOKENS' && assignedTokensLow > 0
                ? 'border-cyan-500 ring-1 ring-cyan-500/40 bg-cyan-500/5'
                : isDark ? 'bg-black/30 border-white/10' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  <span className="font-mono text-xs font-bold text-cyan-400 uppercase tracking-wider">
                    Low Priority Queue
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono text-[11px] font-bold">
                  {lowQueue.length} Pending
                </span>
              </div>
              <div className="text-[10px] font-mono text-slate-500 mb-1.5 flex items-center justify-between">
                <span className="text-cyan-400/90 font-semibold">Quota: 2 jobs / sec</span>
              </div>

              {/* Conveyor Track for Low Priority */}
              <div className="w-full flex items-center gap-2 overflow-x-auto py-2 px-1 min-h-[58px] scrollbar-thin rounded-lg bg-black/20 border border-white/[0.04]">
                {lowQueue.length === 0 ? (
                  <div className="text-xs font-mono text-slate-500 italic py-2 text-center w-full">
                    Queue Empty
                  </div>
                ) : (
                  lowQueue.map((job) => (
                    <div
                      key={job.id}
                      onClick={() => toggleJobFailureLow(job.id)}
                      className="shrink-0 transition-all duration-300 cursor-pointer group"
                      title={
                        job.willFail
                          ? `Job #${job.id} is ARMED TO FAIL (Click to make normal)`
                          : `Job #${job.id} is NORMAL (Click to arm as failure)`
                      }
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex flex-col items-center justify-center relative font-mono font-bold text-xs shadow-md transition-all group-hover:scale-110 active:scale-95 ${
                          job.willFail
                            ? 'bg-rose-500/25 border-2 border-rose-500 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.5)] ring-2 ring-rose-400/30'
                            : 'bg-cyan-500/15 border border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                        }`}
                      >
                        <span className="leading-tight">#{job.id}</span>
                        {job.willFail && (
                          <span className="text-[7px] font-extrabold text-rose-300 uppercase tracking-tight -mt-0.5">
                            FAIL
                          </span>
                        )}
                        {job.attempts > 1 && (
                          <span className="absolute -top-1 -right-1 text-[8px] font-mono font-bold bg-amber-500 text-black px-1 rounded-full border border-black shadow">
                            {job.attempts}/3
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Inbound Flow Route Tag & Interactive Failure Hint */}
            <div className="px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/5 flex flex-col gap-1 text-[10px] font-mono text-slate-400">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">1. Stage Pending</span>
                <span className="text-amber-400 font-semibold flex items-center gap-1">
                  LPUSH Inbound → Lua Quota Claim ➜
                </span>
              </div>
              <div className="text-[9.5px] text-rose-300/80 pt-0.5 border-t border-white/[0.04]">
                ⚡ Click any job circle to arm failure (fails 3 attempts → DLQ rollback)
              </div>
            </div>
          </div>

          {/* COLUMN 2: Center Redis Token Bucket & Lua Evaluator */}
          <div className={`lg:col-span-4 p-4 rounded-xl border relative font-mono text-xs flex flex-col justify-between ${
            isDark ? 'bg-[#12121e] border-white/10' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <HiBolt className="w-4 h-4 text-amber-400 animate-pulse" />
                  <strong className="text-amber-400 text-sm">Redis Token Bucket</strong>
                </div>
              </div>

              {/* Bucket Digital Readout */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/5 mb-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Sliding Window Pool</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <strong className="text-2xl font-extrabold text-amber-400 font-mono">{bucketTokens}</strong>
                    <span className="text-slate-400 text-xs">/ 7 Tokens/Sec</span>
                  </div>
                </div>
                <div className="text-right text-[10px]">
                  <span className="text-slate-500 block">ratelimit:email:bucket</span>
                  <span className="text-emerald-400 font-semibold">1000ms Atomic TTL</span>
                </div>
              </div>

              {/* Visual 7 Tokens Grid */}
              <div className="mb-4">
                <span className="text-[10px] text-slate-400 block mb-1.5 uppercase font-semibold">Token Reservoir:</span>
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 7 }).map((_, idx) => {
                    const isAssignedHigh = idx < assignedTokensHigh;
                    const isAssignedLow = idx >= assignedTokensHigh && idx < (assignedTokensHigh + assignedTokensLow);

                    return (
                      <div
                        key={idx}
                        className={`h-9 rounded-lg border flex flex-col items-center justify-center font-bold text-[11px] transition-all duration-300 ${
                          isAssignedHigh
                            ? 'bg-emerald-500 text-black border-emerald-400 shadow-[0_0_10px_rgba(34,197,94,0.4)] scale-105'
                            : isAssignedLow
                            ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)] scale-105'
                            : 'bg-black/50 border-white/10 text-slate-600'
                        }`}
                      >
                        <span>T{idx + 1}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live Quota Allocation Readout */}
              <div className="space-y-1.5 text-[11px] p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    High Quota Claimed:
                  </span>
                  <strong className="text-white font-bold">{assignedTokensHigh} / 5</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    Low Quota Claimed:
                  </span>
                  <strong className="text-white font-bold">{assignedTokensLow} / 2</strong>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                  <span className="text-slate-400">Total Batch Dispatched:</span>
                  <strong className="text-amber-400 font-bold">{assignedTokensHigh + assignedTokensLow} / 7</strong>
                </div>
              </div>
            </div>

            {/* Atomic Lua Handshake Tag */}
            <div className="mt-3 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-[10px] text-amber-300">
              <span>2. Atomic Claim</span>
              <span className="font-bold">RPOPLPUSH Transfer ➜</span>
            </div>
          </div>

          {/* COLUMN 3: Processing Queue & Outcomes Chamber (Delivered & DLQ) */}
          <div className="lg:col-span-4 flex flex-col gap-3 justify-between">
            {/* The Processing Queue (queue:email:processing) */}
            <div className={`p-3.5 rounded-xl border relative transition-all duration-300 flex-1 flex flex-col justify-between ${
              processingQueue.length > 0
                ? 'border-amber-500 ring-1 ring-amber-500/40 bg-amber-500/5 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                : isDark ? 'bg-black/30 border-white/10' : 'bg-white border-slate-200'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${processingQueue.length > 0 ? 'bg-amber-400 animate-ping' : 'bg-slate-600'}`} />
                    <span className="font-mono text-xs font-bold text-amber-400 uppercase tracking-wider">
                      Processing Queue
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono text-[11px] font-bold">
                    {processingQueue.length} Active in Batch
                  </span>
                </div>

                {/* Parallel Progress Laser Bar (1.50s Latency) */}
                <div className="mb-2.5">
                  <div className="flex items-center justify-between font-mono text-[10px] text-slate-400 mb-1">
                    <span className="flex items-center gap-1 text-amber-300">
                      <HiOutlineServerStack className="w-3 h-3 animate-spin" />
                      <span>SMTP Parallel Flight (1.50s)</span>
                    </span>
                    <span className="font-bold text-white">
                      {processingQueue.length > 0 ? `${parallelProgress.toFixed(0)}% (${((parallelProgress / 100) * 1.5).toFixed(2)}s)` : '0.00s'}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-black/60 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400 transition-all duration-75"
                      style={{ width: `${parallelProgress}%` }}
                    />
                  </div>
                </div>

                {/* Conveyor Track for In-Flight Processing Jobs */}
                <div className="w-full flex items-center gap-2 overflow-x-auto py-2 px-1 min-h-[58px] scrollbar-thin rounded-lg bg-black/20 border border-white/[0.04]">
                  {processingQueue.length === 0 ? (
                    <div className="text-xs font-mono text-slate-500 italic py-2 text-center w-full">
                      Processing buffer empty · Waiting for token cycle...
                    </div>
                  ) : (
                    processingQueue.map((job) => {
                      const isHigh = job.priority === 'HIGH';
                      const isFailing = job.willFail;
                      return (
                        <div key={job.id} className="shrink-0 transition-all duration-300">
                          <div
                            className={`w-10 h-10 rounded-full flex flex-col items-center justify-center relative font-mono font-bold text-xs transition-all animate-pulse ${
                              isFailing
                                ? 'border-2 border-rose-500 bg-rose-500/25 text-rose-300 shadow-[0_0_14px_rgba(244,63,94,0.5)] ring-1 ring-rose-400'
                                : isHigh
                                ? 'border-2 border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(34,197,94,0.4)]'
                                : 'border-2 border-cyan-400 bg-cyan-500/20 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                            }`}
                            title={`Job #${job.id} (${isHigh ? 'High Priority' : 'Low Priority'}${isFailing ? ' · Destined to FAIL' : ''})`}
                          >
                            <span className="leading-tight text-[11px]">#{job.id}</span>
                            <span className="text-[7px] uppercase tracking-wider font-semibold opacity-85 -mt-0.5">
                              {isFailing ? 'FAIL' : isHigh ? 'High' : 'Low'}
                            </span>
                            {job.attempts > 1 && (
                              <span className="absolute -top-1 -right-1 text-[8px] font-mono font-bold bg-rose-500 text-white px-1 rounded-full border border-black shadow">
                                {job.attempts}/3
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Origin Legend */}
              <div className="mt-2 pt-1.5 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Green = High ({processingQueue.filter(j => j.priority === 'HIGH' && !j.willFail).length})
                </span>
                <span className="text-cyan-400 flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  Blue = Low ({processingQueue.filter(j => j.priority === 'LOW' && !j.willFail).length})
                </span>
                {processingQueue.some(j => j.willFail) && (
                  <span className="text-rose-400 flex items-center gap-1 font-semibold animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    Fail: {processingQueue.filter(j => j.willFail).length}
                  </span>
                )}
              </div>
            </div>

            {/* Dead-Letter Queue (queue:email:dlq) — Full Queue Conveyor Track with Priority Color-Coded Jobs */}
            <div className={`p-3.5 rounded-xl border relative transition-all duration-300 flex-1 flex flex-col justify-between ${
              dlqQueue.length > 0
                ? 'border-rose-500/60 ring-1 ring-rose-500/30 bg-rose-500/5 shadow-[0_0_20px_rgba(244,63,94,0.15)]'
                : isDark ? 'bg-black/30 border-white/10' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${dlqQueue.length > 0 ? 'bg-rose-500 animate-ping' : 'bg-rose-400'}`} />
                    <span className="font-mono text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                      <HiOutlineXMark className="w-3.5 h-3.5" />
                      <span>Dead-Letter Queue (DLQ)</span>
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold ${
                    dlqQueue.length > 0
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-white/5 text-slate-500 border border-white/10'
                  }`}>
                    {dlqQueue.length} Exhausted (3/3)
                  </span>
                </div>

                <div className="text-[10px] font-mono text-slate-500 mb-1.5 flex items-center justify-between">
                  <span className={dlqQueue.length > 0 ? 'text-rose-400 font-semibold' : 'text-slate-500'}>
                    {dlqQueue.length > 0 ? '⚡ Auto DB Rollback: user.otp = null' : 'Zero Exhausted Jobs'}
                  </span>
                </div>

                {/* Conveyor Track for DLQ Exhausted Jobs (Color Coded: Green = High, Blue = Low) */}
                <div className="w-full flex items-center gap-2 overflow-x-auto py-2 px-1 min-h-[58px] scrollbar-thin rounded-lg bg-black/20 border border-white/[0.04]">
                  {dlqQueue.length === 0 ? (
                    <div className="text-xs font-mono text-slate-500 italic py-2 text-center w-full">
                      DLQ Buffer Empty · Zero exhausted jobs
                    </div>
                  ) : (
                    dlqQueue.map((job) => {
                      const isHigh = job.priority === 'HIGH';
                      return (
                        <div key={job.id} className="shrink-0 transition-all duration-300">
                          <div
                            className={`w-10 h-10 rounded-full flex flex-col items-center justify-center relative font-mono font-bold text-xs shadow-md transition-all ${
                              isHigh
                                ? 'border-2 border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(34,197,94,0.35)]'
                                : 'border-2 border-cyan-400 bg-cyan-500/20 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.35)]'
                            }`}
                            title={`Job #${job.id} (${isHigh ? 'High Priority' : 'Low Priority'}) failed all 3 attempts -> Ejected to DLQ (DB Rollback)`}
                          >
                            <span className="leading-tight text-[11px]">#{job.id}</span>
                            <span className="text-[7px] uppercase tracking-wider font-semibold opacity-85 -mt-0.5">
                              {isHigh ? 'High' : 'Low'}
                            </span>
                            <span className="absolute -top-1 -right-1 text-[8px] font-mono font-bold bg-rose-500 text-white px-1 rounded-full border border-black shadow">
                              3/3
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* DLQ Origin Legend */}
              <div className="mt-2 pt-1.5 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  High: {dlqQueue.filter(j => j.priority === 'HIGH').length}
                </span>
                <span className="text-cyan-400 flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  Low: {dlqQueue.filter(j => j.priority === 'LOW').length}
                </span>
                <span className="text-rose-400 text-[9.5px]">
                  Permanent Fail
                </span>
              </div>
            </div>

            {/* Resolution Summary Bar: Delivered OK & DLQ Rule */}
            <div className="px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/5 flex flex-col gap-1 text-[10px] font-mono text-slate-400">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <HiOutlineCheckCircle className="w-3.5 h-3.5" />
                  <span>Delivered: <strong className="text-white">{deliveredCount} Jobs</strong> (200 OK via LREM)</span>
                </span>
                <span className="text-slate-500">3. Resolution</span>
              </div>
              <div className="text-[9.5px] text-amber-300/80 pt-0.5 border-t border-white/[0.04] flex items-center justify-between">
                <span>Fail &lt; 3 ↩ High Priority Retry</span>
                <span className="text-rose-400">3/3 Fail ➜ DLQ Ejection</span>
              </div>
            </div>
          </div>

        </div>

        {/* FULL-WIDTH ROW: Second-by-Second Execution Timeline (Terminal Logs) */}
        <div className={`p-3.5 sm:p-4 rounded-xl border font-mono text-xs ${
          isDark ? 'bg-black/50 border-white/5' : 'bg-slate-900 text-slate-200 border-slate-700'
        }`}>
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/5 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 font-bold text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              <span>Second-by-Second Execution Timeline (What Happens on Each Second)</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 font-semibold ml-1">
                {secondEvents.length} logs
              </span>
            </span>
            <div className="flex items-center gap-3">
              <span>Rate Limit Window: 1000ms</span>
              {secondEvents.length > 1 && (
                <button
                  onClick={() => setSecondEvents([secondEvents[0]])}
                  className="text-[10px] text-slate-400 hover:text-slate-200 underline cursor-pointer transition-colors"
                  title="Clear history"
                >
                  Clear Logs
                </button>
              )}
            </div>
          </div>

          {/* Vertically Scrollable Logs Terminal */}
          <div className="max-h-40 sm:max-h-44 overflow-y-auto space-y-2 pr-2 overscroll-contain divide-y divide-white/[0.03]">
            {secondEvents.map((evt) => (
              <div key={evt.id || evt.time} className="flex items-start gap-3 pt-1.5 first:pt-0">
                <span className="text-amber-400 font-bold shrink-0 w-16">[{evt.time}]</span>
                <div className="space-y-0.5">
                  <strong className={
                    evt.type === 'error'
                      ? 'text-rose-400'
                      : evt.type === 'retry'
                      ? 'text-amber-300'
                      : evt.type === 'pause'
                      ? 'text-amber-400'
                      : evt.type === 'success'
                      ? 'text-emerald-400'
                      : evt.type === 'token'
                      ? 'text-cyan-300'
                      : 'text-white'
                  }>
                    {evt.title}
                  </strong>
                  <div className="text-slate-400 text-[10px] leading-relaxed">
                    {evt.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
