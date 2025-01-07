// background.ts
import type {
	ChartDataArray,
	OtherChartDataArray,
	OtherIndexChartData,
} from "./chart/interfact";

import {
	type DashboardData,
	type IndexKey,
	NEPSE_INDEX,
	type NepseData,
	NepseState,
	type OtherIndexDataMap,
	STORAGE_KEYS,
	type SentimentResponse,
	type SocketConfig,
	defaultNepseData,
} from "./interface";
import { NepseWebSocket } from "./socket";
import {
	loadDefaultNepseData,
	loadDefaultNepseIndexData,
	loadNepseOpen,
	loadOtherIndexChart,
} from "./utils";

const realTimeFields = [
	"close",
	"change",
	"percentageChange",
	"turnover",
	"totalTradedShared",
] as const;

let isLocalDataAvailable = false;

let socketClient: NepseWebSocket | null = null;
const ports = new Set<chrome.runtime.Port>();

let currentNepseData: NepseData;
let isNepseOpen: NepseState = NepseState.CLOSE;
let nepseDashboard: DashboardData | null = null;
let nepseSentiment: SentimentResponse | null = null;
let currentNepseIndexChart: ChartDataArray | null = null;
let otherIndexes: OtherIndexDataMap | null = null;
// biome-ignore lint/style/useConst: <explanation>
let otherIntradayChart: OtherChartDataArray = [];
let currentChange: number | null = null;
let otherIndexDashboard: IndexKey[] = [];

const DEFAULT_CONFIG: SocketConfig = {
	url: "https://nepse.surajrimal.dev/ws",
	baseSubscriptions: [
		"isOpen",
		"nepseIndex",
		"nepseIntradayChart",
		"dashboard",
		"sentiment",
	],
	otherIndexes: [],
};

let currentIndexes: IndexKey[] = DEFAULT_CONFIG.otherIndexes; // Track the current Socket URL

async function getSocketConfig(): Promise<SocketConfig> {
	const { otherDashboard = [] } = await chrome.storage.local.get([
		STORAGE_KEYS.OTHER_DASHBOARD,
	]);

	const filteredIndexes = otherDashboard.filter(
		(index: IndexKey) => index !== NEPSE_INDEX,
	) as IndexKey[];

	otherIndexDashboard = filteredIndexes;

	const subscriptions = [...DEFAULT_CONFIG.baseSubscriptions];
	if (filteredIndexes.length > 0) {
		subscriptions.push("otherIntradayChart", "otherIndexes");
	}
	return {
		url: DEFAULT_CONFIG.url,
		baseSubscriptions: subscriptions,
		otherIndexes: filteredIndexes,
	};
}

chrome.storage.onChanged.addListener((changes, namespace) => {
	if (namespace === "local" && changes.otherDashboard) {
		// Use the updated value from changes.otherDashboard.newValue
		const otherDashboards =
			(changes.otherDashboard.newValue as IndexKey[]) || [];
		const filteredIndexes = otherDashboards.filter(
			(index) => index !== NEPSE_INDEX,
		);

		otherIndexDashboard = filteredIndexes;

		const subscriptions = [...DEFAULT_CONFIG.baseSubscriptions];
		if (filteredIndexes.length > 0) {
			subscriptions.push("otherIntradayChart", "otherIndexes");
		}

		const newConfig = {
			url: DEFAULT_CONFIG.url,
			baseSubscriptions: subscriptions,
			otherIndexes: filteredIndexes,
		};

		// Check if the URL has changed
		if (newConfig.otherIndexes !== currentIndexes) {
			initializeSocket(newConfig, true);
			currentIndexes = newConfig.otherIndexes;
		}
	}
});

function initializeSocket(config: SocketConfig, forceReconnect = false) {
	socketClient = NepseWebSocket.getInstance(
		config.url,
		config.baseSubscriptions,
		config.otherIndexes,
		forceReconnect,
	);
}

async function initializeDefaultData() {
	try {
		await loadDefaultNepseData().then(([nepseData, otherIndexData]) => {
			currentNepseData = nepseData;
			otherIndexes = otherIndexData;
			currentChange = nepseData.change ?? null;
			updateBadge(currentChange);
		});
		await loadNepseOpen();
		await loadDefaultNepseIndexData();

		await loadOtherIndexChart();
	} catch (error) {
		console.error("Error loading initial data:", error);
	}
}

chrome.runtime.onStartup.addListener(async () => {
	const result = await chrome.storage.local.get(STORAGE_KEYS.NEPSE_ENABLED);
	if (result.isNepseEnabled !== false) {
		initializeFetch();
	}
});
chrome.runtime.onInstalled.addListener(async (details) => {
	const result = await chrome.storage.local.get(STORAGE_KEYS.NEPSE_ENABLED);

	if (details.reason === "install") {
		if (result.isNepseEnabled === undefined) {
			await chrome.storage.local.set({ isNepseEnabled: true });
			await initializeDefaultData();
			initializeFetch();
		}
	} else if (result.isNepseEnabled === true) {
		initializeFetch();
	}
});

chrome.runtime.onConnect.addListener((port) => {
	ports.add(port);

	port.onDisconnect.addListener(() => {
		ports.delete(port);
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
					dashboardIndexChart: currentNepseIndexChart,
				},
			});
		} catch (error) {
			console.error("Error sending NEPSE update:", error);
		}
	}
}

function sendDashboardUpdate() {
	for (const port of ports) {
		try {
			port.postMessage({
				type: "NEPSE_DASHBOARD_UPDATE",
				payload: {
					dashboard: nepseDashboard,
					sentiment: nepseSentiment,
				},
			});
		} catch (error) {
			console.error("Error sending NEPSE update:", error);
		}
	}
}

function sendOtherIndexUpdate() {
	for (const port of ports) {
		try {
			port.postMessage({
				type: "OTHER_INDEX_UPDATE",
				payload: {
					indexes: otherIndexes,
					charts: otherIntradayChart,
				},
			});
		} catch (error) {
			console.error("Error sending NEPSE update:", error);
		}
	}
}

//socket code
async function initializeFetch() {
	currentNepseData =
		(await chrome.storage.local.get(STORAGE_KEYS.NEPSE_DATA)).nepseData ||
		defaultNepseData;

	chrome.runtime.onMessage.addListener((message) => {
		if (message.type === "nepseIndexUpdate" && message.data) {
			isLocalDataAvailable = true;
			currentNepseData = {
				...currentNepseData,
				...message.data,
			};
			sendNepseUpdate();
		}
	});

	//get existing chart from storage
	chrome.storage.local.get([STORAGE_KEYS.OTHER_INTRADAY_CHART], (result) => {
		otherIntradayChart = result.otherIntradayChart || [];
	});

	if (!socketClient?.ws || socketClient.ws.readyState !== WebSocket.OPEN) {
		const config = await getSocketConfig();

		currentIndexes = config.otherIndexes;

		initializeSocket(config);

		socketClient?.onMessage("isOpen", (data: NepseState) => {
			isNepseOpen = data;
			chrome.storage.local.set({ isNepseOpen });
			sendNepseUpdate();
		});

		socketClient?.onMessage("nepseIndex", (data: NepseData) => {
			chrome.storage.local.set({ nepseData: currentNepseData });

			if (!isLocalDataAvailable) {
				// Use pure Pusher data if no tms tab is opened
				currentNepseData = data;
			} else {
				// Merge real time data from tms tab with Pusher data
				//but only if the field is not undefined
				const newData = { ...data };
				if (currentNepseData) {
					for (const field of realTimeFields) {
						if (currentNepseData[field] !== undefined) {
							(newData as Record<typeof field, NepseData[typeof field]>)[
								field
							] = currentNepseData[field];
						}
					}
				}
				currentNepseData = newData;
				currentChange = newData.change ?? null;
			}
			updateBadge(currentChange);
			sendNepseUpdate();
		});

		socketClient?.onMessage("nepseIntradayChart", (data: ChartDataArray) => {
			currentNepseIndexChart = data;
			chrome.storage.local.set({ nepseChartData: currentNepseIndexChart });
			sendNepseUpdate();
		});

		socketClient?.onMessage("dashboard", (data: DashboardData) => {
			nepseDashboard = data;
			chrome.storage.local.set({ dashboardData: nepseDashboard });
			sendDashboardUpdate();
		});

		socketClient?.onMessage("sentiment", (data: SentimentResponse) => {
			nepseSentiment = data;
			chrome.storage.local.set({ sentimentData: nepseSentiment });
			sendDashboardUpdate();
		});

		socketClient?.onMessage("otherIndexes", (data: OtherIndexDataMap) => {
			otherIndexes = data;
			chrome.storage.local.set({ otherIndexes: data });
			sendOtherIndexUpdate();
		});

		socketClient?.onMessage(
			"otherIntradayChart",
			(data: ChartDataArray, type?: IndexKey) => {
				if (!type) return;

				const chartData: OtherIndexChartData = {
					data: data,
					type: type,
				};

				// Safely find existing index
				const existingIndex =
					otherIntradayChart?.findIndex?.((chart) => chart.type === type) ?? -1;

				if (existingIndex >= 0) {
					otherIntradayChart[existingIndex] = chartData;
				} else {
					otherIntradayChart.push(chartData);
				}

				chrome.storage.local.set({ otherIntradayChart: otherIntradayChart });
				sendOtherIndexUpdate();
			},
		);
	}
}
//end of socket code

function toggleNepseUpdates(isEnabled: boolean) {
	if (isEnabled) {
		initializeFetch();
	} else if (!isEnabled && socketClient) {
		socketClient.close();
		socketClient = null;
	}
}

chrome.runtime.onMessage.addListener(async (message, _sender, sendResponse) => {
	switch (message.type) {
		case "CHECK_SOCKET_CONNECTION":
			initializeFetch();
			sendResponse({
				needsReconnect:
					!socketClient ||
					!socketClient.ws ||
					socketClient.ws.readyState !== WebSocket.OPEN,
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

//badge code
chrome.storage.local.get(STORAGE_KEYS.NEPSE_DATA, (result) => {
	currentChange = result.nepseData?.change ?? null;
	updateBadge(currentChange);
});

async function updateBadge(change: number | null) {
	if (change === null) return;

	await Promise.all([
		chrome.action.setBadgeText({
			text: change.toString(),
		}),
		chrome.action.setBadgeBackgroundColor({
			color: change >= 0 ? "#22c55e" : "#ef4444",
		}),
	]);
}

//end of badge code

//experimental for sidepanel api
// chrome.runtime.onInstalled.addListener(() => {
// 	chrome.contextMenus.create({
// 		id: "summarizeNews",
// 		title: "Summarize News",
// 		type: "normal",
// 		documentUrlPatterns: ["https://merolagani.com/NewsDetail.aspx*"],
// 		contexts: ["page"],
// 	});

// 	chrome.contextMenus.create({
// 		id: "toggleSidebar",
// 		type: "normal",
// 		title: "Open Nepse Dashboard",
// 		contexts: ["all"],
// 	});
// });

// Listen for clicks on the context menu
// chrome.contextMenus.onClicked.addListener(async (info, tab) => {
// 	if (!tab?.id) return;

// 	chrome.storage.session.set({ newsUrl: info.pageUrl });

// 	if (info.menuItemId === "toggleSidebar") {
// 		//broken code
// 		//not sure how to know if the sidebar is open or not

// 		try {
// 			window.close();
// 		} catch {
// 			await chrome.sidePanel.open({ tabId: tab.id });
// 		}

// 		// const menuInfo = info.frameUrl;

// 		// if (menuInfo) {
// 		// 	await chrome.sidePanel.open({ tabId: tab.id });
// 		// } else {
// 		// 	chrome.runtime.sendMessage("closeSidePanel");
// 		// }
// 	}
// });

//method to check if sidebar was closed
// chrome.runtime.onConnect.addListener((port) => {
// 	if (port.name === "nepseSidepanel") {
// 		chrome.contextMenus.update("toggleSidebar", {
// 			title: "Close Nepse Dashboard",
// 		});

// 		port.onDisconnect.addListener(async () => {
// 			chrome.contextMenus.update("toggleSidebar", {
// 				title: "Open Nepse Dashboard",
// 			});
// 		});
// 	}
// });

// //experimental to read dom updates from nepse tms
// chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
// 	if (
// 		tab.url?.includes("nepsetms.com.np/tms") &&
// 		changeInfo.status === "complete" &&
// 		!injectedTabs.has(tabId)
// 	) {
// 		chrome.scripting.executeScript({
// 			target: { tabId },
// 			files: ["content-script-tms.ts"],
// 		});
// 		injectedTabs.add(tabId);
// 	}
// });

// // Listen for tab activation
// chrome.tabs.onActivated.addListener(async (activeInfo) => {
// 	const tab = await chrome.tabs.get(activeInfo.tabId);
// 	if (
// 		tab.url?.includes("nepsetms.com.np/tms") &&
// 		!injectedTabs.has(activeInfo.tabId)
// 	) {
// 		chrome.scripting.executeScript({
// 			target: { tabId: activeInfo.tabId },
// 			files: [nepsetmsScript],
// 		});
// 		injectedTabs.add(activeInfo.tabId);
// 	}
// });

// Clean up removed tabs
// chrome.tabs.onRemoved.addListener((tabId) => {
// 	injectedTabs.delete(tabId);
// });
