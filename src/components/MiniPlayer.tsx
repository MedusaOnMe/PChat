"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createRoot, Root } from "react-dom/client";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import { Track, Room } from "livekit-client";

// Check if Document PiP is supported
export function isPipSupported(): boolean {
  return typeof window !== "undefined" && "documentPictureInPicture" in window;
}

// Mini player content that renders inside the PiP window
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
            display: "flex",
            alignItems: "center",
            gap: "8px",
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

interface MiniPlayerProps {
  roomName: string;
  serverUrl: string;
  token: string;
  onClose: () => void;
  pipWindow: Window;
}

// Component to render inside PiP window
export function MiniPlayerRoot({ roomName, serverUrl, token, onClose, pipWindow }: MiniPlayerProps) {
  const rootRef = useRef<Root | null>(null);

  useEffect(() => {
    // Create root in PiP window
    const container = pipWindow.document.createElement("div");
    container.id = "mini-player-root";
    container.style.width = "100%";
    container.style.height = "100%";
    pipWindow.document.body.appendChild(container);
    pipWindow.document.body.style.margin = "0";
    pipWindow.document.body.style.padding = "0";
    pipWindow.document.body.style.overflow = "hidden";

    rootRef.current = createRoot(container);
    rootRef.current.render(
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect={true}
        audio={false}
        video={false}
        onDisconnected={onClose}
        style={{ height: "100%" }}
      >
        <MiniPlayerContent roomName={roomName} onClose={onClose} />
      </LiveKitRoom>
    );

    // Handle PiP window close
    pipWindow.addEventListener("pagehide", onClose);

    return () => {
      pipWindow.removeEventListener("pagehide", onClose);
      rootRef.current?.unmount();
    };
  }, [roomName, serverUrl, token, onClose, pipWindow]);

  return null;
}

// Hook to manage Document PiP
export function useDocumentPip() {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [isSupported] = useState(isPipSupported);

  const openPip = useCallback(async (): Promise<Window | null> => {
    if (!isSupported) return null;

    try {
      // @ts-expect-error - Document PiP API not in TypeScript types yet
      const pip = await window.documentPictureInPicture.requestWindow({
        width: 320,
        height: 400,
      });
      setPipWindow(pip);
      return pip;
    } catch (e) {
      console.error("Failed to open PiP:", e);
      return null;
    }
  }, [isSupported]);

  const closePip = useCallback(() => {
    if (pipWindow) {
      pipWindow.close();
      setPipWindow(null);
    }
  }, [pipWindow]);

  return { pipWindow, openPip, closePip, isSupported };
}
