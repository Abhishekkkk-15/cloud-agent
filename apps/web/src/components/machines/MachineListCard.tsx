import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMachinesStore } from "@/stores/machines-store";
import {
  ServerIcon,
  Trash2Icon,
  ZapIcon,
  RefreshCwIcon,
  PlusIcon,
  RadioIcon,
} from "lucide-react";
import { ConnectMachineDialog } from "./ConnectMachineDialog";

export function MachineListCard() {
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const machines = useMachinesStore((s) => s.machines);
  const activeMachineId = useMachinesStore((s) => s.activeMachineId);
  const activeConnectionState = useMachinesStore((s) => s.activeConnectionState);
  const fetchMachines = useMachinesStore((s) => s.fetchMachines);
  const deleteMachine = useMachinesStore((s) => s.deleteMachine);
  const connectToMachine = useMachinesStore((s) => s.connectToMachine);
  const disconnectFromMachine = useMachinesStore((s) => s.disconnectFromMachine);
  const loading = useMachinesStore((s) => s.loading);

  useEffect(() => {
    fetchMachines();
  }, [fetchMachines]);

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ServerIcon className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold">Remote Coding Machines (VPS)</h3>
            <p className="text-xs text-muted-foreground">
              Peer-to-peer control of your existing CLI coding agents (Antigravity, Codex) directly on your servers.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchMachines()}
            disabled={loading}
            title="Refresh status"
          >
            <RefreshCwIcon className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={() => setConnectDialogOpen(true)} className="gap-1.5">
            <PlusIcon className="size-3.5" />
            Connect VPS
          </Button>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {machines.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            <ServerIcon className="mx-auto size-8 text-muted-foreground/50" />
            <p className="mt-2 font-medium text-foreground">No remote machines paired yet</p>
            <p className="text-xs">
              Install our zero-database daemon on your VPS to start controlling your agent remotely.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3 gap-1.5"
              onClick={() => setConnectDialogOpen(true)}
            >
              <PlusIcon className="size-3.5" />
              Pair First Machine
            </Button>
          </div>
        ) : (
          machines.map((m) => {
            const isConnectedToThis = activeMachineId === m.machineId;

            return (
              <div
                key={m.machineId}
                className={`flex flex-col justify-between gap-3 rounded-lg border p-4 transition-colors sm:flex-row sm:items-center ${
                  isConnectedToThis
                    ? "border-primary/50 bg-primary/5"
                    : "hover:bg-muted/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-1 size-2.5 rounded-full ${
                      m.isOnline
                        ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                        : "bg-zinc-400"
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{m.name}</span>
                      <Badge
                        variant={m.isOnline ? "default" : "secondary"}
                        className={`text-[10px] uppercase tracking-wider ${
                          m.isOnline
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                            : ""
                        }`}
                      >
                        {m.isOnline ? "Online" : "Offline"}
                      </Badge>

                      {isConnectedToThis && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] gap-1 ${
                            activeConnectionState === "p2p_connected"
                              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                              : "border-sky-500 text-sky-600 dark:text-sky-400"
                          }`}
                        >
                          <ZapIcon className="size-3 fill-current" />
                          {activeConnectionState === "p2p_connected" ? "P2P WebRTC Direct" : "Gateway Relay"}
                        </Badge>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>ID: <code className="text-[11px] font-mono">{m.machineId.slice(0, 8)}...</code></span>
                      <span>•</span>
                      <span>Platform: {m.platform || "linux"} ({m.arch || "x64"})</span>
                      {m.adapters && m.adapters.length > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-foreground">
                            Agent: <strong>{m.adapters[0].displayName}</strong> ({m.adapters[0].binaryName})
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {isConnectedToThis ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                      onClick={() => disconnectFromMachine()}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={!m.isOnline}
                      onClick={() => connectToMachine(m.machineId)}
                      className="gap-1.5"
                    >
                      <RadioIcon className="size-3.5" />
                      Connect P2P
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    className="size-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMachine(m.machineId)}
                    title="Revoke machine"
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ConnectMachineDialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen} />
    </div>
  );
}
