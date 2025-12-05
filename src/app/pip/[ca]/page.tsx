"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createRoot, Root } from "react-dom/client";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { useParams } from "next/navigation";

// Check if Document PiP is supported
function isPipSupported(): boolean {
  return typeof window !== "undefined" && "documentPictureInPicture" in window;
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

// Mini player content - renders inside PiP window
function MiniPlayerContent({
  roomName,
  onClose,
}: {
  roomName: string;
  onClose: () => void;
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
    onClose();
  };

  const shortName = `${roomName.substring(0, 4)}...${roomName.substring(roomName.length - 4)}`;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#0a0a0a",
        color: "#ededed",
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #2a2a2a",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: "14px", fontWeight: "bold" }}>
          <span style={{ color: "#00ff88" }}>Pump</span>Chat
        </span>
        <span style={{ fontSize: "12px", color: "#71717a", fontFamily: "monospace" }}>
          {shortName}
        </span>
      </div>

      {/* Participants */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          gap: "8px",
        }}
      >
        <div style={{ fontSize: "12px", color: "#71717a", marginBottom: "8px" }}>
          <span style={{ color: "#00ff88", fontWeight: "600" }}>{participants.length}</span> in voice
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "6px",
            justifyContent: "center",
            maxHeight: "180px",
            overflowY: "auto",
          }}
        >
          {participants.map((p) => (
            <div
              key={p.identity}
              style={{
                padding: "6px 12px",
                borderRadius: "9999px",
                fontSize: "11px",
                backgroundColor: p.isSpeaking ? "#00ff88" : "#1a1a1a",
                color: p.isSpeaking ? "#000" : "#a1a1aa",
                transition: "all 0.2s",
                transform: p.isSpeaking ? "scale(1.05)" : "scale(1)",
              }}
            >
              {p.identity}
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div
        style={{
          padding: "16px",
          borderTop: "1px solid #2a2a2a",
          display: "flex",
          justifyContent: "center",
          gap: "12px",
        }}
      >
        <button
          onClick={toggleMic}
          style={{
            padding: "12px 24px",
            borderRadius: "9999px",
            border: isMuted ? "1px solid #2a2a2a" : "none",
            backgroundColor: isMuted ? "#1a1a1a" : "#00ff88",
            color: isMuted ? "#fff" : "#000",
            fontWeight: "600",
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          {isMuted ? "Unmute" : "Speaking"}
        </button>
        <button
          onClick={disconnect}
          style={{
            padding: "12px 16px",
            borderRadius: "9999px",
            border: "none",
            backgroundColor: "rgba(239, 68, 68, 0.2)",
            color: "#f87171",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Leave
        </button>
      </div>

      <RoomAudioRenderer />
    </div>
  );
}

// Anchor page content - shows in popup when PiP is active
function AnchorContent({ onClose }: { onClose: () => void }) {
  return (
    <div className="h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-white p-4">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-[#00ff88]/20 flex items-center justify-center mx-auto mb-4">
          <div className="w-3 h-3 rounded-full bg-[#00ff88] animate-pulse" />
        </div>
        <div className="text-lg font-semibold mb-2">
          <span className="text-[#00ff88]">PiP Active</span>
        </div>
        <div className="text-sm text-zinc-400 mb-6 leading-relaxed">
          Voice chat is in the floating player.<br />
          Go back to your trading tab.<br />
          <span className="text-zinc-500">Don&apos;t close this window.</span>
        </div>

        <button
          onClick={onClose}
          className="px-6 py-2.5 bg-red-500/20 text-red-400 rounded-full text-sm hover:bg-red-500/30 transition-colors"
        >
          End Call
        </button>
      </div>
    </div>
  );
}

// Fallback mini controls - when PiP not supported
function FallbackMiniControls({ onLeave }: { onLeave: () => void }) {
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

  return (
    <div className="h-screen bg-[#0a0a0a] flex flex-col text-white">
      <div className="p-3 border-b border-[#2a2a2a] flex justify-between items-center">
        <span className="text-sm font-bold">
          <span className="text-[#00ff88]">Pump</span>Chat
        </span>
        <span className="text-xs text-zinc-500">
          <span className="text-[#00ff88] font-semibold">{participants.length}</span> in voice
        </span>
      </div>
      <div className="flex-1 p-3 overflow-y-auto">
        <div className="flex flex-wrap gap-1.5 justify-center">
          {participants.map((p) => (
            <div
              key={p.identity}
              className={`px-2.5 py-1 rounded-full text-xs transition-all ${
                p.isSpeaking
                  ? "bg-[#00ff88] text-black scale-105"
                  : "bg-[#1a1a1a] text-zinc-400"
              }`}
            >
              {p.identity}
            </div>
          ))}
        </div>
      </div>
      <div className="p-3 border-t border-[#2a2a2a] flex justify-center gap-2">
        <button
          onClick={toggleMic}
          className={`flex-1 py-2.5 rounded-full font-semibold text-sm transition-all ${
            isMuted
              ? "bg-[#1a1a1a] text-white border border-[#2a2a2a]"
              : "bg-[#00ff88] text-black"
          }`}
        >
          {isMuted ? "Unmute" : "Speaking"}
        </button>
        <button
          onClick={disconnect}
          className="px-4 py-2.5 rounded-full bg-red-500/20 text-red-400 text-sm"
        >
          Leave
        </button>
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
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [pipActive, setPipActive] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || "";

  const pipWindowRef = useRef<Window | null>(null);
  const pipRootRef = useRef<Root | null>(null);

  useEffect(() => {
    setPipSupported(isPipSupported());
  }, []);

  // Auto-start connection immediately on mount
  useEffect(() => {
    connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ca]); // Only re-run if CA changes

  const connect = useCallback(async () => {
    try {
      setIsConnecting(true);
      setError(null);

      // Resolve pool address to token CA
      const resolved = await resolveToTokenCA(ca);
      setTokenCA(resolved);

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

  const closePip = useCallback(() => {
    if (pipWindowRef.current) {
      pipWindowRef.current.close();
      pipWindowRef.current = null;
    }
    if (pipRootRef.current) {
      pipRootRef.current.unmount();
      pipRootRef.current = null;
    }
    setPipActive(false);
  }, []);

  const handleClose = useCallback(() => {
    closePip();
    window.close();
  }, [closePip]);

  // Open Document PiP and render voice chat inside
  const openDocumentPip = useCallback(async () => {
    if (!pipSupported || !token || !tokenCA) return;

    try {
      // @ts-expect-error - Document PiP API not in TypeScript types yet
      const pip = await window.documentPictureInPicture.requestWindow({
        width: 280,
        height: 240,
      });

      pipWindowRef.current = pip;

      // Setup PiP window - set background on html and body to prevent white flash
      pip.document.documentElement.style.backgroundColor = "#0a0a0a";
      pip.document.documentElement.style.height = "100%";
      pip.document.body.style.backgroundColor = "#0a0a0a";
      pip.document.body.style.margin = "0";
      pip.document.body.style.padding = "0";
      pip.document.body.style.overflow = "hidden";
      pip.document.body.style.height = "100%";

      const container = pip.document.createElement("div");
      container.id = "pip-root";
      container.style.width = "100%";
      container.style.height = "100%";
      container.style.backgroundColor = "#0a0a0a";
      pip.document.body.appendChild(container);

      // Render React into PiP window
      pipRootRef.current = createRoot(container);
      pipRootRef.current.render(
        <LiveKitRoom
          token={token}
          serverUrl={serverUrl}
          connect={true}
          audio={false}
          video={false}
          onDisconnected={handleClose}
          style={{ height: "100%" }}
        >
          <MiniPlayerContent roomName={tokenCA} onClose={handleClose} />
        </LiveKitRoom>
      );

      // Handle PiP window close
      pip.addEventListener("pagehide", handleClose);

      // Switch back to the original tab (Axiom)
      try {
        if (window.opener) {
          window.opener.focus();
        }
        window.blur();
      } catch {
        // Browsers may block this
      }

      setPipActive(true);
    } catch (e) {
      console.error("Failed to open PiP:", e);
      // If PiP fails, just use the popup as-is
      setIsConnected(true);
    }
  }, [pipSupported, token, tokenCA, serverUrl, handleClose]);

  // Trigger PiP (requires user gesture)
  const triggerPip = useCallback(() => {
    if (isConnected && token && tokenCA && pipSupported && !pipActive) {
      openDocumentPip();
    }
  }, [isConnected, token, tokenCA, pipSupported, pipActive, openDocumentPip]);

  // Listen for any keypress to trigger PiP
  useEffect(() => {
    const handleKeyPress = () => triggerPip();
    window.addEventListener("keydown", handleKeyPress, { once: true });
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [triggerPip]);


  // Error state
  if (error) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 text-white">
        <div className="text-red-400 text-sm mb-3">{error}</div>
        <button
          onClick={() => {
            setError(null);
            setIsConnected(false);
          }}
          className="px-4 py-2 bg-[#1a1a1a] rounded-lg text-sm"
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

  // PiP active - show anchor page
  if (pipActive) {
    return <AnchorContent onClose={handleClose} />;
  }

  // Connected but PiP not supported - show fallback inline UI
  if (isConnected && !pipSupported && token && tokenCA) {
    return (
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect={true}
        audio={false}
        video={false}
        onDisconnected={handleClose}
      >
        <FallbackMiniControls onLeave={handleClose} />
      </LiveKitRoom>
    );
  }

  // Connecting state
  if (isConnecting || !isConnected) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-white">
        <div className="text-4xl mb-4">🎙️</div>
        <div className="animate-pulse text-[#00ff88]">Connecting...</div>
      </div>
    );
  }

  // Connected - tap to open PiP
  const shortCA = tokenCA ? `${tokenCA.substring(0, 4)}...${tokenCA.substring(tokenCA.length - 4)}` : "";

  return (
    <div className="h-screen bg-[#0a0a0a] flex flex-col text-white">
      {/* Header */}
      <div className="p-4 border-b border-[#1a1a1a] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm">
            <span className="text-[#00ff88]">Pump</span>Chat
          </span>
        </div>
        <span className="text-xs text-zinc-500 font-mono">{shortCA}</span>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="text-center">
          <div className="text-sm text-zinc-400 mb-6">Voice chat for this token</div>
          <button
            onClick={triggerPip}
            className="px-10 py-4 bg-[#00ff88] hover:bg-[#00cc6a] text-black font-bold rounded-full text-lg transition-colors"
          >
            Start Voice Chat
          </button>
          <div className="text-xs text-zinc-600 mt-6">
            Opens floating player.<br />
            No wallet access.
          </div>
        </div>
      </div>
    </div>
  );
}
