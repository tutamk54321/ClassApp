import { ParsedCsvPreview, Student } from '../types';

export const DEMO_STUDENT_NAMES: string[] = [
  '陳宥廷',
  '林品妍',
  '黃子軒',
  '張語彤',
  '李承恩',
  '王怡君',
  '吳宇翔',
  '蔡欣妤',
  '劉冠宇',
  '楊芷晴',
  '許哲瑋',
  '鄭羽希',
  '謝柏翰',
  '郭思穎',
  '洪家豪',
  '邱品蓁',
  '曾敬騰',
  '廖婉婷',
  '周俊傑',
  '徐若瑄',
  '賴威廷',
  '葉佳蓉',
  '蘇子豪',
  '莊心怡',
];

export function createStudentId(index: number, name: string): string {
  return `stu-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 6)}-${name.length}`;
}

export function buildStudentsFromNames(names: string[], deduplicate = false): Student[] {
  const cleaned = names
    .map((raw) => raw.trim())
    .filter((name) => name.length > 0);

  const finalNames = deduplicate ? Array.from(new Set(cleaned)) : cleaned;

  return finalNames.map((name, idx) => ({
    id: createStudentId(idx, name),
    name,
  }));
}

export function parsePastedNames(input: string): string[] {
  if (!input.trim()) return [];
  // Split by newlines, commas (half/full-width), Chinese enumeration comma, semicolons, or tabs
  return input
    .split(/[\r\n,，、;\t]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function detectDelimiter(sampleLines: string[]): string {
  const candidates = [',', '\t', ';'];
  let best = ',';
  let bestScore = -1;

  for (const delim of candidates) {
    const counts = sampleLines.map((line) => parseCsvLine(line, delim).length);
    const maxCols = Math.max(...counts, 0);
    if (maxCols > 1 && maxCols > bestScore) {
      bestScore = maxCols;
      best = delim;
    }
  }
  return best;
}

const NAME_HEADER_PATTERNS = [
  '姓名',
  '學生姓名',
  '名字',
  '學生',
  'name',
  'student',
  'student name',
  'full name',
  'fullname',
];

function isLikelyHeaderRow(firstRow: string[], secondRow?: string[]): boolean {
  if (firstRow.length === 0) return false;
  const normalized = firstRow.map((cell) => cell.toLowerCase().trim());

  const headerKeywords = [
    ...NAME_HEADER_PATTERNS,
    '座號',
    '學號',
    '編號',
    '班級',
    '性別',
    '備註',
    'id',
    'no',
    'number',
    'class',
    'gender',
    'email',
  ];

  if (normalized.some((cell) => headerKeywords.includes(cell))) {
    return true;
  }

  // If first row has non-numeric labels while second row starts with a number (e.g., seat number)
  if (secondRow && secondRow.length === firstRow.length) {
    const firstIsText = Number.isNaN(Number(firstRow[0]));
    const secondIsNum = firstRow[0] !== '' && secondRow[0] !== '' && !Number.isNaN(Number(secondRow[0]));
    if (firstIsText && secondIsNum) return true;
  }

  return false;
}

function suggestNameColumn(headers: string[], dataRows: string[][]): number {
  // 1. Check explicit header names
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase().trim();
    if (NAME_HEADER_PATTERNS.includes(h)) {
      return i;
    }
  }
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase().trim();
    if (h.includes('姓名') || h.includes('name')) {
      return i;
    }
  }

  // 2. Otherwise pick the first column that isn't purely numeric IDs/seat numbers
  if (dataRows.length > 0) {
    const colCount = dataRows[0].length;
    for (let col = 0; col < colCount; col++) {
      const sampleValues = dataRows.slice(0, 10).map((r) => (r[col] ?? '').trim()).filter(Boolean);
      if (sampleValues.length === 0) continue;
      const numericCount = sampleValues.filter((v) => /^\d+$/.test(v)).length;
      if (numericCount < sampleValues.length * 0.7) {
        return col;
      }
    }
  }

  return 0;
}

export async function decodeUploadedTextFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  try {
    const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return utf8.replace(/^\uFEFF/, '');
  } catch {
    // Fallback for Traditional Chinese Excel CSV files saved in Big5 / CP950
    try {
      const big5 = new TextDecoder('big5').decode(buffer);
      return big5.replace(/^\uFEFF/, '');
    } catch {
      return new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '');
    }
  }
}

export function parseCsvContent(content: string, fileName: string): ParsedCsvPreview {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawLines = normalized
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (rawLines.length === 0) {
    return {
      headers: [],
      rows: [],
      hasHeaderRow: false,
      suggestedColumnIndex: 0,
      fileName,
    };
  }

  const delimiter = detectDelimiter(rawLines.slice(0, 10));
  const parsedMatrix = rawLines.map((line) => parseCsvLine(line, delimiter));
  const maxCols = Math.max(...parsedMatrix.map((r) => r.length), 1);

  // Normalize row lengths
  const paddedMatrix = parsedMatrix.map((row) => {
    const copy = [...row];
    while (copy.length < maxCols) copy.push('');
    return copy;
  });

  const hasHeaderRow = isLikelyHeaderRow(paddedMatrix[0], paddedMatrix[1]);
  const headers = hasHeaderRow
    ? paddedMatrix[0].map((h, i) => h || `第 ${i + 1} 欄`)
    : Array.from({ length: maxCols }, (_, i) => `第 ${i + 1} 欄`);

  const rows = hasHeaderRow ? paddedMatrix.slice(1) : paddedMatrix;
  const suggestedColumnIndex = suggestNameColumn(hasHeaderRow ? paddedMatrix[0] : [], rows);

  return {
    headers,
    rows,
    hasHeaderRow,
    suggestedColumnIndex,
    fileName,
  };
}

export function downloadSampleCsv(): void {
  const rows = [
    ['座號', '姓名'],
    ...DEMO_STUDENT_NAMES.slice(0, 12).map((name, idx) => [String(idx + 1), name]),
  ];
  const csvContent = '\uFEFF' + rows.map((r) => r.join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = '班級學生名單範例.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
