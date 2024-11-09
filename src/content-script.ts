import { solve_captcha } from "./evaluate";
import {
  Account,
  ANALYTICS_ENDPOINT,
  ResultTypes,
  SolveResult,
  TMS_DASHBOARD_PATTERN,
} from "./interface";

const RELOAD_LIMIT = 3;
const DELAY_MS = 2000;

let reload_counter = 0;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function reload_captcha() {
  document
    ?.querySelector('[aria-label="Reload captcha"]')
    ?.dispatchEvent(new Event("click"));
}

// Memoize account lookup to prevent repeated storage calls
const getMatchingAccount = (() => {
  let cachedAccount: Account | null = null;
  let cachedBrokerNumber: string | null = null;

  return async (url: string): Promise<Account | null> => {
    const brokerMatch = url.match(
      /https:\/\/tms(\d+)\.nepsetms\.com\.np\/login/
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
          acc.broker?.toString().padStart(2, "0") === brokerNumber
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

// Helper function for input field handling
const setInputValue = (selector: string, value: string) => {
  const field = document.querySelector(selector) as HTMLInputElement;
  if (field) {
    field.value = value;
    field.dispatchEvent(new Event("input"));
  }
};

async function handle_result(result: SolveResult) {
  switch (result.type) {
    case ResultTypes.Success: {
      const currentUrl = window.location.href;
      const account = await getMatchingAccount(currentUrl);

      if (!account) return;

      // Set form values
      setInputValue(
        'input[placeholder="Client Code/ User Name"]',
        account.username
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

    case ResultTypes.LowConfidence: {
      break;
    }

    case ResultTypes.InvalidLength: {
      break;
    }
  }

  if (reload_counter > RELOAD_LIMIT) {
    return;
  }

  reload_counter++;
  reload_captcha();
}

const target = document?.querySelector(
  ".form-control.captcha-image-dimension.col-10"
);

window.onload = async () => {
  let captcha_blob_url = target?.getAttribute("src");

  if (
    !captcha_blob_url?.includes("captcha-image.jpg") &&
    captcha_blob_url != null &&
    captcha_blob_url != undefined
  ) {
    let result = await solve_captcha(captcha_blob_url);

    handle_result(result);
  } else {
    console.log("Captcha hasn't loaded!");
  }
};

const config = {
  attributes: true,
  childList: false,
  subtree: false,
};

const observer = new MutationObserver(async (mutation_list, _) => {
  let mutated = mutation_list.filter((item) => item.attributeName === "src")[0];

  let target_element = mutated.target as HTMLElement;
  let captcha_blob_url = target_element.getAttribute("src");

  if (!captcha_blob_url) {
    return;
  }

  let result = await solve_captcha(captcha_blob_url);

  handle_result(result);
});

observer.observe(target!, config);
