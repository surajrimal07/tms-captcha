import { defaultNepseIndexData } from "./chart/data";
import type {
	ChartDataArray,
	ChartDataPoint,
	OtherChartDataArray,
	OtherIndexChartData,
} from "./chart/interfact";
import {
	type IndexKey,
	type NepseData,
	NepseState,
	type OtherIndexDataMap,
	defaultNepseData,
	defaultOtherIndexData,
} from "./interface";

interface ApiResponse {
	indexData: {
		[key: string]: {
			time?: string;
			open: string;
			high?: string;
			low?: string;
			close: string;
			change: number;
			percentageChange: number;
			turnover: string;
			totalTradedShared?: string;
			totalTransactions?: string;
			totalScripsTraded?: string;
			totalCapitalization?: string;
			isOpen?: boolean;
			fiftyTwoWeekHigh?: number;
			fiftyTwoWeekLow?: number;
			previousClose?: string;
		};
	};
}

export function formatTurnover(amount: number): string {
	if (!amount || Number.isNaN(amount)) return "0";

	const kharba = 100000000000; // 100 arab
	const arab = 1000000000; // 100 crore
	const crore = 10000000; // 1 crore

	if (amount >= kharba) {
		const kharbaValue = Math.floor((amount / kharba) * 10) / 10;
		return `${kharbaValue.toFixed(1)} Kharba`;
	}

	if (amount >= arab) {
		const arabValue = Math.floor((amount / arab) * 10) / 10;
		return `${arabValue.toFixed(1)} Arab`;
	}

	const croreValue = Math.floor(amount / crore);
	return `${croreValue} Crore`;
}

export async function loadDefaultNepseData(): Promise<
	[NepseData, OtherIndexDataMap]
> {
	try {
		const response = await fetch(
			"https://nepse.surajrimal.dev/nepse/summary?refresh=true",
		);

		if (!response.ok) {
			throw new Error(`Failed to fetch NEPSE data: ${response.statusText}`);
		}
		const { indexData } = (await response.json()) as ApiResponse;
		const nepseData = indexData["NEPSE Index"] as NepseData;

		const indexDataMap = Object.fromEntries(
			Object.entries(indexData).filter(([key]) => key !== "NEPSE Index"),
		) as OtherIndexDataMap;

		await chrome.storage.local.set({
			nepseData,
			otherIndexData: indexDataMap,
		});

		return [nepseData, indexDataMap];
	} catch (error) {
		console.error("Error fetching NEPSE data:", error);
		return [defaultNepseData, defaultOtherIndexData];
	}
}

export async function loadNepseOpen(): Promise<NepseState> {
	try {
		const response = await fetch("https://nepse.surajrimal.dev/nepse/isOpen");

		if (!response.ok) {
			throw new Error(
				`Failed to fetch NEPSE Open data: ${response.statusText}`,
			);
		}

		const data = (await response.json()) as NepseState;

		chrome.storage.local.set({ data });
		return data;
	} catch (error) {
		return NepseState.CLOSE;
	}
}

export async function loadOtherIndexChart() {
	try {
		// Get stored chart data with default empty array
		const { otherIntradayChart = [] as OtherChartDataArray } =
			await chrome.storage.local.get(["otherIntradayChart"]);

		// Get other indexes with default empty array
		const { otherDashboard = [] as IndexKey[] } =
			await chrome.storage.local.get(["otherDashboard"]);

		// Filter out NEPSE Index
		const otherIndexDashboard = otherDashboard.filter(
			(dashboard: IndexKey) => dashboard !== "NEPSE Index",
		);

		// Early return if no other indexes
		if (!otherIndexDashboard.length) {
			return;
		}

		let hasNewData = false;

		// Process each index
		for (const index of otherIndexDashboard) {
			const hasData = otherIntradayChart.some(
				(chart: OtherIndexChartData) => chart.type === index,
			);

			if (!hasData) {
				try {
					const data = await loadOtherIndexIntradayData(index);
					if (data && Array.isArray(data)) {
						otherIntradayChart.push({
							type: index,
							data: data,
						});
						hasNewData = true;
					}
					console.log(`loaded data for index ${index} ${data}`);
				} catch (error) {
					console.error(`Failed to load data for index ${index}:`, error);
				}
			}
		}

		// Save only if new data was added
		if (hasNewData) {
			await chrome.storage.local.set({ otherIntradayChart });
		}
	} catch (error) {
		console.error("Error in loadOtherIndexChart:", error);
	}
}

export async function loadOtherIndexIntradayData(
	index: IndexKey,
): Promise<OtherChartDataArray | null> {
	try {
		const response = await fetch(
			`https://nepse.surajrimal.dev/nepse/indexintradaychart?index=${index}`,
		);

		if (!response.ok) {
			throw new Error(
				`Failed to fetch Other Index Intraday Data: ${response.statusText}`,
			);
		}

		const rawData = await response.json();

		const formattedData: OtherChartDataArray = Object.entries(rawData).map(
			([indexName, chartData]) => ({
				type: indexName as IndexKey,
				data: chartData as ChartDataPoint[],
			}),
		);

		return formattedData;
	} catch (error) {
		console.error("Error fetching Other Index Intraday Data", error);
		return null;
	}
}

export async function loadDefaultNepseIndexData(): Promise<ChartDataArray> {
	try {
		const response = await fetch(
			"https://nepse.surajrimal.dev/nepse/nepseintradaychart?refresh=true",
		);

		if (!response.ok) {
			throw new Error(
				`Failed to fetch NEPSE Intraday data: ${response.statusText}`,
			);
		}

		const data = (await response.json()) as NepseData;

		if (
			Array.isArray(data) &&
			data.every(
				(point): point is ChartDataPoint =>
					Array.isArray(point) &&
					point.length === 2 &&
					typeof point[0] === "number" &&
					typeof point[1] === "number",
			)
		) {
			chrome.storage.local.set({ nepseChartData: data });
			return data;
		}

		throw new Error("Invalid data structure received from API");
	} catch (error) {
		console.error("Error fetching NEPSE data:", error);
		return defaultNepseIndexData;
	}
}
