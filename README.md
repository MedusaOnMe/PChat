# PumpChat

Voice chat for any Pump.fun token. No wallet connection required.

## Features

- **Paste & Go**: Paste any token address or URL, join voice instantly
- **Pop-out Window**: Opens as a small floating window alongside your trading terminal
- **Anonymous**: No wallet connection, no signup, no data collected
- **Bookmarklet**: Optional one-click access from any token page

## Setup

### 1. Get LiveKit Credentials

1. Go to [LiveKit Cloud](https://cloud.livekit.io) and create a free account
2. Create a new project
3. Copy your API Key, API Secret, and WebSocket URL

### 2. Configure Environment

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Then edit `.env.local`:

```
LIVEKIT_API_KEY=your_api_key_here
LIVEKIT_API_SECRET=your_api_secret_here
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
```

### 3. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Usage

### Basic Usage

1. Copy a token address from pump.fun, DexScreener, Axiom, etc.
2. Paste it into the input box
3. Click "Pop Out" to open voice chat in a floating window
4. Allow microphone access when prompted
5. Click "Unmute" to speak

### Bookmarklet (Power Users)

1. On the homepage, expand "Power User: One-Click Bookmarklet"
2. Drag the "PumpChat" button to your bookmarks bar
3. When on any token page, click the bookmark to instantly open voice chat

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Homepage with paste box
│   ├── api/token/route.ts    # LiveKit token generation
│   └── room/[ca]/
│       ├── page.tsx          # Room page (server)
│       └── RoomClient.tsx    # Room page (client)
├── components/
│   └── VoiceRoom.tsx         # LiveKit voice chat component
```

## Deployment

Deploy to Vercel:

```bash
npm install -g vercel
vercel
```

Set your environment variables in the Vercel dashboard.

## Tech Stack

- **Next.js 14** - React framework
- **LiveKit** - WebRTC voice infrastructure
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety
