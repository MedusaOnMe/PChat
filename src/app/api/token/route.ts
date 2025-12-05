import { AccessToken } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const room = searchParams.get("room");
  const username = searchParams.get("username") || `anon-${Math.random().toString(36).substring(2, 8)}`;

  if (!room) {
    return NextResponse.json(
      { error: "Room parameter is required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "Server misconfigured - missing LiveKit credentials" },
      { status: 500 }
    );
  }

  // Create access token
  const at = new AccessToken(apiKey, apiSecret, {
    identity: username,
    ttl: "6h",
  });

  // Grant permissions for the room
  at.addGrant({
    roomJoin: true,
    room: room,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt();

  return NextResponse.json({ token });
}
