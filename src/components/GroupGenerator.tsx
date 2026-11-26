import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Shuffle,
  Minus,
  Plus,
  Copy,
  Check,
  Download,
  ArrowLeftRight,
  Users,
} from 'lucide-react';
import { RemainderMode, Student, StudentGroup } from '../types';
import { playGroupShuffleSound } from '../utils/sound';

interface GroupGeneratorProps {
  students: Student[];
  groupSize: number;
  onChangeGroupSize: (size: number) => void;
  remainderMode: RemainderMode;
  onChangeRemainderMode: (mode: RemainderMode) => void;
  groups: StudentGroup[];
  onSetGroups: (groups: StudentGroup[]) => void;
  soundEnabled: boolean;
  onLoadMockRoster?: () => void;
  onOpenRosterOnMobile?: () => void;
}

const GROUP_TOP_BARS = [
  'bg-blue-600',
  'bg-emerald-600',
  'bg-amber-500',
  'bg-indigo-600',
  'bg-rose-500',
  'bg-teal-600',
  'bg-sky-600',
  'bg-violet-600',
];

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildGroups(
  students: Student[],
  groupSize: number,
  remainderMode: RemainderMode,
): StudentGroup[] {
  if (students.length === 0) return [];
  const size = Math.max(2, Math.min(students.length, groupSize));
  const shuffled = shuffleArray(students);

  if (remainderMode === 'fixed') {
    const groups: StudentGroup[] = [];
    for (let i = 0; i < shuffled.length; i += size) {
      const idx = groups.length + 1;
      groups.push({
        id: `grp-${Date.now()}-${idx}`,
        index: idx,
        name: `第 ${idx} 組`,
        members: shuffled.slice(i, i + size),
      });
    }
    return groups;
  }

  // Balanced distribution: avoid tiny remainder groups where possible
  const numGroups = Math.max(1, Math.round(shuffled.length / size));
  const baseSize = Math.floor(shuffled.length / numGroups);
  const extra = shuffled.length % numGroups;

  const groups: StudentGroup[] = [];
  let cursor = 0;
  for (let i = 0; i < numGroups; i++) {
    const count = baseSize + (i < extra ? 1 : 0);
    const idx = i + 1;
    groups.push({
      id: `grp-${Date.now()}-${idx}`,
      index: idx,
      name: `第 ${idx} 組`,
      members: shuffled.slice(cursor, cursor + count),
    });
    cursor += count;
  }
  return groups;
}

export const GroupGenerator: React.FC<GroupGeneratorProps> = ({
  students,
  groupSize,
  onChangeGroupSize,
  remainderMode,
  onChangeRemainderMode,
  groups,
  onSetGroups,
  soundEnabled,
  onLoadMockRoster,
  onOpenRosterOnMobile,
}) => {
  const [generationKey, setGenerationKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [selectedSwap, setSelectedSwap] = useState<{
    groupId: string;
    studentId: string;
    studentName: string;
  } | null>(null);

  const maxAllowedSize = Math.max(2, students.length);
  const effectiveSize = Math.max(2, Math.min(maxAllowedSize, groupSize));

  // Preview calculation before clicking generate
  const previewSummary = useMemo(() => {
    const total = students.length;
    if (total === 0) return '請先匯入學生名單';
    if (total <= effectiveSize) return `共 ${total} 人 · 將分為 1 組（${total} 人）`;

    if (remainderMode === 'fixed') {
      const fullGroups = Math.floor(total / effectiveSize);
      const rem = total % effectiveSize;
      if (rem === 0) {
        return `共 ${total} 人 · 將分為 ${fullGroups} 組（每組 ${effectiveSize} 人）`;
      }
      return `共 ${total} 人 · 將分為 ${fullGroups + 1} 組（${fullGroups} 組 ${effectiveSize} 人、1 組 ${rem} 人）`;
    } else {
      const numGroups = Math.max(1, Math.round(total / effectiveSize));
      const base = Math.floor(total / numGroups);
      const extra = total % numGroups;
      if (extra === 0) {
        return `共 ${total} 人 · 將分為 ${numGroups} 組（每組 ${base} 人）`;
      }
      return `共 ${total} 人 · 將分為 ${numGroups} 組（${extra} 組 ${base + 1} 人、${numGroups - extra} 組 ${base} 人）`;
    }
  }, [students.length, effectiveSize, remainderMode]);

  const handleGenerate = () => {
    if (students.length === 0) return;
    const nextGroups = buildGroups(students, effectiveSize, remainderMode);
    onSetGroups(nextGroups);
    setGenerationKey((k) => k + 1);
    setSelectedSwap(null);
    if (soundEnabled) {
      playGroupShuffleSound();
    }
  };

  const handleStudentClick = (groupId: string, student: Student) => {
    if (!selectedSwap) {
      setSelectedSwap({
        groupId,
        studentId: student.id,
        studentName: student.name,
      });
      return;
    }

    if (selectedSwap.studentId === student.id && selectedSwap.groupId === groupId) {
      setSelectedSwap(null);
      return;
    }

    // Swap students between groups (or positions)
    const nextGroups = groups.map((g) => ({
      ...g,
      members: [...g.members],
    }));

    const sourceGroup = nextGroups.find((g) => g.id === selectedSwap.groupId);
    const targetGroup = nextGroups.find((g) => g.id === groupId);

    if (sourceGroup && targetGroup) {
      const sIdx = sourceGroup.members.findIndex((m) => m.id === selectedSwap.studentId);
      const tIdx = targetGroup.members.findIndex((m) => m.id === student.id);

      if (sIdx >= 0 && tIdx >= 0) {
        const temp = sourceGroup.members[sIdx];
        sourceGroup.members[sIdx] = targetGroup.members[tIdx];
        targetGroup.members[tIdx] = temp;
        onSetGroups(nextGroups);
      }
    }
    setSelectedSwap(null);
  };

  const handleCopyGroups = async () => {
    if (groups.length === 0) return;
    const text = groups
      .map((g) => `${g.name}（${g.members.length} 人）：${g.members.map((m) => m.name).join('、')}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard fallback not required in modern browsers
    }
  };

  const escapeCsvCell = (value: string): string => {
    if (/[",\r\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const handleExportCsv = () => {
    if (groups.length === 0) return;
    const rows = [['組別', '組內序號', '學生姓名']];
    groups.forEach((g) => {
      g.members.forEach((m, idx) => {
        rows.push([g.name, String(idx + 1), m.name]);
      });
    });
    const csv = '\uFEFF' + rows.map((r) => r.map(escapeCsvCell).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.download = `課堂分組結果_${dateStamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const presets = [2, 3, 4, 5, 6];

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Configuration Bar */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Group Size Stepper + Presets */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-slate-500 whitespace-nowrap">每組人數</span>
            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => onChangeGroupSize(Math.max(2, effectiveSize - 1))}
                disabled={effectiveSize <= 2}
                className="p-2 text-slate-600 hover:text-slate-900 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                aria-label="減少每組人數"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-11 text-center text-sm font-mono font-semibold tabular-nums text-slate-900">
                {effectiveSize} 人
              </span>
              <button
                type="button"
                onClick={() => onChangeGroupSize(Math.min(Math.max(2, students.length || 12), effectiveSize + 1))}
                disabled={students.length > 0 && effectiveSize >= students.length}
                className="p-2 text-slate-600 hover:text-slate-900 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                aria-label="增加每組人數"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-1">
              {presets.map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => onChangeGroupSize(num)}
                  className={`px-2.5 py-1.5 text-xs font-mono tabular-nums rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    effectiveSize === num
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {num}人
                </button>
              ))}
            </div>
          </div>

          {/* Remainder Mode Toggle */}
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-medium text-slate-500 whitespace-nowrap">餘數處理</span>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => onChangeRemainderMode('balanced')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  remainderMode === 'balanced'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                平均分散
              </button>
              <button
                type="button"
                onClick={() => onChangeRemainderMode('fixed')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  remainderMode === 'fixed'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                固定人數
              </button>
            </div>
          </div>
        </div>

        {/* Preview & Primary CTA Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-600 tabular-nums">{previewSummary}</p>

          <div className="flex flex-wrap items-center gap-2">
            {groups.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleCopyGroups}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      已複製名單
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      複製分組結果
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  下載 CSV 檔案
                </button>
              </>
            )}

            <button
              type="button"
              disabled={students.length === 0}
              onClick={handleGenerate}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap shrink-0"
            >
              <Shuffle className="w-3.5 h-3.5" />
              {groups.length > 0 ? '重新洗牌分組' : '開始自動分組'}
            </button>
          </div>
        </div>
      </div>

      {/* Visualized Group Board */}
      {students.length === 0 ? (
        <div className="flex-1 min-h-[340px] flex flex-col items-center justify-center bg-white border border-slate-200 rounded-xl px-6 py-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mb-3" />
          <h3 className="text-lg font-semibold text-slate-800">尚未載入學生名單</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md">
            請先在左側名單欄上傳 CSV 或貼上學生姓名，或直接載入模擬名單體驗自動分組。
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
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
      ) : groups.length === 0 ? (
        <div className="flex-1 min-h-[340px] flex flex-col items-center justify-center bg-white border border-slate-200 rounded-xl px-6 py-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-4">
            <Shuffle className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">準備進行視覺化分組</h3>
          <p className="text-sm text-slate-500 mt-1.5 max-w-md tabular-nums">
            目前名單共有 {students.length} 位學生，點擊「開始自動分組」即可依每組 {effectiveSize} 人隨機分配並呈現各組座位表。
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Shuffle className="w-4 h-4" />
            開始自動分組
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-4">
          {/* Interactive Swap Hint & Group Distribution Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2 text-xs text-slate-500 tabular-nums">
              <span>分組結果：{groups.length} 組</span>
              <span aria-hidden="true">·</span>
              <span>總計 {groups.reduce((sum, g) => sum + g.members.length, 0)} 人</span>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400" />
              {selectedSwap ? (
                <span className="text-blue-700 font-medium">
                  已選取「{selectedSwap.studentName}」，請點擊另一位學生進行互換
                </span>
              ) : (
                <span className="text-slate-500">
                  提示：點擊任兩位學生可手動互換組別
                </span>
              )}
            </div>
          </div>

          {/* Visual Group Distribution Proportion Strip */}
          <div className="flex h-2 w-full rounded-full overflow-hidden bg-slate-200 gap-0.5">
            {groups.map((group, idx) => (
              <div
                key={group.id}
                style={{ flexGrow: group.members.length }}
                className={`${GROUP_TOP_BARS[idx % GROUP_TOP_BARS.length]} transition-all`}
                title={`${group.name}：${group.members.length} 人`}
              />
            ))}
          </div>

          {/* Visual Group Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {groups.map((group, groupIdx) => {
              const topBarColor = GROUP_TOP_BARS[groupIdx % GROUP_TOP_BARS.length];
              return (
                <motion.div
                  key={`${generationKey}-${group.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.25,
                    delay: Math.min(groupIdx * 0.045, 0.35),
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col"
                >
                  {/* Clean top color indicator */}
                  <div className={`h-1 w-full ${topBarColor}`} />

                  {/* Group Header */}
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-slate-900">{group.name}</h4>
                    <span className="text-xs font-mono tabular-nums text-slate-500">
                      {group.members.length} 人
                    </span>
                  </div>

                  {/* Group Members */}
                  <ul className="p-2 space-y-1 flex-1">
                    {group.members.map((member, mIdx) => {
                      const isSelected =
                        selectedSwap?.groupId === group.id &&
                        selectedSwap?.studentId === member.id;
                      return (
                        <li key={member.id}>
                          <button
                            type="button"
                            onClick={() => handleStudentClick(group.id, member)}
                            className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-blue-50 text-blue-800 ring-1 ring-blue-500'
                                : 'hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={`w-5 h-5 rounded flex items-center justify-center text-[11px] font-mono tabular-nums shrink-0 ${
                                  isSelected
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {mIdx + 1}
                              </span>
                              <span className="text-sm font-medium truncate">
                                {member.name}
                              </span>
                            </div>
                            {isSelected && (
                              <span className="text-[11px] font-medium text-blue-600 shrink-0">
                                待機互換
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
