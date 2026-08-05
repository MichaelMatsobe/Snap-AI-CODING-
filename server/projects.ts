/**
 * Simple project persistence — in-memory + optional disk file for single-node deploys.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const STORE_FILE = path.join(DATA_DIR, 'projects.json');

export interface StoredProject {
  id: string;
  name: string;
  updatedAt: string;
  data: unknown;
}

const memory = new Map<string, StoredProject>();

function ensureDir() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    /* ignore */
  }
}

function loadFromDisk() {
  try {
    if (!fs.existsSync(STORE_FILE)) return;
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const list = JSON.parse(raw) as StoredProject[];
    for (const p of list) memory.set(p.id, p);
  } catch (e) {
    console.warn('[projects] disk load failed', e);
  }
}

function saveToDisk() {
  try {
    ensureDir();
    const list = Array.from(memory.values());
    fs.writeFileSync(STORE_FILE, JSON.stringify(list, null, 2));
  } catch (e) {
    console.warn('[projects] disk save failed', e);
  }
}

loadFromDisk();

export function listProjects(): Array<{ id: string; name: string; updatedAt: string }> {
  return Array.from(memory.values())
    .map(({ id, name, updatedAt }) => ({ id, name, updatedAt }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getProject(id: string): StoredProject | undefined {
  return memory.get(id);
}

export function upsertProject(project: {
  id: string;
  name: string;
  data: unknown;
}): StoredProject {
  const row: StoredProject = {
    id: project.id,
    name: project.name,
    updatedAt: new Date().toISOString(),
    data: project.data,
  };
  memory.set(row.id, row);
  saveToDisk();
  return row;
}

export function deleteProject(id: string): boolean {
  const ok = memory.delete(id);
  if (ok) saveToDisk();
  return ok;
}
