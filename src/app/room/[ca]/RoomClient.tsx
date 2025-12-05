"use client";

import dynamic from "next/dynamic";

const VoiceRoom = dynamic(() => import("@/components/VoiceRoom"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-[#0a0a0a]">
      <div className="animate-pulse text-[#00ff88]">Loading...</div>
    </div>
  ),
});

interface RoomClientProps {
  ca: string;
  serverUrl: string;
}

export default function RoomClient({ ca, serverUrl }: RoomClientProps) {
  return (
    <div className="h-screen bg-[#0a0a0a] flex flex-col">
      {/* Minimal header for popup */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0a0a0a] border-b border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">
            <span className="text-[#00ff88]">Pump</span>Chat
          </span>
        </div>
        <a
          href={`https://pump.fun/coin/${ca}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          View on pump.fun
        </a>
      </div>

      {/* Voice room */}
      <div className="flex-1">
        <VoiceRoom roomName={ca} serverUrl={serverUrl} />
      </div>
    </div>
  );
}
