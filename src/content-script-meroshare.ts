import {
	ANALYTICS_ENDPOINT,
	type Account,
	type AngularComponent,
	CONFIG,
	type Config,
	type Credentials,
	MEROSHAREDASHBOARD_PATTERN,
	MEROSHARE_LOGIN_URL,
	STORAGE_KEYS,
	type Select2Instance,
} from "./interface";

// Constants
const TIMEOUT = 500;
const ANIMATION_FRAME_DELAY = 500;
const EVENT_TYPES = {
	INPUT: ["input", "change", "blur"] as const,
	SELECT: ["change", "select2:select"] as const,
} as const;

// Global state
let formHandler: AbortController | null = null;
let isInitialized = false;

// Helper functions
function createSignal(): AbortController {
	const controller = new AbortController();
	return controller;
}

function cleanup() {
	if (formHandler) {
		formHandler.abort();
		formHandler = null;
	}
	isInitialized = false;
}

async function waitForElement(
	selector: string,
	timeout = TIMEOUT,
): Promise<Element | null> {
	const element = document.querySelector(selector);
	if (element) return element;

	return new Promise((resolve) => {
		const observer = new MutationObserver((_, observer) => {
			const element = document.querySelector(selector);
			if (element) {
				observer.disconnect();
				resolve(element);
			}
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true,
		});

		setTimeout(() => {
			observer.disconnect();
			resolve(null);
		}, timeout);
	});
}

async function getStoredCredentials(): Promise<Credentials | null> {
	try {
		const { accounts = [] } = await chrome.storage.local.get(
			STORAGE_KEYS.ACCOUNTS,
		);
		const selectedAccount =
			accounts.find(
				(acc: Account) => acc.type === "meroshare" && acc.isPrimary,
			) || accounts.find((acc: Account) => acc.type === "meroshare");

		return selectedAccount
			? {
					dp: selectedAccount.broker.toString(),
					username: selectedAccount.username,
					password: selectedAccount.password,
				}
			: null;
	} catch (error) {
		console.error("Error getting stored credentials:", error);
		return null;
	}
}

function dispatchEvents(
	element: HTMLElement,
	eventTypes: readonly string[],
): void {
	for (const eventType of eventTypes) {
		element.dispatchEvent(new Event(eventType, { bubbles: true }));
	}
}

async function updateAngularComponent(
	element: Element,
	value: string,
): Promise<void> {
	const ng = (
		window as {
			ng?: {
				probe: (element: Element) => { componentInstance?: AngularComponent };
			};
		}
	).ng;
	if (!ng) return;

	const ngElement = ng.probe(element);
	if (ngElement?.componentInstance) {
		const component = ngElement.componentInstance as AngularComponent;
		component.writeValue(value);
		component.onChange(value);
	}
}

async function fillDP(dpValue: string, signal: AbortSignal): Promise<void> {
	const [select2Element, nativeSelect, select2Container] = await Promise.all([
		waitForElement('select2[name="selectBranch"]'),
		waitForElement(
			".select2-hidden-accessible",
		) as Promise<HTMLSelectElement | null>,
		waitForElement(".select2-container"),
	]);

	if (!select2Element || !nativeSelect || !select2Container || signal.aborted)
		return;

	const targetOption = Array.from(nativeSelect.options).find((opt) =>
		opt.text.includes(dpValue),
	);
	if (!targetOption) return;

	nativeSelect.value = targetOption.value;

	const select2Instance = (
		window as unknown as {
			jQuery?: (element: HTMLElement) => {
				data: (key: string) => Select2Instance | undefined;
			};
		}
	)
		.jQuery?.(nativeSelect)
		.data("select2") as Select2Instance | undefined;

	if (select2Instance) {
		select2Instance.trigger("select", {
			data: { id: targetOption.value, text: targetOption.text },
		});
	} else {
		const renderedElement = select2Container.querySelector<HTMLElement>(
			".select2-selection__rendered",
		);
		if (renderedElement) {
			renderedElement.textContent = targetOption.text;
			renderedElement.setAttribute("title", targetOption.text);
		}
	}

	dispatchEvents(nativeSelect, EVENT_TYPES.SELECT);
	await updateAngularComponent(select2Element, targetOption.value);
}

async function fillInput(
	selector: string,
	value: string,
	signal: AbortSignal,
): Promise<void> {
	const input = document.querySelector<HTMLInputElement>(selector);
	if (!input || signal.aborted) return;

	input.value = value;
	await updateAngularComponent(input, value);
	dispatchEvents(input, EVENT_TYPES.INPUT);
}

async function submitForm(signal: AbortSignal): Promise<void> {
	const button = document.querySelector<HTMLButtonElement>(
		CONFIG.SELECTORS.LOGIN_BUTTON,
	);
	if (button?.disabled === false && !signal.aborted) {
		button.click();
		await handlePostSubmit(signal);
	}
}

async function handlePostSubmit(signal: AbortSignal): Promise<void> {
	try {
		const [{ analyticsEnabled }, newUrl] = await Promise.all([
			chrome.storage.local.get("analyticsEnabled"),
			Promise.resolve(window.location.href),
		]);

		if (
			!signal.aborted &&
			MEROSHAREDASHBOARD_PATTERN.test(newUrl) &&
			analyticsEnabled !== false
		) {
			fetch(ANALYTICS_ENDPOINT, { mode: "no-cors" }).catch(() => {});
		}
	} catch (error) {
		console.error("Error handling post-submit:", error);
	}
}

async function fillCredentials(signal: AbortSignal): Promise<void> {
	const credentials = await getStoredCredentials();
	if (!credentials || signal.aborted) return;

	const updates = [
		fillDP(credentials.dp, signal),
		fillInput(CONFIG.SELECTORS.USERNAME, credentials.username, signal),
		fillInput(CONFIG.SELECTORS.PASSWORD, credentials.password, signal),
	];

	await Promise.all(updates);

	if (!signal.aborted) {
		requestAnimationFrame(() => {
			setTimeout(() => submitForm(signal), ANIMATION_FRAME_DELAY);
		});
	}
}

async function initializeFormHandler(): Promise<void> {
	if (document.readyState !== "complete") {
		window.addEventListener("load", () => initializeFormHandler(), {
			once: true,
		});
		return;
	}

	cleanup();
	formHandler = createSignal();

	try {
		const form = await waitForElement(CONFIG.SELECTORS.FORM);
		if (!form) throw new Error("Form not found");

		await fillCredentials(formHandler.signal);
	} catch (error) {
		console.error("Error during form initialization:", error);
		cleanup();
	}
}

function setupUrlChangeDetection(): void {
	const originalPushState = history.pushState;
	const originalReplaceState = history.replaceState;

	history.pushState = (...args) => {
		originalPushState.apply(history, args);
		handleUrlChange();
	};

	history.replaceState = (...args) => {
		originalReplaceState.apply(history, args);
		handleUrlChange();
	};

	window.addEventListener("popstate", () => handleUrlChange());
}

function handleUrlChange(): void {
	if (window.location.href.includes(MEROSHARE_LOGIN_URL)) {
		initializeFormHandler();
	} else {
		cleanup();
	}
}

function setupMutationObserver(): void {
	const observer = new MutationObserver(() => {
		if (window.location.href.includes(MEROSHARE_LOGIN_URL) && !isInitialized) {
			initializeFormHandler();
			isInitialized = true;
		}
	});

	observer.observe(document.body, {
		childList: true,
		subtree: true,
	});
}

// Initialize
if (window.location.href.includes(MEROSHARE_LOGIN_URL)) {
	setupUrlChangeDetection();
	setupMutationObserver();
	initializeFormHandler();
}

export type { AngularComponent, Config, Credentials, Select2Instance };
