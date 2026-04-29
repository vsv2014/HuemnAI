/**
 * Huemn AI Extension - Background Script (TS)
 * Relays events from Content Script to the Huemn Backend via WebSocket.
 */

let socket: WebSocket | null = null;
let clientId: string | null = null;
let messageBuffer: any[] = [];
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Load client ID from storage or generate one
chrome.storage.local.get(['clientId'], (result) => {
  if (result.clientId) {
    clientId = result.clientId;
  } else {
    clientId = Math.random().toString(36).substr(2, 9);
    chrome.storage.local.set({ clientId });
  }
  // Connect ONLY after clientId is loaded
  connectSocket();
});

function connectSocket() {
  if (!clientId) return; // Prevent connecting with null ID
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  const wsUrl = `ws://localhost:8001/ws/execution/${clientId}/extension`;
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log("Huemn: Connected to backend WebSocket");
    reconnectAttempts = 0;
    chrome.action.setBadgeText({ text: "ON" });
    chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
    
    // Flush buffer
    while (messageBuffer.length > 0) {
      const msg = messageBuffer.shift();
      socket?.send(JSON.stringify(msg));
    }
  };

  socket.onclose = (event) => {
    console.log(`Huemn: Socket closed (code: ${event.code}). attempts: ${reconnectAttempts}`);
    chrome.action.setBadgeText({ text: "OFF" });
    chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
    
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
      setTimeout(connectSocket, delay);
    }
  };

  socket.onerror = (err) => {
    // Suppress noisy console error if server is just down
    console.warn("Huemn: Backend server not reachable at localhost:8001");
  };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("Huemn: Message received in background", msg);

  if (msg.type?.startsWith("HUEMN_")) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(msg));
    } else {
      messageBuffer.push(msg);
      if (messageBuffer.length > 100) messageBuffer.shift(); // Cap buffer
      connectSocket();
    }
  }
});

// Periodic heartbeat to keep socket alive if needed
setInterval(() => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "HUEMN_HEARTBEAT", timestamp: Date.now() }));
  }
}, 30000);
