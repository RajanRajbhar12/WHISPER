"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Mic, MicOff, Phone, PhoneOff, RefreshCw, Volume2, VolumeX } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"
import { AudioVisualizer } from "@/components/audio-visualizer"
import { cn } from "@/lib/utils"
// Import the EnhancedDebugPanel component
import { EnhancedDebugPanel } from "@/components/enhanced-debug-panel"

// Initialize Supabase client
const supabaseUrl = "https://ielubmsxbovaloqwqqrn.supabase.co"
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllbHVibXN4Ym92YWxvcXdxcXJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MDkxMzQsImV4cCI6MjA2MjE4NTEzNH0.afjbYMRFk-kGjMJXIcXl8tRiAy9XIs-6xNmy_3Sn6sY"
const supabase = createClient(supabaseUrl, supabaseKey)

const moods = [
  { value: "happy", label: "Happy" },
  { value: "sad", label: "Sad" },
  { value: "excited", label: "Excited" },
  { value: "lonely", label: "Lonely" },
  { value: "reflective", label: "Reflective" },
  { value: "anxious", label: "Anxious" },
  { value: "calm", label: "Calm" },
  { value: "curious", label: "Curious" },
]

export default function TalkPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [matchedUserId, setMatchedUserId] = useState<string | null>(null)
  const [callRoomId, setCallRoomId] = useState<string | null>(null)
  const [selectedMood, setSelectedMood] = useState<string>("happy")
  const [status, setStatus] = useState<string>("idle")
  const [callStatus, setCallStatus] = useState<string>("disconnected")
  const [isSearching, setIsSearching] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeakerOn, setIsSpeakerOn] = useState(true)
  const [callDuration, setCallDuration] = useState(0)
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null)
  const [signalingSubscription, setSignalingSubscription] = useState<any>(null)
  const [userStatusSubscription, setUserStatusSubscription] = useState<any>(null)
  const [iceConnectionState, setIceConnectionState] = useState<string>('')
  const [signalingState, setSignalingState] = useState<string>('')
  const [sentCandidates, setSentCandidates] = useState<number>(0)
  const [receivedCandidates, setReceivedCandidates] = useState<number>(0)

  // WebRTC state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null)
  const [pendingCandidates, setPendingCandidates] = useState<RTCIceCandidate[]>([])
  

  // Refs for audio elements
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      cleanupCall()
      if (currentUserId) {
        updateUserStatus(currentUserId, "ended")
      }
    }
  }, [currentUserId])

  // Process pending ICE candidates when remote description is set
  useEffect(() => {
    if (peerConnection?.remoteDescription && pendingCandidates.length > 0) {
      // Add any pending ICE candidates
      pendingCandidates.forEach(async (candidate) => {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
      })
      // Clear pending candidates
      setPendingCandidates([])
    }
  }, [peerConnection?.remoteDescription, pendingCandidates])

  // Find a stranger to talk with
  const findStranger = async () => {
    setIsSearching(true)
    setStatus("searching")

    try {
      // Insert user into "users" table
      const { data, error } = await supabase
        .from("users")
        .insert([{ mood: selectedMood, status: "waiting" }])
        .select()

      if (error) throw error

      if (data && data.length > 0) {
        const userId = data[0].id
        setCurrentUserId(userId)

        // Start the matchmaking logic
        matchUser(userId, selectedMood)

        // Subscribe to user status changes
        subscribeToUserStatus(userId)

        toast({
          title: "Looking for someone to talk to",
          description: `Finding someone who feels ${selectedMood}...`,
        })
      }
    } catch (error) {
      console.error("Error:", error)
      setIsSearching(false)
      setStatus("idle")

      toast({
        title: "Error finding a stranger",
        description: "Please try again later",
        variant: "destructive",
      })
    }
  }

  // Subscribe to user status changes
  const subscribeToUserStatus = (userId: string) => {
    const subscription = supabase
      .channel(`user_status:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "users",
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          // Check if the matched user disconnected
          if (payload.new && payload.new.matched_with === null && status === "matched") {
            toast({
              title: "Stranger disconnected",
              description: "The other person has left the conversation",
            })
            // End the call if it's still active
            if (callStatus !== "disconnected") {
              endCall()
            }
          }
        },
      )
      .subscribe()

    setUserStatusSubscription(subscription)
  }

  // Match with another user
  const matchUser = async (userId: string, mood: string) => {
    try {
      // Find users with the same mood who are waiting
      const { data: waitingUsers, error } = await supabase
        .from("users")
        .select("*")
        .eq("mood", mood)
        .eq("status", "waiting")
        .neq("id", userId)
        .limit(1)

      if (error) throw error

      if (waitingUsers && waitingUsers.length > 0) {
        const stranger = waitingUsers[0]
        setMatchedUserId(stranger.id)

        // Update both users' status to 'matched'
        await supabase.from("users").update({ status: "matched", matched_with: stranger.id }).eq("id", userId)

        await supabase.from("users").update({ status: "matched", matched_with: userId }).eq("id", stranger.id)

        setStatus("matched")
        setIsSearching(false)

        // Create a call room
        const { data: room, error: roomError } = await supabase
          .from("call_rooms")
          .insert([
            {
              user1_id: userId,
              user2_id: stranger.id,
              status: "waiting",
            },
          ])
          .select()

        if (roomError) throw roomError

        if (room && room.length > 0) {
          setCallRoomId(room[0].id)

          toast({
            title: "Match found!",
            description: `You are now matched with someone who feels ${stranger.mood}`,
          })
        }

        // Subscribe to matched user's status
        if (stranger.id) {
          subscribeToMatchedUserStatus(stranger.id)
        }
      } else {
        // Check again after a delay
        setTimeout(() => checkForMatch(userId, mood), 5000)
      }
    } catch (error) {
      console.error("Matching error:", error)
      setIsSearching(false)
      setStatus("idle")

      toast({
        title: "Error during matching",
        description: "Please try again later",
        variant: "destructive",
      })
    }
  }

  // Subscribe to matched user's status changes
  const subscribeToMatchedUserStatus = (matchedId: string) => {
    const subscription = supabase
      .channel(`matched_user:${matchedId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "users",
          filter: `id=eq.${matchedId}`,
        },
        (payload) => {
          // Check if the matched user disconnected
          if (payload.new && (payload.new.status === "ended" || payload.new.matched_with === null)) {
            toast({
              title: "Stranger disconnected",
              description: "The other person has left the conversation",
            })
            // End the call if it's still active
            if (callStatus !== "disconnected") {
              endCall()
            }
          }
        },
      )
      .subscribe()

    // Store this subscription to clean up later
    setSignalingSubscription((prev: any) => ({ ...prev, matchedUserStatus: subscription }))
  }

  // Check if someone matched with this user
  const checkForMatch = async (userId: string, mood: string) => {
    try {
      const { data, error } = await supabase.from("users").select("*").eq("id", userId).single()

      if (error) throw error

      if (data && data.status === "matched") {
        setMatchedUserId(data.matched_with)
        setStatus("matched")
        setIsSearching(false)

        // Get the call room
        const { data: room, error: roomError } = await supabase
          .from("call_rooms")
          .select("*")
          .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
          .eq("status", "waiting")
          .single()

        if (roomError) throw roomError

        if (room) {
          setCallRoomId(room.id)

          toast({
            title: "Match found!",
            description: "Someone wants to talk with you",
          })
        }

        // Subscribe to matched user's status
        if (data.matched_with) {
          subscribeToMatchedUserStatus(data.matched_with)
        }
      } else {
        // Still waiting, check again
        matchUser(userId, mood)
      }
    } catch (error) {
      console.error("Check match error:", error)
      setIsSearching(false)
      setStatus("idle")
    }
  }

  // Start a call
  const startCall = async () => {
    try {
      setCallStatus("connecting")

      // Get local audio stream (voice only)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      })

      setLocalStream(stream)

      // Create RTCPeerConnection
      // Update your peer connection configuration to:
  const configuration: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ],
  iceTransportPolicy: "all" as RTCIceTransportPolicy,
}


      const pc = new RTCPeerConnection(configuration)
      setPeerConnection(pc)

      // Add connection state logging
      pc.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", pc.iceConnectionState)
      }

      pc.onicegatheringstatechange = () => {
        console.log("ICE gathering state:", pc.iceGatheringState)
      }

      pc.onsignalingstatechange = () => {
        console.log("Signaling state:", pc.signalingState)
      }

      // Add local stream to peer connection
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      // Handle ICE candidates
      pc.onicecandidate = async ({ candidate }) => {
        if (candidate && matchedUserId) {
          await sendSignalingMessage({
            type: "ice-candidate",
            candidate: candidate,
            sender: currentUserId,
            receiver: matchedUserId,
          })
        }
      }

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log("Connection state changed:", pc.connectionState)
        if (pc.connectionState === "connected") {
          setCallStatus("connected")
          startCallTimer()

          toast({
            title: "Call connected",
            description: "You are now talking with a stranger",
          })
        } else if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
          endCall()
        }
      }

      pc.ontrack = (event) => {
        console.log("Remote track received:", event.streams[0])

        if (remoteAudioRef.current) {
          // Important: Set srcObject directly to the first stream
          remoteAudioRef.current.srcObject = event.streams[0]

          // Force unmute and set volume
          remoteAudioRef.current.muted = false
          remoteAudioRef.current.volume = 1.0

          // Handle browser autoplay policies with immediate user interaction
          remoteAudioRef.current.play().catch((error) => {
            console.log("Audio play failed:", error)
            toast({
              title: "Audio playback blocked",
              description: "Click the play button or anywhere on the page to hear audio",
              variant: "destructive",
            })

            // Add global click handler to resume audio
            const resumeAudio = () => {
              if (remoteAudioRef.current) {
                remoteAudioRef.current
                  .play()
                  .then(() => console.log("Audio playback started"))
                  .catch((e) => console.error("Still failed to play:", e))
              }
              document.removeEventListener("click", resumeAudio)
            }
            document.addEventListener("click", resumeAudio)
          })
        }
      }

      // Create and send offer
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      if (matchedUserId) {
        await sendSignalingMessage({
          type: "offer",
          offer: offer,
          sender: currentUserId,
          receiver: matchedUserId,
        })
      }

      // Update room status
      if (callRoomId) {
        await supabase.from("call_rooms").update({ status: "connected" }).eq("id", callRoomId)
      }

      // Set up signaling channel
      setupSignalingChannel()

      // Send a "call-start" message to notify the peer
      if (matchedUserId) {
        await sendSignalingMessage({
          type: "call-start",
          sender: currentUserId,
          receiver: matchedUserId,
        })
      }
    } catch (error) {
      console.error("Error in startCall:", error)
      setCallStatus("disconnected")

      toast({
        title: "Error starting call",
        description: "Could not access microphone or establish connection",
        variant: "destructive",
      })
    }
  }

  // End the call
  const endCall = async () => {
    try {
      // Send a "call-end" message to notify the peer
      if (matchedUserId && currentUserId && callStatus !== "disconnected") {
        await sendSignalingMessage({
          type: "call-end",
          sender: currentUserId,
          receiver: matchedUserId,
        })
      }

      cleanupCall()

      // Update user and room status
      if (currentUserId) {
        await updateUserStatus(currentUserId, "ended")
      }

      if (callRoomId) {
        await supabase.from("call_rooms").update({ status: "ended" }).eq("id", callRoomId)
      }

      // Reset state
      setCallStatus("disconnected")
      setStatus("idle")
      setMatchedUserId(null)
      setCallRoomId(null)
      setCallDuration(0)

      toast({
        title: "Call ended",
        description: "Your conversation has ended",
      })
    } catch (error) {
      console.error("End call error:", error)
    }
  }

  // Find a new stranger
  const findNewStranger = async () => {
    // End current call/match if any
    if (callStatus !== "disconnected") {
      await endCall()
    } else if (status === "matched") {
      // Just update user status if call not started yet
      if (currentUserId) {
        await updateUserStatus(currentUserId, "ended")
      }
      setStatus("idle")
      setMatchedUserId(null)
      setCallRoomId(null)
    }

    // Start new search
    findStranger()
  }

  // Toggle mute
  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled
      })
      setIsMuted(!isMuted)
    }
  }

  // Toggle speaker
  const toggleSpeaker = () => {
    setIsSpeakerOn((prev) => {
      const newValue = !prev
      if (remoteAudioRef.current) {
        remoteAudioRef.current.volume = newValue ? 1 : 0
      }
      return newValue
    })
  }
  // Send signaling message through Supabase
  const sendSignalingMessage = async (message: any) => {
    try {
      await supabase.from("signaling").insert([
        {
          room_id: callRoomId,
          message: message,
          sender_id: currentUserId,
          receiver_id: matchedUserId,
        },
      ])
    } catch (error) {
      console.error("Error sending signal:", error)
    }
  }

  // Set up signaling channel
  const setupSignalingChannel = () => {
    if (!currentUserId) return

    // Subscribe to signaling messages
    const subscription = supabase
      .channel(`signaling:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "signaling",
          filter: `receiver_id=eq.${currentUserId}`,
        },
        (payload) => {
          // Process new signaling messages
          if (payload.new && payload.new.room_id === callRoomId) {
            handleSignalingMessage(payload.new.message)
          }
        },
      )
      .subscribe()

    setSignalingSubscription((prev: any) => ({ ...prev, signaling: subscription }))
  }

  // Handle incoming signaling messages
  const handleSignalingMessage = async (message: any) => {
    try {
      if (message.type === "call-end") {
        // The other person ended the call
        toast({
          title: "Call ended",
          description: "The other person ended the call",
        })
        endCall()
        return
      }

      if (!peerConnection && (message.type === "offer" || message.type === "call-start")) {
        // Create peer connection if not exists (for answer side)
        const configuration = {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            {
              urls: "turn:a.relay.metered.ca:443",
              username: "14d834f3b0d78c4fa6f179ae",
              credential: "5VjO9GQyD3q8B1lY",
            },
          ],
          iceTransportPolicy: "all",
        }

        const pc = new RTCPeerConnection(configuration)
        setPeerConnection(pc)

        // Setup local stream if not already done
        if (!localStream) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          })

          setLocalStream(stream)
          stream.getTracks().forEach((track) => pc.addTrack(track, stream))
        } else {
          localStream.getTracks().forEach((track) => pc.addTrack(track, localStream))
        }

        // Handle ICE candidates
        pc.onicecandidate = async ({ candidate }) => {
          if (candidate && message.sender) {
            await sendSignalingMessage({
              type: "ice-candidate",
              candidate: candidate,
              sender: currentUserId,
              receiver: message.sender,
            })
          }
        }

        // Handle connection state changes
        pc.onconnectionstatechange = () => {
          console.log("Connection state changed:", pc.connectionState)
          if (pc.connectionState === "connected") {
            setCallStatus("connected")
            startCallTimer()

            toast({
              title: "Call connected",
              description: "You are now talking with a stranger",
            })
          } else if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
            endCall()
          }
        }

        pc.ontrack = (event) => {
          console.log("Remote track received in answer:", event.streams[0])

          if (remoteAudioRef.current) {
            // Important: Set srcObject directly to the first stream
            remoteAudioRef.current.srcObject = event.streams[0]

            // Force unmute and set volume
            remoteAudioRef.current.muted = false
            remoteAudioRef.current.volume = 1.0

            remoteAudioRef.current.play().catch((err) => {
              console.error("Failed to play audio:", err)
              toast({
                title: "Audio playback blocked",
                description: "Click the play button or anywhere on the page to hear audio",
                variant: "destructive",
              })

              // Add global click handler to resume audio
              const resumeAudio = () => {
                if (remoteAudioRef.current) {
                  remoteAudioRef.current
                    .play()
                    .then(() => console.log("Audio playback started"))
                    .catch((e) => console.error("Still failed to play:", e))
                }
                document.removeEventListener("click", resumeAudio)
              }
              document.addEventListener("click", resumeAudio)
            })
          }
        }

        // Set call status to connecting
        setCallStatus("connecting")
      }

      if (message.type === "offer" && peerConnection) {
        // Handle incoming offer
        await peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer))

        // Create and send answer
        const answer = await peerConnection.createAnswer()
        await peerConnection.setLocalDescription(answer)

        await sendSignalingMessage({
          type: "answer",
          answer: answer,
          sender: currentUserId,
          receiver: message.sender,
        })

        // Apply any pending ICE candidates
        if (pendingCandidates.length > 0) {
          pendingCandidates.forEach(async (candidate) => {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
          })
          setPendingCandidates([])
        }
      } else if (message.type === "answer" && peerConnection) {
        // Handle incoming answer
        await peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer))

        // Apply any pending ICE candidates
        if (pendingCandidates.length > 0) {
          pendingCandidates.forEach(async (candidate) => {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
          })
          setPendingCandidates([])
        }
      } else if (message.type === "ice-candidate") {
        // Add ICE candidate
        if (peerConnection?.remoteDescription) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate))
        } else {
          // Queue candidate if remote description not set yet
          setPendingCandidates((prev) => [...prev, message.candidate])
        }
      }
    } catch (error) {
      console.error("Error handling signal:", error)
    }
  }

  // Start call timer
  const startCallTimer = () => {
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1)
    }, 1000)

    setTimerInterval(interval)
  }

  // Update user status
  const updateUserStatus = async (userId: string, status: string) => {
    try {
      await supabase
        .from("users")
        .update({
          status: status,
          matched_with: null, // Clear matched_with when ending
        })
        .eq("id", userId)
    } catch (error) {
      console.error("Error updating user status:", error)
    }
  }

  // Cleanup call resources
  const cleanupCall = () => {
    // Stop timer
    if (timerInterval) {
      clearInterval(timerInterval)
      setTimerInterval(null)
    }

    // Close peer connection
    if (peerConnection) {
      peerConnection.close()
      setPeerConnection(null)
    }

    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
      setLocalStream(null)
    }

    // Clean up audio element
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null
      remoteAudioRef.current = null
    }

    // Clean up signaling subscriptions
    if (signalingSubscription?.signaling) {
      supabase.removeChannel(signalingSubscription.signaling)
    }

    if (signalingSubscription?.matchedUserStatus) {
      supabase.removeChannel(signalingSubscription.matchedUserStatus)
    }

    setSignalingSubscription(null)
  }

  // Cleanup all resources when component unmounts
  useEffect(() => {
    return () => {
      cleanupCall()

      // Clean up user status subscription
      if (userStatusSubscription) {
        supabase.removeChannel(userStatusSubscription)
      }
    }
  }, [])

  // Format call duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // Add this function after the toggleSpeaker function
  const fixAudioRouting = () => {
    if (!remoteAudioRef.current || !remoteAudioRef.current.srcObject) {
      toast({
        title: "No audio stream detected",
        description: "Try reconnecting the call",
        variant: "destructive",
      })
      return
    }

    // Force audio to play
    remoteAudioRef.current.muted = false
    remoteAudioRef.current.volume = 1.0

    // Create a new audio context to force audio routing
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const source = audioCtx.createMediaStreamSource(remoteAudioRef.current.srcObject as MediaStream)
    const destination = audioCtx.createMediaStreamDestination()
    source.connect(destination)

    // Replace the audio element's source with the processed stream
    remoteAudioRef.current.srcObject = destination.stream

    // Force play
    remoteAudioRef.current
      .play()
      .then(() => {
        toast({
          title: "Audio routing fixed",
          description: "You should hear audio now",
        })
      })
      .catch((err) => {
        console.error("Still failed to play audio:", err)
        toast({
          title: "Audio still blocked",
          description: "Try clicking the audio controls directly",
          variant: "destructive",
        })
      })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-background to-background/90">
      {status === "matched" && callStatus !== "disconnected" && (
        <EnhancedDebugPanel
          peerConnection={peerConnection}
          localStream={localStream}
          remoteAudioRef={remoteAudioRef}
          callStatus={callStatus}
        />
      )}
      <div className="w-full max-w-md">
        <Card className="border-2 border-primary/20">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold gradient-text">Whisper</CardTitle>
            <CardDescription>Connect with strangers through voice</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {status === "idle" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">How do you feel?</label>
                  <Select value={selectedMood} onValueChange={setSelectedMood} disabled={isSearching}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your mood" />
                    </SelectTrigger>
                    <SelectContent>
                      {moods.map((mood) => (
                        <SelectItem key={mood.value} value={mood.value}>
                          {mood.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button className="w-full" onClick={findStranger} disabled={isSearching}>
                  {isSearching ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Finding someone...
                    </>
                  ) : (
                    "Find a Stranger"
                  )}
                </Button>
              </div>
            )}

            {status === "searching" && (
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-primary/40 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center wave-animation">
                          <RefreshCw className="h-5 w-5 text-white animate-spin" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-lg font-medium">Looking for someone who feels {selectedMood}...</p>
                  <p className="text-sm text-muted-foreground mt-1">This might take a moment</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsSearching(false)
                    setStatus("idle")
                    if (currentUserId) {
                      updateUserStatus(currentUserId, "cancelled")
                    }
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}

            {status === "matched" && (
              <div className="space-y-6">
                <div className="flex items-center justify-center space-x-4">
                  <Avatar className="h-16 w-16 border-2 border-primary">
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {selectedMood.substring(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="h-0.5 w-10 bg-primary/30" />

                  <Avatar className="h-16 w-16 border-2 border-primary">
                    <AvatarFallback className="bg-primary/20 text-primary">?</AvatarFallback>
                  </Avatar>
                </div>

                <div className="text-center">
                  <Badge variant="outline" className="mb-2">
                    {callStatus === "connected"
                      ? "Connected"
                      : callStatus === "connecting"
                        ? "Connecting..."
                        : "Ready to Connect"}
                  </Badge>
                  <h3 className="text-lg font-medium">
                    {callStatus === "connected" ? "Talking with a stranger" : "Match found!"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {callStatus === "connected"
                      ? `Call duration: ${formatDuration(callDuration)}`
                      : "Start the call to connect"}
                  </p>
                </div>

                {callStatus === "disconnected" && (
                  <Button className="w-full" onClick={startCall}>
                    <Phone className="mr-2 h-4 w-4" />
                    Start Voice Call
                  </Button>
                )}

                {(callStatus === "connecting" || callStatus === "connected") && (
                  <div className="space-y-4">
                    <AudioVisualizer isActive={callStatus === "connected"} />
                    <audio
                      ref={remoteAudioRef}
                      autoPlay
                      playsInline
                      controls
                      className="w-full mt-2" // Make it visible for debugging
                    />

                    <div className="flex justify-center space-x-3">
                      <Button
                        variant="outline"
                        size="icon"
                        className={cn(
                          "rounded-full h-12 w-12",
                          isMuted && "bg-destructive/10 text-destructive border-destructive/20",
                        )}
                        onClick={toggleMute}
                      >
                        {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                      </Button>

                      <Button variant="destructive" size="icon" className="rounded-full h-12 w-12" onClick={endCall}>
                        <PhoneOff className="h-5 w-5" />
                      </Button>

                      <Button
                        variant="outline"
                        size="icon"
                        className={cn(
                          "rounded-full h-12 w-12",
                          !isSpeakerOn && "bg-destructive/10 text-destructive border-destructive/20",
                        )}
                        onClick={toggleSpeaker}
                      >
                        {isSpeakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                      </Button>
                    </div>

                    <Button variant="secondary" className="w-full" onClick={fixAudioRouting}>
                      Fix Audio
                    </Button>
                  </div>
                )}
                {callStatus === "connected" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => {
                      console.log("Remote audio state:", remoteAudioRef.current?.srcObject)
                      console.log(
                        "Remote audio tracks:",
                        remoteAudioRef.current?.srcObject instanceof MediaStream
                          ? [...remoteAudioRef.current.srcObject.getTracks()]
                          : "No tracks",
                      )

                      // Force play audio
                      remoteAudioRef.current?.play().catch((e) => console.error(e))

                      toast({
                        title: "Audio debug",
                        description: "Check console for audio state",
                      })
                    }}
                  >
                    Debug Audio
                  </Button>
                )}
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            {status === "matched" && callStatus !== "disconnected" && (
              <Button variant="outline" className="w-full" onClick={findNewStranger}>
                Find Someone Else
              </Button>
            )}

            <Separator />

            <p className="text-xs text-center text-muted-foreground">
              By using this service, you agree to our Terms of Service and Privacy Policy. We do not record or store any
              conversations.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
