let activeNotification: HTMLElement | null = null;

export function showNotification(message: string, type: "success" | "error") {
	// Remove existing notification if present
	if (activeNotification) {
		activeNotification.remove();
	}

	const notification = document.createElement("div");
	notification.className = `notification ${type}`;
	notification.textContent = message;
	document.body.appendChild(notification);
	activeNotification = notification;

	const removeNotification = () => {
		return new Promise<void>((resolve) => {
			const handleAnimationEnd = () => {
				notification.remove();
				activeNotification = null;
				notification.removeEventListener("animationend", handleAnimationEnd);
				resolve();
			};

			notification.addEventListener("animationend", handleAnimationEnd);
			notification.classList.add("exit");
		});
	};

	setTimeout(async () => {
		await removeNotification();
	}, 2000);
}
