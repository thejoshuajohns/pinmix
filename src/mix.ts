import {
  createBoard,
  fetchBoardPinIds,
  savePin,
  type Board,
  type CreatedBoard
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
  board: Board;
  name: string;
  seed: string;
  signal: AbortSignal;
  onProgress: (progress: MixProgress) => void;
}

const saveDelayMs = 150;
const retryDelayMs = 1000;
const maxAttempts = 3;

export async function mixBoard(input: MixInput): Promise<MixResult> {
  const { board, signal, onProgress } = input;
  const pinIds = await fetchBoardPinIds(
    board,
    (count) =>
      onProgress({ phase: "loading", done: count, total: board.pinCount }),
    signal
  );

  if (pinIds.length === 0) {
    throw new Error("this board has no pins to shuffle");
  }

  const order = shuffle(pinIds, randomFor(input.seed));
  const created = await createBoard(input.name, board.privacy, signal);
  let saved = 0;

  onProgress({ phase: "saving", done: 0, total: order.length });

  for (const [index, pinId] of order.entries()) {
    if (signal.aborted) {
      break;
    }

    if (index > 0) {
      await sleep(saveDelayMs, signal);
    }

    if (await savePinWithRetry(pinId, created.id, signal)) {
      saved += 1;
    }

    onProgress({ phase: "saving", done: index + 1, total: order.length });
  }

  return { board: created, saved, total: order.length };
}

async function savePinWithRetry(
  pinId: string,
  boardId: string,
  signal: AbortSignal
): Promise<boolean> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await savePin(pinId, boardId, signal);
      return true;
    } catch {
      if (signal.aborted || attempt === maxAttempts) {
        return false;
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
