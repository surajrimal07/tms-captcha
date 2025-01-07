import { solve_captcha } from "./evaluate";
import {
	ANALYTICS_ENDPOINT,
	type Account,
	ResultTypes,
	type SolveResult,
	TMS_DASHBOARD_PATTERN,
} from "./interface";

// Constants
const RELOAD_LIMIT = 3;
const DELAY_MS = 2000;

// Global state
let reloadCounter = 0;

// Helper functions
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const reloadCaptcha = () => {
	document
		.querySelector('[aria-label="Reload captcha"]')
		?.dispatchEvent(new Event("click"));
};

const getMatchingAccount = (() => {
	let cachedAccount: Account | null = null;
	let cachedBrokerNumber: string | null = null;

	return async (url: string): Promise<Account | null> => {
		const brokerMatch = url.match(
			/https:\/\/tms(\d+)\.nepsetms\.com\.np\/login/,
		);
		if (!brokerMatch) return null;

		const brokerNumber = brokerMatch[1];
		if (cachedAccount && cachedBrokerNumber === brokerNumber) {
			return cachedAccount;
		}

		try {
			const { accounts = [] } = await chrome.storage.local.get("accounts");
			const matchingAccounts = accounts.filter(
				(acc: Account) =>
					acc.type === "tms" &&
					acc.broker?.toString().padStart(2, "0") === brokerNumber,
			);
			cachedBrokerNumber = brokerNumber;
			cachedAccount =
				matchingAccounts.find((acc: Account) => acc.isPrimary) ||
				matchingAccounts[0] ||
				null;
			return cachedAccount;
		} catch {
			return null;
		}
	};
})();

const setInputValue = (selector: string, value: string) => {
	const field = document.querySelector(selector) as HTMLInputElement;
	if (field) {
		field.value = value;
		field.dispatchEvent(new Event("input"));
	}
};

const handleResult = async (result: SolveResult) => {
	switch (result.type) {
		case ResultTypes.Success: {
			const currentUrl = window.location.href;
			const account = await getMatchingAccount(currentUrl);

			if (!account) return;

			// Set form values
			setInputValue(
				'input[placeholder="Client Code/ User Name"]',
				account.username,
			);
			setInputValue('input[placeholder="Password"]', account.password);

			// Submit form
			document
				.querySelector('input[value="Login"]')
				?.dispatchEvent(new Event("click"));

			await delay(DELAY_MS);

			const [{ analyticsEnabled }, newUrl] = await Promise.all([
				chrome.storage.local.get("analyticsEnabled"),
				Promise.resolve(window.location.href),
			]);

			if (TMS_DASHBOARD_PATTERN.test(newUrl) && analyticsEnabled !== false) {
				fetch(ANALYTICS_ENDPOINT, { mode: "no-cors" }).catch(() => {});
			}
			return;
		}

		case ResultTypes.LowConfidence:
		case ResultTypes.InvalidLength: {
			break;
		}
	}

	if (reloadCounter >= RELOAD_LIMIT) return;

	reloadCounter++;
	reloadCaptcha();
};

const initializeCaptchaHandler = async () => {
	const target = document.querySelector(
		".form-control.captcha-image-dimension.col-10",
	);
	if (!target) {
		console.error("Target element for captcha not found.");
		return;
	}

	const captchaBlobUrl = target.getAttribute("src");
	if (!captchaBlobUrl?.includes("captcha-image.jpg")) {
		if (captchaBlobUrl) {
			const result = await solve_captcha(captchaBlobUrl);
			await handleResult(result);
		} else {
			console.log("Captcha hasn't loaded!");
		}
	}

	const observer = new MutationObserver(async (mutationList) => {
		const mutated = mutationList.find((item) => item.attributeName === "src");
		if (!mutated) return;

		const targetElement = mutated.target as HTMLElement;
		const captchaBlobUrl = targetElement.getAttribute("src");
		if (!captchaBlobUrl) return;

		const result = await solve_captcha(captchaBlobUrl);
		await handleResult(result);
	});

	observer.observe(target, {
		attributes: true,
		childList: false,
		subtree: false,
	});
};

// Initialize on window load
window.addEventListener("load", initializeCaptchaHandler);
