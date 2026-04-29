/**
 * Huemn AI Extension - Popup Script (TS)
 */

let isRecording = false;

const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
const stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;
const exportBtn = document.getElementById('exportBtn') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;

// Sync UI state on load
chrome.storage.local.get(['isRecording'], (result) => {
  if (result.isRecording) {
    updateUI(true);
  }
});

startBtn?.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (activeTab?.id) {
      chrome.tabs.sendMessage(activeTab.id, { action: "START_RECORDING" });
      updateUI(true);
      chrome.storage.local.set({ isRecording: true });
    }
  });
});

stopBtn?.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (activeTab?.id) {
      chrome.tabs.sendMessage(activeTab.id, { action: "STOP_RECORDING" });
      updateUI(false);
      chrome.storage.local.set({ isRecording: false });
    }
  });
});

exportBtn?.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (activeTab?.id) {
      chrome.tabs.sendMessage(activeTab.id, { action: "EXPORT_JSON" });
    }
  });
});

function updateUI(recording: boolean) {
  isRecording = recording;
  if (!startBtn || !stopBtn || !exportBtn || !statusDiv) return;

  if (recording) {
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    exportBtn.style.display = 'none';
    statusDiv.innerText = "🔴 Recording in progress...";
    statusDiv.style.color = "#ef4444";
  } else {
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    exportBtn.style.display = 'block';
    statusDiv.innerText = "Ready to record";
    statusDiv.style.color = "#94a3b8";
  }
}

// Listen for messages from content script to sync UI
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "HUEMN_RECORDING_STARTED") updateUI(true);
  if (msg.type === "HUEMN_RECORDING_STOPPED") updateUI(false);
});
