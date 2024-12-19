import type { ChartDataArray } from "./chart/interfact";

export enum ResultTypes {
	Success = 0,
	LowConfidence = 1,
	InvalidLength = 2,
}

export interface NepseOpenData {
	data: string;
	event: string;
	channel: string;
}

export interface NepseOpenMessage {
	message: boolean;
}

export interface NepseRawData {
	message: {
		data: NepseData;
	};
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
