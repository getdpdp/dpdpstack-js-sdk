import type {
  ActivityInput,
  ActivityResult,
  AuditCheckpoint,
  AuditCheckpointInput,
  AuditLog,
  AuditVerifyResult,
  Breach,
  BreachActionInput,
  BreachListQuery,
  BreachNotifications,
  BreachReportInput,
  CertificatePublicKey,
  CertificateRegistryResult,
  CertificateVerifyResult,
  ConsentGrantInput,
  ConsentReceipt,
  ConsentRecordSummary,
  ConsentStatus,
  ConsentWithdrawInput,
  ConsentWithdrawResult,
  DSR,
  DSRActionInput,
  DSRCreateInput,
  DSRListQuery,
  ErasureConfirmResult,
  ErasureInput,
  ErasureResult,
  ErasureTask,
  ErasureTaskListQuery,
  EvidenceIngestInput,
  EvidenceIngestResult,
  EvidenceListQuery,
  EvidenceListResult,
  IssueCertificateInput,
  IssueEvidenceCertificateInput,
  IssuedCertificate,
  Purpose,
  PurposeInput,
  Readiness,
  RetentionPolicy,
  RetentionPolicyInput,
  RetentionRunResult,
  Stats,
  Target,
  TargetCreateInput,
  TargetUpdateInput,
  TargetWithSecret,
} from "./types.js";

export const DEFAULT_API_BASE = "https://getdpdp.net/api/v1";

export interface DPDPStackOptions {
  /**
   * API key. A **secret** key (`dpdp_sk_…`) for server-side use, or a
   * **publishable** key (`dpdp_pk_…`) — the only kind safe to ship to a browser,
   * limited to reading purposes and recording consent. Omit for public-only
   * calls (certificate verify/registry/public-key).
   */
  apiKey?: string;
  /** API base URL. Default `https://getdpdp.net/api/v1`. Use a relative path (e.g. `/api/v1`) to call a same-origin proxy. */
  apiBase?: string;
  /** Custom fetch implementation (for Node < 18, testing, or proxies). Defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** Extra headers sent with every request. */
  headers?: Record<string, string>;
  /** `fetch` credentials mode (e.g. `"include"` to send cookies). Default: unset. */
  credentials?: RequestCredentials;
}

/** Thrown for any non-2xx API response. */
export class DPDPError extends Error {
  readonly status: number;
  readonly detail: string;
  readonly body: unknown;

  constructor(status: number, detail: string, body: unknown) {
    super(`DPDP API error ${status}: ${detail}`);
    this.name = "DPDPError";
    this.status = status;
    this.detail = detail;
    this.body = body;
  }
}

function buildQuery(query?: object): string {
  if (!query) return "";
  const parts = Object.entries(query as Record<string, unknown>)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

/**
 * Thin, typed client for the DPDPStack API.
 *
 * ```ts
 * const dpdp = new DPDPStack({ apiKey: "dpdp_sk_…" });
 * await dpdp.grantConsent({ principal_ref: "user_42", purpose: "marketing" });
 * ```
 */
export class DPDPStack {
  private readonly apiBase: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultHeaders: Record<string, string>;
  private readonly credentials?: RequestCredentials;

  constructor(options: DPDPStackOptions = {}) {
    this.apiBase = (options.apiBase ?? DEFAULT_API_BASE).replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.defaultHeaders = options.headers ?? {};
    this.credentials = options.credentials;

    const f = options.fetch ?? globalThis.fetch;
    if (typeof f !== "function") {
      throw new Error(
        "No fetch implementation found. Use Node 18+, a browser, or pass `fetch` in options.",
      );
    }
    this.fetchImpl = f.bind(globalThis);
  }

  /** Low-level request. Most callers use the typed methods below. */
  async request<T>(
    method: string,
    path: string,
    opts: { query?: object; body?: unknown } = {},
  ): Promise<T> {
    const url = `${this.apiBase}${path}${buildQuery(opts.query)}`;
    const headers: Record<string, string> = { ...this.defaultHeaders };
    if (this.apiKey) headers["X-API-Key"] = this.apiKey;

    const hasBody = opts.body !== undefined;
    if (hasBody) headers["Content-Type"] = "application/json";

    const res = await this.fetchImpl(url, {
      method,
      headers,
      body: hasBody ? JSON.stringify(opts.body) : undefined,
      ...(this.credentials ? { credentials: this.credentials } : {}),
    });

    const text = await res.text();
    let data: unknown = undefined;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!res.ok) {
      const detail =
        (data && typeof data === "object" && "detail" in data
          ? String((data as { detail: unknown }).detail)
          : undefined) ?? res.statusText ?? "Request failed";
      throw new DPDPError(res.status, detail, data);
    }

    return data as T;
  }

  // --- Purposes & consent -------------------------------------------------

  /** List consent purposes (with multilingual notices). Publishable-key safe. */
  listPurposes(): Promise<Purpose[]> {
    return this.request("GET", "/purposes");
  }

  /** Create a consent purpose. Requires a secret key. */
  createPurpose(input: PurposeInput): Promise<Purpose> {
    return this.request("POST", "/purposes", { body: input });
  }

  /** Record purpose-level consent and get an immutable receipt. Publishable-key safe. */
  grantConsent(input: ConsentGrantInput): Promise<ConsentReceipt> {
    return this.request("POST", "/consent", { body: input });
  }

  /** Withdraw consent for a purpose (triggers erasure/deferral). Requires a secret key. */
  withdrawConsent(input: ConsentWithdrawInput): Promise<ConsentWithdrawResult> {
    return this.request("POST", "/consent/withdraw", { body: input });
  }

  /** Current consent state for a principal. Requires a secret key. */
  consentStatus(principalRef: string): Promise<ConsentStatus> {
    return this.request("GET", "/consent/status", { query: { principal_ref: principalRef } });
  }

  /** List the organization's consent records (latest first). Requires a secret key. */
  listConsentRecords(): Promise<ConsentRecordSummary[]> {
    return this.request("GET", "/consent/records");
  }

  /** Record principal activity, resetting inactivity-based retention. Requires a secret key. */
  recordActivity(input: ActivityInput): Promise<ActivityResult> {
    return this.request("POST", "/activity", { body: input });
  }

  // --- Erasure ------------------------------------------------------------

  /** Right to erasure: resolve erasure across the principal's purposes. Requires a secret key. */
  requestErasure(input: ErasureInput): Promise<ErasureResult> {
    return this.request("POST", "/erasure", { body: input });
  }

  /** Confirm a downstream erasure with the token delivered to that system. No API key needed. */
  confirmErasure(token: string): Promise<ErasureConfirmResult> {
    return this.request("POST", "/erasure/confirm", { body: { token } });
  }

  // --- Audit --------------------------------------------------------------

  /** Hash-chained audit trail (optionally filtered by principal), plus chain status. Requires a secret key. */
  getAuditLog(query: { principal_ref?: string } = {}): Promise<AuditLog> {
    return this.request("GET", "/audit", { query });
  }

  /** Verify the chain and report where (if anywhere) it breaks, plus the checkpoint
   *  it anchored to for a pruned/retained chain. Requires a secret key. */
  verifyAuditChain(): Promise<AuditVerifyResult> {
    return this.request("GET", "/audit/verify");
  }

  /** Snapshot the chain into an immutable checkpoint so it can be pruned under
   *  retention and still verify. Requires a secret key. */
  createAuditCheckpoint(input: AuditCheckpointInput = {}): Promise<AuditCheckpoint> {
    return this.request("POST", "/audit/checkpoint", { body: input });
  }

  // --- Readiness & stats --------------------------------------------------

  /** A graded DPDP retention-readiness score over your configured policies. Requires a secret key. */
  readiness(): Promise<Readiness> {
    return this.request("GET", "/readiness");
  }

  /** Aggregate dashboard counts (records, audit entries, open DSRs/breaches, certificates). Requires a secret key. */
  stats(): Promise<Stats> {
    return this.request("GET", "/stats");
  }

  // --- Retention ----------------------------------------------------------

  readonly retention = {
    /** List retention policies. Requires a secret key. */
    list: (): Promise<RetentionPolicy[]> => this.request("GET", "/retention/policies"),
    /** Create or update a retention policy. Requires a secret key. */
    upsert: (input: RetentionPolicyInput): Promise<RetentionPolicy> =>
      this.request("POST", "/retention/policies", { body: input }),
    /** Run the retention sweep now (`{ dry_run: true }` to preview). Requires a secret key. */
    run: (input: { dry_run?: boolean } = {}): Promise<RetentionRunResult> =>
      this.request("POST", "/retention/run", { body: input }),
  };

  // --- Certificates -------------------------------------------------------

  readonly certificates = {
    /** Issue a counter-signed Certificate of Erasure for a principal. Requires a secret key. */
    issue: (input: IssueCertificateInput): Promise<IssuedCertificate> =>
      this.request("POST", "/certificate", { body: input }),
    /** Issue a counter-signed Certificate of Consent (what was consented to + the
     *  notice fingerprint) for a principal. Requires a secret key. */
    issueConsent: (input: IssueCertificateInput): Promise<IssuedCertificate> =>
      this.request("POST", "/consent/certificate", { body: input }),
    /** Verify a Certificate of Erasure (JWT) against the public key. Public — no key needed. */
    verify: (certificateJwt: string): Promise<CertificateVerifyResult> =>
      this.request("POST", "/certificate/verify", { body: { certificate_jwt: certificateJwt } }),
    /** Fetch the issuer public key. Public — no key needed. */
    publicKey: (): Promise<CertificatePublicKey> =>
      this.request("GET", "/certificate/public-key"),
    /** Look up a certificate in the public registry by fingerprint. Public — no key needed. */
    registry: (fingerprint: string): Promise<CertificateRegistryResult> =>
      this.request("GET", `/certificate/registry/${encodeURIComponent(fingerprint)}`),
    /** Issue a certificate from SDK-pushed evidence. Requires a secret key. */
    issueFromEvidence: (input: IssueEvidenceCertificateInput): Promise<IssuedCertificate> =>
      this.request("POST", "/evidence/certificate", { body: input }),
  };

  // --- Evidence -----------------------------------------------------------

  readonly evidence = {
    /** Push tamper-evident audit evidence (hash chain) for server-timestamping. Requires a secret key. */
    ingest: (input: EvidenceIngestInput): Promise<EvidenceIngestResult> =>
      this.request("POST", "/evidence", { body: input }),
    /** List stored evidence for a source/subject, with chain status. Requires a secret key. */
    list: (query: EvidenceListQuery = {}): Promise<EvidenceListResult> =>
      this.request("GET", "/evidence", { query }),
  };

  // --- Data-subject requests (DSR) ----------------------------------------

  readonly dsr = {
    /** List rights requests (filter by status/type/principal/overdue). Requires a secret key. */
    list: (query: DSRListQuery = {}): Promise<DSR[]> => this.request("GET", "/dsr", { query }),
    /** Create a rights request. Requires a secret key. */
    create: (input: DSRCreateInput): Promise<DSR> => this.request("POST", "/dsr", { body: input }),
    /** Get a single rights request. Requires a secret key. */
    get: (id: number): Promise<DSR> => this.request("GET", `/dsr/${id}`),
    /** Advance a rights request (acknowledge/start/complete/reject/extend). Requires a secret key. */
    act: (id: number, input: DSRActionInput): Promise<DSR> =>
      this.request("POST", `/dsr/${id}`, { body: input }),
  };

  // --- Breaches -----------------------------------------------------------

  readonly breaches = {
    /** List breach incidents. Requires a secret key. */
    list: (query: BreachListQuery = {}): Promise<Breach[]> =>
      this.request("GET", "/breaches", { query }),
    /** Report a breach incident (metadata only — never PII). Requires a secret key. */
    report: (input: BreachReportInput): Promise<Breach> =>
      this.request("POST", "/breaches", { body: input }),
    /** Get a single breach. Requires a secret key. */
    get: (id: number): Promise<Breach> => this.request("GET", `/breaches/${id}`),
    /** Advance a breach (investigate/contain/notify_board/notify_principals/close). Requires a secret key. */
    act: (id: number, input: BreachActionInput): Promise<Breach> =>
      this.request("POST", `/breaches/${id}`, { body: input }),
    /** Generate draft Board + principal breach notices. Requires a secret key. */
    notifications: (id: number): Promise<BreachNotifications> =>
      this.request("GET", `/breaches/${id}/notification`),
  };

  // --- Targets & fan-out tasks --------------------------------------------

  readonly targets = {
    /** List downstream erasure targets. Requires a secret key. */
    list: (): Promise<Target[]> => this.request("GET", "/targets"),
    /** Register a target. The signing `secret` is returned only once. Requires a secret key. */
    create: (input: TargetCreateInput): Promise<TargetWithSecret> =>
      this.request("POST", "/targets", { body: input }),
    /** Get a single target. Requires a secret key. */
    get: (id: number): Promise<Target> => this.request("GET", `/targets/${id}`),
    /** Update a target. Requires a secret key. */
    update: (id: number, input: TargetUpdateInput): Promise<Target> =>
      this.request("POST", `/targets/${id}`, { body: input }),
    /** Delete a target. Requires a secret key. */
    remove: (id: number): Promise<void> => this.request("DELETE", `/targets/${id}`),
  };

  readonly erasureTasks = {
    /** List per-system erasure fan-out tasks (the propagation evidence). Requires a secret key. */
    list: (query: ErasureTaskListQuery = {}): Promise<ErasureTask[]> =>
      this.request("GET", "/erasure/tasks", { query }),
    /** Re-deliver an erasure instruction to a target. Requires a secret key. */
    retry: (id: number): Promise<ErasureTask> =>
      this.request("POST", `/erasure/tasks/${id}/retry`),
  };
}
