"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { useParams } from "next/navigation";

// Resolve pool address to token CA
async function resolveToTokenCA(address: string): Promise<string> {
  if (address.toLowerCase().endsWith("pump")) {
    return address;
  }
  try {
    const response = await fetch(`/api/resolve?address=${encodeURIComponent(address)}`);
    const data = await response.json();
    return data.tokenCA || address;
  } catch {
    return address;
  }
}

// Full-page voice chat UI - stays in the tab
function TabVoiceChat({
  tokenName,
  tokenSymbol,
  onLeave,
}: {
  tokenName: string;
  tokenSymbol: string;
  onLeave: () => void;
}) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    const checkMute = () => {
      const audioTrack = localParticipant.getTrackPublication(Track.Source.Microphone);
      setIsMuted(!audioTrack?.track || audioTrack.isMuted);
    };
    checkMute();
    const interval = setInterval(checkMute, 100);
    return () => clearInterval(interval);
  }, [localParticipant]);

  const toggleMic = async () => {
    try {
      await localParticipant.setMicrophoneEnabled(isMuted);
    } catch (e) {
      console.error("Failed to toggle mic:", e);
    }
  };

  const disconnect = () => {
    room.disconnect();
    onLeave();
  };

  // Truncate name for display
  const truncateName = (name: string, max: number) =>
    name.length > max ? name.substring(0, max) + "…" : name;

  return (
    <div className="h-screen bg-[#0a0a0a] flex flex-col text-white">
      {/* Header */}
      <div className="p-4 border-b border-[#1a1a1a] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm">
            <span className="text-[#00ff88]">Pump</span>Chat
          </span>
          <span className="text-zinc-600">|</span>
          <span className="text-sm">
            {truncateName(tokenName, 30)}{" "}
            <span className="text-zinc-500">- ${tokenSymbol}</span>
          </span>
        </div>
        <span className="px-3 py-1 rounded-full text-sm font-semibold bg-[#00ff88] text-black">
          {participants.length} in room
        </span>
      </div>

      {/* Participant list */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xs uppercase text-zinc-500 mb-3 tracking-wide">Participants</h2>
          {participants.length === 0 ? (
            <div className="text-zinc-500 text-sm py-4">No one here yet. Be the first to speak!</div>
          ) : (
            <div className="grid gap-2">
              {participants.map((p) => (
                <div
                  key={p.identity}
                  className={`px-4 py-3 rounded-lg flex items-center justify-between transition-all ${
                    p.isSpeaking
                      ? "bg-[#00ff88] text-black shadow-lg shadow-[#00ff88]/20"
                      : "bg-[#1a1a1a] border border-[#282828]"
                  }`}
                >
                  <span className={`font-medium ${p.isSpeaking ? "text-black" : "text-white"}`}>
                    {truncateName(p.identity, 30)}
                  </span>
                  {p.isSpeaking && (
                    <span className="text-xs font-semibold bg-black/20 px-2 py-0.5 rounded">
                      Speaking
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 border-t border-[#1a1a1a]">
        <div className="max-w-2xl mx-auto flex justify-center gap-3">
          <button
            onClick={toggleMic}
            className={`px-8 py-3 rounded-full font-semibold text-sm transition-all ${
              isMuted
                ? "bg-[#1a1a1a] text-white border border-[#333] hover:bg-[#252525]"
                : "bg-[#00ff88] text-black hover:bg-[#00cc6a]"
            }`}
          >
            {isMuted ? "Unmute" : "Mute"}
          </button>
          <button
            onClick={disconnect}
            className="px-6 py-3 rounded-full bg-red-500/15 text-red-400 text-sm font-medium hover:bg-red-500/25 transition-colors"
          >
            Leave
          </button>
        </div>
      </div>

      <RoomAudioRenderer />
    </div>
  );
}

export default function PipPage() {
  const params = useParams();
  const ca = params.ca as string;

  const [token, setToken] = useState<string | null>(null);
  const [tokenCA, setTokenCA] = useState<string | null>(null);
  const [tokenName, setTokenName] = useState<string | null>(null);
  const [tokenSymbol, setTokenSymbol] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [hasLeft, setHasLeft] = useState(false);
  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || "";

  // Auto-start connection immediately on mount
  useEffect(() => {
    connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ca]);

  const connect = useCallback(async () => {
    try {
      setIsConnecting(true);
      setError(null);

      // Resolve pool address to token CA
      const resolved = await resolveToTokenCA(ca);
      setTokenCA(resolved);

      // Fetch token info (validates token and gets name)
      const infoRes = await fetch(`/api/token-info?address=${encodeURIComponent(resolved)}`);
      const infoData = await infoRes.json();

      if (!infoRes.ok) {
        throw new Error(infoData.error || "Invalid token");
      }

      setTokenName(infoData.name);
      setTokenSymbol(infoData.symbol);

      // Fetch LiveKit token
      const response = await fetch(`/api/token?room=${encodeURIComponent(resolved)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get token");
      }

      setToken(data.token);
      setIsConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setIsConnecting(false);
    }
  }, [ca]);

  const handleLeave = useCallback(() => {
    setHasLeft(true);
  }, []);

  // Error state
  if (error) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 text-white">
        <div className="text-red-400 text-sm mb-3">{error}</div>
        <button
          onClick={() => {
            setError(null);
            setIsConnected(false);
            connect();
          }}
          className="px-4 py-2 bg-[#1a1a1a] rounded-lg text-sm hover:bg-[#252525] transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Server not configured
  if (!serverUrl) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 text-white">
        <div className="text-red-400 text-sm">Server not configured</div>
      </div>
    );
  }

  // User left the call
  if (hasLeft) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 text-white">
        <div className="text-center">
          <div className="text-zinc-400 mb-4">You left the voice chat</div>
          <button
            onClick={() => {
              setHasLeft(false);
              setIsConnected(false);
              connect();
            }}
            className="px-6 py-2.5 bg-[#00ff88] hover:bg-[#00cc6a] text-black font-semibold rounded-full text-sm transition-colors"
          >
            Rejoin
          </button>
        </div>
      </div>
    );
  }

  // Connecting state
  if (isConnecting || !isConnected || !token || !tokenCA) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-white">
        <div className="w-8 h-8 rounded-full border-2 border-[#00ff88] border-t-transparent animate-spin mb-4" />
        <div className="text-[#00ff88]">Connecting...</div>
      </div>
    );
  }

  // Connected - show full-page voice chat
  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      audio={false}
      video={false}
      onDisconnected={handleLeave}
    >
      <TabVoiceChat
        tokenName={tokenName || "Unknown Token"}
        tokenSymbol={tokenSymbol || "???"}
        onLeave={handleLeave}
      />
    </LiveKitRoom>
  );
}
