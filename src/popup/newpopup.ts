import { Account } from "../interface";

interface DOMElements {
  ACCOUNTS_LIST: HTMLDivElement;
  MEROSHARE_LIST: HTMLDivElement;
  ACCOUNT_FORM: HTMLFormElement;
  ADD_SECTION: HTMLDivElement;
  ACCOUNTS_SECTION: HTMLDivElement;
}

class PopupManager {
  private static readonly SELECTORS = {
    ACCOUNTS_LIST: "#accountsList",
    MEROSHARE_LIST: "#meroshareContent",
    ACCOUNT_FORM: "#accountForm",
    ADD_SECTION: "#addAccountSection",
    ACCOUNTS_SECTION: "#accountsSection",
  } as const;

  // Memoized DOM elements
  private readonly elements: DOMElements;
  private readonly accountsMap: Map<string, Account>;
  private accounts: Account[] = [];
  private editingAccount: string | null = null;
  private isAnalyticsEnabled = true;
  private activeTab: "tms" | "meroshare" = "tms";

  // Cache frequently used DOM elements
  private readonly notification: HTMLElement | null;
  private readonly formTitle: HTMLHeadingElement | null;
  private readonly submitButton: HTMLButtonElement | null;
  private readonly aliasInput: HTMLInputElement | null;

  constructor() {
    // Cache DOM elements with proper typing
    this.elements = this.initializeElements();
    this.accountsMap = new Map();

    // Cache frequently accessed elements
    this.notification = document.getElementById("notification");
    this.formTitle = document.getElementById("formTitle") as HTMLHeadingElement;
    this.submitButton = this.elements.ACCOUNT_FORM.querySelector(
      'button[type="submit"]'
    ) as HTMLButtonElement;
    this.aliasInput = this.elements.ACCOUNT_FORM.querySelector(
      "#alias"
    ) as HTMLInputElement;

    this.init();
    this.addMenuToHeader();
    this.setupBackupRestore();

    // Event delegation for dynamic elements
    this.elements.ACCOUNTS_SECTION.addEventListener(
      "click",
      this.handleAccountActions.bind(this)
    );
  }

  private initializeElements(): DOMElements {
    return Object.entries(PopupManager.SELECTORS).reduce(
      (acc, [key, selector]) => {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Element ${selector} not found`);
        acc[key as keyof DOMElements] = element as any;
        return acc;
      },
      {} as DOMElements
    );
  }

  private async init(): Promise<void> {
    await Promise.all([this.loadAccounts(), this.loadAnalyticsState()]);

    this.setupEventListeners();
    this.setupTabSwitching();
    this.renderAccountsList();
    this.elements.ADD_SECTION.classList.add("hidden");
  }

  private setupTabSwitching(): void {
    const tabButtons = document.querySelectorAll(".tab-button");
    const tmsContent = document.getElementById("tmsContent");
    const meroshareContent = document.getElementById("meroshareContent");

    const handleTabClick = (button: Element) => {
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      const tab = button.getAttribute("data-tab") as "tms" | "meroshare";
      this.activeTab = tab;

      if (tab === "tms") {
        tmsContent?.classList.remove("hidden");
        meroshareContent?.classList.add("hidden");
      } else {
        tmsContent?.classList.add("hidden");
        meroshareContent?.classList.remove("hidden");
      }

      this.renderAccountsList();
    };

    tabButtons.forEach((button) => {
      button.addEventListener("click", () => handleTabClick(button));
    });
  }

  private addMenuToHeader(): void {
    const header = document.querySelector(".header");
    if (!header) return;

    const menuHtml = `
      <div class="menu-dropdown">
        <button class="btn-menu" id="menuBtn">⋮</button>
        <div class="menu-content hidden" id="menuContent">
          <button id="analyticsBtn">Disable Analytics</button>
          <button id="backupBtn">Backup</button>
          <button id="restoreBtn">Restore</button>
        </div>
      </div>`;
    header.insertAdjacentHTML("beforeend", menuHtml);
  }

  private async loadAnalyticsState(): Promise<void> {
    try {
      const { analyticsEnabled } = await chrome.storage.local.get(
        "analyticsEnabled"
      );
      this.isAnalyticsEnabled = analyticsEnabled !== false;
      this.updateAnalyticsButton();
    } catch (error) {
      console.error("Error loading analytics state:", error);
    }
  }

  private async toggleAnalytics(): Promise<void> {
    try {
      this.isAnalyticsEnabled = !this.isAnalyticsEnabled;
      await chrome.storage.local.set({
        analyticsEnabled: this.isAnalyticsEnabled,
      });
      this.updateAnalyticsButton();
      this.showNotification(
        `Analytics ${this.isAnalyticsEnabled ? "enabled" : "disabled"}!`,
        "success"
      );
    } catch (error) {
      this.showNotification("Error updating analytics settings", "error");
    }
  }

  private updateAnalyticsButton(): void {
    const analyticsBtn = document.getElementById("analyticsBtn");
    if (analyticsBtn) {
      analyticsBtn.textContent = this.isAnalyticsEnabled
        ? "Disable Analytics"
        : "Enable Analytics";
    }
  }

  private setupBackupRestore(): void {
    const menuBtn = document.getElementById("menuBtn");
    const menuContent = document.getElementById("menuContent");

    const hideMenu = () => menuContent?.classList.add("hidden");

    menuBtn?.addEventListener("click", (event) => {
      event.stopPropagation();
      menuContent?.classList.toggle("hidden");
    });

    document.addEventListener("click", hideMenu);

    const buttons = {
      backupBtn: this.backupAccounts,
      restoreBtn: this.restoreAccounts,
      analyticsBtn: this.toggleAnalytics,
    };

    Object.entries(buttons).forEach(([id, handler]) => {
      document.getElementById(id)?.addEventListener("click", () => {
        handler.call(this);
        hideMenu();
      });
    });
  }

  private backupAccounts(): void {
    const backup = {
      tms: this.accounts.filter((acc) => acc.type === "tms"),
      meroshare: this.accounts.filter((acc) => acc.type === "meroshare"),
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `accounts-backup-${backup.timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private createFileInput(): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    return input;
  }

  private async restoreAccounts(): Promise<void> {
    const input = this.createFileInput();

    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const content = await file.text();
        const backup = JSON.parse(content);

        if (!this.validateBackup(backup)) {
          throw new Error("Invalid backup file format");
        }

        this.accounts = [...backup.tms, ...backup.meroshare];
        await this.saveAccounts();
        this.renderAccountsList();
        this.showNotification("Accounts restored successfully", "success");
      } catch (error) {
        this.showNotification(
          "Failed to restore accounts. Invalid backup file.",
          "error"
        );
      }
    };

    input.click();
  }

  private validateBackup(backup: any): boolean {
    if (!backup.tms || !backup.meroshare) return false;

    const accounts = [...backup.tms, ...backup.meroshare];
    return accounts.every(
      (acc: any) => acc.type && acc.alias && acc.username && acc.password
    );
  }

  private async loadAccounts(): Promise<void> {
    try {
      const { accounts } = await chrome.storage.local.get("accounts");
      this.accounts = accounts || [];

      const brokers = new Set(this.accounts.map((acc) => acc.broker));
      brokers.forEach(this.initializePrimaryAccounts.bind(this));

      await this.saveAccounts();
    } catch (error) {
      this.showNotification(
        `Error loading accounts. Please try again. ${error}`,
        "error"
      );
    }
  }

  private initializePrimaryAccounts(broker: number): void {
    const brokerAccounts = this.accounts.filter((acc) => acc.broker === broker);
    if (
      brokerAccounts.length > 0 &&
      !brokerAccounts.some((acc) => acc.isPrimary)
    ) {
      brokerAccounts[0].isPrimary = true;
    }
  }

  private setupEventListeners(): void {
    const addAccountBtn = document.getElementById("addAccountBtn");
    const closeFormBtn = document.getElementById("closeFormBtn");
    const cancelButton = document.getElementById("cancelBtn");

    addAccountBtn?.addEventListener("click", () => this.showAddAccountForm());
    closeFormBtn?.addEventListener("click", () => this.hideAddAccountForm());
    cancelButton?.addEventListener("click", () => this.hideAddAccountForm());
    this.elements.ACCOUNT_FORM.addEventListener(
      "submit",
      this.handleFormSubmit.bind(this)
    );
  }

  private showAddAccountForm(): void {
    if (!this.editingAccount) {
      this.resetForm();
    }
    this.elements.ADD_SECTION.classList.remove("hidden");
    this.elements.ACCOUNTS_SECTION.classList.add("hidden");
  }

  private hideAddAccountForm(): void {
    this.resetForm();
    this.editingAccount = null;
    this.elements.ADD_SECTION.classList.add("hidden");
    this.elements.ACCOUNTS_SECTION.classList.remove("hidden");
  }

  private async handleFormSubmit(event: Event): Promise<void> {
    event.preventDefault();

    try {
      const account = this.getAccountFromForm();

      if (!account.alias) {
        this.showNotification("Account alias is required", "error");
        return;
      }

      if (this.editingAccount) {
        await this.updateAccount(account);
      } else {
        if (this.accounts.some((acc) => acc.alias === account.alias)) {
          this.showNotification("Account alias must be unique", "error");
          return;
        }
        await this.addAccount(account);
      }

      this.hideAddAccountForm();
      this.showNotification("Account saved successfully!", "success");
    } catch (error) {
      this.showNotification(
        `Error saving account. Please try again. ${error}`,
        "error"
      );
    }
  }

  private getAccountFromForm(): Account {
    const formData = new FormData(this.elements.ACCOUNT_FORM);
    return {
      type: formData.get("accountType") as "tms" | "meroshare",
      broker: formData.get("broker") as unknown as number,
      alias:
        this.editingAccount || (formData.get("alias") as string)?.trim() || "",
      username: (formData.get("username") as string)?.trim() || "",
      password: (formData.get("password") as string)?.trim() || "",
      isPrimary: formData.get("isPrimary") === "on",
    };
  }

  private async addAccount(account: Account): Promise<void> {
    this.updatePrimaryStatus(account);
    this.accounts.push(account);
    await this.saveAccounts();
    this.renderAccountsList();
  }

  private updatePrimaryStatus(account: Account): void {
    if (account.isPrimary) {
      this.accounts = this.accounts.map((acc) => ({
        ...acc,
        isPrimary: this.shouldBePrimary(acc, account),
      }));
    } else {
      this.setDefaultPrimary(account);
    }
  }

  private shouldBePrimary(existing: Account, new_account: Account): boolean {
    if (new_account.type === "tms") {
      return !(
        existing.type === "tms" && existing.broker === new_account.broker
      );
    }
    return existing.type !== "meroshare";
  }

  private setDefaultPrimary(account: Account): void {
    if (account.type === "tms") {
      const brokerAccounts = this.accounts.filter(
        (acc) => acc.type === "tms" && acc.broker === account.broker
      );
      if (brokerAccounts.length === 0) {
        account.isPrimary = true;
      }
    } else {
      const meroshareAccounts = this.accounts.filter(
        (acc) => acc.type === "meroshare"
      );
      if (meroshareAccounts.length === 0) {
        account.isPrimary = true;
      }
    }
  }

  private async updateAccount(updatedAccount: Account): Promise<void> {
    if (!this.editingAccount) {
      throw new Error("No account being edited");
    }

    const accountIndex = this.accounts.findIndex(
      (acc) => acc.alias === this.editingAccount
    );

    if (accountIndex === -1) {
      throw new Error("Account not found");
    }

    const oldAccount = this.accounts[accountIndex];
    this.handlePrimaryUpdate(oldAccount, updatedAccount);

    this.accounts[accountIndex] = updatedAccount;
    await this.saveAccounts();
    this.editingAccount = null;
    this.renderAccountsList();
  }

  private handlePrimaryUpdate(
    oldAccount: Account,
    updatedAccount: Account
  ): void {
    if (updatedAccount.isPrimary) {
      this.accounts = this.accounts.map((acc) => ({
        ...acc,
        isPrimary: acc.broker === updatedAccount.broker ? false : acc.isPrimary,
      }));
    } else if (oldAccount.isPrimary && !updatedAccount.isPrimary) {
      const samebrokerAccounts = this.accounts.filter(
        (acc) =>
          acc.broker === oldAccount.broker && acc.alias !== oldAccount.alias
      );
      if (samebrokerAccounts.length > 0) {
        samebrokerAccounts[0].isPrimary = true;
      }
    }
  }

  private async deleteAccount(alias: string): Promise<void> {
    try {
      if (!confirm("Are you sure you want to delete this account?")) return;

      const deletedAccount = this.accounts.find((acc) => acc.alias === alias);
      if (!deletedAccount) return;

      this.accounts = this.accounts.filter((acc) => acc.alias !== alias);
      this.handleDeletePrimary(deletedAccount);

      await this.saveAccounts();
      this.renderAccountsList();
      this.showNotification("Account deleted successfully!", "success");
    } catch (error) {
      this.showNotification(
        `Error deleting account. Please try again. ${error}`,
        "error"
      );
    }
  }

  private handleDeletePrimary(deletedAccount: Account): void {
    if (!deletedAccount.isPrimary) return;

    if (deletedAccount.type === "tms") {
      const samebrokerAccounts = this.accounts.filter(
        (acc) => acc.broker === deletedAccount.broker
      );
      if (samebrokerAccounts.length > 0) {
        samebrokerAccounts[0].isPrimary = true;
      }
    } else {
      const remainingMeroshareAccounts = this.accounts.filter(
        (acc) => acc.type === "meroshare"
      );
      if (remainingMeroshareAccounts.length > 0) {
        remainingMeroshareAccounts[0].isPrimary = true;
      }
    }
  }

  private async setPrimaryAccount(alias: string): Promise<void> {
    try {
      const account = this.accounts.find((acc) => acc.alias === alias);
      if (!account) return;

      this.accounts = this.accounts.map((acc) => ({
        ...acc,
        isPrimary: this.shouldBeNewPrimary(acc, account, alias),
      }));

      await this.saveAccounts();
      this.renderAccountsList();
      this.showNotification(`Primary account updated successfully`, "success");
    } catch (error) {
      this.showNotification(
        `Error updating primary account. Please try again. ${error}`,
        "error"
      );
    }
  }

  private shouldBeNewPrimary(
    acc: Account,
    newPrimary: Account,
    alias: string
  ): boolean {
    if (newPrimary.type === "tms") {
      return acc.broker === newPrimary.broker
        ? acc.alias === alias
        : acc.isPrimary;
    }
    return acc.type === "meroshare" ? acc.alias === alias : acc.isPrimary;
  }

  private startEditing(account: Account): void {
    this.editingAccount = account.alias;
    this.showAddAccountForm();
    this.populateForm(account);
  }

  private populateForm(account: Account): void {
    const brokerInput = document.getElementById("broker") as HTMLSelectElement;
    const radioBtn = document.querySelector(
      `input[name="accountType"][value="${account.type}"]`
    ) as HTMLInputElement;
    const usernameInput = document.getElementById(
      "username"
    ) as HTMLInputElement;
    const passwordInput = document.getElementById(
      "password"
    ) as HTMLInputElement;
    const isPrimaryInput = document.getElementById(
      "isPrimary"
    ) as HTMLInputElement;

    if (this.aliasInput) {
      this.aliasInput.value = account.alias;
      this.aliasInput.disabled = true;
    }
    if (brokerInput) brokerInput.value = account.broker.toString();
    if (radioBtn) radioBtn.checked = true;
    if (usernameInput) usernameInput.value = account.username;
    if (passwordInput) passwordInput.value = account.password;
    if (isPrimaryInput) isPrimaryInput.checked = account.isPrimary;

    if (this.submitButton) this.submitButton.textContent = "Update Account";
    if (this.formTitle) this.formTitle.textContent = "Edit Account";
  }

  private resetForm(): void {
    this.elements.ACCOUNT_FORM.reset();
    this.editingAccount = null;

    if (this.aliasInput) this.aliasInput.disabled = false;
    if (this.submitButton) this.submitButton.textContent = "Add Account";
    if (this.formTitle) this.formTitle.textContent = "Add New Account";
  }

  private async saveAccounts(): Promise<void> {
    try {
      await chrome.storage.local.set({ accounts: this.accounts });
    } catch (error) {
      throw error;
    }
  }

  private showNotification(message: string, type: "success" | "error"): void {
    if (!this.notification) return;

    this.notification.textContent = message;
    this.notification.className = `notification ${type}`;
    this.notification.classList.remove("hidden");

    setTimeout(() => {
      this.notification?.classList.add("hidden");
    }, 3000);
  }

  private renderAccountsList(): void {
    const accounts = this.accounts.filter((acc) => acc.type === this.activeTab);
    const list = this.elements.ACCOUNTS_LIST;
    const fragment = document.createDocumentFragment();

    if (accounts.length === 0) {
      fragment.appendChild(this.createEmptyState());
    } else {
      accounts.forEach((account) => {
        const accountItem = this.createAccountItem(account);
        fragment.appendChild(accountItem);
        this.accountsMap.set(account.alias, account);
      });
    }

    list.textContent = "";
    list.appendChild(fragment);
  }

  private createEmptyState(): HTMLDivElement {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent =
      "No accounts added yet. Click the + button to add an account.";
    return emptyState;
  }

  private handleAccountActions(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    const accountItem = target.closest(".account-item");
    if (!accountItem) return;

    const alias = (accountItem as HTMLElement).dataset.alias;
    if (!alias) return;

    const actions = {
      "btn-edit": () => {
        const account = this.accounts.find((acc) => acc.alias === alias);
        if (account) this.startEditing(account);
      },
      "btn-delete": () => this.deleteAccount(alias),
      "btn-primary": () => this.setPrimaryAccount(alias),
    };

    for (const [className, handler] of Object.entries(actions)) {
      if (target.matches(`.${className}`)) {
        handler();
        break;
      }
    }
  }

  private createAccountItem(account: Account): HTMLDivElement {
    const div = document.createElement("div");
    div.className = "account-item";
    div.dataset.alias = account.alias;

    const primaryBadge = account.isPrimary
      ? '<span class="primary-badge">Primary</span>'
      : "";

    div.innerHTML = `
          <div class="account-info">
            <div class="account-name">
              ${account.alias}
              <span class="broker-badge">${account.broker}</span>
              ${primaryBadge}
            </div>
            <div class="account-username">${account.username}</div>
          </div>
          <div class="actions">
            <button class="btn-action btn-edit" title="Edit">Edit</button>
            <button class="btn-action btn-delete" title="Delete">Delete</button>
          </div>
        `;
    return div;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new PopupManager();
});
