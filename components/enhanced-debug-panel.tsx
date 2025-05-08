"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Progress } from "@/components/ui/progress"

interface EnhancedDebugPanelProps {
  peerConnection: RTCPeerConnection | null
  localStream: MediaStream | null
  remoteAudioRef: React.RefObject<HTMLAudioElement>
  callStatus: string
}

export function EnhancedDebugPanel({
  peerConnection,
  localStream,
  remoteAudioRef,
  callStatus,
}: EnhancedDebugPanelProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [stats, setStats] = useState<any>({})
  const [localAudioLevel, setLocalAudioLevel] = useState(0)
  const [remoteAudioLevel, setRemoteAudioLevel] = useState(0)
  const [connectionDetails, setConnectionDetails] = useState({
    iceConnectionState: "N/A",
    connectionState: "N/A",
    signalingState: "N/A",
    iceGatheringState: "N/A",
    localCandidates: 0,
    remoteCandidates: 0,
    dataChannelState: "N/A",
  })

  const localAnalyserRef = useRef<AnalyserNode | null>(null)
  const remoteAnalyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const testToneOscillatorRef = useRef<OscillatorNode | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)

  // Initialize audio context and analyzers
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
      if (testToneOscillatorRef.current) {
        testToneOscillatorRef.current.stop()
        testToneOscillatorRef.current = null
      }
    }
  }, [])

  // Setup local audio analyzer
  useEffect(() => {
    if (!localStream || !audioContextRef.current) return

    const audioContext = audioContextRef.current
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256

    const source = audioContext.createMediaStreamSource(localStream)
    source.connect(analyser)

    localAnalyserRef.current = analyser

    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    const updateLocalLevel = () => {
      if (!localAnalyserRef.current) return

      localAnalyserRef.current.getByteFrequencyData(dataArray)
      const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length
      setLocalAudioLevel(average)

      requestAnimationFrame(updateLocalLevel)
    }

    updateLocalLevel()

    return () => {
      source.disconnect()
      localAnalyserRef.current = null
    }
  }, [localStream])

  // Setup remote audio analyzer
  useEffect(() => {
    if (!remoteAudioRef.current?.srcObject || !audioContextRef.current) return

    const audioContext = audioContextRef.current
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256

    const source = audioContext.createMediaStreamSource(remoteAudioRef.current.srcObject as MediaStream)
    source.connect(analyser)

    remoteAnalyserRef.current = analyser

    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    const updateRemoteLevel = () => {
      if (!remoteAnalyserRef.current) return

      remoteAnalyserRef.current.getByteFrequencyData(dataArray)
      const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length
      setRemoteAudioLevel(average)

      requestAnimationFrame(updateRemoteLevel)
    }

    updateRemoteLevel()

    return () => {
      source.disconnect()
      remoteAnalyserRef.current = null
    }
  }, [remoteAudioRef.current?.srcObject])

  // Update connection details
  useEffect(() => {
    if (!peerConnection) return

    const updateConnectionDetails = () => {
      setConnectionDetails({
        iceConnectionState: peerConnection.iceConnectionState,
        connectionState: peerConnection.connectionState,
        signalingState: peerConnection.signalingState,
        iceGatheringState: peerConnection.iceGatheringState,
        localCandidates: stats.localCandidates || 0,
        remoteCandidates: stats.remoteCandidates || 0,
        dataChannelState: dataChannelRef.current?.readyState || "N/A",
      })
    }

    // Set up event listeners
    peerConnection.addEventListener("iceconnectionstatechange", updateConnectionDetails)
    peerConnection.addEventListener("connectionstatechange", updateConnectionDetails)
    peerConnection.addEventListener("signalingstatechange", updateConnectionDetails)
    peerConnection.addEventListener("icegatheringstatechange", updateConnectionDetails)

    // Initial update
    updateConnectionDetails()

    // Create data channel for testing
    if (!dataChannelRef.current && peerConnection.connectionState !== "closed") {
      try {
        const dataChannel = peerConnection.createDataChannel("testChannel")
        dataChannel.onopen = updateConnectionDetails
        dataChannel.onclose = updateConnectionDetails
        dataChannelRef.current = dataChannel
      } catch (err) {
        console.log("Could not create data channel", err)
      }
    }

    return () => {
      peerConnection.removeEventListener("iceconnectionstatechange", updateConnectionDetails)
      peerConnection.removeEventListener("connectionstatechange", updateConnectionDetails)
      peerConnection.removeEventListener("signalingstatechange", updateConnectionDetails)
      peerConnection.removeEventListener("icegatheringstatechange", updateConnectionDetails)
    }
  }, [peerConnection, stats])

  // Refresh WebRTC stats
  const refreshStats = async () => {
    if (!peerConnection) return

    try {
      const statsReport = await peerConnection.getStats()
      const statsObj: any = {
        audio: {},
        connection: {},
        localCandidates: 0,
        remoteCandidates: 0,
      }

      statsReport.forEach((report) => {
        if (report.type === "inbound-rtp" && report.kind === "audio") {
          statsObj.audio.inbound = report
        } else if (report.type === "outbound-rtp" && report.kind === "audio") {
          statsObj.audio.outbound = report
        } else if (report.type === "transport") {
          statsObj.connection.transport = report
        } else if (report.type === "candidate-pair" && report.state === "succeeded") {
          statsObj.connection.activeCandidatePair = report
        } else if (report.type === "local-candidate") {
          statsObj.localCandidates++
        } else if (report.type === "remote-candidate") {
          statsObj.remoteCandidates++
        }
      })

      setStats(statsObj)

      // Update connection details with new candidate counts
      setConnectionDetails((prev) => ({
        ...prev,
        localCandidates: statsObj.localCandidates,
        remoteCandidates: statsObj.remoteCandidates,
      }))
    } catch (error) {
      console.error("Failed to get stats:", error)
    }
  }

  // Play test tone through the connection
  const playTestTone = () => {
    if (!audioContextRef.current || !peerConnection) return

    if (testToneOscillatorRef.current) {
      testToneOscillatorRef.current.stop()
      testToneOscillatorRef.current = null
      return
    }

    const audioContext = audioContextRef.current
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.type = "sine"
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime) // A4 note

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime) // Lower volume

    oscillator.connect(gainNode)

    // Get the audio track from local stream and replace it with our test tone
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        // Store original track to restore later
        const originalTrack = audioTrack

        // Create a new audio destination and connect our oscillator to it
        const destination = audioContext.createMediaStreamDestination()
        gainNode.connect(destination)

        // Replace the track in the peer connection
        const senders = peerConnection.getSenders()
        const audioSender = senders.find((sender) => sender.track?.kind === "audio")

        if (audioSender) {
          audioSender.replaceTrack(destination.stream.getAudioTracks()[0])

          // Start the oscillator
          oscillator.start()
          testToneOscillatorRef.current = oscillator

          // Restore original track after 3 seconds
          setTimeout(() => {
            if (audioSender && originalTrack) {
              audioSender.replaceTrack(originalTrack)
            }
            oscillator.stop()
            testToneOscillatorRef.current = null
          }, 3000)
        }
      }
    }
  }

  // Send test message through data channel
  const sendTestMessage = () => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === "open") {
      dataChannelRef.current.send("Test message: " + new Date().toISOString())
      return true
    }
    return false
  }

  // Force play remote audio
  const forcePlayAudio = () => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = false
      remoteAudioRef.current.volume = 1
      remoteAudioRef.current
        .play()
        .then(() => console.log("Audio playback started"))
        .catch((err) => console.error("Audio playback failed:", err))
    }
  }

  // Add this function in the EnhancedDebugPanel component
  const testDirectAudio = () => {
    if (!remoteAudioRef.current || !remoteAudioRef.current.srcObject) {
      alert("No remote audio stream available")
      return
    }

    // Create a new audio element for testing
    const testAudio = document.createElement("audio")
    testAudio.autoplay = true
    testAudio.controls = true
    testAudio.style.position = "fixed"
    testAudio.style.top = "10px"
    testAudio.style.right = "10px"
    testAudio.style.zIndex = "9999"

    // Clone the stream to the test audio element
    testAudio.srcObject = remoteAudioRef.current.srcObject

    // Add to document
    document.body.appendChild(testAudio)

    // Play and show message
    testAudio
      .play()
      .then(() => {
        alert("Test audio element created. Check the top-right corner of your screen.")

        // Remove after 30 seconds
        setTimeout(() => {
          document.body.removeChild(testAudio)
        }, 30000)
      })
      .catch((err) => {
        alert("Failed to play test audio: " + err.message)
        document.body.removeChild(testAudio)
      })
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full mb-4 border rounded-lg">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full flex justify-between p-4 h-auto">
          WebRTC Debug Panel
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="py-2">
                <CardTitle className="text-sm">Connection Status</CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div className="font-medium">ICE Connection:</div>
                  <div
                    className={`${
                      connectionDetails.iceConnectionState === "connected"
                        ? "text-green-500"
                        : connectionDetails.iceConnectionState === "failed"
                          ? "text-red-500"
                          : "text-yellow-500"
                    }`}
                  >
                    {connectionDetails.iceConnectionState}
                  </div>

                  <div className="font-medium">Connection:</div>
                  <div
                    className={`${
                      connectionDetails.connectionState === "connected"
                        ? "text-green-500"
                        : connectionDetails.connectionState === "failed"
                          ? "text-red-500"
                          : "text-yellow-500"
                    }`}
                  >
                    {connectionDetails.connectionState}
                  </div>

                  <div className="font-medium">Signaling:</div>
                  <div>{connectionDetails.signalingState}</div>

                  <div className="font-medium">ICE Gathering:</div>
                  <div>{connectionDetails.iceGatheringState}</div>

                  <div className="font-medium">Local Candidates:</div>
                  <div>{connectionDetails.localCandidates}</div>

                  <div className="font-medium">Remote Candidates:</div>
                  <div>{connectionDetails.remoteCandidates}</div>

                  <div className="font-medium">Data Channel:</div>
                  <div
                    className={`${connectionDetails.dataChannelState === "open" ? "text-green-500" : "text-yellow-500"}`}
                  >
                    {connectionDetails.dataChannelState}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-2">
                <CardTitle className="text-sm">Audio Levels</CardTitle>
              </CardHeader>
              <CardContent className="py-2 space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Local Microphone</span>
                    <span>{Math.round(localAudioLevel)}%</span>
                  </div>
                  <Progress value={localAudioLevel} className="h-2" />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Remote Audio</span>
                    <span>{Math.round(remoteAudioLevel)}%</span>
                  </div>
                  <Progress value={remoteAudioLevel} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={refreshStats}>
              Refresh Stats
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={playTestTone}
              disabled={!peerConnection || callStatus !== "connected"}
            >
              Send Test Tone
            </Button>
            <Button size="sm" variant="outline" onClick={forcePlayAudio} disabled={!remoteAudioRef.current}>
              Force Play Audio
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const success = sendTestMessage()
                if (!success) {
                  alert("Data channel not open. Connection may not be established.")
                } else {
                  alert("Test message sent. Check console on both ends.")
                }
              }}
              disabled={!peerConnection || connectionDetails.dataChannelState !== "open"}
            >
              Test Data Channel
            </Button>
            <Button size="sm" variant="outline" onClick={testDirectAudio} disabled={!remoteAudioRef.current?.srcObject}>
              Test Direct Audio
            </Button>
          </div>

          {Object.keys(stats).length > 0 && stats.audio && (
            <Card>
              <CardHeader className="py-2">
                <CardTitle className="text-sm">Audio Stats</CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <div className="text-xs space-y-2">
                  {stats.audio.outbound && (
                    <div>
                      <p className="font-medium">Outbound Audio:</p>
                      <p>Packets Sent: {stats.audio.outbound.packetsSent}</p>
                      <p>Bytes Sent: {stats.audio.outbound.bytesSent}</p>
                    </div>
                  )}

                  {stats.audio.inbound && (
                    <div>
                      <p className="font-medium">Inbound Audio:</p>
                      <p>Packets Received: {stats.audio.inbound.packetsReceived}</p>
                      <p>Packets Lost: {stats.audio.inbound.packetsLost}</p>
                      <p>Bytes Received: {stats.audio.inbound.bytesReceived}</p>
                      <p>Jitter: {stats.audio.inbound.jitter?.toFixed(3)}s</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="text-xs text-muted-foreground">
            <p>Troubleshooting Tips:</p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>If ICE Connection is "checking" or "disconnected", you may have firewall/NAT issues</li>
              <li>If you see local audio level moving but not remote, audio is not being received</li>
              <li>If data channel works but audio doesn't, check browser permissions</li>
              <li>Try the "Force Play Audio" button if you can't hear anything</li>
              <li>The "Send Test Tone" button sends a 440Hz tone for 3 seconds</li>
            </ul>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
