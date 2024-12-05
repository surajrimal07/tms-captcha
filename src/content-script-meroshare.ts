import {
  ANALYTICS_ENDPOINT,
  type Account,
  type AngularComponent,
  CONFIG,
  type Config,
  type Credentials,
  MEROSHAREDASHBOARD_PATTERN,
  MEROSHARE_LOGIN_URL,
  type Select2Instance,
} from "./interface";

class FormHandler {
  private static readonly TIMEOUT = 500;
  private static readonly EVENT_TYPES = {
    INPUT: ["input", "change", "blur"] as const,
    SELECT: ["change", "select2:select"] as const,
  } as const;
  private static readonly ANIMATION_FRAME_DELAY = 500;

  private form: HTMLFormElement | null = null;
  private readonly abortController: AbortController;
  private readonly signals: { [key: string]: AbortController } = {};

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
    for (const controller of Object.values(this.signals)) {
      controller.abort();
    }
  }

  private async waitForForm(): Promise<void> {
    const form = await this.waitForElement(CONFIG.SELECTORS.FORM);
    if (!form) {
      throw new Error("Form not found");
    }
    this.form = form as HTMLFormElement;
  }

  private async fillCredentials(): Promise<void> {
    const credentials = await this.getStoredCredentials();
    if (!credentials) return;

    const signal = this.createSignal("credentials");

    try {
      // Batch DOM operations
      const updates = [
        this.fillDP(credentials.dp),
        this.fillInput(CONFIG.SELECTORS.USERNAME, credentials.username),
        this.fillInput(CONFIG.SELECTORS.PASSWORD, credentials.password),
      ];

      await Promise.all(updates);

      if (!signal.signal.aborted) {
        requestAnimationFrame(() => {
          setTimeout(
            () => this.submitForm(),
            FormHandler.ANIMATION_FRAME_DELAY
          );
        });
      }
    } finally {
      this.removeSignal("credentials");
    }
  }

  private createSignal(key: string): AbortController {
    const controller = new AbortController();
    this.signals[key] = controller;
    return controller;
  }

  private removeSignal(key: string): void {
    delete this.signals[key];
  }

  private async getStoredCredentials(): Promise<Credentials | null> {
    try {
      const { accounts = [] } = await chrome.storage.local.get("accounts");
      const selectedAccount =
        accounts.find(
          (acc: Account) => acc.type === "meroshare" && acc.isPrimary
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

  private async fillDP(dpValue: string): Promise<void> {
    const [select2Element, nativeSelect, select2Container] = await Promise.all([
      this.waitForElement('select2[name="selectBranch"]'),
      this.waitForElement(
        ".select2-hidden-accessible"
      ) as Promise<HTMLSelectElement | null>,
      this.waitForElement(".select2-container"),
    ]);

    if (!select2Element || !nativeSelect || !select2Container) return;

    const targetOption = Array.from(nativeSelect.options).find((opt) =>
      opt.text.includes(dpValue)
    );
    if (!targetOption) return;

    await this.updateSelect2Value(
      nativeSelect,
      targetOption,
      select2Container as HTMLElement,
      select2Element
    );
  }

  private async updateSelect2Value(
    nativeSelect: HTMLSelectElement,
    targetOption: HTMLOptionElement,
    select2Container: HTMLElement,
    select2Element: Element
  ): Promise<void> {
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
        ".select2-selection__rendered"
      );
      if (renderedElement) {
        renderedElement.textContent = targetOption.text;
        renderedElement.setAttribute("title", targetOption.text);
      }
    }

    this.dispatchEvents(nativeSelect, FormHandler.EVENT_TYPES.SELECT);
    await this.updateAngularComponent(select2Element, targetOption.value);
  }

  private dispatchEvents(
    element: HTMLElement,
    eventTypes: readonly string[]
  ): void {
    for (const eventType of eventTypes) {
      element.dispatchEvent(new Event(eventType, { bubbles: true }));
    }
  }

  private async updateAngularComponent(
    element: Element,
    value: string
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

  private async fillInput(selector: string, value: string): Promise<void> {
    const input = document.querySelector<HTMLInputElement>(selector);
    if (!input) return;

    input.value = value;
    await this.updateAngularComponent(input, value);
    this.dispatchEvents(input, FormHandler.EVENT_TYPES.INPUT);
  }

  private async submitForm(): Promise<void> {
    const button = document.querySelector<HTMLButtonElement>(
      CONFIG.SELECTORS.LOGIN_BUTTON
    );
    if (button?.disabled === false) {
      button.click();
      await this.handlePostSubmit();
    }
  }

  private async handlePostSubmit(): Promise<void> {
    const signal = this.createSignal("postSubmit");

    try {
      const [{ analyticsEnabled }, newUrl] = await Promise.all([
        chrome.storage.local.get("analyticsEnabled"),
        Promise.resolve(window.location.href),
      ]);

      if (
        !signal.signal.aborted &&
        MEROSHAREDASHBOARD_PATTERN.test(newUrl) &&
        analyticsEnabled !== false
      ) {
        fetch(ANALYTICS_ENDPOINT, { mode: "no-cors" }).catch(() => {});
      }
    } finally {
      this.removeSignal("postSubmit");
    }
  }

  private async waitForElement(
    selector: string,
    timeout = FormHandler.TIMEOUT
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
}

class MeroShareHandler {
  private static instance: MeroShareHandler;
  private currentFormHandler: FormHandler | null = null;
  private initialized = false;
  private readonly observer: MutationObserver;

  public static getInstance(): MeroShareHandler {
    if (!MeroShareHandler.instance) {
      MeroShareHandler.instance = new MeroShareHandler();
    }
    return MeroShareHandler.instance;
  }

  private constructor() {
    this.observer = new MutationObserver(this.handleDOMChanges.bind(this));
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
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  private handleDOMChanges(): void {
    if (this.shouldInitialize()) {
      this.initialize();
    }
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

// Initialize only once when the script loads
const meroShareHandler = MeroShareHandler.getInstance();
if (window.location.href.includes(MEROSHARE_LOGIN_URL)) {
  meroShareHandler.initialize();
}

export type { AngularComponent, Config, Credentials, Select2Instance };
