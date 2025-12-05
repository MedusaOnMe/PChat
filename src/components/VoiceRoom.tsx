"use client";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  TrackToggle,
  DisconnectButton,
  useRoomContext,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { useState, useEffect, useCallback } from "react";

interface VoiceRoomProps {
  roomName: string;
  serverUrl: string;
}

function ParticipantCount() {
  const participants = useParticipants();
  return (
    <div className="text-sm text-zinc-400">
      <span className="text-[#00ff88] font-semibold">{participants.length}</span>
      {" "}in voice
    </div>
  );
}

function SpeakingIndicator() {
  const participants = useParticipants();
  const speaking = participants.filter(p => p.isSpeaking);

  return (
    <div className="flex flex-wrap gap-2 justify-center min-h-[60px] py-2">
      {participants.map((participant) => (
        <div
          key={participant.identity}
          className={`px-3 py-1.5 rounded-full text-xs transition-all duration-200 ${
            participant.isSpeaking
              ? "bg-[#00ff88] text-black scale-105"
              : "bg-[#1a1a1a] text-zinc-400"
          }`}
        >
          {participant.identity}
        </div>
      ))}
    </div>
  );
}

function Controls() {
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

  return (
    <div className="flex items-center justify-center gap-3">
      <TrackToggle
        source={Track.Source.Microphone}
        className={`px-6 py-3 rounded-full font-semibold transition-all duration-200 ${
          isMuted
            ? "bg-[#1a1a1a] text-white border border-[#2a2a2a] hover:bg-[#2a2a2a]"
            : "bg-[#00ff88] text-black hover:bg-[#00cc6a]"
        }`}
      >
        {isMuted ? (
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
            Unmute
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Speaking
          </span>
        )}
      </TrackToggle>

      <DisconnectButton className="px-4 py-3 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </DisconnectButton>
    </div>
  );
}

function RoomContent({ roomName }: { roomName: string }) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-mono text-zinc-400 truncate max-w-[200px]">
              {roomName.substring(0, 8)}...{roomName.substring(roomName.length - 4)}
            </h2>
          </div>
          <ParticipantCount />
        </div>
      </div>

      {/* Participants */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <SpeakingIndicator />
      </div>

      {/* Controls */}
      <div className="p-4 border-t border-[#2a2a2a]">
        <Controls />
      </div>

      {/* Audio renderer - handles all remote audio */}
      <RoomAudioRenderer />
    </div>
  );
}

export default function VoiceRoom({ roomName, serverUrl }: VoiceRoomProps) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);

  const fetchToken = useCallback(async () => {
    try {
      setIsConnecting(true);
      setError(null);

      const response = await fetch(`/api/token?room=${encodeURIComponent(roomName)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get token");
      }

      setToken(data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setIsConnecting(false);
    }
  }, [roomName]);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="text-red-400 mb-4">{error}</div>
        <button
          onClick={fetchToken}
          className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (isConnecting || !token) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="animate-pulse text-[#00ff88]">Connecting...</div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      audio={false}
      video={false}
      onDisconnected={() => {
        // Could redirect or show disconnected state
      }}
      className="h-full"
    >
      <RoomContent roomName={roomName} />
    </LiveKitRoom>
  );
}
