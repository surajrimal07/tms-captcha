// // Select the news URL element
// const newsUrlElement = document.getElementById("newsUrl") as HTMLElement;

import { type StockData, gainersData, losersData } from "./market-data";
import { isInTMSsite } from "./utils";

// // Fetch the newsUrl from chrome.storage.session
// async function fetchNewsUrl(): Promise<void> {
// 	try {
// 		const result = await chrome.storage.session.get("newsUrl");
// 		const newsUrl = result.newsUrl || "No URL available.";
// 		newsUrlElement.textContent = newsUrl;
// 	} catch (error) {
// 		console.error("Error fetching newsUrl:", error);
// 		newsUrlElement.textContent = "Error loading URL.";
// 	}
// }

// // Initialize the side panel content
// fetchNewsUrl();

class SentimentGauge {
	private pointer: SVGElement;
	private valueDisplay: HTMLElement;
	private currentValue = 30; // Default to Weak Bearish

	constructor() {
		this.pointer = document.querySelector(".gauge-pointer") as SVGElement;
		this.valueDisplay = document.getElementById(
			"sentiment-value",
		) as HTMLElement;
		this.setValue(this.currentValue); // Initialize with default value
	}

	private getSentimentText(value: number): string {
		if (value <= 20) return "Strong Bearish";
		if (value <= 40) return "Weak Bearish";
		if (value <= 60) return "Neutral";
		if (value <= 80) return "Weak Bullish";
		return "Strong Bullish";
	}

	private calculateRotation(value: number): number {
		// Map 0-100 to -90 to 90 degrees
		return (value / 100) * 180 - 90;
	}

	public setValue(newValue: number) {
		// Ensure value is between 0 and 100
		this.currentValue = Math.max(0, Math.min(100, newValue));

		// Update pointer rotation
		const rotation = this.calculateRotation(this.currentValue);
		this.pointer.style.transform = `rotate(${rotation}deg)`;

		// Update text
		const sentimentText = this.getSentimentText(this.currentValue);
		this.valueDisplay.textContent = sentimentText;
	}

	public getValue(): number {
		return this.currentValue;
	}
}

// Initialize the gauge when the document is loaded
let gauge: SentimentGauge;

document.addEventListener("DOMContentLoaded", () => {
	gauge = new SentimentGauge();
});

// Expose update function for the extension
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
(window as any).updateSentiment = (value: number) => {
	if (gauge) {
		gauge.setValue(value);
	}
};

let currentTab: "gainers" | "losers" = "gainers";
const contextMenu = document.getElementById("contextMenu") as HTMLDivElement;
let selectedSymbol = "";

function formatNumber(num: number): string {
	return num.toFixed(2);
}

function updateTable(data: StockData[]): void {
	const tableBody = document.getElementById("tableBody");
	if (!tableBody) return;

	tableBody.innerHTML = data
		.map(
			(stock) => `
        <tr class="${stock.percentChange >= 0 ? "positive" : "negative"}">
            <td class="symbol" data-symbol="${stock.symbol}">${stock.symbol}</td>
            <td>${formatNumber(stock.ltp)}</td>
            <td class="point-change ${stock.pointChange >= 0 ? "positive" : "negative"}">
                ${stock.pointChange >= 0 ? "+" : ""}${formatNumber(stock.pointChange)}
            </td>
            <td class="percent-change ${stock.percentChange >= 0 ? "positive" : "negative"}">
                ${stock.percentChange >= 0 ? "+" : ""}${formatNumber(stock.percentChange)}
            </td>
        </tr>
    `,
		)
		.join("");
}

function showContextMenu(e: MouseEvent, symbol: string) {
	e.preventDefault();
	selectedSymbol = symbol;
	contextMenu.style.display = "block";
	contextMenu.style.left = `${e.pageX}px`;
	contextMenu.style.top = `${e.pageY}px`;
}

function hideContextMenu() {
	contextMenu.style.display = "none";
}

function initializeEventListeners() {
	// Tab switching
	for (const button of document.querySelectorAll(".tab-btn")) {
		button.addEventListener("click", (e) => {
			const tab = (e.target as HTMLElement).dataset.tab as "gainers" | "losers";
			if (tab) {
				currentTab = tab;
				for (const btn of document.querySelectorAll(".tab-btn")) {
					btn.classList.remove("active", "selected");
				}
				button.classList.add(tab === "gainers" ? "active" : "selected");
				updateTable(tab === "gainers" ? gainersData : losersData);
			}
		});
	}

	// Context menu for symbols
	document.addEventListener("click", hideContextMenu);

	document
		.querySelector(".market-table")
		?.addEventListener("contextmenu", async (e) => {
			e.preventDefault();
			const target = e.target as HTMLElement;
			const cell = target.closest("td");
			if (cell && (await isInTMSsite())) {
				const row = cell.closest("tr");
				const symbolCell = row?.querySelector(".symbol");
				const symbol = symbolCell?.getAttribute("data-symbol");
				if (symbol) {
					showContextMenu(e, symbol);
				}
			}
		});

	// Buy/Sell buttons
	document.getElementById("buyButton")?.addEventListener("click", () => {
		window.parent.location.href = `https://tms04.nepsetms.com.np/tms/me/memberclientorderentry?symbol=${selectedSymbol}&transaction=Buy`;
		hideContextMenu();
	});

	document.getElementById("sellButton")?.addEventListener("click", () => {
		window.parent.location.href = `https://tms04.nepsetms.com.np/tms/me/memberclientorderentry?symbol=${selectedSymbol}&transaction=Sell`;
		hideContextMenu();
	});
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
	updateTable(gainersData);
	initializeEventListeners();
});
