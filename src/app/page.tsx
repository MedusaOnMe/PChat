"use client";

import { useState, useEffect, useRef } from "react";
import { createRoot, Root } from "react-dom/client";
import Image from "next/image";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import { Track, RoomEvent } from "livekit-client";

// Check if Document PiP is supported
function isPipSupported(): boolean {
  return typeof window !== "undefined" && "documentPictureInPicture" in window;
}

// Check if mobile device
function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// LocalStorage helpers
const STORAGE_KEY_USERNAME = "pumpchat_username";

function getStoredUsername(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY_USERNAME) || "";
}

function setStoredUsername(username: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_USERNAME, username);
}

// ========== TEST MODE - SET TO FALSE FOR PRODUCTION ==========
const TEST_MODE = false;
const TEST_PARTICIPANT_COUNT = 100;
// ==============================================================

// ========== OFFICIAL PUMPCHAT TOKEN ==========
// Update this when the token launches
const PUMPCHAT_TOKEN_CA = "";
// ==============================================

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

// Mini player content for PiP window
function MiniPlayerContent({
  tokenName,
  tokenSymbol,
  tokenCA,
  tokenImage,
  onClose,
}: {
  tokenName: string;
  tokenSymbol: string;
  tokenCA: string;
  tokenImage: string | null;
  onClose: () => void;
}) {
  const realParticipants = useParticipants();

  // Generate fake participants for testing
  const participants = TEST_MODE
    ? [
        ...realParticipants,
        ...Array.from({ length: TEST_PARTICIPANT_COUNT }, (_, i) => ({
          identity: `TestUser${i + 1}`,
          isSpeaking: i < 3, // First 3 are "speaking"
        })),
      ]
    : realParticipants;
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const [isMuted, setIsMuted] = useState(true);
  const prevParticipantCount = useRef(participants.length);
  const displayName = tokenName.length > 20 ? tokenName.substring(0, 20) + "…" : tokenName;
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);

  // Add a floating reaction to display
  const addFloatingReaction = (emoji: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    const x = 20 + Math.random() * 60;
    setFloatingReactions(prev => [...prev, { id, emoji, x }]);
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 2000);
  };

  // Send a reaction to all participants
  const sendReaction = (emoji: string) => {
    addFloatingReaction(emoji);
    const data = new TextEncoder().encode(JSON.stringify({ type: "reaction", emoji }));
    localParticipant.publishData(data, { reliable: true });
  };

  // Listen for reactions from other participants
  useEffect(() => {
    const handleData = (payload: Uint8Array) => {
      try {
        const message = JSON.parse(new TextDecoder().decode(payload));
        if (message.type === "reaction" && message.emoji) {
          addFloatingReaction(message.emoji);
        }
      } catch { /* ignore */ }
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room]);

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

  const shareTweet = () => {
    const link = `${window.location.origin}/pip/${tokenCA}`;
    const text = `Join the $${tokenSymbol} voice chat on @PumpChatOnSol`;
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`;
    window.open(tweetUrl, "_blank");
  };

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
    onClose();
  };

  // Truncate participant name for display
  const truncateName = (name: string, max: number) =>
    name.length > max ? name.substring(0, max) + "…" : name;

  return (
    <div
      style={{
        flex: 1,
        width: "100%",
        minHeight: 0,
        backgroundColor: "#0a0a0a",
        color: "#ededed",
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Floating reactions */}
      {floatingReactions.map((reaction) => (
        <div
          key={reaction.id}
          style={{
            position: "absolute",
            left: `${reaction.x}%`,
            bottom: "80px",
            fontSize: "28px",
            pointerEvents: "none",
            animation: "floatUp 2s ease-out forwards",
            zIndex: 100,
          }}
        >
          {reaction.emoji}
        </div>
      ))}

      {/* Header - token + count */}
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid #222",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {tokenImage && (
            <img
              src={tokenImage}
              alt=""
              style={{ width: "24px", height: "24px", borderRadius: "50%", objectFit: "cover" }}
            />
          )}
          <span style={{ fontSize: "15px", fontWeight: "600", color: "#fff" }}>
            {displayName} <span style={{ color: "#444", fontWeight: "400" }}>-</span> <span style={{ color: "#666", fontWeight: "400" }}>${tokenSymbol}</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            onClick={shareTweet}
            style={{
              padding: "4px 8px",
              borderRadius: "9999px",
              fontSize: "11px",
              fontWeight: "500",
              backgroundColor: "#1a1a1a",
              border: "1px solid #333",
              color: "#888",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "3px",
            }}
          >
            <svg width="10" height="10" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            Tweet
          </button>
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "9999px",
              fontSize: "13px",
              fontWeight: "600",
              backgroundColor: "#00ff88",
              color: "#000",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
            {participants.length}
          </span>
        </div>
      </div>

      {/* Participant list - vertical scroll */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "8px 14px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        {participants.length === 0 ? (
          <span style={{ color: "#555", fontSize: "13px", padding: "4px 0" }}>No one here yet</span>
        ) : (
          participants.map((p) => (
            <div
              key={p.identity}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: "500",
                backgroundColor: p.isSpeaking ? "#00ff88" : "#1a1a1a",
                color: p.isSpeaking ? "#000" : "#ccc",
                border: p.isSpeaking ? "none" : "1px solid #282828",
                boxShadow: p.isSpeaking ? "0 0 10px rgba(0, 255, 136, 0.3)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              {truncateName(p.identity, 20)}
            </div>
          ))
        )}
      </div>

      {/* Controls */}
      <div
        style={{
          padding: "10px 14px",
          borderTop: "1px solid #222",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {/* Reaction buttons */}
        <div style={{ display: "flex", justifyContent: "center", gap: "6px" }}>
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => sendReaction(emoji)}
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                backgroundColor: "#1a1a1a",
                border: "1px solid #282828",
                cursor: "pointer",
                fontSize: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title={`Send ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
        {/* Mic and Leave buttons */}
        <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
          <button
            onClick={toggleMic}
            style={{
              padding: "10px 28px",
              borderRadius: "9999px",
              border: isMuted ? "2px solid #00ff88" : "none",
              backgroundColor: isMuted ? "#0a0a0a" : "#00ff88",
              color: isMuted ? "#00ff88" : "#000",
              fontWeight: "600",
              fontSize: "14px",
              cursor: "pointer",
              boxShadow: isMuted ? "0 0 12px rgba(0, 255, 136, 0.3)" : "none",
              animation: isMuted ? "pulse 2s ease-in-out infinite" : "none",
            }}
          >
            {isMuted ? "🎙️ Click to Talk" : "Mute"}
          </button>
          <button
            onClick={disconnect}
            style={{
              padding: "10px 20px",
              borderRadius: "9999px",
              border: "none",
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              color: "#f87171",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            Leave
          </button>
        </div>
      </div>

      <RoomAudioRenderer />
    </div>
  );
}

export default function Home() {
  const [input, setInput] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const [isPipOpen, setIsPipOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pipWindowRef = useRef<Window | null>(null);
  const pipRootRef = useRef<Root | null>(null);

  useEffect(() => {
    setPipSupported(isPipSupported());
    setIsMobile(isMobileDevice());
    setUsername(getStoredUsername());
  }, []);

  // Save username when it changes
  const handleUsernameChange = (value: string) => {
    const sanitized = value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20);
    setUsername(sanitized);
    setStoredUsername(sanitized);
  };

  // Extract address from various URL formats
  const extractAddress = (value: string): string | null => {
    const trimmed = value.trim();
    const addressMatch = trimmed.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
    if (addressMatch) {
      return addressMatch[0];
    }
    return null;
  };

  // Resolve pool address to token CA if needed (for Axiom URLs that use pool addresses)
  const resolveToTokenCA = async (address: string): Promise<string> => {
    // If it ends with "pump", it's likely already a pump.fun token CA
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
  };

  const closePip = () => {
    if (pipWindowRef.current) {
      pipWindowRef.current.close();
      pipWindowRef.current = null;
    }
    if (pipRootRef.current) {
      pipRootRef.current.unmount();
      pipRootRef.current = null;
    }
    setIsConnecting(false);
    setIsPipOpen(false);
  };

  const openPipWindow = async (ca: string, token: string, serverUrl: string, tokenName: string, tokenSymbol: string, tokenImage: string | null) => {
    try {
      // @ts-expect-error - Document PiP API not in TypeScript types yet
      const pipWindow = await window.documentPictureInPicture.requestWindow({
        width: 400,
        height: 280,
      });

      pipWindowRef.current = pipWindow;

      // Setup PiP window - ensure content fills entire window
      pipWindow.document.title = "";
      pipWindow.document.documentElement.style.cssText = `
        height: 100%;
        margin: 0;
        padding: 0;
        background-color: #0a0a0a;
      `;
      pipWindow.document.body.style.cssText = `
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background-color: #0a0a0a;
        display: flex;
        flex-direction: column;
      `;

      // Add scrollbar styles and animations
      const styleEl = pipWindow.document.createElement("style");
      styleEl.textContent = `
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #444;
        }
        * {
          scrollbar-width: thin;
          scrollbar-color: #333 transparent;
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 12px rgba(0, 255, 136, 0.3); }
          50% { box-shadow: 0 0 20px rgba(0, 255, 136, 0.5); }
        }
        @keyframes floatUp {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-200px) scale(1.2); }
        }
      `;
      pipWindow.document.head.appendChild(styleEl);

      const container = pipWindow.document.createElement("div");
      container.id = "pip-root";
      container.style.cssText = `
        flex: 1;
        width: 100%;
        min-height: 0;
        background-color: #0a0a0a;
        display: flex;
        flex-direction: column;
      `;
      pipWindow.document.body.appendChild(container);

      // Render React into PiP window
      pipRootRef.current = createRoot(container);
      pipRootRef.current.render(
        <LiveKitRoom
          token={token}
          serverUrl={serverUrl}
          connect={true}
          audio={false}
          video={false}
          onDisconnected={closePip}
          style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
        >
          <MiniPlayerContent tokenName={tokenName} tokenSymbol={tokenSymbol} tokenCA={ca} tokenImage={tokenImage} onClose={closePip} />
        </LiveKitRoom>
      );

      // Handle PiP window close
      pipWindow.addEventListener("pagehide", closePip);

      setIsConnecting(false);
      setIsPipOpen(true);
    } catch (e) {
      console.error("Failed to open PiP:", e);
      // Fallback to popup
      fallbackToPopup(ca);
    }
  };

  const fallbackToPopup = (ca: string) => {
    // Include username in URL if set
    const usernameParam = username ? `?username=${encodeURIComponent(username)}` : "";
    // Try popup first
    const popup = window.open(
      `/pip/${ca}${usernameParam}`,
      "pumpchat",
      "width=380,height=500,left=100,top=100,resizable=yes,scrollbars=no"
    );
    // If popup blocked (mobile browsers), navigate directly
    if (!popup) {
      window.location.href = `/pip/${ca}${usernameParam}`;
      return;
    }
    setIsConnecting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const address = extractAddress(input);
    if (!address) {
      setError("Could not find a valid token address. Try pasting the CA or full URL.");
      return;
    }

    setIsConnecting(true);

    try {
      // Resolve pool address to token CA if needed (for Axiom URLs)
      const tokenCA = await resolveToTokenCA(address);

      // Fall back to popup if PiP not supported
      if (!pipSupported) {
        fallbackToPopup(tokenCA);
        return;
      }

      // Fetch token info
      const infoRes = await fetch(`/api/token-info?address=${encodeURIComponent(tokenCA)}`);
      const infoData = await infoRes.json();
      const tokenName = infoData.name || "Unknown";
      const tokenSymbol = infoData.symbol || "???";
      const tokenImage = infoData.image || null;

      // Fetch LiveKit token with username
      const usernameParam = username ? `&username=${encodeURIComponent(username)}` : "";
      const response = await fetch(`/api/token?room=${encodeURIComponent(tokenCA)}${usernameParam}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get token");
      }

      const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
      if (!serverUrl) {
        throw new Error("Server not configured");
      }

      await openPipWindow(tokenCA, data.token, serverUrl, tokenName, tokenSymbol, tokenImage);
      playJoinSound(); // Play sound on successful connect (also unlocks audio)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
      setIsConnecting(false);
    }
  };

  const [siteOrigin, setSiteOrigin] = useState("https://pumpchat.xyz");
  const bookmarkletRef = useRef<HTMLAnchorElement>(null);
  const autoSwitchRef = useRef<HTMLAnchorElement>(null);

  // Active rooms state
  interface ActiveRoom {
    ca: string;
    name: string;
    symbol: string;
    image: string | null;
    participants: number;
    createdAt: number;
  }
  const [activeRooms, setActiveRooms] = useState<ActiveRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<ActiveRoom | null>(null);
  const [featuredRoom, setFeaturedRoom] = useState<{ name: string; symbol: string; image: string | null } | null>(null);

  useEffect(() => {
    setSiteOrigin(window.location.origin);
  }, []);

  // Fetch featured room metadata
  useEffect(() => {
    if (!PUMPCHAT_TOKEN_CA) return;
    const fetchFeaturedRoom = async () => {
      try {
        const res = await fetch(`/api/token-info?address=${PUMPCHAT_TOKEN_CA}`);
        const data = await res.json();
        if (data.valid) {
          setFeaturedRoom({ name: data.name, symbol: data.symbol, image: data.image });
        }
      } catch {
        // Silently fail
      }
    };
    fetchFeaturedRoom();
  }, []);

  // Join a room directly (for live rooms)
  const joinRoomFloating = async (room: ActiveRoom) => {
    setSelectedRoom(null);
    setIsConnecting(true);

    try {
      if (!pipSupported) {
        fallbackToPopup(room.ca);
        return;
      }

      const usernameParam = username ? `&username=${encodeURIComponent(username)}` : "";
      const response = await fetch(`/api/token?room=${encodeURIComponent(room.ca)}${usernameParam}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get token");
      }

      const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
      if (!serverUrl) {
        throw new Error("Server not configured");
      }

      await openPipWindow(room.ca, data.token, serverUrl, room.name, room.symbol, room.image);
      playJoinSound();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
      setIsConnecting(false);
    }
  };

  const joinRoomNewTab = (room: ActiveRoom) => {
    setSelectedRoom(null);
    const usernameParam = username ? `?username=${encodeURIComponent(username)}` : "";
    window.open(`/pip/${room.ca}${usernameParam}`, "_blank");
  };

  // Fetch active rooms
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await fetch("/api/rooms");
        const data = await res.json();
        if (data.rooms) {
          setActiveRooms(data.rooms);
        }
      } catch (e) {
        console.error("Failed to fetch rooms:", e);
      } finally {
        setLoadingRooms(false);
      }
    };

    fetchRooms();
    // Poll every 10 seconds
    const interval = setInterval(fetchRooms, 10000);
    return () => clearInterval(interval);
  }, []);

  // Set bookmarklet href via ref to bypass React's javascript: URL blocking
  // Opens popup (not tab) with same window name so it reuses the same window
  // Positions in top-right corner of screen
  useEffect(() => {
    if (bookmarkletRef.current && siteOrigin) {
      const code = `javascript:(function(){try{var m=location.href.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);if(!m){alert('No token address found.');return;}var w=380,h=500,l=screen.width-w-20,t=80;window.open('${siteOrigin}/pip/'+m[0],'pumpchat','popup=yes,width='+w+',height='+h+',left='+l+',top='+t);}catch(e){alert('Error: '+e.message);}})();`;
      bookmarkletRef.current.setAttribute("href", code);
    }
    // Auto-switch bookmarklet - watches URL and switches rooms automatically
    if (autoSwitchRef.current && siteOrigin) {
      const autoCode = `javascript:(function(){if(window.__PUMPCHAT_WATCHER__){alert('Already watching!');return;}window.__PUMPCHAT_WATCHER__=true;var lastCA=null,w=380,h=500,l=screen.width-w-20,t=80;function check(){try{var m=location.href.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);if(m&&m[0]!==lastCA){lastCA=m[0];window.open('${siteOrigin}/pip/'+m[0],'pumpchat','popup=yes,width='+w+',height='+h+',left='+l+',top='+t);}}catch(e){}}check();setInterval(check,500);alert('PumpChat watching - will auto-switch rooms!');})();`;
      autoSwitchRef.current.setAttribute("href", autoCode);
    }
  }, [siteOrigin]);

  // Syntax highlighted code display
  const SyntaxHighlight = () => (
    <pre className="p-3 bg-[#0a0a0a] rounded text-[11px] whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
      <span className="text-purple-400">javascript:</span>
      <span className="text-zinc-300">(</span>
      <span className="text-purple-400">function</span>
      <span className="text-zinc-300">(){"{"}</span>{"\n"}
      {"  "}<span className="text-purple-400">try</span><span className="text-zinc-300"> {"{"}</span>{"\n"}
      {"    "}<span className="text-zinc-500">{"// When you click the bookmark on a token page:"}</span>{"\n"}
      {"    "}<span className="text-zinc-500">{"// 1. Extracts the token address from the URL"}</span>{"\n"}
      {"    "}<span className="text-purple-400">var</span><span className="text-zinc-300"> m = </span>
      <span className="text-blue-400">location</span><span className="text-zinc-300">.</span>
      <span className="text-blue-400">href</span><span className="text-zinc-300">.</span>
      <span className="text-yellow-300">match</span>
      <span className="text-zinc-300">(</span>
      <span className="text-orange-400">/[1-9A-HJ-NP-Za-km-z]{"{"}32,44{"}"}/</span>
      <span className="text-zinc-300">);</span>{"\n\n"}
      {"    "}<span className="text-zinc-500">{"// 2. Shows error if not on a token page"}</span>{"\n"}
      {"    "}<span className="text-purple-400">if</span><span className="text-zinc-300"> (!m) {"{"} </span>
      <span className="text-yellow-300">alert</span>
      <span className="text-zinc-300">(</span>
      <span className="text-green-400">&apos;No token address found.&apos;</span>
      <span className="text-zinc-300">); </span>
      <span className="text-purple-400">return</span>
      <span className="text-zinc-300">; {"}"}</span>{"\n\n"}
      {"    "}<span className="text-zinc-500">{"// 3. Calculates popup position (top-right corner)"}</span>{"\n"}
      {"    "}<span className="text-purple-400">var</span><span className="text-zinc-300"> w=</span>
      <span className="text-orange-300">380</span><span className="text-zinc-300">, h=</span>
      <span className="text-orange-300">500</span><span className="text-zinc-300">, l=</span>
      <span className="text-blue-400">screen</span><span className="text-zinc-300">.width-w-</span>
      <span className="text-orange-300">20</span><span className="text-zinc-300">, t=</span>
      <span className="text-orange-300">80</span><span className="text-zinc-300">;</span>{"\n\n"}
      {"    "}<span className="text-zinc-500">{"// 4. Opens the voice chat in a floating window"}</span>{"\n"}
      {"    "}<span className="text-yellow-300">window.open</span><span className="text-zinc-300">(</span>{"\n"}
      {"      "}<span className="text-green-400">&apos;{siteOrigin}/pip/&apos;</span>
      <span className="text-zinc-300"> + m[</span><span className="text-orange-300">0</span><span className="text-zinc-300">],</span>{"\n"}
      {"      "}<span className="text-green-400">&apos;pumpchat&apos;</span>
      <span className="text-zinc-300">,</span>
      <span className="text-zinc-500"> {"// reuses same popup"}</span>{"\n"}
      {"      "}<span className="text-green-400">&apos;popup=yes,width=&apos;</span>
      <span className="text-zinc-300">+w+</span>
      <span className="text-green-400">&apos;,height=&apos;</span>
      <span className="text-zinc-300">+h+</span>
      <span className="text-green-400">&apos;,left=&apos;</span>
      <span className="text-zinc-300">+l+</span>
      <span className="text-green-400">&apos;,top=&apos;</span>
      <span className="text-zinc-300">+t</span>{"\n"}
      {"    "}<span className="text-zinc-300">);</span>{"\n"}
      {"  "}<span className="text-zinc-300">{"}"} </span>
      <span className="text-purple-400">catch</span>
      <span className="text-zinc-300">(e) {"{"} </span>
      <span className="text-yellow-300">alert</span>
      <span className="text-zinc-300">(</span>
      <span className="text-green-400">&apos;Error: &apos;</span>
      <span className="text-zinc-300">+ e.message); {"}"}</span>{"\n"}
      <span className="text-zinc-300">{"}"})()</span>{"\n\n"}
      <span className="text-zinc-500">{"// ✓ Only reads URL - nothing else"}</span>{"\n"}
      <span className="text-zinc-500">{"// ✓ Cannot access wallet or keys"}</span>{"\n"}
      <span className="text-zinc-500">{"// ✓ Cannot read cookies/storage"}</span>{"\n"}
      <span className="text-zinc-500">{"// ✓ Cannot modify trading page"}</span>{"\n"}
      <span className="text-zinc-500">{"// ✓ Isolated origin (different domain)"}</span>
    </pre>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      {/* PiP active banner */}
      {isPipOpen && (
        <div className="fixed top-0 left-0 right-0 bg-[#00ff88] text-black text-center py-2 px-4 text-sm font-medium z-50">
          Voice chat active in floating player — do not close this tab
        </div>
      )}

      {/* Join room modal */}
      {selectedRoom && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedRoom(null)}
        >
          <div
            className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              {selectedRoom.image ? (
                <img
                  src={selectedRoom.image}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#2a2a2a]" />
              )}
              <div>
                <p className="text-white font-medium">{selectedRoom.name}</p>
                <p className="text-zinc-500 text-sm">${selectedRoom.symbol}</p>
              </div>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => joinRoomFloating(selectedRoom)}
                disabled={isConnecting}
                className="w-full py-3 bg-[#00ff88] hover:bg-[#00cc6a] disabled:opacity-50 text-black font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                {isConnecting ? "Connecting..." : "Join Voice Chat (Floating Player)"}
              </button>
              <button
                onClick={() => joinRoomNewTab(selectedRoom)}
                className="w-full py-3 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] text-zinc-300 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Join Voice Chat (New Tab)
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Image src="/icon.png" alt="PumpChat" width={48} height={48} className="rounded-lg" />
            <h1 className="text-4xl font-bold">
              <span className="text-[#00ff88]">Pump</span>Chat
            </h1>
            <a
              href="https://x.com/PumpChatOnSol"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 p-2 rounded-full bg-[#1a1a1a] border border-[#333] text-zinc-400 hover:text-white hover:border-[#00ff88]/50 transition-colors"
              title="Follow us on X"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
          </div>
          <p className="text-zinc-400 text-sm">
            Voice chat for any Pump.fun token
          </p>
          <p className="text-[#00ff88] text-sm mt-2">
            CA: Coming Soon
          </p>
        </div>

        {/* Trust badges */}
        <div className="flex justify-center gap-4 mb-8 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            No wallet needed
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Anonymous
          </span>
        </div>

        {/* Main input */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError("");
              }}
              placeholder="Paste token address or URL..."
              className="flex-1 px-4 py-3 bg-[#141414] border border-[#2a2a2a] rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-[#00ff88] transition-colors font-mono text-sm"
              autoFocus
              disabled={isConnecting}
            />
            <input
              type="text"
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              placeholder="Name (Optional)"
              className="w-32 px-3 py-3 bg-[#141414] border border-[#2a2a2a] rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-[#00ff88] transition-colors text-sm"
              disabled={isConnecting}
              title="Your display name visible to others in voice chat"
            />
          </div>
          {error && <p className="text-red-400 text-xs mt-1">{error}</p>}

          {/* Mobile warning */}
          {isMobile && (
            <p className="text-xs text-amber-400 bg-amber-400/10 px-3 py-2 rounded-lg">
              Floating player not supported on mobile. Use &quot;New Tab&quot; option below.
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isConnecting}
              className="flex-1 py-3 bg-[#00ff88] hover:bg-[#00cc6a] disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isConnecting ? (
                <span className="animate-pulse">Connecting...</span>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                  Join Voice Chat (Floating Player)
                </>
              )}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              const address = extractAddress(input);
              if (address) {
                const usernameParam = username ? `?username=${encodeURIComponent(username)}` : "";
                window.open(`/pip/${address}${usernameParam}`, "_blank");
              } else {
                setError("Enter a valid token address first");
              }
            }}
            className="w-full py-3 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] text-zinc-300 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Join Voice Chat (New Tab)
          </button>
        </form>

        {/* Supported sites */}
        <div className="mt-6 text-center">
          <p className="text-xs text-zinc-500 mb-2">Works with URLs from:</p>
          <div className="flex justify-center gap-3 text-xs text-zinc-400">
            <span>pump.fun</span>
            <span className="text-zinc-600">|</span>
            <span>DexScreener</span>
            <span className="text-zinc-600">|</span>
            <span>Axiom</span>
            <span className="text-zinc-600">|</span>
            <span>Padre</span>
          </div>
        </div>

        {/* Total active users banner */}
        {!loadingRooms && activeRooms.length > 0 && (
          <div className="mt-6 text-center">
            <span className="text-[#00ff88] font-bold text-lg">
              {activeRooms.reduce((sum, room) => sum + room.participants, 0)}
            </span>
            <span className="text-zinc-400 text-sm ml-2">people chatting right now</span>
          </div>
        )}

        {/* Live Rooms */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-zinc-300 font-medium">Live Rooms</p>
            <span className="text-xs text-zinc-600">
              {loadingRooms ? "..." : `${activeRooms.length} active`}
            </span>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {/* Featured PumpChat Official Room */}
            {PUMPCHAT_TOKEN_CA && featuredRoom && (
              <button
                onClick={() => setSelectedRoom({
                  ca: PUMPCHAT_TOKEN_CA,
                  name: featuredRoom.name,
                  symbol: featuredRoom.symbol,
                  image: featuredRoom.image,
                  participants: activeRooms.find(r => r.ca === PUMPCHAT_TOKEN_CA)?.participants || 0,
                  createdAt: 0,
                })}
                className="w-full p-3 bg-[#141414] border border-[#00ff88]/50 rounded-lg hover:border-[#00ff88] transition-colors text-left flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  {featuredRoom.image ? (
                    <img
                      src={featuredRoom.image}
                      alt=""
                      className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[#2a2a2a] flex-shrink-0" />
                  )}
                  <span className="text-sm text-[#00ff88] group-hover:text-white font-medium">
                    {featuredRoom.name}
                  </span>
                  <span className="text-xs text-zinc-500">${featuredRoom.symbol}</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-[#00ff88]/20 text-[#00ff88] rounded font-medium">
                    OFFICIAL
                  </span>
                </div>
                <span className="text-xs">
                  <span className="text-[#00ff88] font-semibold">
                    {activeRooms.find(r => r.ca === PUMPCHAT_TOKEN_CA)?.participants || 0}
                  </span>
                  <span className="text-zinc-600 ml-1">in voice</span>
                </span>
              </button>
            )}

            {/* Regular rooms */}
            {loadingRooms ? (
              <div className="text-center py-4 text-zinc-500 text-sm">Loading...</div>
            ) : activeRooms.filter(r => r.ca !== PUMPCHAT_TOKEN_CA).length === 0 && !featuredRoom ? (
              <div className="text-center py-4 text-zinc-500 text-sm">No active rooms</div>
            ) : (
              activeRooms.filter(r => r.ca !== PUMPCHAT_TOKEN_CA).slice(0, 10).map((room) => (
                <button
                  key={room.ca}
                  onClick={() => setSelectedRoom(room)}
                  className="w-full p-3 bg-[#141414] border border-[#2a2a2a] rounded-lg hover:border-[#00ff88]/50 transition-colors text-left flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2">
                    {room.image ? (
                      <img
                        src={room.image}
                        alt=""
                        className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-[#2a2a2a] flex-shrink-0" />
                    )}
                    <span className="text-sm text-zinc-300 group-hover:text-white font-medium">
                      {room.name}
                    </span>
                    <span className="text-xs text-zinc-500">${room.symbol}</span>
                  </div>
                  <span className="text-xs">
                    <span className="text-[#00ff88] font-semibold">{room.participants}</span>
                    <span className="text-zinc-600 ml-1">in voice</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="my-8 border-t border-[#2a2a2a]"></div>

        {/* Bookmarklet section */}
        <div>
          <div className="text-center mb-4">
            <p className="text-sm text-zinc-300 font-medium uppercase tracking-wide">One-click access from Axiom & Padre (More coming soon!)</p>
          </div>

          <div className="space-y-2">
            <div className="p-3 bg-[#141414] border border-[#2a2a2a] rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <a
                  ref={bookmarkletRef}
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  draggable
                  className="px-4 py-1.5 bg-[#00ff88] text-black font-bold rounded text-sm cursor-move hover:bg-[#00cc6a] transition-colors"
                >
                  PumpChat
                </a>
                <span className="text-xs text-zinc-500">← drag to bookmark bar</span>
              </div>
              <p className="text-xs text-zinc-400">Click it on any token page to open a floating voice chat. Stays open as you browse.</p>
            </div>

            <div className="p-3 bg-[#141414] border border-[#2a2a2a] rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <a
                  ref={autoSwitchRef}
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  draggable
                  className="px-4 py-1.5 bg-[#00ff88] text-black font-bold rounded text-sm cursor-move hover:bg-[#00cc6a] transition-colors"
                >
                  PumpChat Auto
                </a>
                <span className="text-xs text-zinc-500">← drag to bookmark bar</span>
              </div>
              <p className="text-xs text-zinc-400">Click it once to start. Automatically joins voice chats as you browse tokens. Click again to stop.</p>
            </div>
          </div>

          <details className="text-xs mt-4">
            <summary className="text-zinc-600 cursor-pointer hover:text-zinc-400">What does this code do?</summary>
            <div className="mt-3 text-left">
              <SyntaxHighlight />
            </div>
          </details>
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-xs text-zinc-600">
          <span>No data collected</span>
        </footer>
      </main>
    </div>
  );
}
