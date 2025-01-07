export async function initThemeToggle() {
	const themeToggle = document.getElementById("themeToggle");
	const themeIcon = document.getElementById("themeIcon");
	const root = document.documentElement;

	if (!themeToggle) return;

	const toggleTheme = () => {
		const isLight = root.dataset.theme === "light";
		root.dataset.theme = isLight ? "dark" : "light";
		localStorage.setItem("theme", root.dataset.theme);

		if (themeIcon) {
			themeIcon.style.transform = "rotate(360deg)";
			requestAnimationFrame(() => {
				themeIcon.style.transform = "rotate(0)";
			});
		}
	};

	themeToggle.addEventListener("click", toggleTheme);
}
