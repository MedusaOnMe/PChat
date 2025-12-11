import { NextRequest, NextResponse } from "next/server";

// Try pump.fun API first, then fall back to DexScreener
async function getTokenFromPumpFun(address: string) {
  try {
    const response = await fetch(
      `https://frontend-api-v3.pump.fun/coins/${address}`,
      {
        headers: {
          "Accept": "application/json",
          "Origin": "https://pump.fun",
        },
        next: { revalidate: 300 },
      }
    );
    if (response.ok) {
      const data = await response.json();
      if (data.name && data.symbol) {
        return { name: data.name, symbol: data.symbol, image: data.image_uri || null };
      }
    }
  } catch {
    // Fall through to DexScreener
  }
  return null;
}

async function getTokenFromDexScreener(address: string) {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
      { next: { revalidate: 300 } }
    );
    if (response.ok) {
      const data = await response.json();
      if (data.pairs && data.pairs.length > 0) {
        const pair = data.pairs.find(
          (p: { baseToken?: { address?: string } }) =>
            p.baseToken?.address?.toLowerCase() === address.toLowerCase()
        ) || data.pairs[0];
        const tokenInfo = pair.baseToken?.address?.toLowerCase() === address.toLowerCase()
          ? pair.baseToken
          : pair.quoteToken;
        if (tokenInfo?.name) {
          return { name: tokenInfo.name, symbol: tokenInfo.symbol || "???", image: pair.info?.imageUrl || null };
        }
      }
    }
  } catch {
    // Fall through
  }
  return null;
}

// Validate a token CA and get its metadata
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json(
      { error: "Address parameter is required" },
      { status: 400 }
    );
  }

  // Basic validation - Solana addresses are 32-44 chars, base58
  const isValidFormat = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  if (!isValidFormat) {
    return NextResponse.json(
      { error: "Invalid token address format" },
      { status: 400 }
    );
  }

  try {
    // Try pump.fun first (better for pump.fun tokens), then DexScreener
    const tokenInfo = await getTokenFromPumpFun(address) || await getTokenFromDexScreener(address);

    return NextResponse.json({
      valid: true,
      address: address,
      name: tokenInfo?.name || "Unknown Token",
      symbol: tokenInfo?.symbol || "???",
      image: tokenInfo?.image || null,
    });
  } catch (error) {
    console.error("Failed to validate token:", error);
    return NextResponse.json(
      { error: "Failed to validate token" },
      { status: 500 }
    );
  }
}
