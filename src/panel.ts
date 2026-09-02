import type { BoardPath } from "./board-page.ts";
import { mix, type MixProgress, type MixResult } from "./mix.ts";
import { getTarget, type Target } from "./pinterest.ts";
import { styles } from "./styles.ts";

export interface Panel {
  setBoardPath(path: BoardPath | null): void;
}

type View = "form" | "progress" | "done";

const shuffleIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h3.5l7 10H21"/><path d="M3 17h3.5l7-10H21"/><path d="m18 4 3 3-3 3"/><path d="m18 14 3 3-3 3"/></svg>`;

const template = `
<style>${styles}</style>
<button class="launcher" type="button" hidden>${shuffleIcon}<span></span></button>
<section class="card" hidden>
  <header>
    <h2>shuffle</h2>
    <button class="close" type="button" aria-label="close">×</button>
  </header>
  <p class="subtitle"></p>
  <form class="form">
    <label><span class="name-label"></span><input name="name" required autocomplete="off" /></label>
    <label>seed (optional) <input name="seed" placeholder="same seed, same order" autocomplete="off" /></label>
    <label class="switch" hidden><input name="keepSections" type="checkbox" checked /> keep sections</label>
    <button class="primary" type="submit">shuffle</button>
  </form>
  <div class="progress" hidden>
    <p class="status"></p>
    <div class="bar"><div class="fill"></div></div>
    <button class="secondary cancel" type="button">stop</button>
  </div>
  <div class="done" hidden>
    <p class="summary"></p>
    <a class="open" target="_blank" rel="noopener"></a>
    <button class="secondary again" type="button">shuffle again</button>
  </div>
  <p class="error" hidden></p>
</section>`;

function describe({ board, section }: Target): string {
  const parts = section
    ? [board.name, section.title, `${section.pinCount} pins`]
    : [board.name, `${board.pinCount} pins`];

  if (!section && board.sectionCount > 0) {
    parts.push(`${board.sectionCount} sections`);
  }

  return parts.join(" · ");
}

export function mountPanel(): Panel {
  const host = document.createElement("div");
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = template;
  document.body.append(host);

  const query = <T extends Element>(selector: string) =>
    root.querySelector(selector) as T;
  const el = {
    launcher: query<HTMLButtonElement>(".launcher"),
    launcherLabel: query<HTMLElement>(".launcher span"),
    card: query<HTMLElement>(".card"),
    close: query<HTMLButtonElement>(".close"),
    subtitle: query<HTMLElement>(".subtitle"),
    form: query<HTMLFormElement>(".form"),
    nameLabel: query<HTMLElement>(".name-label"),
    name: query<HTMLInputElement>("[name=name]"),
    keepSections: query<HTMLInputElement>("[name=keepSections]"),
    keepSectionsField: query<HTMLElement>(".switch"),
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

  let target: Target | null = null;
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
    el.launcher.hidden = open || !target;
  }

  function updateProgress({ phase, done, total }: MixProgress): void {
    el.status.textContent =
      phase === "loading"
        ? `loading pins · ${done}`
        : `saving ${done} of ${total}`;
    el.fill.style.width = `${total ? Math.min(100, (done / total) * 100) : 0}%`;
  }

  function showResult(
    { url, saved, total }: MixResult,
    stopped: boolean
  ): void {
    const missed = total - saved;
    el.summary.textContent = stopped
      ? `stopped after saving ${saved} of ${total} pins`
      : missed
        ? `saved ${saved} of ${total} pins, ${missed} didn't save`
        : `saved all ${total} pins`;
    el.open.href = new URL(url, location.origin).href;
    show("done");
  }

  async function run(
    current: Target,
    name: string,
    seed: string
  ): Promise<void> {
    controller = new AbortController();
    const { signal } = controller;

    show("progress");
    updateProgress({ phase: "loading", done: 0, total: 0 });

    try {
      const result = await mix({
        target: current,
        name,
        seed,
        keepSections: el.keepSections.checked,
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

    if (!target || !name) {
      el.name.focus();
      return;
    }

    void run(target, name, el.seed.value.trim());
  });

  return {
    setBoardPath(path) {
      loadId += 1;
      target = null;

      if (!controller) {
        setCardOpen(false);
      }

      if (!path) {
        return;
      }

      const id = loadId;

      getTarget(path)
        .then((loaded) => {
          if (id !== loadId) {
            return;
          }

          const kind = loaded.section ? "section" : "board";

          target = loaded;
          el.launcherLabel.textContent = `shuffle this ${kind}`;
          el.subtitle.textContent = describe(loaded);
          el.nameLabel.textContent = `new ${kind} name`;
          el.name.value = `${loaded.section?.title ?? loaded.board.name} shuffled`;
          el.keepSectionsField.hidden =
            !!loaded.section || loaded.board.sectionCount === 0;
          el.open.textContent = `open new ${kind}`;

          if (!controller) {
            show("form");
            setCardOpen(false);
          }
        })
        .catch(() => undefined);
    }
  };
}
