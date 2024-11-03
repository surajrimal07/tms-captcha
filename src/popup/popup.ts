import { Account } from "../interface";

class PopupManager {
  private accounts: Account[] = [];
  private accountsList: HTMLDivElement;
  private meroshareList: HTMLDivElement;
  private form: HTMLFormElement;
  private addAccountSection: HTMLDivElement;
  private accountsSection: HTMLDivElement;
  private editingAccount: string | null = null;
  private isAnalyticsEnabled: boolean = true;
  private activeTab: "tms" | "meroshare" = "tms";

  constructor() {
    this.accountsList = document.getElementById(
      "accountsList"
    ) as HTMLDivElement;
    this.meroshareList = document.getElementById(
      "meroshareAccountsList"
    ) as HTMLDivElement;
    this.form = document.getElementById("accountForm") as HTMLFormElement;
    this.addAccountSection = document.getElementById(
      "addAccountSection"
    ) as HTMLDivElement;
    this.accountsSection = document.getElementById(
      "accountsSection"
    ) as HTMLDivElement;
    this.init();

    this.addMenuToHeader();
    this.setupBackupRestore();
  }

  private async init() {
    await this.loadAccounts();
    await this.loadAnalyticsState();
    this.setupEventListeners();
    this.setupTabSwitching();
    this.renderAccountsList();
    this.addAccountSection.classList.add("hidden");
  }

  private setupTabSwitching() {
    const tabButtons = document.querySelectorAll(".tab-button");
    const tmsContent = document.getElementById("tmsContent");
    const meroshareContent = document.getElementById("meroshareContent");

    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
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
      });
    });
  }

  private addMenuToHeader() {
    const header = document.querySelector(".header");
    const menuHtml = `
      <div class="menu-dropdown">
        <button class="btn-menu" id="menuBtn">⋮</button>
        <div class="menu-content hidden" id="menuContent">
         <button id="analyticsBtn">Disable Analytics</button>
          <button id="backupBtn">Backup</button>
          <button id="restoreBtn">Restore</button>
        </div>
      </div>`;
    header?.insertAdjacentHTML("beforeend", menuHtml);
  }

  private async loadAnalyticsState() {
    try {
      const result = await chrome.storage.local.get("analyticsEnabled");
      this.isAnalyticsEnabled = result.analyticsEnabled !== false;
      this.updateAnalyticsButton();
    } catch (error) {
      console.error("Error loading analytics state:", error);
    }
  }

  private async toggleAnalytics() {
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

  private updateAnalyticsButton() {
    const analyticsBtn = document.getElementById("analyticsBtn");
    if (analyticsBtn) {
      analyticsBtn.textContent = this.isAnalyticsEnabled
        ? "Disable Analytics"
        : "Enable Analytics";
    }
  }

  private setupBackupRestore() {
    const menuBtn = document.getElementById("menuBtn");
    const menuContent = document.getElementById("menuContent");
    const backupBtn = document.getElementById("backupBtn");
    const restoreBtn = document.getElementById("restoreBtn");
    const analyticsBtn = document.getElementById("analyticsBtn");

    menuBtn?.addEventListener("click", (event) => {
      event.stopPropagation();
      menuContent?.classList.toggle("hidden");
    });

    document.addEventListener("click", () => {
      menuContent?.classList.add("hidden");
    });
    backupBtn?.addEventListener("click", () => {
      this.backupAccounts();
      menuContent?.classList.add("hidden");
    });

    restoreBtn?.addEventListener("click", () => {
      this.restoreAccounts();
      menuContent?.classList.add("hidden");
    });

    analyticsBtn?.addEventListener("click", () => {
      this.toggleAnalytics();
      menuContent?.classList.add("hidden");
    });
  }

  private backupAccounts() {
    const tmsAccounts = this.accounts.filter((acc) => acc.type === "tms");
    const meroshareAccounts = this.accounts.filter(
      (acc) => acc.type === "meroshare"
    );

    const backup = {
      tms: tmsAccounts,
      meroshare: meroshareAccounts,
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `accounts-backup-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private async restoreAccounts() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const content = await file.text();
        const backup = JSON.parse(content);

        // Validate backup structure
        if (!backup.tms || !backup.meroshare) {
          throw new Error("Invalid backup file format");
        }

        // Merge accounts by type
        const restoredAccounts = [...backup.tms, ...backup.meroshare];

        // Validate each account has required fields
        const isValid = restoredAccounts.every(
          (acc) => acc.type && acc.alias && acc.username && acc.password
        );

        if (!isValid) {
          throw new Error("Backup contains invalid account data");
        }

        this.accounts = restoredAccounts;
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

  private async loadAccounts() {
    try {
      const result = await chrome.storage.local.get("accounts");
      this.accounts = result.accounts || [];

      // Ensure only one Meroshare account is primary
      let foundMerosharePrimary = false;
      this.accounts = this.accounts.map((acc) => {
        if (acc.type === "meroshare") {
          if (!foundMerosharePrimary && acc.isPrimary) {
            foundMerosharePrimary = true;
            return acc;
          }
          return { ...acc, isPrimary: false };
        }
        return acc;
      });

      // If no Meroshare account is primary but there are Meroshare accounts,
      // make the first one primary
      const meroshareAccounts = this.accounts.filter(
        (acc) => acc.type === "meroshare"
      );
      if (meroshareAccounts.length > 0 && !foundMerosharePrimary) {
        this.accounts = this.accounts.map((acc) => {
          if (acc.alias === meroshareAccounts[0].alias) {
            return { ...acc, isPrimary: true };
          }
          return acc;
        });
      }

      // Handle TMS accounts primary status per broker
      const brokers = new Set(
        this.accounts
          .filter((acc) => acc.type === "tms")
          .map((acc) => acc.broker)
      );

      brokers.forEach((broker) => {
        const brokerAccounts = this.accounts.filter(
          (acc) => acc.type === "tms" && acc.broker === broker
        );
        let hasPrimary = brokerAccounts.some((acc) => acc.isPrimary);
        if (brokerAccounts.length > 0 && !hasPrimary) {
          const firstBrokerAccount = brokerAccounts[0];
          this.accounts = this.accounts.map((acc) =>
            acc.alias === firstBrokerAccount.alias
              ? { ...acc, isPrimary: true }
              : acc
          );
        }
      });

      await this.saveAccounts();
    } catch (error) {
      this.showNotification(
        `Error loading accounts. Please try again. ${error}`,
        "error"
      );
    }
  }

  private setupEventListeners() {
    const addAccountBtn = document.getElementById("addAccountBtn");
    addAccountBtn?.addEventListener("click", () => {
      this.showAddAccountForm();
    });

    const closeFormBtn = document.getElementById("closeFormBtn");
    closeFormBtn?.addEventListener("click", () => {
      this.hideAddAccountForm();
    });

    const cancelButton = document.getElementById("cancelBtn");
    cancelButton?.addEventListener("click", () => {
      this.hideAddAccountForm();
    });

    this.form.addEventListener("submit", this.handleFormSubmit.bind(this));
  }

  private showAddAccountForm() {
    if (!this.editingAccount) {
      this.resetForm();
    }
    this.addAccountSection.classList.remove("hidden");
    this.accountsSection.classList.add("hidden");
  }

  private hideAddAccountForm() {
    this.resetForm();
    this.editingAccount = null;
    this.addAccountSection.classList.add("hidden");
    this.accountsSection.classList.remove("hidden");
  }

  private async handleFormSubmit(event: Event) {
    event.preventDefault();

    try {
      const formData = new FormData(this.form);

      const account: Account = {
        type: formData.get("accountType") as "tms" | "meroshare",
        broker: formData.get("broker") as unknown as number,
        alias:
          this.editingAccount ||
          (formData.get("alias") as string)?.trim() ||
          "",
        username: (formData.get("username") as string)?.trim() || "",
        password: (formData.get("password") as string)?.trim() || "",
        isPrimary: formData.get("isPrimary") === "on",
      };

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

  private async addAccount(account: Account) {
    if (account.type === "meroshare") {
      // For Meroshare: Only one primary across all Meroshare accounts
      if (account.isPrimary) {
        // If this new account is primary, remove primary from all other Meroshare accounts
        this.accounts = this.accounts.map((acc) => ({
          ...acc,
          isPrimary: acc.type === "meroshare" ? false : acc.isPrimary,
        }));
      } else {
        // If this is the first Meroshare account, make it primary
        const meroshareAccounts = this.accounts.filter(
          (acc) => acc.type === "meroshare"
        );
        if (meroshareAccounts.length === 0) {
          account.isPrimary = true;
        }
      }
    } else if (account.type === "tms") {
      // For TMS: One primary per broker
      if (account.isPrimary) {
        this.accounts = this.accounts.map((acc) => ({
          ...acc,
          isPrimary:
            acc.type === "tms" && acc.broker === account.broker
              ? false
              : acc.isPrimary,
        }));
      } else {
        const brokerAccounts = this.accounts.filter(
          (acc) => acc.type === "tms" && acc.broker === account.broker
        );
        if (brokerAccounts.length === 0) {
          account.isPrimary = true;
        }
      }
    }

    this.accounts.push(account);
    await this.saveAccounts();
    this.renderAccountsList();
  }
  private async updateAccount(updatedAccount: Account) {
    try {
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

      // Handle Meroshare account primary status
      if (updatedAccount.type === "meroshare") {
        if (updatedAccount.isPrimary) {
          // Remove primary from all other Meroshare accounts
          this.accounts = this.accounts.map((acc) => ({
            ...acc,
            isPrimary: acc.type === "meroshare" ? false : acc.isPrimary,
          }));
        } else if (oldAccount.isPrimary) {
          // If removing primary status, ensure another Meroshare account becomes primary
          const otherMeroshareAccounts = this.accounts.filter(
            (acc) => acc.type === "meroshare" && acc.alias !== oldAccount.alias
          );
          if (otherMeroshareAccounts.length > 0) {
            const firstAccount = otherMeroshareAccounts[0];
            this.accounts = this.accounts.map((acc) =>
              acc.alias === firstAccount.alias
                ? { ...acc, isPrimary: true }
                : acc
            );
          } else {
            // If this is the only Meroshare account, keep it primary
            updatedAccount.isPrimary = true;
          }
        }
      } else if (updatedAccount.type === "tms") {
        // Handle TMS account primary status
        if (updatedAccount.isPrimary) {
          // Remove primary from other accounts with same broker
          this.accounts = this.accounts.map((acc) => ({
            ...acc,
            isPrimary:
              acc.type === "tms" &&
              acc.broker === updatedAccount.broker &&
              acc.alias !== oldAccount.alias
                ? false
                : acc.isPrimary,
          }));
        } else if (oldAccount.isPrimary) {
          // If removing primary status, make another account with same broker primary
          const sameBrokerAccounts = this.accounts.filter(
            (acc) =>
              acc.type === "tms" &&
              acc.broker === oldAccount.broker &&
              acc.alias !== oldAccount.alias
          );
          if (sameBrokerAccounts.length > 0) {
            const firstAccount = sameBrokerAccounts[0];
            this.accounts = this.accounts.map((acc) =>
              acc.alias === firstAccount.alias
                ? { ...acc, isPrimary: true }
                : acc
            );
          } else {
            // If this is the only account for this broker, keep it primary
            updatedAccount.isPrimary = true;
          }
        }
      }

      this.accounts[accountIndex] = updatedAccount;
      await this.saveAccounts();
      this.editingAccount = null;
      this.renderAccountsList();
    } catch (error) {
      throw error;
    }
  }

  private async deleteAccount(alias: string) {
    try {
      const isConfirmed = confirm(
        "Are you sure you want to delete this account?"
      );
      if (!isConfirmed) return;

      const deletedAccount = this.accounts.find((acc) => acc.alias === alias);
      if (!deletedAccount) return;

      this.accounts = this.accounts.filter((acc) => acc.alias !== alias);

      if (deletedAccount.type === "meroshare" && deletedAccount.isPrimary) {
        // If deleting primary Meroshare account, make another one primary
        const remainingMeroshareAccounts = this.accounts.filter(
          (acc) => acc.type === "meroshare"
        );
        if (remainingMeroshareAccounts.length > 0) {
          remainingMeroshareAccounts[0].isPrimary = true;
        }
      } else if (deletedAccount.type === "tms" && deletedAccount.isPrimary) {
        // If deleting primary TMS account, make another account with same broker primary
        const sameBrokerAccounts = this.accounts.filter(
          (acc) => acc.type === "tms" && acc.broker === deletedAccount.broker
        );
        if (sameBrokerAccounts.length > 0) {
          sameBrokerAccounts[0].isPrimary = true;
        }
      }

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

  private async setPrimaryAccount(alias: string) {
    try {
      const account = this.accounts.find((acc) => acc.alias === alias);
      if (!account) return;

      if (account.type === "meroshare") {
        // For Meroshare accounts, only one can be primary total
        this.accounts = this.accounts.map((acc) => ({
          ...acc,
          isPrimary:
            acc.type === "meroshare" ? acc.alias === alias : acc.isPrimary,
        }));
      } else if (account.type === "tms") {
        // For TMS accounts, one primary per broker
        this.accounts = this.accounts.map((acc) => ({
          ...acc,
          isPrimary:
            acc.type === "tms" && acc.broker === account.broker
              ? acc.alias === alias
              : acc.isPrimary,
        }));
      }

      await this.saveAccounts();
      this.renderAccountsList();
      this.showNotification("Primary account updated successfully", "success");
    } catch (error) {
      this.showNotification(
        `Error updating primary account. Please try again. ${error}`,
        "error"
      );
    }
  }

  private startEditing(account: Account) {
    this.editingAccount = account.alias;

    this.showAddAccountForm();

    const aliasInput = document.getElementById("alias") as HTMLInputElement;

    const brokerInput = document.getElementById("broker") as HTMLSelectElement;

    const radioBtn = document.querySelector(
      `input[name="accountType"][value="${account.type}"]`
    ) as HTMLInputElement;
    if (radioBtn) {
      radioBtn.checked = true;
    }

    const usernameInput = document.getElementById(
      "username"
    ) as HTMLInputElement;
    const passwordInput = document.getElementById(
      "password"
    ) as HTMLInputElement;
    const isPrimaryInput = document.getElementById(
      "isPrimary"
    ) as HTMLInputElement;
    const submitButton = this.form.querySelector(
      'button[type="submit"]'
    ) as HTMLButtonElement;
    const formTitle = document.getElementById(
      "formTitle"
    ) as HTMLHeadingElement;

    if (aliasInput) aliasInput.value = account.alias;
    if (brokerInput) brokerInput.value = account.broker.toString();
    if (usernameInput) usernameInput.value = account.username;
    if (passwordInput) passwordInput.value = account.password;
    if (isPrimaryInput) isPrimaryInput.checked = account.isPrimary;

    if (aliasInput) aliasInput.disabled = true;
    if (submitButton) submitButton.textContent = "Update Account";
    if (formTitle) formTitle.textContent = "Edit Account";
  }

  private resetForm() {
    this.form.reset();
    this.editingAccount = null;
    const submitButton = this.form.querySelector(
      'button[type="submit"]'
    ) as HTMLButtonElement;
    const formTitle = document.getElementById(
      "formTitle"
    ) as HTMLHeadingElement;
    const aliasInput = this.form.querySelector("#alias") as HTMLInputElement;

    aliasInput.disabled = false;
    submitButton.textContent = "Add Account";
    formTitle.textContent = "Add New Account";
  }

  private async saveAccounts() {
    try {
      await chrome.storage.local.set({ accounts: this.accounts });
    } catch (error) {
      throw error;
    }
  }

  private showNotification(message: string, type: "success" | "error") {
    const notification = document.getElementById("notification");
    if (notification) {
      notification.textContent = message;
      notification.className = `notification ${type}`;
      notification.classList.remove("hidden");
      setTimeout(() => {
        notification.classList.add("hidden");
      }, 3000);
    }
  }

  private renderAccountsList() {
    this.accountsList.innerHTML = "";
    this.meroshareList.innerHTML = "";

    const tmsAccounts = this.accounts.filter((acc) => acc.type === "tms");
    const meroshareAccounts = this.accounts.filter(
      (acc) => acc.type === "meroshare"
    );

    if (tmsAccounts.length === 0) {
      const emptyState = this.createEmptyState("No TMS accounts added yet.");
      this.accountsList.appendChild(emptyState);
    } else {
      tmsAccounts.forEach((account) => {
        const accountElement = this.createAccountElement(account);
        this.accountsList.appendChild(accountElement);
      });
    }

    // Render Meroshare accounts
    if (meroshareAccounts.length === 0) {
      const emptyState = this.createEmptyState(
        "No Meroshare accounts added yet."
      );
      this.meroshareList.appendChild(emptyState);
    } else {
      meroshareAccounts.forEach((account) => {
        const accountElement = this.createAccountElement(account);
        this.meroshareList.appendChild(accountElement);
      });
    }
  }

  private createEmptyState(message: string): HTMLDivElement {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = message;
    return emptyState;
  }

  private createAccountElement(account: Account): HTMLDivElement {
    const accountItem = document.createElement("div");
    accountItem.className = "account-item";

    const accountInfo = document.createElement("div");
    accountInfo.className = "account-info";

    const accountName = document.createElement("div");
    accountName.className = "account-name";
    accountName.textContent = account.alias;

    const brokerBadge = document.createElement("span");
    brokerBadge.className = "broker-badge";
    brokerBadge.textContent =
      account.type === "tms"
        ? `Broker ${account.broker}`
        : `DP ${account.broker}`;
    accountName.appendChild(brokerBadge);

    if (account.isPrimary) {
      const primaryBadge = document.createElement("span");
      primaryBadge.className = "primary-badge";
      primaryBadge.textContent = "Primary";
      accountName.appendChild(primaryBadge);
    }

    const accountUsername = document.createElement("div");
    accountUsername.className = "account-username";
    accountUsername.textContent = account.username;

    const actions = document.createElement("div");
    actions.className = "account-actions";

    if (!account.isPrimary) {
      const primaryBtn = this.createActionButton("Primary", () =>
        this.setPrimaryAccount(account.alias)
      );
      actions.appendChild(primaryBtn);
    }

    const editBtn = this.createActionButton("Edit", () =>
      this.startEditing(account)
    );

    const deleteBtn = this.createActionButton("Delete", () =>
      this.deleteAccount(account.alias)
    );
    deleteBtn.classList.add("delete-action");

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    accountInfo.appendChild(accountName);
    accountInfo.appendChild(accountUsername);
    accountItem.appendChild(accountInfo);
    accountItem.appendChild(actions);

    return accountItem;
  }

  private createActionButton(
    title: string,
    onClick: () => void
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.className = "btn-action";
    button.title = title;
    button.textContent = title;
    button.addEventListener("click", onClick);
    return button;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new PopupManager();
});
