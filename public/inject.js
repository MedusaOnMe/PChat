// PumpChat Overlay Injection Script
// This gets injected onto any page via bookmarklet

(async function() {
  // Check if already injected
  if (window.__PUMPCHAT_INJECTED__) {
    console.log('PumpChat already running');
    return;
  }
  window.__PUMPCHAT_INJECTED__ = true;

  // Extract token address from URL
  const match = location.href.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  if (!match) {
    alert('No token address found on this page.');
    return;
  }
  const tokenAddress = match[0];

  // Config
  const API_BASE = 'https://pumpchat.xyz'; // Change to your domain
  const LIVEKIT_URL = 'wss://pumpchat-jcyketdb.livekit.cloud'; // Your LiveKit URL

  // Create overlay container
  const overlay = document.createElement('div');
  overlay.id = 'pumpchat-overlay';
  overlay.innerHTML = `
    <style>
      #pumpchat-overlay {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 280px;
        background: #0a0a0a;
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        font-family: system-ui, -apple-system, sans-serif;
        z-index: 999999;
        color: #fff;
        overflow: hidden;
      }
      #pumpchat-overlay * {
        box-sizing: border-box;
      }
      #pumpchat-header {
        padding: 12px 16px;
        border-bottom: 1px solid #2a2a2a;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: move;
      }
      #pumpchat-header span {
        font-size: 14px;
        font-weight: bold;
      }
      #pumpchat-header .green {
        color: #00ff88;
      }
      #pumpchat-close {
        background: none;
        border: none;
        color: #666;
        cursor: pointer;
        font-size: 18px;
        padding: 0;
        line-height: 1;
      }
      #pumpchat-close:hover {
        color: #fff;
      }
      #pumpchat-content {
        padding: 16px;
        min-height: 100px;
      }
      #pumpchat-status {
        text-align: center;
        color: #00ff88;
        font-size: 14px;
      }
      #pumpchat-participants {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        justify-content: center;
        margin-bottom: 12px;
      }
      .pumpchat-participant {
        padding: 6px 12px;
        border-radius: 9999px;
        font-size: 11px;
        background: #1a1a1a;
        color: #a1a1aa;
        transition: all 0.2s;
      }
      .pumpchat-participant.speaking {
        background: #00ff88;
        color: #000;
        transform: scale(1.05);
      }
      #pumpchat-controls {
        display: flex;
        gap: 8px;
        padding: 12px 16px;
        border-top: 1px solid #2a2a2a;
      }
      #pumpchat-mute {
        flex: 1;
        padding: 10px 16px;
        border-radius: 9999px;
        border: 1px solid #2a2a2a;
        background: #1a1a1a;
        color: #fff;
        font-weight: 600;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
      }
      #pumpchat-mute.unmuted {
        background: #00ff88;
        color: #000;
        border-color: #00ff88;
      }
      #pumpchat-leave {
        padding: 10px 16px;
        border-radius: 9999px;
        border: none;
        background: rgba(239, 68, 68, 0.2);
        color: #f87171;
        cursor: pointer;
        font-size: 13px;
      }
      #pumpchat-count {
        font-size: 12px;
        color: #71717a;
        text-align: center;
        margin-bottom: 8px;
      }
      #pumpchat-count span {
        color: #00ff88;
        font-weight: 600;
      }
      #pumpchat-error {
        color: #f87171;
        font-size: 12px;
        text-align: center;
      }
    </style>
    <div id="pumpchat-header">
      <span><span class="green">Pump</span>Chat</span>
      <button id="pumpchat-close">&times;</button>
    </div>
    <div id="pumpchat-content">
      <div id="pumpchat-status">Connecting...</div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Make draggable
  let isDragging = false;
  let dragOffsetX, dragOffsetY;
  const header = overlay.querySelector('#pumpchat-header');

  header.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragOffsetX = e.clientX - overlay.offsetLeft;
    dragOffsetY = e.clientY - overlay.offsetTop;
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      overlay.style.left = (e.clientX - dragOffsetX) + 'px';
      overlay.style.right = 'auto';
      overlay.style.top = (e.clientY - dragOffsetY) + 'px';
      overlay.style.bottom = 'auto';
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // Close button
  overlay.querySelector('#pumpchat-close').addEventListener('click', () => {
    if (window.__PUMPCHAT_ROOM__) {
      window.__PUMPCHAT_ROOM__.disconnect();
    }
    overlay.remove();
    window.__PUMPCHAT_INJECTED__ = false;
  });

  const content = overlay.querySelector('#pumpchat-content');
  const status = overlay.querySelector('#pumpchat-status');

  // Try to load LiveKit from CDN
  try {
    status.textContent = 'Loading...';

    // Load LiveKit client library
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/livekit-client@2.0.0/dist/livekit-client.umd.js';

    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    status.textContent = 'Getting token...';

    // Resolve pool address to token CA if needed
    let roomName = tokenAddress;
    try {
      const resolveRes = await fetch(`${API_BASE}/api/resolve?address=${encodeURIComponent(tokenAddress)}`);
      const resolveData = await resolveRes.json();
      if (resolveData.tokenCA) {
        roomName = resolveData.tokenCA;
      }
    } catch (e) {
      console.log('Could not resolve address, using as-is');
    }

    // Get LiveKit token from our API
    const tokenRes = await fetch(`${API_BASE}/api/token?room=${encodeURIComponent(roomName)}`);
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      throw new Error(tokenData.error || 'Failed to get token');
    }

    status.textContent = 'Joining room...';

    // Connect to LiveKit
    const room = new LivekitClient.Room();
    window.__PUMPCHAT_ROOM__ = room;

    await room.connect(LIVEKIT_URL, tokenData.token);

    // Update UI to show connected state
    let isMuted = true;

    function updateUI() {
      const participants = Array.from(room.remoteParticipants.values());
      participants.unshift(room.localParticipant);

      content.innerHTML = `
        <div id="pumpchat-count"><span>${participants.length}</span> in voice</div>
        <div id="pumpchat-participants">
          ${participants.map(p => `
            <div class="pumpchat-participant ${p.isSpeaking ? 'speaking' : ''}">${p.identity}</div>
          `).join('')}
        </div>
      `;

      // Re-add controls if not present
      if (!overlay.querySelector('#pumpchat-controls')) {
        const controls = document.createElement('div');
        controls.id = 'pumpchat-controls';
        controls.innerHTML = `
          <button id="pumpchat-mute">${isMuted ? 'Unmute' : 'Speaking'}</button>
          <button id="pumpchat-leave">Leave</button>
        `;
        overlay.appendChild(controls);

        controls.querySelector('#pumpchat-mute').addEventListener('click', async () => {
          await room.localParticipant.setMicrophoneEnabled(isMuted);
          isMuted = !isMuted;
          const btn = controls.querySelector('#pumpchat-mute');
          btn.textContent = isMuted ? 'Unmute' : 'Speaking';
          btn.classList.toggle('unmuted', !isMuted);
        });

        controls.querySelector('#pumpchat-leave').addEventListener('click', () => {
          room.disconnect();
          overlay.remove();
          window.__PUMPCHAT_INJECTED__ = false;
        });
      } else {
        const btn = overlay.querySelector('#pumpchat-mute');
        btn.textContent = isMuted ? 'Unmute' : 'Speaking';
        btn.classList.toggle('unmuted', !isMuted);
      }
    }

    // Update on participant changes
    room.on('participantConnected', updateUI);
    room.on('participantDisconnected', updateUI);
    room.on('activeSpeakersChanged', updateUI);
    room.on('trackSubscribed', updateUI);
    room.on('trackUnsubscribed', updateUI);

    // Check mute state periodically
    setInterval(() => {
      const audioTrack = room.localParticipant.getTrackPublication(LivekitClient.Track.Source.Microphone);
      const newMuted = !audioTrack?.track || audioTrack.isMuted;
      if (newMuted !== isMuted) {
        isMuted = newMuted;
        updateUI();
      }
    }, 100);

    updateUI();

  } catch (error) {
    console.error('PumpChat error:', error);
    content.innerHTML = `
      <div id="pumpchat-error">
        ${error.message || 'Failed to connect'}<br><br>
        <small>CSP may be blocking. Try the tab version.</small>
      </div>
    `;
  }
})();
