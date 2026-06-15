export { DPDPStack, DPDPError, DEFAULT_API_BASE } from "./client.js";
export type { DPDPStackOptions } from "./client.js";

export { mountConsentWidget } from "./widget.js";
export type {
  ConsentWidgetOptions,
  ConsentWidgetController,
  ConsentWidgetTexts,
} from "./widget.js";

export type * from "./types.js";

import { mountConsentWidget, type ConsentWidgetController } from "./widget.js";
import type { ConsentReceipt, Purpose } from "./types.js";

/**
 * Backward-compatible shim for the original `DPDPConsent.init({ el, … })`
 * script-tag widget. Prefer {@link mountConsentWidget} in new code.
 */
export const DPDPConsent = {
  init(config: {
    el: string | HTMLElement;
    apiBase?: string;
    apiKey?: string;
    principalRef: string;
    locale?: string;
    purposes?: Purpose[];
    onSave?: (receipts: ConsentReceipt[]) => void;
  }): ConsentWidgetController {
    const { el, ...rest } = config;
    return mountConsentWidget(el, rest);
  },
};
