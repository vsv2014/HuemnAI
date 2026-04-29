/**
 * Huemn AI Extension - Content Script
 * Captures user events (click, input, navigate) and relays them to the background script.
 */

interface BrowserStep {
  type: "click" | "input" | "navigate" | "scroll" | "hover" | "keypress";
  selector: string;
  value?: string;
  url?: string;
  timestamp: number;
}

interface Workflow {
  name: string;
  steps: BrowserStep[];
  recordedAt: string;
}

class EventRecorder {
  private isRecording: boolean = false;
  private steps: BrowserStep[] = [];
  private lastUrl: string = "";
  private overlay: HTMLDivElement | null = null;

  constructor() {
    this.initListeners();
    this.checkUrlChange();
  }

  private initListeners() {
    document.addEventListener("click", (e) => this.handleClick(e), true);
    document.addEventListener("input", (e) => this.handleInput(e), true);
    document.addEventListener("change", (e) => this.handleInput(e), true);
    document.addEventListener("keydown", (e) => this.handleKeydown(e), true);
    window.addEventListener("scroll", () => this.handleScroll(), { passive: true });
  }

  private createOverlay() {
    if (this.overlay) return;
    this.overlay = document.createElement("div");
    this.overlay.id = "huemn-recording-overlay";
    const container = document.createElement("div");
    Object.assign(container.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      zIndex: "999999",
      background: "#ef4444",
      color: "white",
      padding: "10px 15px",
      borderRadius: "8px",
      fontFamily: "sans-serif",
      fontSize: "12px",
      fontWeight: "bold",
      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
      display: "flex",
      alignItems: "center",
      gap: "8px"
    });

    const dot = document.createElement("span");
    Object.assign(dot.style, {
      width: "8px",
      height: "8px",
      background: "white",
      borderRadius: "50%"
    });
    
    // Add pulse animation via keyframes in a style tag
    const style = document.createElement("style");
    style.textContent = `
      @keyframes huemn-pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
    `;
    document.head.appendChild(style);
    dot.style.animation = "huemn-pulse 1s infinite";

    container.appendChild(dot);
    container.appendChild(document.createTextNode("Huemn: Recording..."));
    this.overlay.appendChild(container);
    document.body.appendChild(this.overlay);
  }

  private removeOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  private checkUrlChange() {
    setInterval(() => {
      if (this.isRecording && window.location.href !== this.lastUrl) {
        this.lastUrl = window.location.href;
        this.relayStep({
          type: "navigate",
          selector: "window",
          url: this.lastUrl,
          timestamp: Date.now()
        });
      }
    }, 1000);
  }

  private getSelector(el: HTMLElement): string {
    if (!el) return "";
    
    // Priority 1: ID
    if (el.id) return `#${el.id}`;
    
    // Priority 2: Data Attributes (Common in modern web apps)
    const dataAttrs = ["data-testid", "data-qa", "aria-label", "name", "placeholder"];
    for (const attr of dataAttrs) {
      const val = el.getAttribute(attr);
      if (val) return `[${attr}="${val}"]`;
    }

    // Priority 3: Tag + Class (Optimized)
    let selector = el.tagName.toLowerCase();
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.split(/\s+/).filter(c => c && !c.includes(':') && !c.includes('.') && !/^[0-9]/.test(c)).join('.');
      if (classes) selector += `.${classes}`;
    }
    
    // Priority 4: Path (limited depth for stability)
    try {
      if (el.parentElement && el.parentElement !== document.body) {
        const siblings = Array.from(el.parentElement.children);
        const index = siblings.indexOf(el) + 1;
        const parentSelector = this.getSelector(el.parentElement as HTMLElement);
        if (parentSelector) return `${parentSelector} > ${el.tagName.toLowerCase()}:nth-child(${index})`;
      }
    } catch (e) {}

    return selector;
  }

  private handleClick(e: MouseEvent) {
    if (!this.isRecording) return;
    const target = e.target as HTMLElement;
    this.relayStep({
      type: "click",
      selector: this.getSelector(target),
      timestamp: Date.now()
    });
  }

  private handleInput(e: Event) {
    if (!this.isRecording) return;
    const target = e.target as HTMLInputElement;
    this.relayStep({
      type: "input",
      selector: this.getSelector(target),
      value: target.value,
      timestamp: Date.now()
    });
  }

  private handleKeydown(e: KeyboardEvent) {
    if (!this.isRecording) return;
    if (e.key === "Enter") {
      const target = e.target as HTMLElement;
      this.relayStep({
        type: "keypress",
        selector: this.getSelector(target),
        value: "Enter",
        timestamp: Date.now()
      });
    }
  }

  private handleScroll() {
    if (!this.isRecording) return;
    const now = Date.now();
    const lastStep = this.steps[this.steps.length - 1];
    if (lastStep && lastStep.type === "scroll" && now - lastStep.timestamp < 500) {
      lastStep.value = window.scrollY.toString();
      lastStep.timestamp = now;
      return;
    }

    this.relayStep({
      type: "scroll",
      selector: "window",
      value: window.scrollY.toString(),
      timestamp: now
    });
  }

  public start() {
    this.isRecording = true;
    this.steps = [];
    this.lastUrl = window.location.href;
    this.createOverlay();
    console.log("Huemn: Recording started");
    chrome.runtime.sendMessage({ type: "HUEMN_RECORDING_STARTED", timestamp: Date.now() });
    
    this.relayStep({
      type: "navigate",
      selector: "window",
      url: this.lastUrl,
      timestamp: Date.now()
    });
  }

  public stop(): Workflow {
    this.isRecording = false;
    this.removeOverlay();
    const workflow = {
      name: `Workflow_${new Date().toISOString()}`,
      steps: this.steps,
      recordedAt: new Date().toISOString()
    };
    console.log("Huemn: Recording stopped", workflow);
    chrome.runtime.sendMessage({ type: "HUEMN_RECORDING_STOPPED", workflow });
    return workflow;
  }

  public exportJson() {
    const workflow = this.stop();
    const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${workflow.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private relayStep(step: BrowserStep) {
    if (!this.isRecording) return;
    this.steps.push(step);
    chrome.runtime.sendMessage({ type: "HUEMN_RECORD_STEP", step });
  }
}

const recorder = new EventRecorder();

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "START_RECORDING") recorder.start();
  if (msg.action === "STOP_RECORDING") recorder.stop();
  if (msg.action === "EXPORT_JSON") recorder.exportJson();
});
