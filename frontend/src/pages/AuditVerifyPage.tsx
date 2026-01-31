import React, { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { PageHeader } from "../components/common/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { computePacketHash, type AuditPacket } from "../lib/agenticAudit";
import { verifyAuditPacketOnServer } from "../lib/auditServer";

export function AuditVerifyPage() {
  const [input, setInput] = useState("");
  const [parsed, setParsed] = useState<AuditPacket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computedHash, setComputedHash] = useState<string | null>(null);
  const [serverResult, setServerResult] = useState<{ claimed?: string; computed?: string; match?: boolean } | null>(null);

  const claimedHash = parsed?.packetHash ?? null;
  const verificationState = useMemo(() => {
    if (!computedHash || !claimedHash) return "unknown";
    return computedHash === claimedHash ? "pass" : "fail";
  }, [computedHash, claimedHash]);

  const handleVerify = async () => {
    setError(null);
    setComputedHash(null);
    setParsed(null);
    setServerResult(null);

    try {
      const parsedJson = JSON.parse(input) as AuditPacket;
      setParsed(parsedJson);
      const hash = await computePacketHash(parsedJson);
      setComputedHash(hash);
      toast.success("Packet verified");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON payload");
    }
  };

  const handleServerVerify = async () => {
    if (!parsed) {
      toast.error("Paste and verify JSON first");
      return;
    }
    const response = await verifyAuditPacketOnServer(parsed);
    if (!response.ok) {
      toast.error(response.message ?? "Server verification failed");
      return;
    }
    setServerResult(response.data as { claimed?: string; computed?: string; match?: boolean });
    toast.success("Server verification complete");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Packet Verification"
        subtitle="Verify packet integrity by recomputing the SHA-256 hash."
      />

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Audit packet JSON
            </label>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Paste audit packet JSON here"
              className="min-h-[220px] w-full rounded-md border border-border/70 bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
              aria-label="Audit packet JSON input"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleVerify} disabled={!input.trim()}>
              Verify packet
            </Button>
            <Button variant="outline" onClick={handleServerVerify} disabled={!parsed}>
              Verify via server
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorState title="Unable to verify" description={error} />}

      {!error && !computedHash && !claimedHash && (
        <EmptyState
          title="Awaiting verification"
          description="Paste an audit packet and click verify to recompute the hash."
        />
      )}

      {(computedHash || claimedHash) && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={verificationState === "pass" ? "success" : verificationState === "fail" ? "destructive" : "secondary"}>
                {verificationState === "pass" ? "PASS" : verificationState === "fail" ? "FAIL" : "PENDING"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {verificationState === "pass"
                  ? "Packet hash matches the computed value."
                  : verificationState === "fail"
                    ? "Packet hash does not match."
                    : "Compute to verify integrity."}
              </span>
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs">
              <p className="text-muted-foreground">Claimed packetHash</p>
              <p className="mt-1 break-all text-foreground">{claimedHash ?? "--"}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background p-3 text-xs">
              <p className="text-muted-foreground">Computed SHA-256</p>
              <p className="mt-1 break-all text-foreground">{computedHash ?? "--"}</p>
            </div>
            {serverResult && (
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs">
                <p className="text-muted-foreground">Server verification</p>
                <p className="mt-1 text-foreground">
                  {serverResult.match ? "PASS" : "FAIL"}
                </p>
                <p className="mt-2 break-all text-muted-foreground">
                  Claimed: {serverResult.claimed ?? "--"}
                </p>
                <p className="mt-1 break-all text-muted-foreground">
                  Computed: {serverResult.computed ?? "--"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
