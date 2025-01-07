import { formatTurnover } from "./utils";

let observer: MutationObserver | null = null;
let isConnected = true;

interface TradeData {
	close: string;
	change: number;
	percentageChange: number;
	totalTradedShared: string;
	turnover: string;
}

function isValidTradeData(values: TradeData): boolean {
	const numericClose = Number.parseFloat(values.close);
	return (
		values.close !== "NaN" &&
		!Number.isNaN(numericClose) &&
		values.change !== 0 &&
		values.percentageChange !== 0 &&
		values.totalTradedShared !== "0" &&
		values.turnover !== "0" &&
		values.turnover !== ""
	);
}

// Function to extract market values
function extractMarketValues() {
	const headerAmount = document.querySelector(
		'div[class*="header__indices--amount"]',
	);
	if (!headerAmount) return null;

	const nepseIndexElement = headerAmount.querySelector(
		'span[class*="header__indices--change"]',
	);
	const changeElement = headerAmount.querySelector(
		'span[class*="header__indices--changeperc"]',
	);
	const turnoverElement = document.querySelector(
		'h6[class*="header__indices--changeperc"]:nth-of-type(1)',
	);
	const volumeElement = document.querySelector(
		'h6[class*="header__indices--changeperc"]:nth-of-type(2)',
	);
	const dnaLoggedInElement = document.querySelector(
		'div[title="DNA logged In"]',
	);

	try {
		const nepseIndex = nepseIndexElement?.textContent?.trim() || "0";
		const changeText = changeElement?.textContent?.trim() || "";
		const turnover =
			turnoverElement?.textContent
				?.replace("Turnover:", "")
				.trim()
				.replace(/,/g, "") || "0";
		const volume =
			volumeElement?.textContent
				?.replace("Volume:", "")
				.trim()
				.replace(/,/g, "") || "0";
		const isDnaLoggedIn = dnaLoggedInElement !== null;

		let pointChange = 0;
		let percentChange = 0;

		if (changeText) {
			const cleanText = changeText.replace(/[()]/g, "");
			const [points, percentText] = cleanText.split("/");
			pointChange = Number.parseFloat(points);
			percentChange = Number.parseFloat(percentText);
		}

		const values = {
			close: nepseIndex.replace(/,/g, ""),
			change: pointChange,
			percentageChange: percentChange,
			turnover: formatTurnover(Number.parseFloat(turnover) || 0),
			totalTradedShared: volume,
		};

		if (!isValidTradeData(values)) return null;

		return values;
	} catch (error) {
		console.error("Error extracting values:", error);
		return null;
	}
}

function startMonitoring() {
	if (!isConnected) return;

	try {
		observer = new MutationObserver(async () => {
			if (!isConnected) {
				cleanup();
				return;
			}

			const values = extractMarketValues();
			if (values) {
				await chrome.runtime
					.sendMessage({
						type: "nepseIndexUpdate",
						data: values,
					})
					.catch(() => {
						isConnected = false;
						cleanup();
					});
			}
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true,
		});
	} catch (error) {
		console.error("Error starting monitoring:", error);
		cleanup();
	}
}

function cleanup() {
	if (observer) {
		observer.disconnect();
		observer = null;
	}
}

// Handle extension unload
window.addEventListener("unload", cleanup);

// Start monitoring when the page loads
if (document.readyState === "loading") {
	window.addEventListener("load", startMonitoring);
} else {
	startMonitoring();
}
