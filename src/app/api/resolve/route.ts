import { NextRequest, NextResponse } from "next/server";

// Resolve a pool address to a token mint address using DexScreener
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json(
      { error: "Address parameter is required" },
      { status: 400 }
    );
  }

  // Check if this looks like a pump.fun token (ends with "pump")
  // If so, it's likely already a token CA, not a pool
  if (address.toLowerCase().endsWith("pump")) {
    return NextResponse.json({ tokenCA: address, resolved: false });
  }

  try {
    // Try DexScreener to resolve pool -> token
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/pairs/solana/${address}`,
      { next: { revalidate: 60 } } // Cache for 60 seconds
    );

    if (!response.ok) {
      // If DexScreener doesn't recognize it, assume it's a token CA
      return NextResponse.json({ tokenCA: address, resolved: false });
    }

    const data = await response.json();

    if (data.pair && data.pair.baseToken && data.pair.baseToken.address) {
      return NextResponse.json({
        tokenCA: data.pair.baseToken.address,
        tokenName: data.pair.baseToken.name,
        tokenSymbol: data.pair.baseToken.symbol,
        resolved: true,
      });
    }

    // Fallback: return the original address
    return NextResponse.json({ tokenCA: address, resolved: false });
  } catch (error) {
    console.error("Failed to resolve address:", error);
    // On error, just return the original address
    return NextResponse.json({ tokenCA: address, resolved: false });
  }
}
