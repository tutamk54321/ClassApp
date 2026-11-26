import React, { useMemo, useRef, useState } from 'react';
import {
  Upload,
  ClipboardPaste,
  Plus,
  Trash2,
  Download,
  Users,
  FileSpreadsheet,
  Check,
  X,
  AlertTriangle,
  BookOpen,
} from 'lucide-react';
import { ParsedCsvPreview, Student } from '../types';
import {
  buildStudentsFromNames,
  decodeUploadedTextFile,
  DEMO_STUDENT_NAMES,
  downloadSampleCsv,
  parseCsvContent,
  parsePastedNames,
} from '../utils/csvParser';

interface RosterPanelProps {
  students: Student[];
  onSetStudents: (next: Student[]) => void;
  onAppendStudents: (added: Student[]) => void;
  onRemoveStudent: (id: string) => void;
  onClearStudents: () => void;
  onResetDrawHistory?: () => void;
}

type InputMode = 'paste' | 'csv';

interface DuplicateAnalysis {
  duplicateIndices: Set<number>;
  firstSeenIndices: Set<number>;
  duplicateCount: number;
}

function analyzeDuplicates(names: string[]): DuplicateAnalysis {
  const seen = new Map<string, number>();
  const duplicateIndices = new Set<number>();
  const firstSeenIndices = new Set<number>();

  names.forEach((raw, idx) => {
    const key = raw.trim();
    if (!key) return;
    if (seen.has(key)) {
      duplicateIndices.add(idx);
      firstSeenIndices.add(seen.get(key)!);
    } else {
      seen.set(key, idx);
    }
  });

  return {
    duplicateIndices,
    firstSeenIndices,
    duplicateCount: duplicateIndices.size,
  };
}

export const RosterPanel: React.FC<RosterPanelProps> = ({
  students,
  onSetStudents,
  onAppendStudents,
  onRemoveStudent,
  onClearStudents,
}) => {
  const [inputMode, setInputMode] = useState<InputMode>('paste');
  const [pasteText, setPasteText] = useState('');
  const [quickAddName, setQuickAddName] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // CSV preview states
  const [csvPreview, setCsvPreview] = useState<ParsedCsvPreview | null>(null);
  const [selectedColIdx, setSelectedColIdx] = useState(0);
  const [treatFirstAsHeader, setTreatFirstAsHeader] = useState(true);
  const [csvDedupedNames, setCsvDedupedNames] = useState<string[] | null>(null);

  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showFeedback = (msg: string) => {
    setErrorMsg(null);
    setFeedbackMsg(msg);
    window.setTimeout(() => {
      setFeedbackMsg((prev) => (prev === msg ? null : prev));
    }, 3600);
  };

  // Live parsed names from paste textarea
  const pastedNames = useMemo(() => parsePastedNames(pasteText), [pasteText]);
  const pasteDupAnalysis = useMemo(() => analyzeDuplicates(pastedNames), [pastedNames]);

  // Live parsed names from CSV preview
  const rawCsvColumnNames = useMemo(() => {
    if (!csvPreview) return [];
    const sourceRows = treatFirstAsHeader
      ? csvPreview.rows
      : csvPreview.hasHeaderRow
        ? [csvPreview.headers, ...csvPreview.rows]
        : csvPreview.rows;

    return sourceRows
      .map((row) => (row[selectedColIdx] ?? '').trim())
      .filter((val) => val.length > 0);
  }, [csvPreview, selectedColIdx, treatFirstAsHeader]);

  const effectiveCsvNames = csvDedupedNames ?? rawCsvColumnNames;
  const csvDupAnalysis = useMemo(
    () => analyzeDuplicates(effectiveCsvNames),
    [effectiveCsvNames],
  );

  // Active roster duplicate analysis
  const rosterDupAnalysis = useMemo(
    () => analyzeDuplicates(students.map((s) => s.name)),
    [students],
  );

  const handleRemovePasteDuplicates = () => {
    if (pasteDupAnalysis.duplicateCount === 0) return;
    const uniqueNames = Array.from(new Set(pastedNames));
    const removedCount = pastedNames.length - uniqueNames.length;
    setPasteText(uniqueNames.join('\n'));
    showFeedback(`已移除 ${removedCount} 筆重複姓名`);
  };

  const handleApplyPasted = (mode: 'replace' | 'append') => {
    if (pastedNames.length === 0) {
      setErrorMsg('請先貼上至少一位學生姓名');
      return;
    }

    if (mode === 'replace') {
      const next = buildStudentsFromNames(pastedNames, false);
      onSetStudents(next);
      setPasteText('');
      showFeedback(`已匯入 ${next.length} 位學生名單`);
    } else {
      const added = buildStudentsFromNames(pastedNames, false);
      onAppendStudents(added);
      setPasteText('');
      showFeedback(`已加入 ${added.length} 位學生`);
    }
  };

  const handleFileProcess = async (file: File) => {
    setErrorMsg(null);
    if (!file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.txt')) {
      setErrorMsg('請上傳 .csv 或 .txt 格式的名單檔案');
      return;
    }

    try {
      const text = await decodeUploadedTextFile(file);
      const preview = parseCsvContent(text, file.name);
      if (preview.rows.length === 0 && preview.headers.length === 0) {
        setErrorMsg('檔案內容為空，請確認檔案內有學生姓名');
        return;
      }

      // Always open preview list so teachers can inspect & deduplicate before confirming
      setCsvPreview(preview);
      setSelectedColIdx(preview.suggestedColumnIndex);
      setTreatFirstAsHeader(preview.hasHeaderRow);
      setCsvDedupedNames(null);
    } catch {
      setErrorMsg('讀取檔案失敗，請確認檔案編碼格式正確');
    }
  };

  const handleRemoveCsvDuplicates = () => {
    if (csvDupAnalysis.duplicateCount === 0) return;
    const uniqueNames = Array.from(new Set(effectiveCsvNames));
    const removedCount = effectiveCsvNames.length - uniqueNames.length;
    setCsvDedupedNames(uniqueNames);
    showFeedback(`已從預覽名單移除 ${removedCount} 筆重複姓名`);
  };

  const handleConfirmCsvColumn = (mode: 'replace' | 'append') => {
    if (!csvPreview) return;
    if (effectiveCsvNames.length === 0) {
      setErrorMsg('所選欄位中沒有有效的學生姓名');
      return;
    }

    if (mode === 'replace') {
      const next = buildStudentsFromNames(effectiveCsvNames, false);
      onSetStudents(next);
      showFeedback(`已從 ${csvPreview.fileName} 匯入 ${next.length} 位學生`);
    } else {
      const added = buildStudentsFromNames(effectiveCsvNames, false);
      onAppendStudents(added);
      showFeedback(`已從 ${csvPreview.fileName} 加入 ${added.length} 位學生`);
    }
    setCsvPreview(null);
    setCsvDedupedNames(null);
  };

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickAddName.trim();
    if (!trimmed) return;
    const added = buildStudentsFromNames([trimmed], false);
    onAppendStudents(added);
    setQuickAddName('');
    setErrorMsg(null);
  };

  const handleRemoveRosterDuplicates = () => {
    if (rosterDupAnalysis.duplicateCount === 0) return;
    const seen = new Set<string>();
    const deduplicated: Student[] = [];
    for (const s of students) {
      if (!seen.has(s.name)) {
        seen.add(s.name);
        deduplicated.push(s);
      }
    }
    const removedCount = students.length - deduplicated.length;
    onSetStudents(deduplicated);
    showFeedback(`已移除現有名單中的 ${removedCount} 筆重複姓名`);
  };

  const handleLoadDemo = () => {
    const demo = buildStudentsFromNames(DEMO_STUDENT_NAMES, true);
    onSetStudents(demo);
    setCsvPreview(null);
    setCsvDedupedNames(null);
    showFeedback(`已載入模擬名單（${demo.length} 位學生），可直接測試抽籤與分組`);
  };

  return (
    <aside className="flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden h-full">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600 shrink-0" />
            <h2 className="text-base font-semibold text-slate-900">學生名單來源</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoadDemo}
              title="一鍵載入 24 位學生模擬名單以快速體驗功能"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <BookOpen className="w-3 h-3" />
              模擬名單
            </button>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {students.length} 人
            </span>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="mt-3 grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setInputMode('paste')}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              inputMode === 'paste'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            貼上名單
          </button>
          <button
            type="button"
            onClick={() => setInputMode('csv')}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              inputMode === 'csv'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            上傳 CSV
          </button>
        </div>
      </div>

      {/* Import Zone */}
      <div className="px-5 py-4 border-b border-slate-100 space-y-3">
        {inputMode === 'paste' ? (
          <div className="space-y-2.5">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={4}
              placeholder={'每行輸入一位學生姓名，或使用逗號、頓號分隔\n例如：\n陳宥廷\n林品妍\n黃子軒'}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 resize-y"
            />

            {/* Live Paste Preview List with Duplicate Highlighting */}
            {pastedNames.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200 bg-white flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-700 tabular-nums">
                    匯入預覽（{pastedNames.length} 筆）
                  </span>
                  {pasteDupAnalysis.duplicateCount > 0 ? (
                    <button
                      type="button"
                      onClick={handleRemovePasteDuplicates}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                      移除重複（{pasteDupAnalysis.duplicateCount}）
                    </button>
                  ) : (
                    <span className="text-[11px] text-emerald-700 font-medium">
                      無重複姓名
                    </span>
                  )}
                </div>

                {pasteDupAnalysis.duplicateCount > 0 && (
                  <div className="px-3 py-1.5 bg-amber-50 border-b border-amber-200 flex items-center gap-1.5 text-[11px] text-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>偵測到 {pasteDupAnalysis.duplicateCount} 筆重複姓名，已於下方標記</span>
                  </div>
                )}

                <ul className="max-h-36 overflow-y-auto divide-y divide-slate-100 bg-white">
                  {pastedNames.map((name, idx) => {
                    const isExtraDup = pasteDupAnalysis.duplicateIndices.has(idx);
                    const isFirstDup = pasteDupAnalysis.firstSeenIndices.has(idx);
                    return (
                      <li
                        key={`${idx}-${name}`}
                        className={`flex items-center justify-between gap-2 px-3 py-1.5 text-xs ${
                          isExtraDup
                            ? 'bg-amber-50/90 text-amber-900'
                            : isFirstDup
                              ? 'bg-amber-50/40 text-slate-800'
                              : 'text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 text-right font-mono tabular-nums text-slate-400 shrink-0">
                            {idx + 1}
                          </span>
                          <span className="truncate font-medium">{name}</span>
                        </div>
                        {isExtraDup ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 shrink-0">
                            <AlertTriangle className="w-3 h-3" />
                            重複
                          </span>
                        ) : isFirstDup ? (
                          <span className="text-[11px] text-amber-600 shrink-0">
                            首次出現
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleApplyPasted('replace')}
                disabled={pastedNames.length === 0}
                className="px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
              >
                覆蓋目前名單{pastedNames.length > 0 ? ` (${pastedNames.length})` : ''}
              </button>
              <button
                type="button"
                onClick={() => handleApplyPasted('append')}
                disabled={pastedNames.length === 0}
                className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
              >
                加入現有名單
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {!csvPreview ? (
              <>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleFileProcess(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  className={`flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-6 text-center transition-colors cursor-pointer ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50/70'
                      : 'border-slate-300 bg-slate-50/60 hover:border-blue-400 hover:bg-slate-50'
                  }`}
                >
                  <FileSpreadsheet className="w-7 h-7 text-slate-400 mb-2" />
                  <p className="text-xs font-medium text-slate-700">
                    點擊選擇或拖曳 CSV 檔案至此
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    支援 UTF-8 與 Excel Big5 編碼格式
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt,text/csv,text/plain"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileProcess(file);
                      e.target.value = '';
                    }}
                  />
                </div>
                <div className="flex items-center justify-end text-xs">
                  <button
                    type="button"
                    onClick={downloadSampleCsv}
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    下載範例 CSV
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800 truncate">
                    {csvPreview.fileName}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCsvPreview(null);
                      setCsvDedupedNames(null);
                    }}
                    className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                    aria-label="取消 CSV 預覽"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {csvPreview.headers.length > 1 && (
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      選擇姓名所在欄位
                    </label>
                    <select
                      value={selectedColIdx}
                      onChange={(e) => {
                        setSelectedColIdx(Number(e.target.value));
                        setCsvDedupedNames(null);
                      }}
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                    >
                      {csvPreview.headers.map((header, idx) => (
                        <option key={idx} value={idx}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {csvPreview.hasHeaderRow && (
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={treatFirstAsHeader}
                      onChange={(e) => {
                        setTreatFirstAsHeader(e.target.checked);
                        setCsvDedupedNames(null);
                      }}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    略過第一列標題列
                  </label>
                )}

                {/* CSV Preview List with Duplicate Detection & One-Click Removal */}
                <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                  <div className="px-2.5 py-2 border-b border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-700 tabular-nums">
                      預覽名單（{effectiveCsvNames.length} 筆）
                    </span>
                    {csvDupAnalysis.duplicateCount > 0 ? (
                      <button
                        type="button"
                        onClick={handleRemoveCsvDuplicates}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                        移除重複（{csvDupAnalysis.duplicateCount}）
                      </button>
                    ) : (
                      <span className="text-[11px] text-emerald-700 font-medium">
                        無重複姓名
                      </span>
                    )}
                  </div>

                  {csvDupAnalysis.duplicateCount > 0 && (
                    <div className="px-2.5 py-1.5 bg-amber-50 border-b border-amber-200 flex items-center gap-1.5 text-[11px] text-amber-800">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>偵測到 {csvDupAnalysis.duplicateCount} 筆重複姓名，已於下方標記</span>
                    </div>
                  )}

                  <ul className="max-h-40 overflow-y-auto divide-y divide-slate-100">
                    {effectiveCsvNames.map((name, idx) => {
                      const isExtraDup = csvDupAnalysis.duplicateIndices.has(idx);
                      const isFirstDup = csvDupAnalysis.firstSeenIndices.has(idx);
                      return (
                        <li
                          key={`${idx}-${name}`}
                          className={`flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs ${
                            isExtraDup
                              ? 'bg-amber-50/90 text-amber-900'
                              : isFirstDup
                                ? 'bg-amber-50/40 text-slate-800'
                                : 'text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 text-right font-mono tabular-nums text-slate-400 shrink-0">
                              {idx + 1}
                            </span>
                            <span className="truncate font-medium">{name}</span>
                          </div>
                          {isExtraDup ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 shrink-0">
                              <AlertTriangle className="w-3 h-3" />
                              重複
                            </span>
                          ) : isFirstDup ? (
                            <span className="text-[11px] text-amber-600 shrink-0">
                              首次出現
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleConfirmCsvColumn('replace')}
                    disabled={effectiveCsvNames.length === 0}
                    className="px-2.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    覆蓋匯入 ({effectiveCsvNames.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmCsvColumn('append')}
                    disabled={effectiveCsvNames.length === 0}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    加入名單
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Feedback / Error */}
        {feedbackMsg && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="flex items-center gap-1.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            <X className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Quick Add + Roster List */}
      <div className="flex-1 flex flex-col min-h-0 px-5 py-4">
        <form onSubmit={handleQuickAdd} className="flex items-center gap-2 mb-3">
          <input
            type="text"
            value={quickAddName}
            onChange={(e) => setQuickAddName(e.target.value)}
            placeholder="快速新增單一學生姓名..."
            className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
          />
          <button
            type="submit"
            disabled={!quickAddName.trim()}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" />
            新增
          </button>
        </form>

        {/* Roster Quick Actions */}
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 text-xs">
          <span className="font-medium text-slate-500">目前班級名單</span>
          <div className="flex items-center gap-3">
            {rosterDupAnalysis.duplicateCount > 0 && (
              <button
                type="button"
                onClick={handleRemoveRosterDuplicates}
                className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-800 font-semibold cursor-pointer whitespace-nowrap shrink-0"
              >
                <AlertTriangle className="w-3 h-3" />
                移除重複 ({rosterDupAnalysis.duplicateCount})
              </button>
            )}
            {students.length > 0 && (
              <button
                type="button"
                onClick={onClearStudents}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3 h-3" />
                清空名單
              </button>
            )}
          </div>
        </div>

        {/* List */}
        {students.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm font-medium text-slate-600">目前尚無學生名單</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
              可於上方貼上名單或上傳 CSV，或先載入模擬名單快速體驗功能
            </p>
            <button
              type="button"
              onClick={handleLoadDemo}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
            >
              載入模擬名單（24人）
            </button>
          </div>
        ) : (
          <ul className="flex-1 overflow-y-auto divide-y divide-slate-100 -mx-2 px-2 mt-1 max-h-[340px] lg:max-h-none">
            {students.map((student, idx) => {
              const isExtraDup = rosterDupAnalysis.duplicateIndices.has(idx);
              return (
                <li
                  key={student.id}
                  className={`group flex items-center justify-between py-2 px-1.5 rounded-md transition-colors ${
                    isExtraDup ? 'bg-amber-50/80 hover:bg-amber-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 text-right text-xs font-mono tabular-nums text-slate-400 shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-sm text-slate-800 truncate">{student.name}</span>
                    {isExtraDup && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-amber-700 shrink-0">
                        <AlertTriangle className="w-3 h-3" />
                        重複
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveStudent(student.id)}
                    className="opacity-60 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer shrink-0"
                    aria-label={`移除 ${student.name}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
};
