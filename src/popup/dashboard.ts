import { NEPSE_INDEX, type IndexKey } from "../interface";
import { loadOtherIndexChart } from "../utils";
import { showNotification } from "./notification";
import { state, updateNepseUI } from "./popup";


//make global state of elements to avoid querying dom multiple times
const elements = {
	infoButton: document.querySelector(".info-button") as HTMLButtonElement,
	prevButton: document.querySelector(".prev-button") as HTMLButtonElement,
	nextButton: document.querySelector(".next-button") as HTMLButtonElement,
	// homeButton: document.querySelector(".home-button") as HTMLElement,
	deleteButton: document.querySelector(".delete-button") as HTMLButtonElement,
	dashboardIndicator: document.querySelector(
		".dashboard-indicator",
	) as HTMLElement,
	currentActiveDot: document.querySelector(
		".dashboard-dot.active",
	) as HTMLElement,
	addButton: document.querySelector(".add-dashboard-button") as HTMLElement,
	selector: document.getElementById("indexSelector") as HTMLElement,
	closeButton: document.querySelector(".close-selector"),
	options: document.querySelectorAll(
		".index-option",
	) as NodeListOf<HTMLElement>,
};

export async function deleteOtherIndex(index: IndexKey) {
	try {
		const result = await chrome.storage.local.get("otherDashboard");
		if (!result.otherDashboard) return;

		const currentIndices = result.otherDashboard as IndexKey[];
		const updatedIndices = currentIndices.filter((item) => item !== index);

		await chrome.storage.local.set({ otherDashboard: updatedIndices });

		state.otherDashboard = updatedIndices;

		showNotification(`${index} deleted`, "success");
	} catch (error) {
		console.error("Error deleting index:", error);
		showNotification("Error deleting index", "error");
	}
}

export function setupDashboardControls() {
	if (!elements.prevButton || !elements.nextButton || !elements.deleteButton)
		return;

	function handlePrevDashboard() {
		// Find current index position
		const currentIndex = state.otherDashboard.indexOf(state.activeDashboard);

		// Get previous dashboard if exists
		if (currentIndex > 0) {
			const prevDashboard = state.otherDashboard[currentIndex - 1];

			// Update state and UI
			state.activeDashboard = prevDashboard;
			if (elements.infoButton) elements.infoButton.title = prevDashboard;
			chrome.storage.local.set({ activeDashboard: prevDashboard });
			updateActiveDot(prevDashboard);

			// Hide prev button if we reach start
			elements.prevButton.disabled = currentIndex - 1 === 0;

			//hide delete button if we are on NEPSE Index
			elements.deleteButton.disabled = prevDashboard === NEPSE_INDEX;

			// Show next button since we moved backward
			elements.nextButton.disabled = false;

			//update the ui
			updateNepseUI();

			//send notification
			showNotification(prevDashboard, "success");
		}
	}

	function handleNextDashboard() {
		// Find current index position
		const currentIndex = state.otherDashboard.indexOf(state.activeDashboard);

		// Get next dashboard if exists
		if (currentIndex < state.otherDashboard.length - 1) {
			const nextDashboard = state.otherDashboard[currentIndex + 1];

			// Update state and UI
			state.activeDashboard = nextDashboard;
			if (elements.infoButton) elements.infoButton.title = nextDashboard;
			chrome.storage.local.set({ activeDashboard: nextDashboard });
			updateActiveDot(nextDashboard);

			// Hide next button if we reach end
			elements.nextButton.disabled =
				currentIndex + 1 === state.otherDashboard.length - 1;

			//if delete buttom was hidden then show it
			elements.deleteButton.disabled = false;

			// Show prev button since we moved forward
			elements.prevButton.disabled = false;

			//update the ui
			updateNepseUI();

			//send notification
			showNotification(nextDashboard, "success");
		}
	}

	// Button click listeners
	elements.nextButton.addEventListener("click", handleNextDashboard);
	elements.prevButton.addEventListener("click", handlePrevDashboard);

	// Keyboard listeners
	document.addEventListener("keydown", (event) => {
		if (event.key === "ArrowRight") {
			handleNextDashboard();
		} else if (event.key === "ArrowLeft") {
			handlePrevDashboard();
		}
	});

	elements.deleteButton.addEventListener("click", async () => {
		// Only delete if not NEPSE Index
		if (state.activeDashboard !== NEPSE_INDEX) {
			const currentIndex = state.otherDashboard.indexOf(state.activeDashboard);
			const previousIndex = state.otherDashboard[currentIndex - 1];

			console.log("new active dashboard", previousIndex);

			// Save new active dashboard
			await chrome.storage.local.set({ activeDashboard: previousIndex });
			await deleteOtherIndex(state.activeDashboard);

			// Update state and UI
			state.activeDashboard = previousIndex;
			if (elements.dashboardIndicator) createDashboardDots();
			if (elements.infoButton) elements.infoButton.title = previousIndex;

			// Update button states based on new position
			const remainingDashboards = state.otherDashboard.length; // -1 for about to be deleted
			const newPosition = currentIndex - 1;

			if (remainingDashboards === newPosition || newPosition === 0) {
				//means we are in last index
				elements.nextButton.disabled = true;
			}

			if (remainingDashboards <= 1) {
				// Only NEPSE Index remains
				elements.prevButton.disabled = true;
				elements.nextButton.disabled = true;
				elements.deleteButton.disabled = true;
			}

			updateNepseUI();
		}
	});

	//add click listner for info-button
	elements.infoButton.addEventListener("click", () => {
		showNotification(state.activeDashboard, "success");
	});
}

export async function initializeDashboard() {
	try {
		if (
			!elements.dashboardIndicator ||
			!elements.prevButton ||
			!elements.nextButton ||
			!elements.deleteButton
		)
			return;

		const storage = await chrome.storage.local.get([
			"otherDashboard",
			"activeDashboard",
		]);

		// Initialize state with storage or defaults
		state.otherDashboard = storage.otherDashboard ?? [NEPSE_INDEX];
		state.activeDashboard = storage.activeDashboard ?? NEPSE_INDEX;

		// Set storage if values don't exist
		if (!storage.otherDashboard || !storage.activeDashboard) {
			await chrome.storage.local.set({
				otherDashboard: state.otherDashboard,
				activeDashboard: state.activeDashboard,
			});
		}

		if (elements.infoButton) elements.infoButton.title = state.activeDashboard;

		// Show controls only if multiple dashboards exist
		const currentIndex = state.otherDashboard.indexOf(state.activeDashboard);
		const hasMultipleIndices = state.otherDashboard.length > 1;

		elements.prevButton.disabled = !hasMultipleIndices || currentIndex === 0;

		// Update next button disabled state
		elements.nextButton.disabled =
			!hasMultipleIndices || currentIndex === state.otherDashboard.length - 1;

		// Control delete button visibility
		const showDelete =
			hasMultipleIndices && state.activeDashboard !== NEPSE_INDEX;

		elements.deleteButton.disabled = !showDelete;

		// Create dots for other dashboards
		createDashboardDots();

		await setupIndexSelector();

		setupDashboardControls();
	} catch (error) {
		console.error("Error initializing dashboard dots:", error);
	}
}

function createDashboardDots() {
	if (!elements.dashboardIndicator) return;

	// Clear all existing dots
	elements.dashboardIndicator.innerHTML = "";

	// Create all dots from state
	for (const dashboard of state.otherDashboard) {
		const dot = document.createElement("span");
		dot.className = "dashboard-dot";
		dot.dataset.dashboard = dashboard;
		dot.title = dashboard;

		// Mark active if matches current dashboard
		if (state.activeDashboard === dashboard) {
			dot.classList.add("active");
		}

		elements.dashboardIndicator.appendChild(dot);
	}
}

export function updateActiveDot(newActiveDashboard: "NEPSE Index" | IndexKey) {
	if (elements.currentActiveDot) {
		elements.currentActiveDot.classList.remove("active");
	}

	const newActiveDot = document.querySelector(
		`.dashboard-dot[data-dashboard="${newActiveDashboard}"]`,
	) as HTMLElement;

	if (newActiveDot) {
		newActiveDot.classList.add("active");
		elements.currentActiveDot = newActiveDot;
	}
}

export async function setupIndexSelector() {
	elements.addButton?.addEventListener("click", () => {
		elements.selector?.classList.remove("hidden");
	});

	elements.closeButton?.addEventListener("click", () => {
		elements.selector?.classList.add("hidden");
	});

	for (const option of elements.options) {
		option.addEventListener("click", async (e) => {
			if (!(e.target instanceof HTMLElement)) return;
			const selectedIndex = e.target.dataset.index as IndexKey;

			// Get current dashboard array
			const result = await chrome.storage.local.get("otherDashboard");
			const currentDashboard =
				result.otherDashboard || ([NEPSE_INDEX] as IndexKey[]);

			if (!currentDashboard.includes(selectedIndex)) {
				const updatedDashboard = [...currentDashboard, selectedIndex];
				await chrome.storage.local.set({ otherDashboard: updatedDashboard });
				state.otherDashboard = updatedDashboard;

				if (elements.dashboardIndicator) createDashboardDots();

				loadOtherIndexChart();
				showNotification(`${selectedIndex} added`, "success");
			} else {
				showNotification(`${selectedIndex} exists`, "error");
			}

			elements.selector?.classList.add("hidden");
		});
	}

	// Close on outside click
	elements.selector?.addEventListener("click", (e) => {
		if (e.target === elements.selector) {
			elements.selector.classList.add("hidden");
		}
	});
}
