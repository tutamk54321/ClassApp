import { useEffect, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { DrawRecord, RemainderMode, Student, StudentGroup, WorkspaceTab } from './types';
import { buildStudentsFromNames, DEMO_STUDENT_NAMES } from './utils/csvParser';
import { RosterPanel } from './components/RosterPanel';
import { RandomPicker } from './components/RandomPicker';
import { GroupGenerator } from './components/GroupGenerator';

const STORAGE_KEYS = {
  STUDENTS: 'classroom_helper_students_v1',
  INIT: 'classroom_helper_initialized_v1',
  SOUND: 'classroom_helper_sound_v1',
  ALLOW_REPEAT: 'classroom_helper_allow_repeat_v1',
  GROUP_SIZE: 'classroom_helper_group_size_v1',
};

function loadInitialStudents(): Student[] {
  try {
    const initialized = localStorage.getItem(STORAGE_KEYS.INIT);
    const saved = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    if (initialized && saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
    if (!initialized) {
      const demo = buildStudentsFromNames(DEMO_STUDENT_NAMES, true);
      localStorage.setItem(STORAGE_KEYS.INIT, '1');
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(demo));
      return demo;
    }
  } catch {
    // Fallback to demo roster if storage is unavailable
  }
  return buildStudentsFromNames(DEMO_STUDENT_NAMES, true);
}

export default function App() {
  const [students, setStudents] = useState<Student[]>(loadInitialStudents);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('picker');
  const [showSidebar, setShowSidebar] = useState(true);

  const [allowRepeat, setAllowRepeat] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.ALLOW_REPEAT) === 'true';
    } catch {
      return false;
    }
  });

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.SOUND);
      return val === null ? true : val === 'true';
    } catch {
      return true;
    }
  });

  const [drawHistory, setDrawHistory] = useState<DrawRecord[]>([]);

  const [groupSize, setGroupSize] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(STORAGE_KEYS.GROUP_SIZE));
      return saved >= 2 ? saved : 4;
    } catch {
      return 4;
    }
  });
  const [remainderMode, setRemainderMode] = useState<RemainderMode>('balanced');
  const [groups, setGroups] = useState<StudentGroup[]>([]);

  // Persist roster & preferences
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.INIT, '1');
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
    } catch {
      // Ignore storage quota errors
    }
  }, [students]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SOUND, String(soundEnabled));
    } catch {
      // Ignore
    }
  }, [soundEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ALLOW_REPEAT, String(allowRepeat));
    } catch {
      // Ignore
    }
  }, [allowRepeat]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.GROUP_SIZE, String(groupSize));
    } catch {
      // Ignore
    }
  }, [groupSize]);

  const handleSetStudents = (next: Student[]) => {
    setStudents(next);
    setDrawHistory([]);
    setGroups([]);
  };

  const handleAppendStudents = (added: Student[]) => {
    setStudents((prev) => [...prev, ...added]);
    setGroups([]);
  };

  const handleRemoveStudent = (id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
    setDrawHistory((prev) => prev.filter((r) => r.student.id !== id));
    setGroups((prev) =>
      prev
        .map((g) => ({
          ...g,
          members: g.members.filter((m) => m.id !== id),
        }))
        .filter((g) => g.members.length > 0),
    );
  };

  const handleClearStudents = () => {
    setStudents([]);
    setDrawHistory([]);
    setGroups([]);
  };

  const handleRecordDraw = (student: Student) => {
    setDrawHistory((prev) => [
      {
        id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        student,
        round: prev.length + 1,
        timestamp: Date.now(),
      },
      ...prev,
    ]);
  };

  const handleUndoDraw = (recordId: string) => {
    setDrawHistory((prev) => prev.filter((item) => item.id !== recordId));
  };

  const handleResetHistory = () => {
    setDrawHistory([]);
  };

  const handleLoadMockRoster = () => {
    const demo = buildStudentsFromNames(DEMO_STUDENT_NAMES, true);
    handleSetStudents(demo);
  };

  const handleNavClick = (tab: WorkspaceTab) => {
    if (tab === 'roster') {
      setActiveTab('roster');
      setShowSidebar(true);
    } else {
      setActiveTab(tab);
    }
  };

  // On desktop, 'picker' and 'grouping' are the main stage views while RosterPanel sits in the left column
  const desktopStageTab = activeTab === 'roster' ? 'picker' : activeTab;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar (3-zone contract) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          {/* Zone 1: Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('picker');
            }}
            className="text-base sm:text-lg font-display font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            課堂點名分組
          </a>

          {/* Zone 2: Clean Text Navigation Links */}
          <nav className="flex items-center gap-6 sm:gap-8 text-sm font-medium h-full">
            <button
              type="button"
              onClick={() => handleNavClick('picker')}
              className={`h-full inline-flex items-center border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                desktopStageTab === 'picker' && activeTab !== 'roster'
                  ? 'border-blue-600 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              隨機抽籤
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('grouping')}
              className={`h-full inline-flex items-center border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                desktopStageTab === 'grouping' && activeTab !== 'roster'
                  ? 'border-blue-600 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              自動分組
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('roster')}
              className={`lg:hidden h-full inline-flex items-center border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'roster'
                  ? 'border-blue-600 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              名單管理
            </button>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="hidden lg:flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setShowSidebar((prev) => !prev)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {showSidebar ? (
                <>
                  <PanelLeftClose className="w-3.5 h-3.5" />
                  收合名單欄
                </>
              ) : (
                <>
                  <PanelLeftOpen className="w-3.5 h-3.5" />
                  展開名單欄（{students.length} 人）
                </>
              )}
            </button>
          </div>
          {/* Mobile spacer for balanced flex alignment */}
          <div className="lg:hidden w-4 shrink-0" aria-hidden="true" />
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col lg:flex-row items-stretch gap-6 min-h-[calc(100vh-8.5rem)]">
          {/* Left Roster Column (Always visible on desktop if showSidebar=true; tab-controlled on mobile) */}
          <div
            className={`${
              activeTab === 'roster' ? 'block' : 'hidden'
            } ${showSidebar ? 'lg:block' : 'lg:hidden'} w-full lg:w-[340px] xl:w-[360px] shrink-0`}
          >
            <RosterPanel
              students={students}
              onSetStudents={handleSetStudents}
              onAppendStudents={handleAppendStudents}
              onRemoveStudent={handleRemoveStudent}
              onClearStudents={handleClearStudents}
              onResetDrawHistory={handleResetHistory}
            />
          </div>

          {/* Right Primary Feature Stage */}
          <section
            className={`${
              activeTab === 'roster' ? 'hidden lg:block' : 'block'
            } flex-1 min-w-0`}
          >
            {desktopStageTab === 'picker' ? (
              <RandomPicker
                students={students}
                allowRepeat={allowRepeat}
                onChangeAllowRepeat={setAllowRepeat}
                soundEnabled={soundEnabled}
                onToggleSound={() => setSoundEnabled((prev) => !prev)}
                drawHistory={drawHistory}
                onRecordDraw={handleRecordDraw}
                onUndoDraw={handleUndoDraw}
                onResetHistory={handleResetHistory}
                onLoadMockRoster={handleLoadMockRoster}
                onOpenRosterOnMobile={() => setActiveTab('roster')}
              />
            ) : (
              <GroupGenerator
                students={students}
                groupSize={groupSize}
                onChangeGroupSize={setGroupSize}
                remainderMode={remainderMode}
                onChangeRemainderMode={setRemainderMode}
                groups={groups}
                onSetGroups={setGroups}
                soundEnabled={soundEnabled}
                onLoadMockRoster={handleLoadMockRoster}
                onOpenRosterOnMobile={() => setActiveTab('roster')}
              />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
