import { DPDPStack } from "./client.js";
import type { ConsentReceipt, LocalizedNotice, Purpose } from "./types.js";

export interface ConsentWidgetTexts {
  heading: string;
  subheading: string;
  save: string;
  saving: string;
  saved: string;
  loading: string;
  error: string;
}

const DEFAULT_TEXTS: ConsentWidgetTexts = {
  heading: "We value your privacy",
  subheading: "Choose what you consent to. You can withdraw anytime (DPDP Act).",
  save: "Save consent preferences",
  saving: "Saving…",
  saved: "Preferences saved.",
  loading: "Loading…",
  error: "Could not save your preferences. Please try again.",
};

export interface ConsentWidgetOptions {
  /** Your opaque user id (internal id or hash) — never PII. */
  principalRef: string;
  /** Pre-built client. If omitted, one is built from `apiBase`/`apiKey`. */
  client?: DPDPStack;
  /** Used to build a client when `client` is not supplied. */
  apiBase?: string;
  /** Publishable key (`dpdp_pk_…`). Used to build a client when `client` is not supplied. */
  apiKey?: string;
  /** Purposes to render. If omitted, they're fetched via `client.listPurposes()`. */
  purposes?: Purpose[];
  /** Initial locale for notice text. Default `"en"`. */
  locale?: string;
  /** Purpose codes checked on first render. */
  defaultChecked?: string[];
  /** Override any UI strings. */
  texts?: Partial<ConsentWidgetTexts>;
  /** Called with the receipts after a successful save. */
  onSave?: (receipts: ConsentReceipt[]) => void;
  /** Called if loading purposes or saving fails. */
  onError?: (error: unknown) => void;
}

export interface ConsentWidgetController {
  /** Switch the notice language and re-render. */
  setLocale(locale: string): void;
  /** Re-fetch purposes (when not passed in) and re-render. */
  refresh(): Promise<void>;
  /** Remove the widget from the DOM. */
  destroy(): void;
}

type Attrs = Record<string, string | EventListenerOrEventListenerObject>;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "style" && typeof v === "string") node.style.cssText = v;
    else if (k === "class" && typeof v === "string") node.className = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (typeof v === "string") node.setAttribute(k, v);
  }
  for (const c of children) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  return node;
}

function noticeFor(purpose: Purpose, locale: string): Required<LocalizedNotice> {
  const t: LocalizedNotice = purpose.translations?.[locale] ?? {};
  return {
    name: t.name || purpose.name,
    description: t.description || purpose.description,
  };
}

const CARD =
  "border:1px solid #e3e3ef;border-radius:12px;padding:20px;background:#fff;max-width:480px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#11113a;box-shadow:0 1px 3px rgba(15,23,42,0.06);";

/**
 * Mount a drop-in consent capture widget. Returns a controller for switching
 * locale, refreshing, or removing it.
 *
 * ```ts
 * mountConsentWidget("#consent", {
 *   apiBase: "/api/v1",
 *   apiKey: "dpdp_pk_…",       // publishable key
 *   principalRef: "user_123",
 * });
 * ```
 */
export function mountConsentWidget(
  target: string | HTMLElement,
  options: ConsentWidgetOptions,
): ConsentWidgetController {
  const container =
    typeof target === "string" ? document.querySelector<HTMLElement>(target) : target;
  if (!container) throw new Error(`mountConsentWidget: container not found: ${String(target)}`);

  const client =
    options.client ?? new DPDPStack({ apiBase: options.apiBase, apiKey: options.apiKey });
  const texts: ConsentWidgetTexts = { ...DEFAULT_TEXTS, ...options.texts };
  const defaultChecked = new Set(options.defaultChecked ?? []);

  let locale = options.locale ?? "en";
  let purposes: Purpose[] | null = options.purposes ?? null;

  function message(text: string, color: string): HTMLElement {
    return el("div", { style: `margin-top:12px;font-size:13px;color:${color};` }, [text]);
  }

  function render(): void {
    container!.innerHTML = "";
    const card = el("div", { style: CARD }, [
      el("div", { style: "font-weight:600;font-size:15px;margin-bottom:4px;" }, [texts.heading]),
      el("div", { style: "font-size:13px;color:#666;margin-bottom:12px;" }, [texts.subheading]),
    ]);

    if (!purposes) {
      card.appendChild(message(texts.loading, "#666"));
      container!.appendChild(card);
      return;
    }

    const checks: Record<string, HTMLInputElement> = {};
    for (const p of purposes) {
      const n = noticeFor(p, locale);
      const box = el("input", { type: "checkbox", id: `dpdp_${p.code}` }) as HTMLInputElement;
      if (defaultChecked.has(p.code)) box.checked = true;
      checks[p.code] = box;
      card.appendChild(
        el(
          "label",
          {
            style:
              "display:flex;align-items:flex-start;gap:8px;margin:10px 0;font-size:14px;cursor:pointer;",
            for: `dpdp_${p.code}`,
          },
          [
            box,
            el("span", {}, [
              el("strong", {}, [n.name]),
              el("div", { style: "font-size:12px;color:#777;margin-top:2px;" }, [n.description]),
            ]),
          ],
        ),
      );
    }

    const status = el("div", {});
    const saveBtn = el(
      "button",
      {
        type: "button",
        style:
          "margin-top:14px;background:#4f46e5;color:#fff;border:0;border-radius:8px;padding:10px 16px;font:inherit;font-weight:600;cursor:pointer;",
      },
      [texts.save],
    ) as HTMLButtonElement;

    saveBtn.addEventListener("click", async () => {
      const selected = purposes!.filter((p) => checks[p.code]?.checked);
      saveBtn.disabled = true;
      saveBtn.textContent = texts.saving;
      status.innerHTML = "";
      try {
        const receipts = await Promise.all(
          selected.map((p) =>
            client.grantConsent({ principal_ref: options.principalRef, purpose: p.code, locale }),
          ),
        );
        status.appendChild(message(texts.saved, "#16a34a"));
        options.onSave?.(receipts);
      } catch (err) {
        status.appendChild(message(texts.error, "#dc2626"));
        options.onError?.(err);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = texts.save;
      }
    });

    card.appendChild(saveBtn);
    card.appendChild(status);
    container!.appendChild(card);
  }

  async function refresh(): Promise<void> {
    if (!options.purposes) {
      render(); // show loading
      try {
        purposes = await client.listPurposes();
      } catch (err) {
        purposes = [];
        options.onError?.(err);
      }
    }
    render();
  }

  void refresh();

  return {
    setLocale(next: string) {
      locale = next;
      render();
    },
    refresh,
    destroy() {
      container!.innerHTML = "";
    },
  };
}
