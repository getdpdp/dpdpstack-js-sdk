/**
 * Request/response shapes for the DPDPStack HTTP API.
 *
 * The SDK mirrors the wire format (snake_case) exactly, so these types double as
 * documentation and line up 1:1 with the curl examples in the docs. Free-form
 * maps (`metadata`, `payload`, `translations`) are intentionally `Record<…>`.
 */

/** ISO-8601 timestamp string, or null when not yet set. */
export type Timestamp = string;
export type Nullable<T> = T | null;

// --- Purposes & consent ---------------------------------------------------

export interface LocalizedNotice {
  name?: string;
  description?: string;
}

export interface Purpose {
  code: string;
  name: string;
  description: string;
  /** Per-locale notice overrides, e.g. `{ hi: { name, description } }`. */
  translations: Record<string, LocalizedNotice>;
  active: boolean;
}

export interface PurposeInput {
  code: string;
  name: string;
  description?: string;
  translations?: Record<string, LocalizedNotice>;
  active?: boolean;
}

export interface ConsentGrantInput {
  /** Your opaque user id (an internal id or hash) — never PII. */
  principal_ref: string;
  /** Purpose `code` to record consent for. */
  purpose: string;
  locale?: string;
  /** Arbitrary metadata stored on the audit receipt (kept verbatim). */
  metadata?: Record<string, unknown>;
}

export interface ConsentReceipt {
  /** Hash of the immutable audit entry — the consent receipt id. */
  receipt_id: string;
  audit_sequence: number;
  principal_ref: string;
  purpose: string;
  status: string;
  granted_at: Nullable<Timestamp>;
  /** The exact notice text shown to the principal, in the chosen locale. */
  notice_shown: Required<LocalizedNotice>;
}

export interface ConsentWithdrawInput {
  principal_ref: string;
  purpose: string;
}

/** Outcome of an erasure resolution (fires now, or defers under a legal hold). */
export interface ErasureOutcome {
  status: string;
  action?: string;
  legal_basis?: string;
  erase_after?: Nullable<Timestamp>;
  [key: string]: unknown;
}

export interface ConsentWithdrawResult {
  principal_ref: string;
  purpose: string;
  status: string;
  withdrawn_at: Nullable<Timestamp>;
  erasure: ErasureOutcome;
}

export interface ConsentStatusEntry {
  purpose: string;
  status: string;
  granted_at: Nullable<Timestamp>;
  withdrawn_at: Nullable<Timestamp>;
}

export interface ConsentStatus {
  principal_ref: string;
  consents: ConsentStatusEntry[];
}

export interface ConsentRecordSummary {
  principal_ref: string;
  purpose: string;
  status: string;
  granted_at: Nullable<Timestamp>;
  withdrawn_at: Nullable<Timestamp>;
}

// --- Erasure --------------------------------------------------------------

export interface ErasureInput {
  principal_ref: string;
}

export interface ErasureResult {
  principal_ref: string;
  status: string;
  results: Array<{ purpose: string } & ErasureOutcome>;
}

export interface ErasureConfirmResult {
  status: string;
  target: string;
}

// --- Audit ----------------------------------------------------------------

export interface AuditEntry {
  sequence: number;
  event_type: string;
  principal_ref: string;
  payload: Record<string, unknown>;
  prev_hash: string;
  entry_hash: string;
  created_at: Timestamp;
}

export interface AuditLog {
  /** Whether the hash chain still verifies end-to-end. */
  chain_verified: boolean;
  count: number;
  entries: AuditEntry[];
}

// --- Retention ------------------------------------------------------------

export type RetentionTrigger = "consent_withdrawn" | "inactivity" | "fixed_period" | string;
export type ErasureAction = "delete" | "anonymize";

export interface RetentionPolicy {
  purpose: string;
  retention_days: number;
  trigger: RetentionTrigger;
  notice_hours_before: number;
  erasure_action: ErasureAction;
  legal_hold_days: number;
  legal_basis: string;
  active: boolean;
}

export interface RetentionPolicyInput {
  purpose: string;
  retention_days: number;
  trigger?: RetentionTrigger;
  notice_hours_before?: number;
  erasure_action?: ErasureAction;
  legal_hold_days?: number;
  legal_basis?: string;
  active?: boolean;
}

export interface RetentionRunResult {
  dry_run: boolean;
  [key: string]: unknown;
}

export interface ActivityInput {
  principal_ref: string;
  purpose?: string;
}

export interface ActivityResult {
  updated: number;
  last_activity_at: Timestamp;
}

// --- Certificates ---------------------------------------------------------

/** The certificate payload (subject, status, action, legal_basis, chain_verified, …). */
export type CertificatePayload = Record<string, unknown>;

export interface IssueCertificateInput {
  principal_ref: string;
  purpose?: string;
}

export interface IssuedCertificate {
  certificate_jwt: string;
  fingerprint: string;
  issued_at: Timestamp;
  payload: CertificatePayload;
  public_key_url: string;
  verify_url: string;
}

export interface CertificateVerifyResult {
  valid: boolean;
  error?: string;
  issuer?: string;
  fingerprint?: string;
  in_registry?: boolean;
  revoked?: boolean;
  payload?: CertificatePayload;
}

export interface CertificatePublicKey {
  issuer: string;
  algorithm: string;
  public_key_pem: string;
}

export interface CertificateRegistryResult {
  found: boolean;
  fingerprint?: string;
  status?: string;
  issued_at?: Timestamp;
  revoked?: boolean;
}

export interface IssueEvidenceCertificateInput {
  subject: string;
  purpose?: string;
  source?: string;
}

// --- Evidence -------------------------------------------------------------

export interface EvidenceIngestInput {
  /** SDK-pushed hash-chain entries (each needs at least `sequence` + `entry_hash`). */
  entries: Array<Record<string, unknown>>;
  source?: string;
}

export interface EvidenceIngestResult {
  source: string;
  stored: number;
  total: number;
  chain_verified: boolean;
}

export interface EvidenceEntry {
  sequence: number;
  event_type: string;
  subject: string;
  payload: Record<string, unknown>;
  entry_hash: string;
  source_timestamp: Nullable<Timestamp>;
  received_at: Timestamp;
}

export interface EvidenceListResult {
  source: string;
  chain_verified: boolean;
  total: number;
  entries: EvidenceEntry[];
}

export interface EvidenceListQuery {
  source?: string;
  subject?: string;
}

// --- Data-subject requests (DSR) ------------------------------------------

export type DSRRequestType = "access" | "correction" | "erasure" | "nomination" | "grievance";
export type DSRStatus = "received" | "in_progress" | "completed" | "rejected" | "extended";
export type DSRAction = "acknowledge" | "start" | "complete" | "reject" | "extend";

export interface DSR {
  id: number;
  principal_ref: string;
  request_type: DSRRequestType;
  status: DSRStatus;
  detail: string;
  response: string;
  sla_days: number;
  received_at: Timestamp;
  deadline_at: Nullable<Timestamp>;
  acknowledged_at: Nullable<Timestamp>;
  completed_at: Nullable<Timestamp>;
  is_overdue: boolean;
  days_remaining: Nullable<number>;
}

export interface DSRCreateInput {
  principal_ref: string;
  request_type: DSRRequestType;
  detail?: string;
  sla_days?: number;
}

export interface DSRActionInput {
  action: DSRAction;
  /** Used by `complete`/`reject`. */
  response?: string;
  /** Used by `extend` (default 30). */
  extra_days?: number;
}

export interface DSRListQuery {
  status?: DSRStatus;
  request_type?: DSRRequestType;
  principal_ref?: string;
  overdue?: boolean;
}

// --- Breaches -------------------------------------------------------------

export type BreachSeverity = "low" | "medium" | "high" | "critical";
export type BreachStatus =
  | "reported"
  | "investigating"
  | "contained"
  | "notified"
  | "closed";
export type BreachAction =
  | "investigate"
  | "contain"
  | "notify_board"
  | "notify_principals"
  | "close";

export interface Breach {
  id: number;
  title: string;
  description: string;
  severity: BreachSeverity;
  status: BreachStatus;
  nature: string;
  affected_count: number;
  measures: string;
  discovered_at: Timestamp;
  occurred_at: Nullable<Timestamp>;
  notified_board_at: Nullable<Timestamp>;
  notified_principals_at: Nullable<Timestamp>;
}

export interface BreachReportInput {
  title: string;
  description?: string;
  severity?: BreachSeverity;
  nature?: string;
  affected_count?: number;
  measures?: string;
  occurred_at?: Nullable<Timestamp>;
}

export interface BreachActionInput {
  action: BreachAction;
  measures?: string;
}

export interface BreachListQuery {
  status?: BreachStatus;
  severity?: BreachSeverity;
}

/** Draft Board + data-principal breach notices generated from the incident. */
export type BreachNotifications = Record<string, unknown>;

// --- Targets & fan-out tasks ----------------------------------------------

export interface Target {
  id: number;
  name: string;
  url: string;
  active: boolean;
  created_at: Timestamp;
}

export interface TargetCreateInput {
  name: string;
  url: string;
  active?: boolean;
}

/** Target create response — includes the signing `secret`, returned only once. */
export interface TargetWithSecret extends Target {
  secret: string;
}

export interface TargetUpdateInput {
  name?: string;
  url?: string;
  active?: boolean;
}

export interface ErasureTask {
  id: number;
  target: string;
  principal_ref: string;
  purpose: string;
  action: string;
  reason: string;
  status: string;
  status_code: Nullable<number>;
  error: string;
  created_at: Timestamp;
  delivered_at: Nullable<Timestamp>;
  confirmed_at: Nullable<Timestamp>;
}

export interface ErasureTaskListQuery {
  principal_ref?: string;
  status?: string;
  target?: string;
}
