import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { EmptyState } from "../components/common/EmptyState";
import { PageHeader } from "../components/common/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { fetchAuditPacketIndex, seedAuditDemoPackets } from "../lib/auditServer";
import { formatTimestamp } from "../lib/formatters";

const hashPreview = (hash: string) => `${hash.slice(0, 8)}…${hash.slice(-6)}`;

type PacketMeta = {
  packetHash: string;
  caseId: string;
  decisionId: string;
  createdAt: string;
  sizeBytes: number;
  packetVersion: string;
};

export function AuditPacketsPage() {
  const [items, setItems] = useState<PacketMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedCaseId, setSeedCaseId] = useState<string | null>(null);

  const loadPackets = async () => {
    setLoading(true);
    setError(null);
    const response = await fetchAuditPacketIndex(50);
    if (response.ok) {
      setItems(response.data as PacketMeta[]);
    } else {
      setError(response.message || "Unable to load packets");
    }
    setLoading(false);
  };

  const handleSeed = async () => {
    setSeedLoading(true);
    const response = await seedAuditDemoPackets({});
    if (response.ok) {
      const data = response.data as { caseId: string; seeded: number };
      toast.success(`Seeded ${data.seeded} demo packets`);
      setSeedCaseId(data.caseId);
      setQuery(data.caseId);
      await loadPackets();
    } else {
      toast.error(response.message || "Unable to seed demo packets");
    }
    setSeedLoading(false);
  };

  React.useEffect(() => {
    loadPackets();
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      [item.caseId, item.decisionId, item.packetHash].some((value) =>
        value?.toLowerCase().includes(term)
      )
    );
  }, [items, query]);

  const previousHashByPacket = useMemo(() => {
    const map = new Map<string, string | null>();
    items.forEach((item, index) => {
      const previous = items.slice(index + 1).find((entry) => entry.caseId === item.caseId);
      map.set(item.packetHash, previous?.packetHash ?? null);
    });
    return map;
  }, [items]);

  const copyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Packets"
        subtitle="Recent persisted audit packets from the server."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleSeed} disabled={seedLoading}>
              {seedLoading ? "Seeding..." : "Seed Demo Packets"}
            </Button>
            <Button variant="outline" size="sm" onClick={loadPackets} disabled={loading}>
              Refresh
            </Button>
          </div>
        }
      />

      {seedCaseId && (
        <div className="text-xs text-muted-foreground">
          Seeded case: <span className="font-semibold text-foreground">{seedCaseId}</span>
        </div>
      )}

      <Card>
        <CardContent className="space-y-4 p-5">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search case ID, decision ID, or hash"
          />

          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          )}

          {!loading && error && (
            <EmptyState title="Unable to load packets" description={error} actionLabel="Retry" onAction={loadPackets} />
          )}

          {!loading && !error && filtered.length === 0 && (
            <>
              <EmptyState
                title="No packets stored yet"
                description="Store an audit packet from the workbench or verify a packet to get started."
              />
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/agentic/workbench">Open Workbench</Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/audit/verify">Open Verify</Link>
                </Button>
              </div>
            </>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="table-premium w-full text-sm">
                <thead>
                  <tr>
                    <th>Created</th>
                    <th>Case ID</th>
                    <th>Decision ID</th>
                    <th>Hash</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.packetHash}>
                      <td>{formatTimestamp(item.createdAt)}</td>
                      <td>{item.caseId}</td>
                      <td>{item.decisionId}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{hashPreview(item.packetHash)}</Badge>
                          <Button variant="ghost" size="sm" onClick={() => copyHash(item.packetHash)}>
                            Copy
                          </Button>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link to={`/audit/view?hash=${item.packetHash}`}>View</Link>
                          </Button>
                          <Button asChild variant="ghost" size="sm">
                            <Link to={`/audit/verify?hash=${item.packetHash}`}>Verify</Link>
                          </Button>
                          <Button asChild variant="ghost" size="sm" disabled={!previousHashByPacket.get(item.packetHash)}>
                            <Link
                              to={
                                previousHashByPacket.get(item.packetHash)
                                  ? `/audit/diff?left=${previousHashByPacket.get(item.packetHash)}&right=${item.packetHash}`
                                  : "#"
                              }
                            >
                              Compare
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
