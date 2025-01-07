import { Chart } from "../chart/chart";
import type { ChartDataPoint, OtherChartDataArray } from "../chart/interfact";
import {
	type Account,
	type IndexKey,
	NEPSE_INDEX,
	type NepseData,
	NepseState,
	type OtherIndexDataMap,
	type OtherIndexKey,
	STORAGE_KEYS,
	SVG_ICONS,
	type SocketMessage,
} from "../interface";
import {
	loadDefaultNepseData,
	loadDefaultNepseIndexData,
	loadNepseOpen,
} from "../utils";
import { backupAccounts, restoreAccounts } from "./backup";
import { initializeDashboard } from "./dashboard";
import { showNotification } from "./notification";
import { initThemeToggle } from "./theme";

let chartInstance: Chart | null = null;
let scheduledFrame: number | null = null;

function connectToServiceWorker() {
	chrome.runtime.sendMessage(
		{ type: "CHECK_SOCKET_CONNECTION" },
		(response) => {
			if (!response?.needsReconnect) {
				const port = chrome.runtime.connect({ name: "popup" });

				port.onMessage.addListener((message: SocketMessage) => {
					if (message.type === "NEPSE_COMBINED_UPDATE") {
						const { data, isOpen, dashboardIndexChart } = message.payload;
						if (data) state.nepseData = data;
						if (Object.values(NepseState).includes(isOpen))
							state.isOpen = isOpen;
						if (dashboardIndexChart && chartInstance) {
							state.dashboardIndexChart = dashboardIndexChart;
							chartInstance.updateData(dashboardIndexChart);
							chartInstance.render();
						}
						updateNepseUI();
					}

					if (message.type === "OTHER_INDEX_UPDATE") {
						const { indexes, charts } = message.payload;
						if (indexes) state.otherIndexData = indexes;
						if (charts) state.otherIntradayChart = charts;
					}
				});
			}
		},
	);
}

// State management
export const state = {
	accounts: [] as Account[],
	editingAccount: null as string | null,
	isAnalyticsEnabled: true,
	activeTab: "nepse" as "nepse" | "tms" | "meroshare",
	isNepseEnabled: true,
	isOpen: NepseState.CLOSE as NepseState,
	nepseData: {} as NepseData,
	dashboardIndexChart: [] as ChartDataPoint[],
	otherDashboard: [NEPSE_INDEX] as IndexKey[], //holds what other dashboard are selected
	activeDashboard: NEPSE_INDEX as IndexKey, //current active dashboard
	otherIndexData: {} as OtherIndexDataMap, //holds other index data
	otherIntradayChart: [] as OtherChartDataArray, //holds other intraday chart data
	get currentIndex() {
		return this.activeDashboard === NEPSE_INDEX
			? this.nepseData
			: this.otherIndexData[this.activeDashboard as OtherIndexKey];
	},
	get currentIndexChart() {
		return this.activeDashboard === NEPSE_INDEX
			? this.dashboardIndexChart
			: this.otherIntradayChart.find(
					(chart) => chart.type === state.activeDashboard,
				)?.data || [];
	},
};

// DOM Elements
const elements = {
	header: document.querySelector(".header") as HTMLElement,
	accountsList: document.getElementById("accountsList") as HTMLDivElement,
	meroshareList: document.getElementById(
		"meroshareAccountsList",
	) as HTMLDivElement,
	form: document.getElementById("accountForm") as HTMLFormElement,
	addAccountSection: document.getElementById(
		"addAccountSection",
	) as HTMLDivElement,
	accountsSection: document.getElementById("accountsSection") as HTMLDivElement,
	analyticsBtn: document.getElementById("analyticsBtn") as HTMLButtonElement,
	nepseToggle: document.getElementById("nepseBtn") as HTMLButtonElement,
	nepseTab: document.getElementById("nepseTab") as HTMLDivElement,
	tmsContent: document.getElementById("tmsContent") as HTMLDivElement,
	nepseDataTab: document.querySelector('[data-tab="nepse"]') as HTMLElement,
	tmsDataTab: document.querySelector('[data-tab="tms"]') as HTMLElement,

	nepseQuery: document.querySelector("#nepseTab") as HTMLElement,
	tmsQuery: document.querySelector("#tmsContent") as HTMLElement,
	chartCanvas: document.getElementById("nepseChart") as HTMLCanvasElement,

	//other nepse elements
	time: document.getElementById("nepseTime") as HTMLSpanElement,
	open: document.getElementById("nepseOpen") as HTMLSpanElement,
	high: document.getElementById("nepseHigh") as HTMLSpanElement,
	low: document.getElementById("nepseLow") as HTMLSpanElement,
	close: document.getElementById("nepseClose") as HTMLSpanElement,
	change: document.getElementById("nepseChange") as HTMLSpanElement,
	turnover: document.getElementById("nepseTurnover") as HTMLSpanElement,
	shareTraded: document.getElementById("nepseTraded") as HTMLSpanElement,
	transaction: document.getElementById("nepseTransaction") as HTMLSpanElement,
	scriptTraded: document.getElementById("nepseScriptTraded") as HTMLSpanElement,
	pClose: document.getElementById("nepsePreviousClose") as HTMLSpanElement,

	statusText: document.querySelector(".status-text") as HTMLSpanElement,
	statusIndicator: document.querySelector(
		".status-indicator",
	) as HTMLDivElement,
	indexDisplay: document.querySelector(".index-display") as HTMLDivElement,
	chartContainer: document.querySelector(".chart-container") as HTMLDivElement,
	changeIndicator: document.querySelector(
		".change-indicator",
	) as HTMLDivElement,
};

// Core initialization
async function init() {
	await Promise.all([loadAccounts(), loadAnalyticsState(), loadNepseState()]);
	if (state.isNepseEnabled) connectToServiceWorker();
	setupEventListeners();
	setupTabSwitching();
	renderAccountsList();
	setupMenu();
	elements.addAccountSection.classList.add("hidden");
	initializeDashboard();

	// Initialize correct content visibility based on Nepse state

	if (!state.isNepseEnabled) {
		if (elements.nepseTab) elements.nepseTab.style.display = "none";
		if (elements.tmsContent) elements.tmsContent.style.display = "block";

		// Ensure TMS tab is active
		elements.nepseDataTab?.classList.remove("active");
		elements.tmsDataTab?.classList.add("active");
		state.activeTab = "tms";
	}

	updateNepseToggleUI();
}

async function toggleAnalytics() {
	state.isAnalyticsEnabled = !state.isAnalyticsEnabled;
	await chrome.storage.local.set({
		analyticsEnabled: state.isAnalyticsEnabled,
	});
	updateAnalyticsButton();
	showNotification(
		`Analytics ${state.isAnalyticsEnabled ? "enabled" : "disabled"}!`,
		"success",
	);
}

function createChartCanvas() {
	if (!elements.chartCanvas) return;

	if (!chartInstance) {
		chartInstance = new Chart(elements.chartCanvas, state.currentIndexChart);
	} else {
		chartInstance.updateData(state.currentIndexChart);
	}
	chartInstance.render();
}

export function updateNepseUI() {
	if (!state.nepseData) return;

	if (scheduledFrame) cancelAnimationFrame(scheduledFrame);

	scheduledFrame = requestAnimationFrame(() => {
		createChartCanvas();

		const {
			time = Date.now(),
			open = null,
			high = null,
			low = null,
			close = null,
			change = 0,
			turnover = null,
			totalTradedShared = null,
			totalTransactions = null,
			totalScripsTraded = null,
			previousClose = null,
			percentageChange = 0,
		} = state.currentIndex;

		const isPositive = change >= 0;
		const newChange = isPositive ? "positive" : "negative";

		if (elements.statusText && elements.statusIndicator) {
			const stateClass = String(state.isOpen)
				.toLowerCase()
				.replace(/\s+/g, "-");

			elements.statusText.textContent = `Market ${state.isOpen}`;
			elements.statusText.className = `status-text ${stateClass}`;
			elements.statusIndicator.className = `status-indicator ${stateClass}`;
		}

		if (elements.indexDisplay) {
			const hasNewClass = elements.indexDisplay.classList.contains(newChange);
			if (!hasNewClass) {
				elements.indexDisplay.classList.remove("positive", "negative");
				elements.indexDisplay.classList.add(newChange);
			}
		}

		// Update chart container colors
		if (elements.chartContainer) {
			if (!elements.chartContainer.classList.contains(newChange)) {
				elements.chartContainer.classList.remove("positive", "negative");
				elements.chartContainer.classList.add(newChange);

				// Only recreate chart if classes changed
				if (elements.chartCanvas && chartInstance) {
					chartInstance.updateStyle();
				}
			}
		}

		if (elements.change) {
			const formattedChange =
				change > 0 ? `+${String(change)}` : String(change);
			elements.change.textContent = `${formattedChange} / ${String(percentageChange)}%`;
		}

		if (elements.changeIndicator) {
			elements.changeIndicator.classList.remove(
				"positive",
				"negative",
				"open",
				"close",
			);
			elements.changeIndicator.classList.add(
				newChange,
				state.isOpen.toLowerCase(),
			);
		}

		if (elements.time) {
			elements.time.textContent = time.toLocaleString();
		}

		if (elements.open) {
			elements.open.textContent = open;
		}

		if (elements.high) {
			elements.high.textContent = high ?? "-";
		}

		if (elements.low) {
			elements.low.textContent = low ?? "-";
		}

		if (elements.close) {
			elements.close.textContent = close;
		}

		if (elements.turnover) {
			elements.turnover.textContent = turnover;
		}

		if (elements.shareTraded) {
			elements.shareTraded.textContent = totalTradedShared ?? "-";
		}

		if (elements.transaction) {
			elements.transaction.textContent = totalTransactions ?? "-";
		}

		if (elements.scriptTraded) {
			elements.scriptTraded.textContent = totalScripsTraded ?? "-";
		}

		if (elements.pClose) {
			elements.pClose.textContent = previousClose ?? "-";
		}
	});
}

export function updateNepseToggleUI() {
	elements.nepseToggle.textContent = state.isNepseEnabled
		? "Disable Update"
		: "Enable Update";
	elements.nepseToggle.classList.toggle("active", state.isNepseEnabled);

	if (elements.nepseDataTab)
		elements.nepseDataTab.style.display = state.isNepseEnabled
			? "block"
			: "none";

	if (!state.isNepseEnabled) {
		if (elements.nepseQuery) {
			elements.nepseQuery.style.display = "none";
		}

		if (elements.nepseDataTab?.classList.contains("active")) {
			elements.nepseDataTab.classList.remove("active");
			elements.tmsDataTab?.classList.add("active");
			if (elements.tmsQuery) {
				elements.tmsQuery.style.display = "block";
			}
		}
		state.activeTab = "tms";
	}
}

export async function loadNepseState(): Promise<void> {
	try {
		const isEnabled = await chrome.storage.local.get([
			STORAGE_KEYS.NEPSE_ENABLED,
		]);

		state.isNepseEnabled = isEnabled.isNepseEnabled ?? state.isNepseEnabled;
		updateNepseToggleUI();

		if (!state.isNepseEnabled) return;

		const storage = await chrome.storage.local.get([
			STORAGE_KEYS.NEPSE_DATA,
			STORAGE_KEYS.NEPSE_STATE,
			STORAGE_KEYS.NEPSE_CHART_DATA,
			STORAGE_KEYS.ACTIVE_DASHBOARD,
			STORAGE_KEYS.OTHER_DASHBOARD,
		]);

		if (storage.activeDashboard) {
			state.activeDashboard = storage.activeDashboard as IndexKey;
		}

		if (storage.otherDashboard) {
			const otherStorage = await chrome.storage.local.get([
				STORAGE_KEYS.OTHER_INDEXES,
				STORAGE_KEYS.OTHER_INTRADAY_CHART,
			]);

			if (otherStorage.otherIndexes)
				state.otherIndexData = otherStorage.otherIndexes as OtherIndexDataMap;

			if (otherStorage.otherIntradayChart)
				state.otherIntradayChart =
					otherStorage.otherIntradayChart as OtherChartDataArray;
		}

		//validate data and load default if not present
		if (
			!storage.nepseData ||
			storage.isNepseOpen === undefined ||
			!storage.nepseChartData ||
			storage.nepseChartData.length === 0
		) {
			const [[nepseData, indexDataMap], nepseOpen, indexChartData] =
				await Promise.all([
					loadDefaultNepseData(),
					loadNepseOpen(),
					loadDefaultNepseIndexData(),
				]);

			state.isOpen = nepseOpen;
			state.nepseData = nepseData;
			state.dashboardIndexChart = indexChartData;
			state.otherIndexData = indexDataMap;
		} else {
			state.isOpen = storage.isNepseOpen;
			state.nepseData = storage.nepseData;
			state.dashboardIndexChart = storage.nepseChartData;
		}

		updateNepseUI();
	} catch (error) {
		console.error("Error loading NEPSE data:", error);
	}
}

async function toggleNepseUpdates() {
	const isEnabled = !state.isNepseEnabled;
	state.isNepseEnabled = isEnabled;

	await Promise.all([
		chrome.storage.local.set({ isNepseEnabled: isEnabled }),
		chrome.runtime.sendMessage({
			type: "TOGGLE_NEPSE_UPDATES",
			payload: isEnabled,
		}),
	]);

	showNotification(
		`Nepse Updates ${isEnabled ? "enabled" : "disabled"}!`,
		"success",
	);

	if (isEnabled) {
		await loadNepseState();
	}
	updateNepseToggleUI();
}

function setupMenu() {
	const menuBtn = document.getElementById("menuBtn");
	const menuContent = document.getElementById("menuContent");
	const backupBtn = document.getElementById("backupBtn");
	const restoreBtn = document.getElementById("restoreBtn");
	const privacyBtn = document.getElementById("privacyBtn");
	const termsBtn = document.getElementById("termsBtn");

	if (!menuBtn || !menuContent) return;

	menuBtn?.addEventListener("click", (event) => {
		event.stopPropagation();
		menuContent?.classList.toggle("hidden");
	});

	document.addEventListener("click", () => {
		menuContent?.classList.add("hidden");
	});

	backupBtn?.addEventListener("click", () => {
		backupAccounts();
		menuContent?.classList.add("hidden");
	});

	restoreBtn?.addEventListener("click", () => {
		restoreAccounts();
		menuContent?.classList.add("hidden");
	});

	elements.nepseToggle?.addEventListener("click", () => {
		toggleNepseUpdates();
		menuContent?.classList.add("hidden");
	});

	elements.analyticsBtn?.addEventListener("click", () => {
		toggleAnalytics();
		menuContent?.classList.add("hidden");
	});

	privacyBtn?.addEventListener("click", () => {
		chrome.tabs.create({
			url: "https://www.surajrimal.dev/tmsextension/privacy",
		});
		menuContent?.classList.add("hidden");
	});

	termsBtn?.addEventListener("click", () => {
		chrome.tabs.create({
			url: "https://www.surajrimal.dev/tmsextension/terms",
		});
		menuContent?.classList.add("hidden");
	});
}

async function loadAnalyticsState() {
	const { analyticsEnabled } = await chrome.storage.local.get(
		STORAGE_KEYS.ANALYTICS_ENABLED,
	);
	state.isAnalyticsEnabled = analyticsEnabled !== false;
	updateAnalyticsButton();
}

function resetForm() {
	elements.form.reset();
	const formTitle = document.getElementById("formTitle");
	if (formTitle) {
		formTitle.textContent = state.editingAccount
			? "Edit Account"
			: "Add New Account";
	}
}

function createEmptyState(message: string): HTMLDivElement {
	const emptyState = document.createElement("div");
	emptyState.className = "empty-state";
	emptyState.textContent = message;
	return emptyState;
}

function createBadge(text: string, className: string): HTMLSpanElement {
	const badge = document.createElement("span");
	badge.className = className;
	badge.textContent = text;
	return badge;
}

function createAccountActions(account: Account): HTMLDivElement {
	const actions = document.createElement("div");
	actions.className = "account-actions";

	const fragment = document.createDocumentFragment();

	const buttonConfigs = [
		{
			className: "edit-action",
			icon: SVG_ICONS.edit,
			handler: () => handleEditAccount(account),
		},
		{
			className: "primary-action",
			icon: account.isPrimary
				? SVG_ICONS.primaryFilled
				: SVG_ICONS.primaryOutline,
			handler: async () => makePrimary(account),
		},
		{
			className: "delete-action",
			icon: SVG_ICONS.delete,
			handler: () => handleDeleteAccount(account),
		},
	];

	for (const { className, icon, handler } of buttonConfigs) {
		const button = document.createElement("button");
		button.className = `btn-action ${className}`;
		button.innerHTML = icon;
		button.addEventListener("click", handler);
		fragment.appendChild(button);
	}

	actions.appendChild(fragment);
	return actions;
}

async function handleEditAccount(account: Account) {
	state.editingAccount = account.alias;
	const form = elements.form;

	const brokerInput = form.querySelector<HTMLInputElement>('[name="broker"]');
	if (brokerInput) {
		brokerInput.value = account.broker.toString();
	}
	const aliasInput = form.querySelector<HTMLInputElement>('[name="alias"]');
	if (aliasInput) {
		aliasInput.value = account.alias;
	}
	const usernameInput =
		form.querySelector<HTMLInputElement>('[name="username"]');
	if (usernameInput) {
		usernameInput.value = account.username;
	}
	const passwordInput =
		form.querySelector<HTMLInputElement>('[name="password"]');
	if (passwordInput) {
		passwordInput.value = account.password;
	}
	const isPrimaryInput =
		form.querySelector<HTMLInputElement>('[name="isPrimary"]');
	if (isPrimaryInput) {
		isPrimaryInput.checked = account.isPrimary;
	}

	const accountTypeInputs = form.querySelectorAll<HTMLInputElement>(
		'[name="accountType"]',
	);
	for (const input of accountTypeInputs) {
		input.checked = input.value === account.type;
	}

	showAddAccountForm();
}

async function handleDeleteAccount(account: Account) {
	if (!confirm(`Are you sure you want to delete ${account.alias}?`)) return;

	try {
		state.accounts = state.accounts.filter(
			(acc) => acc.alias !== account.alias,
		);
		await saveAccounts();
		renderAccountsList();
		showNotification("Account deleted successfully!", "success");
	} catch (error) {
		showNotification(`Error deleting account: ${error}`, "error");
	}
}

async function makePrimary(account: Account) {
	if (account.type === "meroshare") {
		state.accounts = state.accounts.map((acc) => ({
			...acc,
			isPrimary:
				acc.type === "meroshare" ? acc.alias === account.alias : acc.isPrimary,
		}));

		ensureSingleMerosharePrimary();
	} else if (account.type === "tms") {
		state.accounts = state.accounts.map((acc) => ({
			...acc,
			isPrimary:
				acc.type === "tms" && acc.broker === account.broker
					? acc.alias === account.alias
					: acc.isPrimary,
		}));

		ensureTMSPrimaryPerBroker();
	}

	await saveAccounts();
	renderAccountsList();
	showNotification("Primary account updated successfully!", "success");
}

export function updateAnalyticsButton() {
	if (elements.analyticsBtn) {
		elements.analyticsBtn.textContent = `${
			state.isAnalyticsEnabled ? "Disable" : "Enable"
		} Analytics`;
	}
}

// Account Management
async function loadAccounts() {
	try {
		const result = await chrome.storage.local.get(STORAGE_KEYS.ACCOUNTS);
		state.accounts = result.accounts || [];
		ensureSingleMerosharePrimary();
		ensureTMSPrimaryPerBroker();
		await saveAccounts();
	} catch (error) {
		showNotification(`Error loading accounts: ${error}`, "error");
	}
}

function ensureSingleMerosharePrimary() {
	let foundPrimary = false;
	state.accounts = state.accounts.map((acc) => {
		if (acc.type !== "meroshare") return acc;
		if (!foundPrimary && acc.isPrimary) {
			foundPrimary = true;
			return acc;
		}
		return { ...acc, isPrimary: false };
	});

	if (!foundPrimary) {
		const firstMeroshare = state.accounts.find(
			(acc) => acc.type === "meroshare",
		);
		if (firstMeroshare) {
			state.accounts = state.accounts.map((acc) =>
				acc.alias === firstMeroshare.alias ? { ...acc, isPrimary: true } : acc,
			);
		}
	}
}

function ensureTMSPrimaryPerBroker() {
	const brokers = new Set(
		state.accounts.filter((acc) => acc.type === "tms").map((acc) => acc.broker),
	);

	for (const broker of brokers) {
		const brokerAccounts = state.accounts.filter(
			(acc) => acc.type === "tms" && acc.broker === broker,
		);

		const hasPrimary = brokerAccounts.some((acc) => acc.isPrimary);
		if (brokerAccounts.length > 0 && !hasPrimary) {
			const firstBrokerAccount = brokerAccounts[0];
			state.accounts = state.accounts.map((acc) =>
				acc.alias === firstBrokerAccount.alias
					? { ...acc, isPrimary: true }
					: acc,
			);
		}
	}
}

// Event Listeners
function setupEventListeners() {
	elements.form.addEventListener("submit", handleFormSubmit);
	document
		.getElementById("addAccountBtn")
		?.addEventListener("click", showAddAccountForm);
	document
		.getElementById("closeFormBtn")
		?.addEventListener("click", hideAddAccountForm);
	document
		.getElementById("cancelBtn")
		?.addEventListener("click", hideAddAccountForm);
}

function setupTabSwitching() {
	const tabButtons = document.querySelectorAll(".tab-button");
	const nepseContent = document.getElementById("nepseTab");
	const tmsContent = document.getElementById("tmsContent");
	const meroshareContent = document.getElementById("meroshareContent");

	for (const button of tabButtons) {
		button.addEventListener("click", () => {
			const tab = button.getAttribute("data-tab") as
				| "nepse"
				| "tms"
				| "meroshare";
			if (tab === "nepse" && !state.isNepseEnabled) {
				return;
			}

			for (const btn of tabButtons) {
				btn.classList.remove("active");
			}
			button.classList.add("active");
			state.activeTab = tab;

			if (nepseContent) nepseContent.style.display = "none";
			if (tmsContent) tmsContent.style.display = "none";
			if (meroshareContent) meroshareContent.style.display = "none";

			if (tab === "nepse" && state.isNepseEnabled) {
				if (nepseContent) nepseContent.style.display = "block";
			} else if (tab === "tms") {
				if (tmsContent) tmsContent.style.display = "block";
			} else if (tab === "meroshare") {
				if (meroshareContent) meroshareContent.style.display = "block";
			}

			renderAccountsList();
		});
	}
}

// Form Handling
async function handleFormSubmit(event: Event) {
	event.preventDefault();

	try {
		const formData = new FormData(elements.form);
		const account: Account = {
			type: formData.get("accountType") as "tms" | "meroshare",
			broker: formData.get("broker") as unknown as number,
			alias:
				state.editingAccount || (formData.get("alias") as string)?.trim() || "",
			username: (formData.get("username") as string)?.trim() || "",
			password: (formData.get("password") as string)?.trim() || "",
			isPrimary: formData.get("isPrimary") === "on",
		};

		if (!account.alias) {
			showNotification("Account alias is required", "error");
			return;
		}

		if (state.editingAccount) {
			await updateAccount(account);
		} else {
			if (state.accounts.some((acc) => acc.alias === account.alias)) {
				showNotification("Account alias must be unique", "error");
				return;
			}
			await addAccount(account);
		}

		hideAddAccountForm();
		showNotification("Account saved successfully!", "success");
	} catch (error) {
		showNotification(`Error saving account: ${error}`, "error");
	}
}

// UI Management
function showAddAccountForm() {
	if (!state.editingAccount) {
		resetForm();
	}
	elements.addAccountSection.classList.remove("hidden");
	elements.accountsSection.classList.add("hidden");
}

function hideAddAccountForm() {
	resetForm();
	state.editingAccount = null;
	elements.addAccountSection.classList.add("hidden");
	elements.accountsSection.classList.remove("hidden");
}

// Account Operations
async function addAccount(account: Account) {
	account.type === "meroshare"
		? handleMeroshareAccountAdd(account)
		: handleTMSAccountAdd(account);

	state.accounts.push(account);
	await saveAccounts();
	renderAccountsList();
}

function handleMeroshareAccountAdd(account: Account) {
	if (account.isPrimary) {
		state.accounts = state.accounts.map((acc) => ({
			...acc,
			isPrimary: acc.type === "meroshare" ? false : acc.isPrimary,
		}));
	} else {
		const meroshareAccounts = state.accounts.filter(
			(acc) => acc.type === "meroshare",
		);
		if (meroshareAccounts.length === 0) {
			account.isPrimary = true;
		}
	}
}

function handleTMSAccountAdd(account: Account) {
	if (account.isPrimary) {
		state.accounts = state.accounts.map((acc) => ({
			...acc,
			isPrimary:
				acc.type === "tms" && acc.broker === account.broker
					? false
					: acc.isPrimary,
		}));
	} else {
		const brokerAccounts = state.accounts.filter(
			(acc) => acc.type === "tms" && acc.broker === account.broker,
		);
		if (brokerAccounts.length === 0) {
			account.isPrimary = true;
		}
	}
}

async function updateAccount(updatedAccount: Account) {
	if (!state.editingAccount) throw new Error("No account being edited");

	const accountIndex = state.accounts.findIndex(
		(acc) => acc.alias === state.editingAccount,
	);
	if (accountIndex === -1) throw new Error("Account not found");

	const oldAccount = state.accounts[accountIndex];

	if (updatedAccount.type === "meroshare") {
		handleMeroshareAccountUpdate(updatedAccount, oldAccount);
	} else {
		handleTMSAccountUpdate(updatedAccount, oldAccount);
	}

	state.accounts[accountIndex] = updatedAccount;
	await saveAccounts();
	state.editingAccount = null;
	renderAccountsList();
}

function handleMeroshareAccountUpdate(
	updatedAccount: Account,
	oldAccount: Account,
) {
	if (updatedAccount.isPrimary) {
		state.accounts = state.accounts.map((acc) => ({
			...acc,
			isPrimary: acc.type === "meroshare" ? false : acc.isPrimary,
		}));
	} else if (oldAccount.isPrimary) {
		const otherMeroshareAccounts = state.accounts.filter(
			(acc) => acc.type === "meroshare" && acc.alias !== oldAccount.alias,
		);
		if (otherMeroshareAccounts.length > 0) {
			const firstAccount = otherMeroshareAccounts[0];
			state.accounts = state.accounts.map((acc) =>
				acc.alias === firstAccount.alias ? { ...acc, isPrimary: true } : acc,
			);
		} else {
			updatedAccount.isPrimary = true;
		}
	}
}

function handleTMSAccountUpdate(updatedAccount: Account, oldAccount: Account) {
	if (updatedAccount.isPrimary) {
		state.accounts = state.accounts.map((acc) => ({
			...acc,
			isPrimary:
				acc.type === "tms" &&
				acc.broker === updatedAccount.broker &&
				acc.alias !== oldAccount.alias
					? false
					: acc.isPrimary,
		}));
	} else if (oldAccount.isPrimary) {
		const sameBrokerAccounts = state.accounts.filter(
			(acc) =>
				acc.type === "tms" &&
				acc.broker === oldAccount.broker &&
				acc.alias !== oldAccount.alias,
		);
		if (sameBrokerAccounts.length > 0) {
			const firstAccount = sameBrokerAccounts[0];
			state.accounts = state.accounts.map((acc) =>
				acc.alias === firstAccount.alias ? { ...acc, isPrimary: true } : acc,
			);
		} else {
			updatedAccount.isPrimary = true;
		}
	}
}

// UI Rendering
export function renderAccountsList() {
	elements.accountsList.innerHTML = "";
	elements.meroshareList.innerHTML = "";

	const accounts = {
		tms: state.accounts.filter((acc) => acc.type === "tms"),
		meroshare: state.accounts.filter((acc) => acc.type === "meroshare"),
	};

	renderAccountGroup(
		elements.accountsList,
		accounts.tms,
		"No TMS accounts added yet.",
	);
	renderAccountGroup(
		elements.meroshareList,
		accounts.meroshare,
		"No Meroshare accounts added yet.",
	);
}

function renderAccountGroup(
	container: HTMLElement,
	accounts: Account[],
	emptyMessage: string,
) {
	const fragment = document.createDocumentFragment();

	if (accounts.length === 0) {
		fragment.appendChild(createEmptyState(emptyMessage));
	} else {
		for (const account of accounts) {
			fragment.appendChild(createAccountElement(account));
		}
	}

	container.innerHTML = ""; //not sure why
	container.appendChild(fragment);
}

function createAccountElement(account: Account): HTMLDivElement {
	const accountItem = document.createElement("div");
	accountItem.className = "account-item";

	const accountInfo = createAccountInfo(account);
	const actions = createAccountActions(account);

	accountItem.appendChild(accountInfo);
	accountItem.appendChild(actions);

	return accountItem;
}

function createAccountInfo(account: Account): HTMLDivElement {
	const accountInfo = document.createElement("div");
	accountInfo.className = "account-info";

	const accountName = document.createElement("div");
	accountName.className = "account-name";
	accountName.textContent = account.alias;

	const brokerBadge = createBadge(
		account.type === "tms"
			? `Broker ${account.broker}`
			: `DP ${account.broker}`,
		"broker-badge",
	);
	accountName.appendChild(brokerBadge);

	if (account.isPrimary) {
		accountName.appendChild(createBadge("Primary", "primary-badge"));
	}

	const accountUsername = document.createElement("div");
	accountUsername.className = "account-username";
	accountUsername.textContent = account.username;

	accountInfo.appendChild(accountName);
	accountInfo.appendChild(accountUsername);

	return accountInfo;
}

export async function saveAccounts() {
	await chrome.storage.local.set({ accounts: state.accounts });
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", async () => {
	await initThemeToggle();
	await init();
});
