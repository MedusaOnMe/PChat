import { RoomServiceClient } from "livekit-server-sdk";
import { NextResponse } from "next/server";

// Fetch token info from DexScreener
async function getTokenInfo(address: string): Promise<{ name: string; symbol: string } | null> {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
      { next: { revalidate: 300 } }
    );
    if (!response.ok) return null;

    const data = await response.json();
    if (data.pairs && data.pairs.length > 0) {
      const pair = data.pairs.find(
        (p: { baseToken?: { address?: string } }) =>
          p.baseToken?.address?.toLowerCase() === address.toLowerCase()
      ) || data.pairs[0];

      const tokenInfo = pair.baseToken?.address?.toLowerCase() === address.toLowerCase()
        ? pair.baseToken
        : pair.quoteToken;

      return {
        name: tokenInfo?.name || "Unknown",
        symbol: tokenInfo?.symbol || "???",
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  // Convert wss:// to https:// for the API
  const httpUrl = wsUrl.replace("wss://", "https://");

  try {
    const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    const rooms = await roomService.listRooms();

    // Fetch token info for each room in parallel
    const roomsWithInfo = await Promise.all(
      rooms.map(async (room) => {
        const tokenInfo = await getTokenInfo(room.name);
        return {
          ca: room.name,
          name: tokenInfo?.name || "Unknown",
          symbol: tokenInfo?.symbol || "???",
          participants: room.numParticipants,
          createdAt: Number(room.creationTime) * 1000,
        };
      })
    );

    // Sort by participants (most active first)
    roomsWithInfo.sort((a, b) => b.participants - a.participants);

    return NextResponse.json({ rooms: roomsWithInfo });
  } catch (error) {
    console.error("Failed to list rooms:", error);
    return NextResponse.json(
      { error: "Failed to fetch rooms" },
      { status: 500 }
    );
  }
}
