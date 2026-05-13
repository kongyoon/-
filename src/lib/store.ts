import { get, set } from 'idb-keyval';
import { DreamAnalysis } from './gemini';

export interface DreamEntry {
  id: string;
  timestamp: number;
  analysis: DreamAnalysis;
  imageUrl: string;
  mood: string | null;
  tags: string[];
}

const STORE_KEY = 'dreamscape_entries';

export async function getDreams(): Promise<DreamEntry[]> {
  const entries = await get<DreamEntry[]>(STORE_KEY);
  return entries || [];
}

export async function saveDream(entry: DreamEntry): Promise<void> {
  const entries = await getDreams();
  const existingIndex = entries.findIndex(e => e.id === entry.id);
  if (existingIndex >= 0) {
    entries[existingIndex] = entry;
  } else {
    entries.push(entry);
  }
  entries.sort((a, b) => b.timestamp - a.timestamp);
  await set(STORE_KEY, entries);
}

export async function deleteDream(id: string): Promise<void> {
  const entries = await getDreams();
  const filtered = entries.filter(e => e.id !== id);
  await set(STORE_KEY, filtered);
}
