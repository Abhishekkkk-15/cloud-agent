import { useState } from "react"
import { CheckIcon, CopyIcon, QrCodeIcon, ShieldCheckIcon, SmartphoneIcon, WifiIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export function PairDeviceDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [copied, setCopied] = useState(false)
  const pairingCode = "729-418"

  const handleCopy = async () => {
    await navigator.clipboard.writeText(`https://cloudagent.dev/pair?code=${pairingCode}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2">
            <SmartphoneIcon className="size-6" />
          </div>
          <DialogTitle className="text-base font-semibold">
            Control Local Agents Remotely
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Connect your phone or web browser directly to this machine using end-to-end encrypted WebRTC.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center space-y-4 py-2">
          {/* Mock QR Code Container */}
          <div className="relative flex size-44 items-center justify-center rounded-2xl border-2 border-dashed border-primary/40 bg-muted/40 p-4 shadow-inner">
            <div className="grid grid-cols-5 gap-2 text-primary opacity-85">
              {Array.from({ length: 25 }).map((_, i) => (
                <div
                  key={i}
                  className={`size-4 rounded-xs ${
                    (i % 2 === 0 || i % 7 === 0 || i === 0 || i === 4 || i === 20 || i === 24)
                      ? "bg-primary"
                      : "bg-primary/20"
                  }`}
                />
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-background/30 backdrop-blur-xs">
              <QrCodeIcon className="size-10 text-primary drop-shadow" />
            </div>
          </div>

          {/* 6-Digit Code */}
          <div className="flex flex-col items-center space-y-1">
            <span className="text-[11px] text-muted-foreground uppercase font-medium">Or enter pairing code</span>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-1.5 font-mono text-lg font-bold tracking-widest text-foreground">
              <span>{pairingCode}</span>
            </div>
          </div>

          {/* Security Features */}
          <div className="w-full rounded-xl border bg-muted/30 p-3 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ShieldCheckIcon className="size-4 text-emerald-500 shrink-0" />
              <span>Direct P2P DataChannel — no code or prompts touch cloud servers</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <WifiIcon className="size-4 text-blue-500 shrink-0" />
              <span>Instant LAN discovery when on the same Wi-Fi network</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" className="text-xs" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button size="sm" className="text-xs gap-1.5" onClick={handleCopy}>
            {copied ? <CheckIcon className="size-3.5 text-emerald-500" /> : <CopyIcon className="size-3.5" />}
            <span>{copied ? "Link Copied!" : "Copy Pairing Link"}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
