import {
  createBoard,
  createSection,
  fetchBoardPinIds,
  fetchSectionPinIds,
  getSections,
  savePin,
  saveSectionPins,
  type CreatedBoard,
  type Target
} from "./pinterest.ts";
import { randomFor, shuffle } from "./shuffle.ts";

export interface MixProgress {
  phase: "loading" | "saving";
  done: number;
  total: number;
}

export interface MixResult {
  board: CreatedBoard;
  saved: number;
  total: number;
}

export interface MixInput {
  target: Target;
  name: string;
  seed: string;
  signal: AbortSignal;
  onProgress: (progress: MixProgress) => void;
}

interface PinGroup {
  title: string | null;
  pinIds: string[];
}

const saveDelayMs = 150;
const retryDelayMs = 1000;
const maxAttempts = 3;
const sectionBatchSize = 50;

export async function mixBoard(input: MixInput): Promise<MixResult> {
  const { target, signal, onProgress } = input;
  const expected = (target.section ?? target.board).pinCount;
  const groups = await loadGroups(
    target,
    (count) => onProgress({ phase: "loading", done: count, total: expected }),
    signal
  );
  const total = groups.reduce((sum, group) => sum + group.pinIds.length, 0);

  if (total === 0) {
    throw new Error("there are no pins here to shuffle");
  }

  const random = randomFor(input.seed);
  const created = await createBoard(input.name, target.board.privacy, signal);
  let done = 0;
  let saved = 0;

  onProgress({ phase: "saving", done, total });

  for (const group of groups) {
    if (signal.aborted) {
      break;
    }

    if (group.pinIds.length === 0) {
      continue;
    }

    const pinIds = shuffle(group.pinIds, random);
    const sectionId =
      group.title === null
        ? null
        : await createSection(created.id, group.title, signal);
    const batches = sectionId
      ? chunk(pinIds, sectionBatchSize)
      : pinIds.map((pinId) => [pinId]);

    for (const batch of batches) {
      if (signal.aborted) {
        break;
      }

      if (done > 0) {
        await sleep(saveDelayMs, signal);
      }

      const ok = await withRetry(
        () =>
          sectionId
            ? saveSectionPins(batch, sectionId, signal)
            : savePin(batch[0], created.id, signal),
        signal
      );

      if (ok) {
        saved += batch.length;
      }

      done += batch.length;
      onProgress({ phase: "saving", done, total });
    }
  }

  return { board: created, saved, total };
}

async function loadGroups(
  { board, section }: Target,
  onCount: (count: number) => void,
  signal: AbortSignal
): Promise<PinGroup[]> {
  if (section) {
    return [
      {
        title: null,
        pinIds: await fetchSectionPinIds(section, onCount, signal)
      }
    ];
  }

  const groups: PinGroup[] = [];
  let loaded = 0;
  const countFrom = (count: number) => onCount(loaded + count);
  const rootPinIds = await fetchBoardPinIds(board, countFrom, signal);

  groups.push({ title: null, pinIds: rootPinIds });
  loaded += rootPinIds.length;

  for (const boardSection of await getSections(board, signal)) {
    const pinIds = await fetchSectionPinIds(boardSection, countFrom, signal);

    groups.push({ title: boardSection.title, pinIds });
    loaded += pinIds.length;
  }

  return groups;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size));
  }

  return chunks;
}

async function withRetry(
  attempt: () => Promise<void>,
  signal: AbortSignal
): Promise<boolean> {
  for (let attempts = 1; ; attempts += 1) {
    try {
      await attempt();
      return true;
    } catch {
      if (signal.aborted || attempts === maxAttempts) {
        return false;
      }

      await sleep(retryDelayMs * attempts, signal);
    }
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener("abort", finish);
  });
}
