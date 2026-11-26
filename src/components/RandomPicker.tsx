import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Undo2,
  Repeat,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { DrawRecord, Student } from '../types';
import { playTickSound, playWinnerChime } from '../utils/sound';

interface RandomPickerProps {
  students: Student[];
  allowRepeat: boolean;
  onChangeAllowRepeat: (allow: boolean) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  drawHistory: DrawRecord[];
  onRecordDraw: (student: Student) => void;
  onUndoDraw: (recordId: string) => void;
  onResetHistory: () => void;
  onLoadMockRoster?: () => void;
  onOpenRosterOnMobile?: () => void;
}

interface BurstParticle {
  id: number;
  angle: number;
  distance: number;
  color: string;
  size: number;
}

const BURST_COLORS = ['#2563EB', '#0EA5E9', '#10B981', '#F59E0B', '#6366F1'];

export const RandomPicker: React.FC<RandomPickerProps> = ({
  students,
  allowRepeat,
  onChangeAllowRepeat,
  soundEnabled,
  onToggleSound,
  drawHistory,
  onRecordDraw,
  onUndoDraw,
  onResetHistory,
  onLoadMockRoster,
  onOpenRosterOnMobile,
}) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [winner, setWinner] = useState<Student | null>(null);
  const [burstKey, setBurstKey] = useState(0);

  const rafRef = useRef<number | null>(null);
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  // Compute eligible pool
  const drawnIdSet = useMemo(
    () => new Set(drawHistory.map((item) => item.student.id)),
    [drawHistory],
  );

  const availablePool = useMemo(() => {
    if (allowRepeat) return students;
    return students.filter((s) => !drawnIdSet.has(s.id));
  }, [students, allowRepeat, drawnIdSet]);

  // Keep winner synced if roster was cleared
  useEffect(() => {
    if (students.length === 0) {
      setWinner(null);
      setIsDrawing(false);
    }
  }, [students.length]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const burstParticles: BurstParticle[] = useMemo(() => {
    return Array.from({ length: 18 }, (_, idx) => ({
      id: idx,
      angle: (idx / 18) * Math.PI * 2 + (idx % 2 === 0 ? 0.12 : -0.12),
      distance: 110 + (idx % 3) * 38,
      color: BURST_COLORS[idx % BURST_COLORS.length],
      size: idx % 2 === 0 ? 8 : 6,
    }));
  }, []);

  const handleStartDraw = () => {
    if (isDrawing || availablePool.length === 0) return;

    // Pick final winner cryptographically/uniformly upfront
    const pool = availablePool;
    const winnerPoolIdx = Math.floor(Math.random() * pool.length);
    const chosenWinner = pool[winnerPoolIdx];

    // If only 1 student remains in pool, still give a brief crisp reveal or immediate pick
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || students.length <= 1) {
      setWinner(chosenWinner);
      onRecordDraw(chosenWinner);
      setBurstKey((k) => k + 1);
      if (soundEnabledRef.current) {
        playWinnerChime();
      }
      return;
    }

    setIsDrawing(true);
    setWinner(null);

    // Build an ordered reel sequence ending cleanly on chosenWinner
    const totalDurationMs = 2300;
    const startTime = performance.now();
    let lastStepTime = startTime;
    let currentIdx = Math.floor(Math.random() * students.length);
    setDisplayIndex(currentIdx);
    if (soundEnabledRef.current) {
      playTickSound(0);
    }

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / totalDurationMs);

      // Interval eases from 55ms at start to 330ms near the end (cubic ease-in interval)
      const currentInterval = 55 + Math.pow(progress, 2.4) * 280;

      if (progress >= 1) {
        // Land on the chosen winner in the full student list (or fallback to 0)
        const targetIdx = students.findIndex((s) => s.id === chosenWinner.id);
        if (targetIdx >= 0) {
          setDisplayIndex(targetIdx);
        }
        setWinner(chosenWinner);
        setIsDrawing(false);
        setBurstKey((k) => k + 1);
        onRecordDraw(chosenWinner);
        if (soundEnabledRef.current) {
          playWinnerChime();
        }
        return;
      }

      if (now - lastStepTime >= currentInterval) {
        lastStepTime = now;
        // Cycle visually through all students (or available pool if > 2) for excitement
        const cycleSource = pool.length >= 3 ? pool : students;
        const nextCandidate = cycleSource[Math.floor(Math.random() * cycleSource.length)];
        let nextIdx = students.findIndex((s) => s.id === nextCandidate.id);
        if (nextIdx === currentIdx && students.length > 1) {
          nextIdx = (currentIdx + 1) % students.length;
        }
        currentIdx = nextIdx >= 0 ? nextIdx : (currentIdx + 1) % Math.max(1, students.length);
        setDisplayIndex(currentIdx);

        if (soundEnabledRef.current) {
          playTickSound(progress);
        }
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
  };

  const activeRollingStudent = students[displayIndex] ?? null;
  const prevRollingStudent =
    students.length > 1
      ? students[(displayIndex - 1 + students.length) % students.length]
      : null;
  const nextRollingStudent =
    students.length > 1 ? students[(displayIndex + 1) % students.length] : null;

  const isPoolExhausted = students.length > 0 && !allowRepeat && availablePool.length === 0;

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-4">
          {/* Repeat Mode Segmented Switch */}
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-medium text-slate-500 whitespace-nowrap">抽籤規則</span>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                disabled={isDrawing}
                onClick={() => onChangeAllowRepeat(false)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed ${
                  !allowRepeat
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                不重複抽取
              </button>
              <button
                type="button"
                disabled={isDrawing}
                onClick={() => onChangeAllowRepeat(true)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed ${
                  allowRepeat
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                可重複抽取
              </button>
            </div>
          </div>

          {/* Unboxed Metadata Stats */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 tabular-nums">
            <span>名單 {students.length} 人</span>
            <span aria-hidden="true">·</span>
            {allowRepeat ? (
              <span>已抽 {drawHistory.length} 次</span>
            ) : (
              <span>
                待抽 <strong className="font-semibold text-slate-800">{availablePool.length}</strong> 人
              </span>
            )}
          </div>
        </div>

        {/* Sound Toggle */}
        <button
          type="button"
          onClick={onToggleSound}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            soundEnabled
              ? 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
              : 'border-slate-200 bg-slate-100 text-slate-500 hover:text-slate-700'
          }`}
        >
          {soundEnabled ? (
            <>
              <Volume2 className="w-3.5 h-3.5 text-blue-600" />
              音效：開啟
            </>
          ) : (
            <>
              <VolumeX className="w-3.5 h-3.5 text-slate-400" />
              音效：靜音
            </>
          )}
        </button>
      </div>

      {/* Main Spotlight Stage */}
      <div className="relative flex-1 min-h-[340px] flex flex-col items-center justify-center bg-white border border-slate-200 rounded-xl px-6 py-10 overflow-hidden">
        {/* Subtle grid background texture */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'radial-gradient(#cbd5e1 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {students.length === 0 ? (
          <div className="relative z-10 text-center max-w-md space-y-3">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-lg font-semibold text-slate-800">尚未載入學生名單</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              請在左側名單欄上傳 CSV 或貼上學生姓名，或直接載入模擬名單快速體驗課堂抽籤。
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {onLoadMockRoster && (
                <button
                  type="button"
                  onClick={onLoadMockRoster}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  載入模擬名單（24人）
                </button>
              )}
              {onOpenRosterOnMobile && (
                <button
                  type="button"
                  onClick={onOpenRosterOnMobile}
                  className="lg:hidden inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  前往設定名單
                </button>
              )}
            </div>
          </div>
        ) : isPoolExhausted && !isDrawing ? (
          <div className="relative z-10 text-center max-w-md space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xl font-bold text-slate-900">本輪 {students.length} 位學生皆已抽完</h3>
              {winner && (
                <p className="text-sm text-slate-500">
                  最後一位抽中：<span className="font-semibold text-slate-800">{winner.name}</span>
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={onResetHistory}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                重置名單，開始新一輪
              </button>
              <button
                type="button"
                onClick={() => onChangeAllowRepeat(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Repeat className="w-4 h-4" />
                改為可重複抽取
              </button>
            </div>
          </div>
        ) : (
          <div className="relative z-10 w-full max-w-xl flex flex-col items-center text-center">
            {/* Status label (unboxed text) */}
            <p className="text-xs font-medium text-slate-500 mb-6 tabular-nums">
              {isDrawing
                ? '正在隨機抽取中...'
                : winner
                  ? `第 ${drawHistory.length} 順位抽中`
                  : allowRepeat
                    ? `準備抽籤 · 共 ${students.length} 位候選（可重複）`
                    : `準備抽籤 · 剩餘 ${availablePool.length} 位待抽`}
            </p>

            {/* Kinetic Name Reel / Spotlight */}
            <div className="relative w-full py-4 flex flex-col items-center justify-center min-h-[180px]">
              {/* Celebratory Burst on Winner Reveal */}
              <AnimatePresence>
                {winner && !isDrawing && burstKey > 0 && (
                  <div
                    key={burstKey}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                  >
                    {burstParticles.map((p) => (
                      <motion.span
                        key={p.id}
                        initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
                        animate={{
                          x: Math.cos(p.angle) * p.distance,
                          y: Math.sin(p.angle) * p.distance,
                          scale: 1,
                          opacity: 0,
                        }}
                        transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
                        style={{
                          width: p.size,
                          height: p.size,
                          backgroundColor: p.color,
                        }}
                        className="absolute rounded-xs"
                      />
                    ))}
                  </div>
                )}
              </AnimatePresence>

              {/* Rolling Preview Above */}
              <div className="h-7 flex items-center justify-center overflow-hidden">
                {isDrawing && prevRollingStudent && (
                  <span className="text-lg font-medium text-slate-300 select-none">
                    {prevRollingStudent.name}
                  </span>
                )}
              </div>

              {/* Center Focal Name */}
              <div className="my-2 w-full flex items-center justify-center">
                {isDrawing && activeRollingStudent ? (
                  <div className="px-8 py-5 rounded-2xl border border-blue-200 bg-blue-50/50 min-w-[260px] max-w-full">
                    <span className="block font-display font-extrabold tracking-tight text-slate-900 text-4xl sm:text-5xl md:text-6xl truncate">
                      {activeRollingStudent.name}
                    </span>
                  </div>
                ) : winner ? (
                  <motion.div
                    key={`winner-${winner.id}-${drawHistory.length}`}
                    initial={{ scale: 0.86, opacity: 0.4 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                    className="px-10 py-6 rounded-2xl border-2 border-blue-600 bg-white shadow-sm min-w-[280px] max-w-full"
                  >
                    <span className="block font-display font-extrabold tracking-tight text-blue-700 text-4xl sm:text-5xl md:text-6xl truncate">
                      {winner.name}
                    </span>
                  </motion.div>
                ) : (
                  <div className="px-10 py-6 rounded-2xl border border-slate-200 bg-slate-50/70 min-w-[280px]">
                    <span className="block font-display font-bold text-slate-400 text-3xl sm:text-4xl">
                      準備好就開始抽籤
                    </span>
                  </div>
                )}
              </div>

              {/* Rolling Preview Below */}
              <div className="h-7 flex items-center justify-center overflow-hidden">
                {isDrawing && nextRollingStudent && (
                  <span className="text-lg font-medium text-slate-300 select-none">
                    {nextRollingStudent.name}
                  </span>
                )}
              </div>
            </div>

            {/* Primary Draw Button */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                disabled={isDrawing || availablePool.length === 0}
                onClick={handleStartDraw}
                className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 text-base font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 active:scale-[0.99] disabled:bg-slate-300 disabled:text-slate-500 transition-all cursor-pointer disabled:cursor-not-allowed whitespace-nowrap shrink-0"
              >
                <Play className="w-4 h-4 fill-current" />
                {isDrawing ? '抽取中...' : winner ? '再抽下一位' : '開始隨機抽籤'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Draw History Strip */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-xs text-slate-500 tabular-nums">
            <h3 className="text-sm font-semibold text-slate-900">抽籤紀錄</h3>
            <span aria-hidden="true">·</span>
            <span>累計 {drawHistory.length} 次</span>
          </div>
          {drawHistory.length > 0 && (
            <button
              type="button"
              disabled={isDrawing}
              onClick={() => {
                setWinner(null);
                onResetHistory();
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              重置抽籤紀錄
            </button>
          )}
        </div>

        {drawHistory.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">
            尚無抽籤紀錄，點擊上方「開始隨機抽籤」後將依序顯示於此。
          </p>
        ) : (
          <div className="pt-3 flex flex-wrap gap-2 max-h-40 overflow-y-auto">
            {drawHistory.map((record, idx) => (
              <div
                key={record.id}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs"
              >
                <span className="font-mono tabular-nums text-slate-400">
                  #{drawHistory.length - idx}
                </span>
                <span className="font-medium text-slate-800">{record.student.name}</span>
                {!allowRepeat && (
                  <button
                    type="button"
                    disabled={isDrawing}
                    onClick={() => onUndoDraw(record.id)}
                    title="放回待抽名單"
                    className="text-slate-400 hover:text-blue-600 transition-colors cursor-pointer disabled:opacity-40"
                    aria-label={`將 ${record.student.name} 放回待抽名單`}
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
