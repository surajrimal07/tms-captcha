import { Chart } from "../chart/chart";
import type { ChartDataArray, ChartDataPoint } from "../chart/interfact";
import {
	loadDefaultNepseData,
	loadDefaultNepseIndexData,
	loadNepseOpen,
} from "../fetcher";
import { type Account, type NepseData, NepseState } from "../interface";

let chartInstance: Chart | null = null;
let scheduledFrame: number | null = null;

function connectToServiceWorker() {
	chrome.runtime.sendMessage(
		{ type: "CHECK_PUSHER_CONNECTION" },
		(response) => {
			if (!response?.needsReconnect) {
				const port = chrome.runtime.connect({ name: "popup" });

				port.onMessage.addListener(
					(message: {
						type: "NEPSE_COMBINED_UPDATE";
						payload: {
							data: NepseData | null;
							isOpen: NepseState;
							nepseIndexChart: ChartDataArray | null;
						};
					}) => {
						const { data, isOpen, nepseIndexChart } = message.payload;

						if (data) state.nepseData = data;
						state.isOpen = isOpen;

						if (nepseIndexChart && chartInstance) {
							state.nepseIndexChart = nepseIndexChart;
							chartInstance.updateData(nepseIndexChart);
							chartInstance.render();
						}
						updateNepseUI();
					},
				);
			}
		},
	);
}

// State management
const state = {
	accounts: [] as Account[],
	editingAccount: null as string | null,
	isAnalyticsEnabled: true,
	activeTab: "nepse" as "nepse" | "tms" | "meroshare",
	isNepseEnabled: true,
	isOpen: NepseState.CLOSE as NepseState,
	nepseData: {} as NepseData,
	nepseIndexChart: [] as ChartDataPoint[],
};

// DOM Elements
const elements = {
	accountsList: document.getElementById("accountsList") as HTMLDivElement,
	meroshareList: document.getElementById(
		"meroshareAccountsList",
	) as HTMLDivElement,
	form: document.getElementById("accountForm") as HTMLFormElement,
	addAccountSection: document.getElementById(
		"addAccountSection",
	) as HTMLDivElement,
	accountsSection: document.getElementById("accountsSection") as HTMLDivElement,
	notification: document.getElementById("notification") as HTMLDivElement,
	analyticsBtn: document.getElementById("analyticsBtn") as HTMLButtonElement,
	nepseToggle: document.getElementById("nepseBtn") as HTMLButtonElement,
	nepseTab: document.getElementById("nepseTab") as HTMLDivElement,
	chartCanvas: document.getElementById("nepseChart") as HTMLCanvasElement,

	//other nepse elements
	time: document.getElementById("nepseTime"),
	open: document.getElementById("nepseOpen"),
	high: document.getElementById("nepseHigh"),
	low: document.getElementById("nepseLow"),
	close: document.getElementById("nepseClose"),
	change: document.getElementById("nepseChange"),
	turnover: document.getElementById("nepseTurnover"),
	shareTraded: document.getElementById("nepseTraded"),
	transaction: document.getElementById("nepseTransaction"),
	scriptTraded: document.getElementById("nepseScriptTraded"),
	pClose: document.getElementById("nepsePreviousClose"),
	statusText: document.querySelector(".status-text"),
	statusIndicator: document.querySelector(".status-indicator"),
	indexDisplay: document.querySelector(".index-display"),
	chartContainer: document.querySelector(".chart-container"),
	changeIndicator: document.querySelector(".change-indicator"),
};

// Core initialization
async function init() {
	await loadAccounts();
	await loadAnalyticsState();
	await loadNepseState();
	if (state.isNepseEnabled) connectToServiceWorker();
	setupEventListeners();
	setupTabSwitching();
	setupMenu();
	renderAccountsList();
	elements.addAccountSection.classList.add("hidden");
	addMenuToHeader();

	// Initialize correct content visibility based on Nepse state
	const nepseContent = document.getElementById("nepseTab");
	const tmsContent = document.getElementById("tmsContent");

	if (!state.isNepseEnabled) {
		if (nepseContent) nepseContent.style.display = "none";
		if (tmsContent) tmsContent.style.display = "block";

		// Ensure TMS tab is active
		const nepseTab = document.querySelector('[data-tab="nepse"]');
		const tmsTab = document.querySelector('[data-tab="tms"]');
		nepseTab?.classList.remove("active");
		tmsTab?.classList.add("active");
		state.activeTab = "tms";
	}

	updateNepseToggleUI();
}

async function toggleAnalytics() {
	try {
		state.isAnalyticsEnabled = !state.isAnalyticsEnabled;
		await chrome.storage.local.set({
			analyticsEnabled: state.isAnalyticsEnabled,
		});
		updateAnalyticsButton();
		const menuAnalyticsBtn = document.getElementById("analyticsBtn");
		if (menuAnalyticsBtn) {
			menuAnalyticsBtn.textContent = `${
				state.isAnalyticsEnabled ? "Disable" : "Enable"
			} Analytics`;
		}
		showNotification(
			`Analytics ${state.isAnalyticsEnabled ? "enabled" : "disabled"}!`,
			"success",
		);
	} catch (error) {
		showNotification("Error updating analytics settings", "error");
	}
}

function updateNepseUI() {
	if (!state.nepseData) return;

	if (scheduledFrame) {
		cancelAnimationFrame(scheduledFrame);
	}

	scheduledFrame = requestAnimationFrame(() => {
		const {
			time,
			open,
			high,
			low,
			close,
			change,
			turnover,
			totalTradedShared,
			totalTransactions,
			totalScripsTraded,
			previousClose,
			totalCapitalization,
			percentageChange,
		} = state.nepseData;

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
			const hasNewClass = elements.chartContainer.classList.contains(newChange);
			if (!hasNewClass) {
				elements.chartContainer.classList.remove("positive", "negative");
				elements.chartContainer.classList.add(newChange);

				// Only recreate chart if classes changed
				if (elements.chartCanvas) {
					chartInstance = new Chart(
						elements.chartCanvas,
						state.nepseIndexChart,
					);
					chartInstance.render();
				}
			}
		}

		if (elements.change) {
			const formattedChange =
				change > 0 ? `+${String(change)}` : String(change);
			elements.change.textContent = `${formattedChange} / ${String(percentageChange)}%`;
		}

		if (elements.changeIndicator) {
			const hasNewClass =
				elements.changeIndicator.classList.contains(newChange);
			if (!hasNewClass) {
				elements.changeIndicator.classList.remove("positive", "negative");
				elements.changeIndicator.classList.add(newChange);
			}
		}

		if (elements.time) {
			const date = new Date(time ?? Date.now());
			//why? sometimes nepse api returns time as null
			elements.time.textContent = date.toLocaleString();
		}

		if (elements.open) {
			elements.open.textContent = open;
		}

		if (elements.high) {
			elements.high.textContent = high;
		}

		if (elements.low) {
			elements.low.textContent = low;
		}

		if (elements.close) {
			elements.close.textContent = close;
		}

		if (elements.turnover) {
			elements.turnover.textContent = turnover;
		}

		if (elements.shareTraded) {
			elements.shareTraded.textContent = totalTradedShared;
		}

		if (elements.transaction) {
			elements.transaction.textContent = totalTransactions;
		}

		if (elements.scriptTraded) {
			elements.scriptTraded.textContent = totalScripsTraded;
		}

		if (elements.pClose) {
			elements.pClose.textContent = totalCapitalization;
		}
	});
}

function updateNepseToggleUI() {
	const btn = elements.nepseToggle;
	const nepseTab = document.querySelector('[data-tab="nepse"]');
	const tmsTab = document.querySelector('[data-tab="tms"]');
	const nepseContent = document.querySelector("#nepseTab");
	const tmsContent = document.querySelector("#tmsContent");

	btn.textContent = state.isNepseEnabled ? "Disable Update" : "Enable Update";
	btn.classList.toggle("active", state.isNepseEnabled);

	if (nepseTab) {
		(nepseTab as HTMLElement).style.display = state.isNepseEnabled
			? "block"
			: "none";
	}

	if (!state.isNepseEnabled) {
		if (nepseContent) {
			(nepseContent as HTMLElement).style.display = "none";
		}

		if (nepseTab?.classList.contains("active")) {
			nepseTab.classList.remove("active");
			tmsTab?.classList.add("active");
			if (tmsContent) {
				(tmsContent as HTMLElement).style.display = "block";
			}
		}
		state.activeTab = "tms";
	}
}

async function loadNepseState(): Promise<void> {
	try {
		const storage = await chrome.storage.local.get([
			"isNepseEnabled",
			"nepseData",
			"isNepseOpen",
			"nepseChartData",
		]);

		state.isNepseEnabled = storage.isNepseEnabled ?? state.isNepseEnabled;
		updateNepseToggleUI();

		if (!state.isNepseEnabled) return;

		if (
			!storage.nepseData ||
			storage.isNepseOpen === undefined ||
			!storage.nepseChartData ||
			storage.nepseChartData.length === 0
		) {
			const [defaultData, nepseOpen, indexChartData] = await Promise.all([
				loadDefaultNepseData(),
				loadNepseOpen(),
				loadDefaultNepseIndexData(),
			]);

			state.isOpen = nepseOpen;
			state.nepseData = defaultData;
			state.nepseIndexChart = indexChartData;
		} else {
			state.isOpen = storage.isNepseOpen;
			state.nepseData = storage.nepseData;
			state.nepseIndexChart = storage.nepseChartData;
		}

		updateNepseUI();

		if (elements.chartCanvas) {
			chartInstance = new Chart(elements.chartCanvas, state.nepseIndexChart);
			chartInstance.render();
		}
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
	const analyticsBtn = document.getElementById("analyticsBtn");
	const privacyBtn = document.getElementById("privacyBtn");
	const termsBtn = document.getElementById("termsBtn");
	const nepseBtn = document.getElementById("nepseBtn");

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

	nepseBtn?.addEventListener("click", () => {
		toggleNepseUpdates();
		menuContent?.classList.add("hidden");
	});

	analyticsBtn?.addEventListener("click", () => {
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
	const { analyticsEnabled } =
		await chrome.storage.local.get("analyticsEnabled");
	state.isAnalyticsEnabled = analyticsEnabled !== false;
	updateAnalyticsButton();
}

function addMenuToHeader() {
	const header = document.querySelector(".header") as HTMLElement;
	const menuHtml = `
    <div class="menu-dropdown">
      <div id="menuContent" class="menu-content hidden">
         <button id="nepseBtn">${
						state.isNepseEnabled ? "Disable" : "Enable"
					} Nepse Updates</button>
        <button id="analyticsBtn">
          ${state.isAnalyticsEnabled ? "Disable" : "Enable"} Analytics
        </button>
      </div>
    </div>
  `;
	header.insertAdjacentHTML("beforeend", menuHtml);
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

	const editButton = document.createElement("button");
	editButton.className = "btn-action";
	editButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>`;
	editButton.addEventListener("click", () => handleEditAccount(account));

	const deleteButton = document.createElement("button");
	deleteButton.className = "btn-action delete-action";
	deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>`;
	deleteButton.addEventListener("click", () => handleDeleteAccount(account));

	actions.appendChild(editButton);
	actions.appendChild(deleteButton);

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

// Backup and Restore functionality
function backupAccounts() {
	const backup = {
		accounts: state.accounts,
		timestamp: new Date().toISOString(),
	};

	const blob = new Blob([JSON.stringify(backup, null, 2)], {
		type: "application/json",
	});
	const url = URL.createObjectURL(blob);

	const a = document.createElement("a");
	a.href = url;
	a.download = `nepse-companion-backup-${
		new Date().toISOString().split("T")[0]
	}.json`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

async function restoreAccounts() {
	const input = document.createElement("input");
	input.type = "file";
	input.accept = ".json";

	input.onchange = async (e) => {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;

		try {
			const content = await file.text();
			const backup = JSON.parse(content);

			if (!backup.accounts || !Array.isArray(backup.accounts)) {
				throw new Error("Invalid backup file format");
			}

			state.accounts = backup.accounts;
			await saveAccounts();
			renderAccountsList();
			showNotification("Accounts restored successfully!", "success");
		} catch (error) {
			showNotification(`Error restoring backup: ${error}`, "error");
		}
	};

	input.click();
}

function updateAnalyticsButton() {
	const analyticsBtn = elements.analyticsBtn;
	if (analyticsBtn) {
		analyticsBtn.textContent = `${
			state.isAnalyticsEnabled ? "Disable" : "Enable"
		} Analytics`;
	}
}

// Account Management
async function loadAccounts() {
	try {
		const result = await chrome.storage.local.get("accounts");
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
	if (account.type === "meroshare") {
		handleMeroshareAccountAdd(account);
	} else {
		handleTMSAccountAdd(account);
	}

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
function renderAccountsList() {
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

// Utility Functions
function showNotification(message: string, type: "success" | "error") {
	if (!elements.notification) return;

	elements.notification.textContent = message;
	elements.notification.className = `notification ${type}`;
	elements.notification.classList.remove("hidden");

	setTimeout(() => {
		elements.notification.classList.add("hidden");
	}, 3000);
}

async function saveAccounts() {
	await chrome.storage.local.set({ accounts: state.accounts });
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
	init();
});
