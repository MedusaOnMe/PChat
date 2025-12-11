"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useRoomContext,
  useConnectionState,
} from "@livekit/components-react";
import { Track, ConnectionState, RoomEvent, DataPacket_Kind } from "livekit-client";
import { useParams, useSearchParams } from "next/navigation";

// Sound effects using Audio API
function playJoinSound() {
  try {
    const audio = new Audio("/join.mp3");
    audio.volume = 0.3;
    audio.play().catch(() => {});
  } catch { /* ignore */ }
}

function playLeaveSound() {
  try {
    const audio = new Audio("/leave.mp3");
    audio.volume = 0.3;
    audio.play().catch(() => {});
  } catch { /* ignore */ }
}

function playMuteSound() {
  try {
    const audio = new Audio("/mute.mp3");
    audio.volume = 0.3;
    audio.play().catch(() => {});
  } catch { /* ignore */ }
}

function playUnmuteSound() {
  try {
    const audio = new Audio("/unmute.mp3");
    audio.volume = 0.3;
    audio.play().catch(() => {});
  } catch { /* ignore */ }
}

// Emoji reactions
const REACTION_EMOJIS = ["🚀", "🔥", "🇮🇳", "🏳️‍🌈", "💀", "👍", "😂"];

interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
}

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
  tokenCA,
  tokenImage,
  onLeave,
}: {
  tokenName: string;
  tokenSymbol: string;
  tokenCA: string;
  tokenImage: string | null;
  onLeave: () => void;
}) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const [isMuted, setIsMuted] = useState(true);
  const prevParticipantCount = useRef(participants.length);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);

  // Add a floating reaction to display
  const addFloatingReaction = useCallback((emoji: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    const x = 20 + Math.random() * 60; // Random x position (20-80%)
    setFloatingReactions(prev => [...prev, { id, emoji, x }]);
    // Remove after animation completes
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 2000);
  }, []);

  // Send a reaction to all participants
  const sendReaction = useCallback((emoji: string) => {
    // Show locally immediately
    addFloatingReaction(emoji);
    // Broadcast to others
    const data = new TextEncoder().encode(JSON.stringify({ type: "reaction", emoji }));
    localParticipant.publishData(data, { reliable: true });
  }, [localParticipant, addFloatingReaction]);

  // Listen for reactions from other participants
  useEffect(() => {
    const handleData = (payload: Uint8Array) => {
      try {
        const message = JSON.parse(new TextDecoder().decode(payload));
        if (message.type === "reaction" && message.emoji) {
          addFloatingReaction(message.emoji);
        }
      } catch { /* ignore invalid messages */ }
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room, addFloatingReaction]);

  // Track participant changes for sounds
  useEffect(() => {
    const currentCount = participants.length;
    const prevCount = prevParticipantCount.current;

    if (currentCount > prevCount) {
      playJoinSound();
    } else if (currentCount < prevCount && prevCount > 0) {
      playLeaveSound();
    }

    prevParticipantCount.current = currentCount;
  }, [participants.length]);

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
      // Play sound after successful toggle (isMuted is the state BEFORE toggle)
      if (isMuted) {
        playUnmuteSound();
      } else {
        playMuteSound();
      }
    } catch (e) {
      console.error("Failed to toggle mic:", e);
    }
  };

  const disconnect = () => {
    playLeaveSound();
    room.disconnect();
    onLeave();
  };

  const shareTweet = () => {
    const link = `${window.location.origin}/pip/${tokenCA}`;
    const text = `Join the $${tokenSymbol} voice chat on @PumpChatOnSol`;
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`;
    window.open(tweetUrl, "_blank");
  };

  // Connection quality indicator
  const getConnectionColor = () => {
    switch (connectionState) {
      case ConnectionState.Connected: return "#00ff88";
      case ConnectionState.Connecting: return "#fbbf24";
      case ConnectionState.Reconnecting: return "#fbbf24";
      default: return "#ef4444";
    }
  };

  // Truncate name for display
  const truncateName = (name: string, max: number) =>
    name.length > max ? name.substring(0, max) + "…" : name;

  return (
    <div className="h-screen bg-[#0a0a0a] flex flex-col text-white relative overflow-hidden">
      {/* Floating reactions */}
      {floatingReactions.map((reaction) => (
        <div
          key={reaction.id}
          className="absolute text-4xl pointer-events-none animate-float-up"
          style={{
            left: `${reaction.x}%`,
            bottom: "120px",
            animation: "floatUp 2s ease-out forwards",
          }}
        >
          {reaction.emoji}
        </div>
      ))}
      <style jsx>{`
        @keyframes floatUp {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-300px) scale(1.2);
          }
        }
      `}</style>

      {/* Do not close banner */}
      <div className="bg-[#00ff88] text-black text-center py-1.5 px-4 text-xs font-medium">
        Do not close this tab while in voice chat
      </div>

      {/* Header */}
      <div className="p-4 border-b border-[#1a1a1a] flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Connection indicator */}
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: getConnectionColor() }}
            title={connectionState}
          />
          <span className="font-bold text-sm">
            <span className="text-[#00ff88]">Pump</span>Chat
          </span>
          <span className="text-zinc-600">|</span>
          {tokenImage && (
            <img src={tokenImage} alt="" className="w-6 h-6 rounded-full object-cover" />
          )}
          <span className="text-sm">
            {truncateName(tokenName, 30)}{" "}
            <span className="text-zinc-500">- ${tokenSymbol}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Tweet button */}
          <button
            onClick={shareTweet}
            className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#1a1a1a] border border-[#333] text-zinc-400 hover:text-white hover:border-[#00ff88]/50 transition-colors flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            Tweet
          </button>
          <span className="px-3 py-1 rounded-full text-sm font-semibold bg-[#00ff88] text-black flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
            {participants.length}
          </span>
        </div>
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
        <div className="max-w-2xl mx-auto space-y-3">
          {/* Reaction buttons */}
          <div className="flex justify-center gap-2">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => sendReaction(emoji)}
                className="w-10 h-10 rounded-full bg-[#1a1a1a] border border-[#282828] hover:border-[#00ff88]/50 hover:bg-[#252525] transition-all text-xl active:scale-90"
                title={`Send ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
          {/* Mic and Leave buttons */}
          <div className="flex justify-center gap-3">
            <button
              onClick={toggleMic}
              className={`px-8 py-3 rounded-full font-semibold text-sm transition-all ${
                isMuted
                  ? "bg-[#0a0a0a] text-[#00ff88] border-2 border-[#00ff88] hover:bg-[#111] animate-pulse shadow-[0_0_15px_rgba(0,255,136,0.3)]"
                  : "bg-[#00ff88] text-black hover:bg-[#00cc6a]"
              }`}
            >
              {isMuted ? "🎙️ Click to Talk" : "Mute"}
            </button>
            <button
              onClick={disconnect}
              className="px-6 py-3 rounded-full bg-red-500/15 text-red-400 text-sm font-medium hover:bg-red-500/25 transition-colors"
            >
              Leave
            </button>
          </div>
        </div>
      </div>

      <RoomAudioRenderer />
    </div>
  );
}

export default function PipPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const ca = params.ca as string;
  const urlUsername = searchParams.get("username");

  const [token, setToken] = useState<string | null>(null);
  const [tokenCA, setTokenCA] = useState<string | null>(null);
  const [tokenName, setTokenName] = useState<string | null>(null);
  const [tokenSymbol, setTokenSymbol] = useState<string | null>(null);
  const [tokenImage, setTokenImage] = useState<string | null>(null);
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
      setTokenImage(infoData.image || null);

      // Fetch LiveKit token with username if provided
      const usernameParam = urlUsername ? `&username=${encodeURIComponent(urlUsername)}` : "";
      const response = await fetch(`/api/token?room=${encodeURIComponent(resolved)}${usernameParam}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get token");
      }

      setToken(data.token);
      setIsConnected(true);
      playJoinSound(); // Play sound on successful connect (also unlocks audio)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setIsConnecting(false);
    }
  }, [ca, urlUsername]);

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
        tokenCA={tokenCA}
        tokenImage={tokenImage}
        onLeave={handleLeave}
      />
    </LiveKitRoom>
  );
}
