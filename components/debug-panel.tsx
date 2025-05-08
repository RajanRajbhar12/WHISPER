"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, ChevronUp } from "lucide-react"

interface DebugPanelProps {
  peerConnection: RTCPeerConnection | null
  localStream: MediaStream | null
  remoteAudio: HTMLAudioElement | null
}

export function DebugPanel({ peerConnection, localStream, remoteAudio }: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [stats, setStats] = useState<any>({})

  const refreshStats = async () => {
    if (!peerConnection) return

    try {
      const statsReport = await peerConnection.getStats()
      const statsObj: any = {}

      statsReport.forEach((report) => {
        if (report.type === "inbound-rtp" || report.type === "outbound-rtp") {
          statsObj[report.type] = report
        }
      })

      setStats(statsObj)
    } catch (error) {
      console.error("Failed to get stats:", error)
    }
  }

  const testAudio = () => {
    if (remoteAudio) {
      remoteAudio.play().catch((e) => console.error("Play failed:", e))
    }
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full flex justify-between">
          WebRTC Debug Panel
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card className="mt-2">
          <CardHeader>
            <CardTitle className="text-sm">Connection Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-1">
              <div>ICE Connection:</div>
              <div>{peerConnection?.iceConnectionState || "N/A"}</div>

              <div>Signaling State:</div>
              <div>{peerConnection?.signalingState || "N/A"}</div>

              <div>Connection State:</div>
              <div>{peerConnection?.connectionState || "N/A"}</div>

              <div>Local Audio Tracks:</div>
              <div>{localStream?.getAudioTracks().length || 0}</div>

              <div>Remote Audio:</div>
              <div>{remoteAudio?.srcObject ? "Connected" : "Not connected"}</div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button size="sm" variant="outline" onClick={refreshStats}>
                Refresh Stats
              </Button>
              <Button size="sm" variant="outline" onClick={testAudio}>
                Test Audio
              </Button>
            </div>

            {Object.keys(stats).length > 0 && (
              <pre className="mt-2 p-2 bg-muted rounded-md overflow-auto max-h-40">
                {JSON.stringify(stats, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  )
}
