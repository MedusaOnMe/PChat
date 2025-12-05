import { redirect } from "next/navigation";
import RoomClient from "./RoomClient";

interface RoomPageProps {
  params: Promise<{
    ca: string;
  }>;
}

// Resolve pool address to token CA if needed
async function resolveToTokenCA(address: string): Promise<string> {
  // If it ends with "pump", it's likely already a pump.fun token CA
  if (address.toLowerCase().endsWith("pump")) {
    return address;
  }

  try {
    // Use DexScreener to resolve pool -> token
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/pairs/solana/${address}`,
      { next: { revalidate: 60 } }
    );

    if (!response.ok) {
      return address;
    }

    const data = await response.json();

    if (data.pair && data.pair.baseToken && data.pair.baseToken.address) {
      return data.pair.baseToken.address;
    }

    return address;
  } catch {
    return address;
  }
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { ca } = await params;
  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || "";

  // Validate address format (basic check)
  const isValidAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ca);

  if (!isValidAddress) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0a0a0a] p-6">
        <div className="text-red-400 mb-2">Invalid token address</div>
        <div className="text-zinc-500 text-sm text-center">
          The address doesn&apos;t appear to be a valid Solana token.
        </div>
        <a
          href="/"
          className="mt-4 px-4 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] rounded-lg transition-colors text-sm"
        >
          Go back
        </a>
      </div>
    );
  }

  // Resolve pool address to token CA if needed (for Axiom URLs)
  const tokenCA = await resolveToTokenCA(ca);

  // If we resolved to a different address, redirect to the correct URL
  if (tokenCA !== ca) {
    redirect(`/room/${tokenCA}`);
  }

  if (!serverUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0a0a0a] p-6">
        <div className="text-red-400 mb-2">Server not configured</div>
        <div className="text-zinc-500 text-sm text-center">
          LiveKit server URL is missing. Check environment variables.
        </div>
      </div>
    );
  }

  return <RoomClient ca={tokenCA} serverUrl={serverUrl} />;
}

export async function generateMetadata({ params }: RoomPageProps) {
  const { ca } = await params;
  const shortCA = `${ca.substring(0, 6)}...${ca.substring(ca.length - 4)}`;

  return {
    title: `Voice Chat - ${shortCA} | PumpChat`,
    description: `Join the voice chat for token ${shortCA}`,
  };
}
