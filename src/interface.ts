import type { ChartDataArray, OtherChartDataArray } from "./chart/interfact";

export enum ResultTypes {
	Success = 0,
	LowConfidence = 1,
	InvalidLength = 2,
}

export interface NepseRawData {
	message: NepseData;
	channel: string;
	event: string;
}

export interface NepseChartDataRaw {
	message: ChartDataArray;
	channel: string;
	event: string;
}

export enum NepseState {
	CLOSE = "Close",
	OPEN = "Open",
	PRE_OPEN = "Pre Open",
	PRE_CLOSE = "Pre Close",
}

export type SocketRoom =
	| "isOpen"
	| "nepseIndex"
	| "nepseIntradayChart"
	| "otherIntradayChart"
	| "otherIndexes"
	| "dashboard"
	| "sentiment";

export interface SocketConfig {
	url: string;
	baseSubscriptions: SocketRoom[];
	otherIndexes: IndexKey[];
}

export interface NepseData {
	time: string;
	open: string;
	high: string;
	low: string;
	close: string;
	change: number;
	percentageChange: number;
	turnover: string;
	totalTradedShared: string;
	totalTransactions: string;
	totalScripsTraded: string;
	totalCapitalization: string;
	isOpen: boolean;
	fiftyTwoWeekHigh: number;
	fiftyTwoWeekLow: number;
	previousClose: string;
}

export interface OtherIndexData extends Partial<NepseData> {
	turnover: string;
	close: string;
	percentageChange: number;
	change: number;
	open: string;
}

export type OtherIndexDataMap = {
	[K in OtherIndexKey]: OtherIndexData;
};

export const defaultNepseData: NepseData = {
	time: "2024-12-04T14:59:59.977",
	isOpen: false,
	open: "2775.40",
	high: "2795.78",
	low: "2747.65",
	close: "2750.87",
	change: -24.97,
	percentageChange: -0.89,
	turnover: "4.7 Arab",
	totalTradedShared: "2919838",
	totalCapitalization: "43.0 Kharba",
	totalTransactions: "14476",
	totalScripsTraded: "275",
	previousClose: "2689",
	fiftyTwoWeekHigh: 3000.81,
	fiftyTwoWeekLow: 1852.78,
};

export const defaultOtherIndexData: OtherIndexDataMap = {
	"Banking SubIndex": {
		turnover: "15 Crore",
		close: "1386.62",
		percentageChange: -0.37,
		change: -5.13,
		open: "1391.75",
	},
	"Development Bank Ind.": {
		turnover: "22 Crore",
		close: "5240.16",
		percentageChange: 1.46,
		change: 76.51,
		open: "5163.65",
	},
	"Finance Index": {
		turnover: "16 Crore",
		close: "2889.56",
		percentageChange: -0.05,
		change: -1.44,
		open: "2891.00",
	},
	"Hotels And Tourism": {
		turnover: "1 Crore",
		close: "6386.85",
		percentageChange: 0.43,
		change: 27.46,
		open: "6359.39",
	},
	"HydroPower Index": {
		turnover: "75 Crore",
		close: "3444.46",
		percentageChange: 0.81,
		change: 27.9,
		open: "3416.56",
	},
	Investment: {
		turnover: "9 Crore",
		close: "98.04",
		percentageChange: -0.73,
		change: -0.72,
		open: "98.76",
	},
	"Life Insurance": {
		turnover: "6 Crore",
		close: "12402.25",
		percentageChange: 0.38,
		change: 47.13,
		open: "12355.12",
	},
	"Manufacturing And Pr.": {
		turnover: "7 Crore",
		close: "6667.27",
		percentageChange: -0.14,
		change: -9.33,
		open: "6676.60",
	},
	"Microfinance Index": {
		turnover: "18 Crore",
		close: "4852.46",
		percentageChange: -0.96,
		change: -46.58,
		open: "4899.04",
	},
	"Mutual Fund": {
		turnover: "0 Crore",
		close: "20.21",
		percentageChange: -0.07,
		change: -0.01,
		open: "20.22",
	},
	"Non Life Insurance": {
		turnover: "11 Crore",
		close: "12404.13",
		percentageChange: 0.4,
		change: 49.62,
		open: "12354.51",
	},
	"Others Index": {
		turnover: "5 Crore",
		close: "1903.71",
		percentageChange: -1.84,
		change: -35.03,
		open: "1938.74",
	},
	"Sensitive Index": {
		turnover: "0",
		close: "442.01",
		percentageChange: -0.47,
		change: -2.08,
		open: "444.09",
	},
	"Trading Index": {
		turnover: "0 Crore",
		close: "4453.41",
		percentageChange: -2.33,
		change: -103.76,
		open: "4557.17",
	},
};

export type DashboardData = {
	gainers: Array<{
		symbol: string;
		name: string;
		ltp: number;
		pointchange: number;
		percentchange: number;
	}>;
	losers: Array<{
		symbol: string;
		name: string;
		ltp: number;
		pointchange: number;
		percentchange: number;
	}>;
	transactions: Array<{
		symbol: string;
		name: string;
		ltp: number;
		transactions: number;
	}>;
	turnovers: Array<{
		symbol: string;
		name: string;
		ltp: number;
		turnover: number;
	}>;
	traded: Array<{
		symbol: string;
		name: string;
		ltp: number;
		shareTraded: number;
	}>;
};

export const DEFAULT_DASHBOARD_DATA: DashboardData = {
	gainers: [
		{
			symbol: "MLBSL",
			name: "Mahila Lagubitta Bittiya Sanstha Limited ",
			ltp: 2461.6,
			pointchange: 223.7,
			percentchange: 10,
		},
		{
			symbol: "ANLB",
			name: "Aatmanirbhar Laghubitta Bittiya Sanstha Limited",
			ltp: 6530,
			pointchange: 592.6,
			percentchange: 9.98,
		},
		{
			symbol: "MLBS",
			name: "Manushi Laghubitta Bittiya Sanstha Limited",
			ltp: 2160,
			pointchange: 123.9,
			percentchange: 6.09,
		},
		{
			symbol: "SHLB",
			name: "Shrijanshil Laghubitta Bittiya Sanstha Limited",
			ltp: 2785,
			pointchange: 155,
			percentchange: 5.89,
		},
		{
			symbol: "NRN",
			name: "NRN Infrastructure and Development Limited",
			ltp: 999,
			pointchange: 54,
			percentchange: 5.71,
		},
		{
			symbol: "MSLB",
			name: "Mahuli Laghubitta Bittiya Sanstha Limited",
			ltp: 1564,
			pointchange: 68.5,
			percentchange: 4.58,
		},
		{
			symbol: "SLBSL",
			name: "Samudayik Laghubitta Bittiya Sanstha Limited",
			ltp: 1987,
			pointchange: 70,
			percentchange: 3.65,
		},
		{
			symbol: "KDBY",
			name: "Kumari Dhanabriddhi Yojana",
			ltp: 9.55,
			pointchange: 0.32,
			percentchange: 3.47,
		},
	],
	losers: [
		{
			symbol: "SMB",
			name: "Support Microfinance Bittiya Sanstha Ltd.",
			ltp: 3587.4,
			pointchange: -398.5,
			percentchange: -10,
		},
		{
			symbol: "NABBC",
			name: "Narayani Development Bank Limited",
			ltp: 1040.9,
			pointchange: -115.6,
			percentchange: -10,
		},
		{
			symbol: "SAPDBL",
			name: "Saptakoshi Development Bank Ltd",
			ltp: 872.1,
			pointchange: -96.9,
			percentchange: -10,
		},
		{
			symbol: "JFL",
			name: "Janaki Finance Company Limited",
			ltp: 833.4,
			pointchange: -92.6,
			percentchange: -10,
		},
		{
			symbol: "SINDU",
			name: "Sindhu Bikash Bank Ltd",
			ltp: 761.4,
			pointchange: -84.6,
			percentchange: -10,
		},
		{
			symbol: "JOSHI",
			name: "Joshi Hydropower Development Company Ltd",
			ltp: 420,
			pointchange: -40.3,
			percentchange: -8.76,
		},
		{
			symbol: "GRDBL",
			name: "Green Development Bank Ltd.",
			ltp: 880,
			pointchange: -80,
			percentchange: -8.33,
		},
		{
			symbol: "BFC",
			name: "Best Finance Company Ltd.",
			ltp: 638.9,
			pointchange: -49.1,
			percentchange: -7.14,
		},
	],
	transactions: [
		{
			symbol: "PRVU",
			name: "Prabhu Bank Limited",
			ltp: 241.1,
			transactions: 1704,
		},
		{
			symbol: "JFL",
			name: "Janaki Finance Company Limited",
			ltp: 833.4,
			transactions: 1567,
		},
		{
			symbol: "NFS",
			name: "Nepal Finance Ltd.",
			ltp: 1002,
			transactions: 1152,
		},
		{
			symbol: "SFCL",
			name: "Samriddhi Finance Company Limited",
			ltp: 608,
			transactions: 1101,
		},
		{
			symbol: "HRL",
			name: "Himalayan Reinsurance Limited",
			ltp: 796,
			transactions: 1039,
		},
		{
			symbol: "KBL",
			name: "Kumari Bank Limited",
			ltp: 219.3,
			transactions: 977,
		},
		{
			symbol: "JOSHI",
			name: "Joshi Hydropower Development Company Ltd",
			ltp: 420,
			transactions: 959,
		},
		{
			symbol: "NYADI",
			name: "Nyadi Hydropower Limited",
			ltp: 428,
			transactions: 899,
		},
	],
	turnovers: [
		{
			symbol: "PRVU",
			name: "Prabhu Bank Limited",
			ltp: 241.1,
			turnover: 261082664.8,
		},
		{
			symbol: "JFL",
			name: "Janaki Finance Company Limited",
			ltp: 833.4,
			turnover: 160941667.9,
		},
		{
			symbol: "NRN",
			name: "NRN Infrastructure and Development Limited",
			ltp: 999,
			turnover: 153478594.9,
		},
		{
			symbol: "NLG",
			name: "NLG Insurance Company Ltd.",
			ltp: 965,
			turnover: 121322747.1,
		},
		{
			symbol: "RFPL",
			name: "River Falls Power Limited",
			ltp: 1020,
			turnover: 111838618.1,
		},
		{
			symbol: "KBL",
			name: "Kumari Bank Limited",
			ltp: 219.3,
			turnover: 110558204.2,
		},
		{
			symbol: "SAPDBL",
			name: "Saptakoshi Development Bank Ltd",
			ltp: 872.1,
			turnover: 99476978.6,
		},
		{
			symbol: "SFCL",
			name: "Samriddhi Finance Company Limited",
			ltp: 608,
			turnover: 85952248,
		},
	],
	traded: [
		{
			symbol: "PRVU",
			name: "Prabhu Bank Limited",
			ltp: 241.1,
			shareTraded: 1065655,
		},
		{
			symbol: "KBL",
			name: "Kumari Bank Limited",
			ltp: 219.3,
			shareTraded: 496350,
		},
		{
			symbol: "PRSF",
			name: "Prabhu Smart Fund",
			ltp: 10.19,
			shareTraded: 242698,
		},
		{
			symbol: "JFL",
			name: "Janaki Finance Company Limited",
			ltp: 833.4,
			shareTraded: 192333,
		},
		{
			symbol: "JOSHI",
			name: "Joshi Hydropower Development Company Ltd",
			ltp: 420,
			shareTraded: 183594,
		},
		{
			symbol: "LSL",
			name: "Laxmi Sunrise Bank Limited",
			ltp: 239,
			shareTraded: 179127,
		},
		{
			symbol: "NSIF2",
			name: "NMB Sulav Investment Fund - 2",
			ltp: 10.13,
			shareTraded: 178200,
		},
		{
			symbol: "NYADI",
			name: "Nyadi Hydropower Limited",
			ltp: 428,
			shareTraded: 172351,
		},
	],
};

//for other indexes
export type OtherIndexKey = Exclude<IndexKey, "NEPSE Index">;

export type IndexKey =
	| "NEPSE Index"
	| "Banking SubIndex"
	| "Development Bank Ind."
	| "Finance Index"
	| "Hotels And Tourism"
	| "HydroPower Index"
	| "Investment"
	| "Life Insurance"
	| "Manufacturing And Pr."
	| "Microfinance Index"
	| "Mutual Fund"
	| "Non Life Insurance"
	| "Others Index"
	| "Sensitive Index"
	| "Trading Index";

export interface ThemeToggle extends HTMLElement {
	classList: DOMTokenList;
}

export interface SentimentResponse {
	prediction: string;
	strength: number;
}

export const DEFAULT_SENTIMENT_DATA: SentimentResponse = {
	prediction: "Market may decrease",
	strength: -0.3,
};

export interface SolveResult {
	type: ResultTypes;
	value?: string;
}

export interface KindEntry {
	write_name: string;
	data_path: string;
}

export interface Account {
	type: "tms" | "meroshare";
	broker: number;
	alias: string;
	username: string;
	password: string;
	isPrimary: boolean;
}

//meroshare enums
export enum FormSelectors {
	FORM = 'form[name="loginForm"]',
	USERNAME = 'input[name="username"]',
	PASSWORD = 'input[name="password"]',
	DP_SELECT = 'select[name="dp"]',
	DP_OPTIONS = 'select[name="dp"] option',
	LOGIN_BUTTON = 'button[type="submit"]',
	SELECT2_CONTAINER = ".select2-container",
	SELECT2_DROPDOWN = ".select2-dropdown",
	SELECT2_SELECTION = ".select2-selection",
	SELECT2_RESULTS = ".select2-results__options",
}

export interface Config {
	readonly MAX_RETRIES: number;
	readonly RETRY_DELAY: number;
	readonly INITIAL_DELAY: number;
	readonly SELECTORS: typeof FormSelectors;
}

export interface Credentials {
	readonly dp: string;
	readonly username: string;
	readonly password: string;
}

export interface Select2Instance {
	trigger(event: string, data: unknown): void;
}

export interface AngularComponent {
	writeValue(value: unknown): void;
	onChange(value: unknown): void;
}

export const CONFIG: Readonly<Config> = {
	MAX_RETRIES: 5,
	RETRY_DELAY: 100,
	INITIAL_DELAY: 300,
	SELECTORS: FormSelectors,
};

export const MEROSHAREDASHBOARD_PATTERN = /\/#\/dashboard$/;
export const ANALYTICS_ENDPOINT =
	"https://surajrimal.dev/api/logincount?action=receive" as const;
export const MEROSHARE_LOGIN_URL = "meroshare.cdsc.com.np/#/login" as const;
export const TMS_DASHBOARD_PATTERN = /\/tms\/client\/dashboard/;

export type NepseUpdateMessage = {
	type: "NEPSE_COMBINED_UPDATE";
	payload: {
		data: NepseData | null;
		isOpen: NepseState | NepseState.CLOSE;
		dashboardIndexChart: ChartDataArray | null;
	};
};

export type OtherIndexMessage = {
	type: "OTHER_INDEX_UPDATE";
	payload: {
		indexes: OtherIndexDataMap | null;
		charts: OtherChartDataArray | null;
	};
};

export type SocketMessage = NepseUpdateMessage | OtherIndexMessage;

export const SVG_ICONS = {
	primaryOutline: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
</svg>`,
	primaryFilled: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
</svg>`,
	edit: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>`,
	delete: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>`,
};

export const NEPSE_INDEX = "NEPSE Index";
export const STORAGE_KEYS = {
	// Dashboard related
	OTHER_DASHBOARD: "otherDashboard",
	ACTIVE_DASHBOARD: "activeDashboard",
	OTHER_INDEXES: "otherIndexes",
	OTHER_INTRADAY_CHART: "otherIntradayChart",

	// NEPSE related
	NEPSE_DATA: "nepseData",
	NEPSE_STATE: "isNepseOpen",
	NEPSE_CHART_DATA: "nepseChartData",
	NEPSE_ENABLED: "isNepseEnabled",

	// Account related
	ACCOUNTS: "accounts",

	// Features
	ANALYTICS_ENABLED: "analyticsEnabled",
};
