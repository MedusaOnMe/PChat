import { NextRequest, NextResponse } from "next/server";

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
    // Use DexScreener to validate and get token info
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
      { next: { revalidate: 300 } } // Cache for 5 minutes
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Token not found" },
        { status: 404 }
      );
    }

    const data = await response.json();

    // DexScreener returns pairs that include this token
    if (data.pairs && data.pairs.length > 0) {
      // Find the pair where this token is the base token
      const pair = data.pairs.find(
        (p: { baseToken?: { address?: string } }) =>
          p.baseToken?.address?.toLowerCase() === address.toLowerCase()
      ) || data.pairs[0];

      const tokenInfo = pair.baseToken?.address?.toLowerCase() === address.toLowerCase()
        ? pair.baseToken
        : pair.quoteToken;

      return NextResponse.json({
        valid: true,
        address: address,
        name: tokenInfo?.name || "Unknown Token",
        symbol: tokenInfo?.symbol || "???",
        priceUsd: pair.priceUsd,
        liquidity: pair.liquidity?.usd,
      });
    }

    // No pairs found - token might exist but have no liquidity
    return NextResponse.json({
      valid: true,
      address: address,
      name: "Unknown Token",
      symbol: "???",
    });
  } catch (error) {
    console.error("Failed to validate token:", error);
    return NextResponse.json(
      { error: "Failed to validate token" },
      { status: 500 }
    );
  }
}
