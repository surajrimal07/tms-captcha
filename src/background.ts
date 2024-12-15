// background.ts
import PusherWorker from "pusher-js/worker";
import type { ChartDataArray } from "./chart/interfact";
import {
  loadDefaultNepseData,
  loadDefaultNepseIndexData,
  loadNepseOpen,
} from "./fetcher";
import {
  type NepseChartDataRaw,
  type NepseData,
  type NepseRawData,
  NepseState,
} from "./interface";

// background.ts
let pusher: PusherWorker | null = null;
let ports: chrome.runtime.Port[] = [];

let currentNepseData: NepseData | null = null;
let isNepseOpen: NepseState = NepseState.CLOSE;
let currentNepseIndexChart: ChartDataArray | null = null;

async function initializeDefaultData() {
  try {
    await loadDefaultNepseData();
    await loadNepseOpen();
    await loadDefaultNepseIndexData();

    console.log("✅ Successfully loaded initial data");

    // await Promise.all([
    //   loadDefaultNepseData(),
    //   loadNepseOpen(),
    //   loadDefaultNepseIndexData(),
    // ]);//this errors out
  } catch (error) {
    console.error("Error loading initial data:", error);
  }
}

chrome.runtime.onStartup.addListener(async () => {
  const result = await chrome.storage.local.get("isNepseEnabled");
  if (result.isNepseEnabled !== false) {
    initializePusher();
  }
});
chrome.runtime.onInstalled.addListener(async (details) => {
  const result = await chrome.storage.local.get("isNepseEnabled");

  if (details.reason === "install") {
    if (result.isNepseEnabled === undefined) {
      await chrome.storage.local.set({ isNepseEnabled: true });
      await initializeDefaultData();
      initializePusher();
    }
  } else if (result.isNepseEnabled === true) {
    initializePusher();
  }
});

chrome.runtime.onConnect.addListener((port) => {
  ports.push(port);

  port.onDisconnect.addListener(() => {
    ports = ports.filter((p) => p !== port);
  });
});

function sendNepseUpdate() {
  for (const port of ports) {
    try {
      port.postMessage({
        type: "NEPSE_COMBINED_UPDATE",
        payload: {
          data: currentNepseData,
          isOpen: isNepseOpen,
          nepseIndexChart: currentNepseIndexChart,
        },
      });
    } catch (error) {
      console.error("Error sending NEPSE update:", error);
    }
  }
}

function initializePusher() {
  if (!pusher || pusher.connection.state !== "connected") {
    pusher = new PusherWorker("dbdb40ced4f07c947017", { cluster: "ap2" });

    pusher.connection.bind("connecting", () =>
      console.log("⌛ Attempting to connect to Pusher...")
    );
    pusher.connection.bind("connected", () =>
      console.log("✅ Successfully connected to Pusher")
    );
    pusher.connection.bind("failed", () =>
      setTimeout(() => {
        console.log("🔄 Retrying Pusher connection...");
        pusher?.connect();
      }, 5000)
    );
    pusher.connection.bind("disconnected", () =>
      console.log("🔌 Disconnected from Pusher")
    );
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    pusher.connection.bind("error", (err: any) =>
      console.error("❌ Pusher connection error:", err)
    );

    const channel = pusher.subscribe("nepseapi");

    channel.bind("pusher:subscription_succeeded", () =>
      console.log("✅ Successfully subscribed to nepseapi channel")
    );

    channel.bind("nepseintradaychart", (rawData: NepseChartDataRaw) => {
      currentNepseIndexChart = rawData.message;
      chrome.storage.local.set({ nepseChartData: currentNepseIndexChart });
      sendNepseUpdate();
    });

    channel.bind("nepseindex", (rawData: NepseRawData) => {
      currentNepseData = rawData.message;
      console.log(`new nepse data: ${JSON.stringify(currentNepseData)}`);
      chrome.storage.local.set({ nepseData: currentNepseData });
      sendNepseUpdate();
    });

    channel.bind("isnepseopen", (rawData: { message: NepseState }) => {
      isNepseOpen = rawData.message;
      chrome.storage.local.set({ isNepseOpen });
      sendNepseUpdate();
    });
  }
}

function toggleNepseUpdates(isEnabled: boolean) {
  if (isEnabled) {
    initializePusher();
  } else if (!isEnabled && pusher) {
    pusher.disconnect();
    pusher = null;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "CHECK_PUSHER_CONNECTION":
      initializePusher();
      sendResponse({
        needsReconnect: !pusher || pusher.connection.state !== "connected",
      });
      break;

    case "TOGGLE_NEPSE_UPDATES": {
      const isEnabled = message.payload;
      toggleNepseUpdates(isEnabled);
      sendResponse({ success: true });
      break;
    }

    default:
      sendResponse({ success: false, message: "Unknown message type" });
      break;
  }
  return true;
});
