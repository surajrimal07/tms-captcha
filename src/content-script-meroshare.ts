import {
  Account,
  ANALYTICS_ENDPOINT,
  AngularComponent,
  Config,
  CONFIG,
  Credentials,
  MEROSHARE_LOGIN_URL,
  MEROSHAREDASHBOARD_PATTERN,
  Select2Instance,
} from "./interface";

class FormHandler {
  private retryCount = 0;
  private form: HTMLFormElement | null = null;
  private readonly abortController: AbortController;

  constructor() {
    this.abortController = new AbortController();
  }

  public async initialize(): Promise<void> {
    if (document.readyState !== "complete") {
      window.addEventListener("load", () => this.initialize(), { once: true });
      return;
    }

    try {
      await this.waitForForm();
      await this.fillCredentials();
    } catch (error) {
      console.error("Error during form initialization:", error);
    }
  }

  public cleanup(): void {
    this.abortController.abort();
  }

  private async waitForForm(): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkForm = (): void => {
        this.form = document.querySelector<HTMLFormElement>(
          CONFIG.SELECTORS.FORM
        );

        if (this.form) {
          resolve();
        } else if (this.retryCount++ < CONFIG.MAX_RETRIES) {
          setTimeout(checkForm, CONFIG.RETRY_DELAY);
        } else {
          reject(new Error("Form not found after maximum retries"));
        }
      };
      checkForm();
    });
  }

  private async fillCredentials(): Promise<void> {
    const credentials = await this.getStoredCredentials();
    if (!credentials) return;

    await this.delay(CONFIG.INITIAL_DELAY);
    await this.fillDP(credentials.dp);
    await this.delay(300);

    await Promise.all([
      this.fillInput(CONFIG.SELECTORS.USERNAME, credentials.username),
      this.fillInput(CONFIG.SELECTORS.PASSWORD, credentials.password),
    ]);

    this.delay(500).then(() => this.submitForm());
  }

  private async getStoredCredentials(): Promise<Credentials | null> {
    try {
      const { accounts = [] } = await chrome.storage.local.get("accounts");
      const meroshareAccounts = accounts.filter(
        (acc: Account) => acc.type === "meroshare"
      );

      if (!meroshareAccounts.length) return null;

      const selectedAccount =
        meroshareAccounts.find((acc: Account) => acc.isPrimary) ||
        meroshareAccounts[0];

      return {
        dp: selectedAccount.broker.toString(),
        username: selectedAccount.username,
        password: selectedAccount.password,
      };
    } catch (error) {
      console.error("Error getting stored credentials:", error);
      return null;
    }
  }

  private async fillDP(dpValue: string): Promise<void> {
    const select2Element = await this.waitForElement(
      'select2[name="selectBranch"]'
    );
    if (!select2Element) return;

    const select2Container =
      document.querySelector<HTMLElement>(".select2-container");
    const nativeSelect = document.querySelector<HTMLSelectElement>(
      ".select2-hidden-accessible"
    );

    if (!select2Container || !nativeSelect) return;

    try {
      const targetOption = Array.from(nativeSelect.options).find((opt) =>
        opt.text.includes(dpValue)
      );

      if (!targetOption) {
        console.warn("Target option not found:", dpValue);
        return;
      }

      await this.updateSelect2Value(
        nativeSelect,
        targetOption,
        select2Container,
        select2Element
      );
    } catch (error) {
      console.error("Error setting Select2 value:", error);
    }
  }

  private async updateSelect2Value(
    nativeSelect: HTMLSelectElement,
    targetOption: HTMLOptionElement,
    select2Container: HTMLElement,
    select2Element: Element
  ): Promise<void> {
    nativeSelect.value = targetOption.value;

    const select2Instance = (window as any)
      .jQuery?.(nativeSelect)
      .data("select2") as Select2Instance | undefined;

    if (select2Instance) {
      select2Instance.trigger("select", {
        data: { id: targetOption.value, text: targetOption.text },
      });
    } else {
      const renderedElement = select2Container.querySelector<HTMLElement>(
        ".select2-selection__rendered"
      );
      if (renderedElement) {
        renderedElement.textContent = targetOption.text;
        renderedElement.setAttribute("title", targetOption.text);
      }
    }

    this.dispatchSelectEvents(nativeSelect);
    await this.updateAngularComponent(select2Element, targetOption.value);
    await this.delay(100);
  }

  private dispatchSelectEvents(element: HTMLElement): void {
    ["change", "select2:select"].forEach((eventType) => {
      element.dispatchEvent(new Event(eventType, { bubbles: true }));
    });
  }

  private async updateAngularComponent(
    element: Element,
    value: string
  ): Promise<void> {
    const ng = (window as any)["ng"];
    if (!ng) return;

    const ngElement = ng.probe(element);
    if (ngElement?.componentInstance) {
      const component = ngElement.componentInstance as AngularComponent;
      component.writeValue(value);
      component.onChange(value);
    }
  }

  private async fillInput(selector: string, value: string): Promise<void> {
    const input = document.querySelector<HTMLInputElement>(selector);
    if (!input) return;

    input.value = value;
    await this.updateAngularComponent(input, value);

    ["input", "change", "blur"].forEach((eventType) => {
      input.dispatchEvent(new Event(eventType, { bubbles: true }));
    });

    await this.delay(100);
  }

  private async submitForm(): Promise<void> {
    const button = document.querySelector<HTMLButtonElement>(
      CONFIG.SELECTORS.LOGIN_BUTTON
    );
    if (button && !button.disabled) {
      button.click();
      await this.handlePostSubmit();
    }
  }

  private async handlePostSubmit(): Promise<void> {
    await this.delay(1000);
    const [{ analyticsEnabled }, newUrl] = await Promise.all([
      chrome.storage.local.get("analyticsEnabled"),
      Promise.resolve(window.location.href),
    ]);

    if (MEROSHAREDASHBOARD_PATTERN.test(newUrl) && analyticsEnabled !== false) {
      try {
        await fetch(ANALYTICS_ENDPOINT, { mode: "no-cors" });
      } catch {
        // Silently fail
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(resolve, ms);
      this.abortController.signal.addEventListener("abort", () => {
        clearTimeout(timeoutId);
        resolve();
      });
    });
  }

  private async waitForElement(
    selector: string,
    timeout = 500
  ): Promise<Element | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const element = document.querySelector(selector);
      if (element) return element;
      await this.delay(100);
    }

    return null;
  }
}

class MeroShareHandler {
  private currentFormHandler: FormHandler | null = null;
  private initialized = false;

  constructor() {
    this.setupUrlChangeDetection();
    this.setupMutationObserver();
  }

  private setupUrlChangeDetection(): void {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.handleUrlChange();
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.handleUrlChange();
    };

    window.addEventListener("popstate", () => this.handleUrlChange());
  }

  private setupMutationObserver(): void {
    const observer = new MutationObserver(() => {
      if (this.shouldInitialize()) {
        this.initialize();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  private shouldInitialize(): boolean {
    return (
      window.location.href.includes(MEROSHARE_LOGIN_URL) &&
      !this.initialized &&
      document.querySelector(CONFIG.SELECTORS.FORM) !== null
    );
  }

  private handleUrlChange(): void {
    if (this.shouldInitialize()) {
      this.initialize();
    } else {
      this.cleanup();
    }
  }

  private cleanup(): void {
    if (this.currentFormHandler) {
      this.currentFormHandler.cleanup();
      this.currentFormHandler = null;
    }
    this.initialized = false;
  }

  public initialize(): void {
    if (!this.initialized) {
      this.cleanup();
      this.currentFormHandler = new FormHandler();
      this.currentFormHandler.initialize();
      this.initialized = true;
    }
  }
}

const meroShareHandler = new MeroShareHandler();
if (window.location.href.includes(MEROSHARE_LOGIN_URL)) {
  meroShareHandler.initialize();
}

export type { AngularComponent, Config, Credentials, Select2Instance };
