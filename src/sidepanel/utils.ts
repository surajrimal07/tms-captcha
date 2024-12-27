export async function isInTMSsite(): Promise<boolean> {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	const url = tab?.url || "";
	return /^https:\/\/tms\d+\.nepsetms\.com\.np\/tms\/client\/.*/.test(url);
}
