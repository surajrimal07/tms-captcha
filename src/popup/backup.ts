import type { Account, IndexKey } from "../interface";
import { showNotification } from "./notification";
import {
	loadNepseState,
	renderAccountsList,
	state,
	updateAnalyticsButton,
	updateNepseToggleUI,
} from "./popup";

interface BackupData {
	accounts: Account[];
	theme: string;
	otherDashboard: IndexKey[];
	isNepseEnabled: boolean;
	analyticsEnabled: boolean;
}

export async function backupAccounts() {
	try {
		const storage = await chrome.storage.local.get([
			"accounts",
			"otherDashboard",
			"isNepseEnabled",
			"analyticsEnabled",
		]);

		const theme = localStorage.getItem("theme");

		const backupData: BackupData = {
			accounts: storage.accounts || [],
			theme: theme || "light",
			otherDashboard: storage.otherDashboard || ["NEPSE Index"],
			isNepseEnabled: storage.isNepseEnabled ?? true,
			analyticsEnabled: storage.analyticsEnabled ?? true,
		};

		const blob = new Blob([JSON.stringify(backupData, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `nepse-extension-backup-${new Date().toISOString().split("T")[0]}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	} catch (error) {
		showNotification(`Error creating backup: ${error}`, "error");
	}
}

export async function restoreAccounts() {
	const input = document.createElement("input");
	input.type = "file";
	input.accept = ".json";

	input.onchange = async (e) => {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;

		try {
			const content = await file.text();
			const backup = JSON.parse(content) as BackupData;

			// Validate backup data
			if (!backup.accounts || !Array.isArray(backup.accounts)) {
				throw new Error("Invalid backup file format: missing accounts array");
			}

			// Restore all settings
			await chrome.storage.local.set({
				accounts: backup.accounts,
				otherDashboard: backup.otherDashboard || ["NEPSE Index"],
				isNepseEnabled: backup.isNepseEnabled ?? true,
				analyticsEnabled: backup.analyticsEnabled ?? true,
			});

			localStorage.setItem("theme", backup.theme);
			document.documentElement.dataset.theme = backup.theme;

			// Update UI
			state.accounts = backup.accounts;
			state.otherDashboard = backup.otherDashboard;
			state.isNepseEnabled = backup.isNepseEnabled;
			state.isAnalyticsEnabled = backup.analyticsEnabled;

			renderAccountsList();
			updateNepseToggleUI();

			loadNepseState();
			updateAnalyticsButton();

			showNotification("Settings restored successfully!", "success");
		} catch (error) {
			showNotification(`Error restoring backup: ${error}`, "error");
		}
	};

	input.click();
}
