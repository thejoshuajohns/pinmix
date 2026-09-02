import type { BoardPath } from "./board-page.ts";
import { mixBoard, type MixProgress, type MixResult } from "./mix.ts";
import { getBoard, type Board } from "./pinterest.ts";
import { styles } from "./styles.ts";

export interface Panel {
  setBoardPath(path: BoardPath | null): void;
}

type View = "form" | "progress" | "done";

const shuffleIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h3.5l7 10H21"/><path d="M3 17h3.5l7-10H21"/><path d="m18 4 3 3-3 3"/><path d="m18 14 3 3-3 3"/></svg>`;

const template = `
<style>${styles}</style>
<button class="launcher" type="button" hidden>${shuffleIcon}shuffle this board</button>
<section class="card" hidden>
  <header>
    <h2>shuffle board</h2>
    <button class="close" type="button" aria-label="close">×</button>
  </header>
  <p class="subtitle"></p>
  <form class="form">
    <label>new board name <input name="name" required autocomplete="off" /></label>
    <label>seed (optional) <input name="seed" placeholder="same seed, same order" autocomplete="off" /></label>
    <button class="primary" type="submit">shuffle</button>
  </form>
  <div class="progress" hidden>
    <p class="status"></p>
    <div class="bar"><div class="fill"></div></div>
    <button class="secondary cancel" type="button">stop</button>
  </div>
  <div class="done" hidden>
    <p class="summary"></p>
    <a class="open" target="_blank" rel="noopener">open new board</a>
    <button class="secondary again" type="button">shuffle again</button>
  </div>
  <p class="error" hidden></p>
</section>`;

export function mountPanel(): Panel {
  const host = document.createElement("div");
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = template;
  document.body.append(host);

  const query = <T extends Element>(selector: string) =>
    root.querySelector(selector) as T;
  const el = {
    launcher: query<HTMLButtonElement>(".launcher"),
    card: query<HTMLElement>(".card"),
    close: query<HTMLButtonElement>(".close"),
    subtitle: query<HTMLElement>(".subtitle"),
    form: query<HTMLFormElement>(".form"),
    name: query<HTMLInputElement>("[name=name]"),
    seed: query<HTMLInputElement>("[name=seed]"),
    progress: query<HTMLElement>(".progress"),
    status: query<HTMLElement>(".status"),
    fill: query<HTMLElement>(".fill"),
    cancel: query<HTMLButtonElement>(".cancel"),
    done: query<HTMLElement>(".done"),
    summary: query<HTMLElement>(".summary"),
    open: query<HTMLAnchorElement>(".open"),
    again: query<HTMLButtonElement>(".again"),
    error: query<HTMLElement>(".error")
  };

  let board: Board | null = null;
  let loadId = 0;
  let controller: AbortController | null = null;

  function show(view: View): void {
    el.form.hidden = view !== "form";
    el.progress.hidden = view !== "progress";
    el.done.hidden = view !== "done";
    el.error.hidden = true;
  }

  function setCardOpen(open: boolean): void {
    el.card.hidden = !open;
    el.launcher.hidden = open || !board;
  }

  function updateProgress({ phase, done, total }: MixProgress): void {
    el.status.textContent =
      phase === "loading"
        ? `loading pins · ${done}`
        : `saving ${done} of ${total}`;
    el.fill.style.width = `${total ? Math.min(100, (done / total) * 100) : 0}%`;
  }

  function showResult(
    { board: created, saved, total }: MixResult,
    stopped: boolean
  ): void {
    const missed = total - saved;
    el.summary.textContent = stopped
      ? `stopped after saving ${saved} of ${total} pins`
      : missed
        ? `saved ${saved} of ${total} pins, ${missed} didn't save`
        : `saved all ${total} pins`;
    el.open.href = new URL(created.url, location.origin).href;
    show("done");
  }

  async function run(target: Board, name: string, seed: string): Promise<void> {
    controller = new AbortController();
    const { signal } = controller;

    show("progress");
    updateProgress({ phase: "loading", done: 0, total: target.pinCount });

    try {
      const result = await mixBoard({
        board: target,
        name,
        seed,
        signal,
        onProgress: updateProgress
      });
      showResult(result, signal.aborted);
    } catch (error) {
      show("form");

      if (!signal.aborted) {
        el.error.textContent =
          error instanceof Error ? error.message : String(error);
        el.error.hidden = false;
      }
    } finally {
      controller = null;
    }
  }

  el.launcher.addEventListener("click", () => setCardOpen(true));
  el.close.addEventListener("click", () => setCardOpen(false));
  el.cancel.addEventListener("click", () => controller?.abort());
  el.again.addEventListener("click", () => show("form"));
  el.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = el.name.value.trim();

    if (!board || !name) {
      el.name.focus();
      return;
    }

    void run(board, name, el.seed.value.trim());
  });

  return {
    setBoardPath(path) {
      loadId += 1;
      board = null;

      if (!controller) {
        setCardOpen(false);
      }

      if (!path) {
        return;
      }

      const id = loadId;

      getBoard(path)
        .then((loaded) => {
          if (id !== loadId) {
            return;
          }

          board = loaded;
          el.subtitle.textContent = `${loaded.name} · ${loaded.pinCount} pins`;
          el.name.value = `${loaded.name} shuffled`;

          if (!controller) {
            show("form");
            setCardOpen(false);
          }
        })
        .catch(() => undefined);
    }
  };
}
