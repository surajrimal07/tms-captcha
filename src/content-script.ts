import { solve_captcha } from "./evaluate";
import {
  Account,
  ANALYTICS_ENDPOINT,
  ResultTypes,
  SolveResult,
  TMS_DASHBOARD_PATTERN,
} from "./interface";

const RELOAD_LIMIT = 3;

let reload_counter = 0;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function reload_captcha() {
  document
    ?.querySelector('[aria-label="Reload captcha"]')
    ?.dispatchEvent(new Event("click"));
}

async function getMatchingAccount(url: string): Promise<Account | null> {
  try {
    const brokerMatch = url.match(
      /https:\/\/tms(\d+)\.nepsetms\.com\.np\/login/
    );

    if (!brokerMatch) return null;

    const brokerNumber = brokerMatch[1];

    const result = await chrome.storage.local.get("accounts");
    const accounts: Account[] = result.accounts || [];

    const matchingAccounts = accounts.filter(
      (acc) =>
        acc.type === "tms" && // Filter TMS accounts only
        acc.broker?.toString().padStart(2, "0") === brokerNumber
    );

    if (matchingAccounts.length === 0) return null;

    return matchingAccounts.find((acc) => acc.isPrimary) || matchingAccounts[0];
  } catch (error) {
    return null;
  }
}

async function handle_result(result: SolveResult) {
  switch (result.type) {
    case ResultTypes.Success: {
      const currentUrl = window.location.href;
      const account = await getMatchingAccount(currentUrl);

      if (!account) {
        return;
      }

      const usernameField = document.querySelector(
        'input[placeholder="Client Code/ User Name"]'
      );
      if (usernameField) {
        (usernameField as HTMLInputElement).value = account!.username;
        usernameField.dispatchEvent(new Event("input"));
      }

      const passwordField = document.querySelector(
        'input[placeholder="Password"]'
      );
      if (passwordField) {
        (passwordField as HTMLInputElement).value = account!.password;
        passwordField.dispatchEvent(new Event("input"));
      }

      const submitButton = document.querySelector('input[value="Login"]');

      if (submitButton) {
        submitButton.dispatchEvent(new Event("click"));
      }

      await delay(2000);

      const [{ analyticsEnabled }, newUrl] = await Promise.all([
        chrome.storage.local.get("analyticsEnabled"),
        Promise.resolve(window.location.href),
      ]);

      if (TMS_DASHBOARD_PATTERN.test(newUrl) && analyticsEnabled !== false) {
        try {
          await fetch(ANALYTICS_ENDPOINT, {
            mode: "no-cors",
          }).catch(() => {});
        } catch {
          // Silently fail
        }
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
