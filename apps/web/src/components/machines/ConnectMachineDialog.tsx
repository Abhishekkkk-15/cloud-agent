import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMachinesStore } from "@/stores/machines-store";
import {
  ServerIcon,
  CopyIcon,
  CheckIcon,
  TerminalIcon,
  LoaderCircleIcon,
  ShieldCheckIcon,
} from "lucide-react";

interface ConnectMachineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectMachineDialog({ open, onOpenChange }: ConnectMachineDialogProps) {
  const [machineName, setMachineName] = useState("");
  const [copied, setCopied] = useState(false);
  const [generatedInfo, setGeneratedInfo] = useState<{
    token: string;
    installCommand: string;
    machineId: string;
  } | null>(null);

  const createToken = useMachinesStore((s) => s.createToken);
  const fetchMachines = useMachinesStore((s) => s.fetchMachines);
  const machines = useMachinesStore((s) => s.machines);
  const loading = useMachinesStore((s) => s.loading);

  const handleGenerate = async () => {
    try {
      const res = await createToken(machineName || "Remote VPS");
      setGeneratedInfo({
        token: res.token,
        installCommand: `cloud-agent-daemon start --token "${res.token}"`,
        machineId: res.machineId,
      });
    } catch {
      // Error handled by store
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Poll for VPS connection once token is generated
  useEffect(() => {
    if (!generatedInfo || !open) return;

    const interval = setInterval(() => {
      fetchMachines();
    }, 2000);

    return () => clearInterval(interval);
  }, [generatedInfo, open, fetchMachines]);

  const matchedMachine = generatedInfo
    ? machines.find((m) => m.machineId === generatedInfo.machineId)
    : null;

  const isConnected = matchedMachine?.isOnline ?? false;

  const handleClose = () => {
    setGeneratedInfo(null);
    setMachineName("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <ServerIcon className="size-5" />
            </div>
            <div>
              <DialogTitle>Connect VPS Machine</DialogTitle>
              <DialogDescription>
                Install the Cloud Agent daemon on your VPS to control existing CLI tools (Antigravity, Codex) via Peer-to-Peer.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!generatedInfo ? (
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Machine Nickname</label>
              <Input
                placeholder="e.g. Hetzner-Ubuntu, Production-VPS"
                value={machineName}
                onChange={(e) => setMachineName(e.target.value)}
                className="mt-1"
                autoFocus
              />
            </div>

            <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <ShieldCheckIcon className="size-4 text-emerald-500" />
                End-to-End Secure & Zero Database
              </div>
              <p className="mt-1">
                Your machine connects outbound to the Gateway for signaling, then opens a direct WebRTC DataChannel to your browser. Your source code and chats never touch external databases.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={loading}>
                {loading && <LoaderCircleIcon className="mr-2 size-4 animate-spin" />}
                Generate Pairing Token
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {isConnected ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
                  <CheckIcon className="size-6" />
                </div>
                <h4 className="mt-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  Machine Connected Successfully!
                </h4>
                <p className="text-xs text-muted-foreground">
                  Your VPS is online and ready for direct WebRTC Peer-to-Peer control.
                </p>
                <Button className="mt-3" onClick={handleClose}>
                  Done
                </Button>
              </div>
            ) : (
              <>
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">Run this command on your VPS:</span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <LoaderCircleIcon className="size-3 animate-spin text-primary" />
                      Waiting for daemon handshake...
                    </span>
                  </div>

                  <div className="relative mt-2 rounded-lg border bg-zinc-950 p-3 text-left font-mono text-xs text-zinc-100">
                    <div className="flex items-center gap-2 pb-2 text-zinc-400">
                      <TerminalIcon className="size-3.5" />
                      <span>Terminal</span>
                    </div>
                    <code className="block select-all break-all whitespace-pre-wrap">
                      {generatedInfo.installCommand}
                    </code>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-3 w-full gap-1.5"
                      onClick={() => handleCopy(generatedInfo.installCommand)}
                    >
                      {copied ? (
                        <>
                          <CheckIcon className="size-3.5 text-emerald-500" />
                          Copied to Clipboard!
                        </>
                      ) : (
                        <>
                          <CopyIcon className="size-3.5" />
                          Copy Command
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground">
                  💡 <strong>Tip:</strong> Ensure your coding agent (e.g. <code>agy</code>) is installed on your VPS. The daemon will auto-discover it.
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
