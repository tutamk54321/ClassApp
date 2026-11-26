export interface Student {
  id: string;
  name: string;
}

export interface DrawRecord {
  id: string;
  student: Student;
  round: number;
  timestamp: number;
}

export interface StudentGroup {
  id: string;
  index: number;
  name: string;
  members: Student[];
}

export type WorkspaceTab = 'picker' | 'grouping' | 'roster';

export type RemainderMode = 'balanced' | 'fixed';

export interface ParsedCsvPreview {
  headers: string[];
  rows: string[][];
  hasHeaderRow: boolean;
  suggestedColumnIndex: number;
  fileName: string;
}
