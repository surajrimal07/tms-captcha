// background.ts
import PusherWorker from "pusher-js/worker";
import type { NepseDataSubset, NepseRawData } from "./interface";

// background.ts
let pusher: PusherWorker | null = null;
let ports: chrome.runtime.Port[] = [];

// Connect to Pusher on service worker startup
chrome.runtime.onStartup.addListener(async () => {
  const result = await chrome.storage.local.get("isNepseEnabled");
  if (result.isNepseEnabled !== false) {
    console.log("🚀 Initializing Nepse updates on startup");
    initializePusher();
  }
});

// Also connect when installed/updated
chrome.runtime.onInstalled.addListener(async () => {
  const result = await chrome.storage.local.get("isNepseEnabled");
  if (result.isNepseEnabled !== false) {
    console.log("🚀 Initializing Nepse updates on install/update");
    initializePusher();
  }
});

// Handle port connections from popup
chrome.runtime.onConnect.addListener((port) => {
  ports.push(port);

  port.onDisconnect.addListener(() => {
    ports = ports.filter((p) => p !== port);
  });
});

function initializePusher() {
  if (!pusher) {
    pusher = new PusherWorker("dbdb40ced4f07c947017", {
      cluster: "ap2",
    });

    // Connection state handlers
    pusher.connection.bind("connecting", () => {
      console.log("⌛ Attempting to connect to Pusher...");
    });

    pusher.connection.bind("connected", () => {
      console.log("✅ Successfully connected to Pusher");
    });

    pusher.connection.bind("failed", () => {
      console.error("❌ Failed to connect to Pusher");
      // Retry connection after delay
      setTimeout(() => {
        console.log("🔄 Retrying Pusher connection...");
        pusher?.connect();
      }, 5000);
    });

    pusher.connection.bind("disconnected", () => {
      console.log("🔌 Disconnected from Pusher");
    });

    pusher.connection.bind("error", (err: unknown) => {
      let errorMessage = "Unknown error";

      if (err instanceof Error) {
        errorMessage = `${err.name}: ${err.message}`;
        if (err.stack) {
          console.error("Stack trace:", err.stack);
        }
      } else if (typeof err === "object" && err !== null) {
        try {
          errorMessage = JSON.stringify(err, null, 2);
        } catch {
          errorMessage = String(err);
        }
      } else {
        errorMessage = String(err);
      }

      console.error("❌ Pusher connection error:", errorMessage);
    });

    const channel = pusher.subscribe("nepseapi");

    channel.bind("pusher:subscription_succeeded", () => {
      console.log("✅ Successfully subscribed to nepseapi channel");
    });

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    channel.bind("pusher:subscription_error", (err: any) => {
      console.error("❌ Channel subscription error:", err);
    });

    channel.bind("nepseindex", (rawData: NepseRawData) => {
      try {
        const data = rawData.message;
        const nepseData: NepseDataSubset = {
          time: data.time,
          isOpen: data.isOpen,
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
          change: data.change,
          percentageChange: data.percentageChange,
          turnover: data.turnover,
        };

        // Save to storage
        chrome.storage.local.set({ nepseData });

        // Notify all connected popups
        for (const port of ports) {
          port.postMessage({
            type: "NEPSE_DATA_UPDATE",
            payload: nepseData,
          });
        }
      } catch (error) {
        console.error("❌ Error processing NEPSE data:", error);
      }
    });

    channel.bind("isnepseopen", (rawData: { message: boolean }) => {
      try {
        const isOpen = rawData.message;

        chrome.storage.local.set({ isNepseOpen: isOpen });

        // Notify popups
        for (const port of ports) {
          port.postMessage({
            type: "NEPSE_STATUS_UPDATE",
            payload: isOpen,
          });
        }
      } catch (error) {
        console.error("❌ Error processing NEPSE open status:", error);
      }
    });
  }
}

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TOGGLE_NEPSE_UPDATES") {
    const isEnabled = message.payload;
    if (isEnabled && !pusher) {
      initializePusher();
    } else if (!isEnabled && pusher) {
      pusher.disconnect();
      pusher = null;
    }
    sendResponse({ success: true });
  }
  return true;
});
