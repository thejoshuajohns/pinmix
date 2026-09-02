import {
  addSectionPins,
  createBoard,
  createSection,
  fetchBoardPinIds,
  fetchSectionPinIds,
  getSections,
  savePin,
  type Board,
  type Section,
  type Target
} from "./pinterest.ts";
import { randomFor, shuffle } from "./shuffle.ts";

export interface MixProgress {
  phase: "loading" | "saving";
  done: number;
  total: number;
}

export interface MixResult {
  url: string;
  saved: number;
  total: number;
}

export interface MixInput {
  target: Target;
  name: string;
  seed: string;
  keepSections: boolean;
  signal: AbortSignal;
  onProgress: (progress: MixProgress) => void;
}

interface PinGroup {
  title: string | null;
  pinIds: string[];
}

interface Tracker {
  run<T>(count: number, work: () => Promise<T>): Promise<T | null>;
  result(url: string): MixResult;
}

type ProgressFn = MixInput["onProgress"];

const saveDelayMs = 150;
const retryDelayMs = 1000;
const maxAttempts = 3;
const sectionBatchSize = 50;

export function mix(input: MixInput): Promise<MixResult> {
  const { board, section } = input.target;

  return section ? mixSection(input, board, section) : mixBoard(input, board);
}

async function mixBoard(
  { name, seed, keepSections, signal, onProgress }: MixInput,
  board: Board
): Promise<MixResult> {
  const groups = await loadGroups(
    board,
    keepSections,
    countingTo(board.pinCount, onProgress),
    signal
  );
  const tracker = createTracker(groups, signal, onProgress);
  const random = randomFor(seed);
  const created = await createBoard(name, board.privacy, signal);

  for (const group of groups) {
    if (signal.aborted) {
      break;
    }

    const pinIds = shuffle(group.pinIds, random);

    if (group.title === null) {
      for (const pinId of pinIds) {
        await tracker.run(1, () => savePin(pinId, created.id, signal));
      }
    } else if (pinIds.length > 0) {
      const section = await createSection(created, group.title, signal);

      for (const batch of chunk(pinIds, sectionBatchSize)) {
        await tracker.run(batch.length, () =>
          addSectionPins(batch, section.id, signal)
        );
      }
    }
  }

  return tracker.result(created.url);
}

async function mixSection(
  { name, seed, signal, onProgress }: MixInput,
  board: Board,
  section: Section
): Promise<MixResult> {
  const pinIds = await fetchSectionPinIds(
    section,
    countingTo(section.pinCount, onProgress),
    signal
  );
  const tracker = createTracker([{ title: null, pinIds }], signal, onProgress);
  const created = await createSection(board, name, signal);
  const copies: string[] = [];

  for (const pinId of shuffle(pinIds, randomFor(seed))) {
    const copy = await tracker.run(1, () => savePin(pinId, board.id, signal));

    if (copy) {
      copies.push(copy);
    }
  }

  for (const batch of chunk(copies, sectionBatchSize)) {
    await addSectionPins(batch, created.id);
  }

  return tracker.result(created.url);
}

async function loadGroups(
  board: Board,
  keepSections: boolean,
  onCount: (count: number) => void,
  signal: AbortSignal
): Promise<PinGroup[]> {
  const root: PinGroup = { title: null, pinIds: [] };
  const groups = [root];
  let loaded = 0;
  const countFrom = (count: number) => onCount(loaded + count);

  root.pinIds = await fetchBoardPinIds(board, countFrom, signal);
  loaded = root.pinIds.length;

  for (const section of await getSections(board, signal)) {
    const pinIds = await fetchSectionPinIds(section, countFrom, signal);

    if (keepSections) {
      groups.push({ title: section.title, pinIds });
    } else {
      root.pinIds.push(...pinIds);
    }

    loaded += pinIds.length;
  }

  return groups;
}

function countingTo(
  expected: number,
  onProgress: ProgressFn
): (count: number) => void {
  return (count) =>
    onProgress({ phase: "loading", done: count, total: expected });
}

function createTracker(
  groups: PinGroup[],
  signal: AbortSignal,
  onProgress: ProgressFn
): Tracker {
  const total = groups.reduce((sum, group) => sum + group.pinIds.length, 0);
  let done = 0;
  let saved = 0;

  if (total === 0) {
    throw new Error("there are no pins here to shuffle");
  }

  onProgress({ phase: "saving", done, total });

  return {
    async run(count, work) {
      if (signal.aborted) {
        return null;
      }

      if (done > 0) {
        await sleep(saveDelayMs, signal);
      }

      const outcome = await withRetry(work, signal);

      if (outcome !== null) {
        saved += count;
      }

      done += count;
      onProgress({ phase: "saving", done, total });

      return outcome;
    },
    result(url) {
      return { url, saved, total };
    }
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size));
  }

  return chunks;
}

async function withRetry<T>(
  work: () => Promise<T>,
  signal: AbortSignal
): Promise<T | null> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await work();
    } catch {
      if (signal.aborted || attempt === maxAttempts) {
        return null;
      }

      await sleep(retryDelayMs * attempt, signal);
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
