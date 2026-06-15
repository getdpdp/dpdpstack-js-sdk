// Server-side usage (Node 18+). Run: node examples/server.mjs
// Uses a SECRET key (dpdp_sk_…) — never expose this in a browser.
import { DPDPStack, DPDPError } from "dpdpstack-js-sdk";

const dpdp = new DPDPStack({
  apiKey: process.env.DPDP_SECRET_KEY, // dpdp_sk_…
  // apiBase defaults to https://getdpdp.net/api/v1
});

try {
  // Record + read consent
  await dpdp.grantConsent({ principal_ref: "user_42", purpose: "marketing" });
  const status = await dpdp.consentStatus("user_42");
  console.log("consent:", status.consents);

  // Withdraw → erasure resolves (fires now, or defers under a legal hold)
  const w = await dpdp.withdrawConsent({ principal_ref: "user_42", purpose: "marketing" });
  console.log("erasure:", w.erasure.status);

  // Issue + verify a Certificate of Erasure
  const cert = await dpdp.certificates.issue({ principal_ref: "user_42", purpose: "marketing" });
  const verified = await dpdp.certificates.verify(cert.certificate_jwt);
  console.log("certificate valid:", verified.valid, "fingerprint:", cert.fingerprint);

  // Audit chain
  const audit = await dpdp.getAuditLog({ principal_ref: "user_42" });
  console.log("audit entries:", audit.count, "chain ok:", audit.chain_verified);

  // Rights request (DSR)
  const dsr = await dpdp.dsr.create({ principal_ref: "user_42", request_type: "access" });
  await dpdp.dsr.act(dsr.id, { action: "complete", response: "Data export sent." });
} catch (err) {
  if (err instanceof DPDPError) console.error(`API ${err.status}: ${err.detail}`);
  else throw err;
}
