"use client";

import { useState, useEffect, useRef } from "react";
import { createRoot, Root } from "react-dom/client";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import { Track } from "livekit-client";

// Check if Document PiP is supported
function isPipSupported(): boolean {
  return typeof window !== "undefined" && "documentPictureInPicture" in window;
}

// Mini player content for PiP window
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
            maxHeight: "120px",
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

export default function Home() {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const pipWindowRef = useRef<Window | null>(null);
  const pipRootRef = useRef<Root | null>(null);

  useEffect(() => {
    setPipSupported(isPipSupported());
  }, []);

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
  };

  const openPipWindow = async (ca: string, token: string, serverUrl: string) => {
    try {
      // @ts-expect-error - Document PiP API not in TypeScript types yet
      const pipWindow = await window.documentPictureInPicture.requestWindow({
        width: 320,
        height: 380,
      });

      pipWindowRef.current = pipWindow;

      // Setup PiP window
      const container = pipWindow.document.createElement("div");
      container.id = "pip-root";
      container.style.width = "100%";
      container.style.height = "100%";
      pipWindow.document.body.appendChild(container);
      pipWindow.document.body.style.margin = "0";
      pipWindow.document.body.style.padding = "0";
      pipWindow.document.body.style.overflow = "hidden";

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
          style={{ height: "100%" }}
        >
          <MiniPlayerContent roomName={ca} onClose={closePip} />
        </LiveKitRoom>
      );

      // Handle PiP window close
      pipWindow.addEventListener("pagehide", closePip);

      setIsConnecting(false);
    } catch (e) {
      console.error("Failed to open PiP:", e);
      // Fallback to popup
      fallbackToPopup(ca);
    }
  };

  const fallbackToPopup = (ca: string) => {
    window.open(
      `/room/${ca}`,
      "pumpchat",
      "width=400,height=600,left=100,top=100,resizable=yes,scrollbars=no"
    );
    setIsConnecting(false);
  };

  const handleSubmit = async (e: React.FormEvent, usePip: boolean = true) => {
    e.preventDefault();
    setError("");

    const address = extractAddress(input);
    if (!address) {
      setError("Could not find a valid token address. Try pasting the CA or full URL.");
      return;
    }

    // Use Document PiP
    setIsConnecting(true);

    try {
      // Resolve pool address to token CA if needed (for Axiom URLs)
      const tokenCA = await resolveToTokenCA(address);

      // If PiP not supported or user chose popup, use fallback
      if (!usePip || !pipSupported) {
        fallbackToPopup(tokenCA);
        return;
      }

      // Fetch token
      const response = await fetch(`/api/token?room=${encodeURIComponent(tokenCA)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get token");
      }

      const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
      if (!serverUrl) {
        throw new Error("Server not configured");
      }

      await openPipWindow(tokenCA, data.token, serverUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
      setIsConnecting(false);
    }
  };

  const [siteOrigin, setSiteOrigin] = useState("https://pumpchat.xyz");
  const bookmarkletRef = useRef<HTMLAnchorElement>(null);
  const autoSwitchRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    setSiteOrigin(window.location.origin);
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
      {"    "}<span className="text-zinc-500">{"// READ-ONLY: Extract Solana address from URL"}</span>{"\n"}
      {"    "}<span className="text-zinc-500">{"// Cannot access cookies, localStorage, or wallet"}</span>{"\n"}
      {"    "}<span className="text-purple-400">var</span><span className="text-zinc-300"> m = </span>
      <span className="text-blue-400">location</span><span className="text-zinc-300">.</span>
      <span className="text-blue-400">href</span><span className="text-zinc-300">.</span>
      <span className="text-yellow-300">match</span>
      <span className="text-zinc-300">(</span>
      <span className="text-orange-400">/[1-9A-HJ-NP-Za-km-z]{"{"}32,44{"}"}/</span>
      <span className="text-zinc-300">);</span>{"\n\n"}
      {"    "}<span className="text-zinc-500">{"// Exit if no token address found"}</span>{"\n"}
      {"    "}<span className="text-purple-400">if</span><span className="text-zinc-300"> (!m) {"{"} </span>
      <span className="text-yellow-300">alert</span>
      <span className="text-zinc-300">(</span>
      <span className="text-green-400">&apos;No token address found.&apos;</span>
      <span className="text-zinc-300">); </span>
      <span className="text-purple-400">return</span>
      <span className="text-zinc-300">; {"}"}</span>{"\n\n"}
      {"    "}<span className="text-zinc-500">{"// Popup position (top-right)"}</span>{"\n"}
      {"    "}<span className="text-purple-400">var</span><span className="text-zinc-300"> w=</span>
      <span className="text-orange-300">380</span><span className="text-zinc-300">, h=</span>
      <span className="text-orange-300">500</span><span className="text-zinc-300">, l=</span>
      <span className="text-blue-400">screen</span><span className="text-zinc-300">.width-w-</span>
      <span className="text-orange-300">20</span><span className="text-zinc-300">, t=</span>
      <span className="text-orange-300">80</span><span className="text-zinc-300">;</span>{"\n\n"}
      {"    "}<span className="text-zinc-500">{"// Opens SEPARATE window (isolated from trading site)"}</span>{"\n"}
      {"    "}<span className="text-yellow-300">window.open</span><span className="text-zinc-300">(</span>{"\n"}
      {"      "}<span className="text-green-400">&apos;{siteOrigin}/pip/&apos;</span>
      <span className="text-zinc-300"> + m[</span><span className="text-orange-300">0</span><span className="text-zinc-300">],</span>{"\n"}
      {"      "}<span className="text-green-400">&apos;pumpchat&apos;</span>
      <span className="text-zinc-300">,</span>
      <span className="text-zinc-500"> {"// reuses same window"}</span>{"\n"}
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
      <main className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">
            <span className="text-[#00ff88]">Pump</span>Chat
          </h1>
          <p className="text-zinc-400 text-sm">
            Voice chat for any Pump.fun token
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
            Voice only
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Anonymous
          </span>
        </div>

        {/* Main input */}
        <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-4">
          <div>
            <input
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError("");
              }}
              placeholder="Paste token address or URL..."
              className="w-full px-4 py-3 bg-[#141414] border border-[#2a2a2a] rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-[#00ff88] transition-colors font-mono text-sm"
              autoFocus
              disabled={isConnecting}
            />
            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          </div>

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
                  Join Voice Chat
                </>
              )}
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e, false)}
              disabled={isConnecting}
              className="px-4 py-3 bg-[#1a1a1a] hover:bg-[#2a2a2a] disabled:opacity-50 border border-[#2a2a2a] text-white rounded-lg transition-colors"
              title="Open in new window"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </button>
          </div>
        </form>

        {/* PiP indicator */}
        {pipSupported && (
          <div className="mt-4 text-center">
            <span className="text-xs text-zinc-500 flex items-center justify-center gap-1">
              <svg className="w-3 h-3 text-[#00ff88]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zm-10-7h9v6h-9z" />
              </svg>
              Picture-in-Picture supported
            </span>
          </div>
        )}

        {/* Supported sites */}
        <div className="mt-6 text-center">
          <p className="text-xs text-zinc-500 mb-2">Works with URLs from:</p>
          <div className="flex justify-center gap-3 text-xs text-zinc-400">
            <span>pump.fun</span>
            <span className="text-zinc-600">|</span>
            <span>DexScreener</span>
            <span className="text-zinc-600">|</span>
            <span>Birdeye</span>
            <span className="text-zinc-600">|</span>
            <span>Axiom</span>
          </div>
        </div>

        {/* Divider */}
        <div className="my-8 border-t border-[#2a2a2a]"></div>

        {/* Bookmarklet section */}
        <div>
          <div className="text-center mb-4">
            <p className="text-sm text-zinc-300 font-medium">Voice Chat from Axiom</p>
            <p className="text-xs text-zinc-500 mt-1">Drag one to your bookmarks bar. Use it on Axiom.</p>
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
                <span className="text-xs text-zinc-500">← drag and drop into bookmark bar</span>
              </div>
              <p className="text-xs text-zinc-400">Click to join the currently viewed coin&apos;s room. You&apos;ll stay in that room as you browse other coins. Click again to switch.</p>
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
                <span className="text-xs text-zinc-500">← drag and drop into bookmark bar</span>
              </div>
              <p className="text-xs text-zinc-400">Click once to activate. Automatically switches rooms as you browse different coins.</p>
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
