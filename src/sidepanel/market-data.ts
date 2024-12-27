export interface StockData {
	symbol: string;
	ltp: number;
	pointChange: number;
	percentChange: number;
}

export const gainersData: StockData[] = [
	{ symbol: "ANLB", ltp: 5937.4, pointChange: 539.7, percentChange: 10.0 },
	{ symbol: "SMB", ltp: 3985.9, pointChange: 362.3, percentChange: 10.0 },
	{ symbol: "GLBSL", ltp: 2550.0, pointChange: 174.0, percentChange: 7.32 },
	{ symbol: "PRVU", ltp: 244.0, pointChange: 13.5, percentChange: 5.86 },
	{ symbol: "KBSH", ltp: 2587.0, pointChange: 124.27, percentChange: 5.05 },
	{ symbol: "GMFBS", ltp: 1787.0, pointChange: 71.0, percentChange: 4.14 },
	{ symbol: "MLBBL", ltp: 1565.0, pointChange: 57.78, percentChange: 3.83 },
	{ symbol: "PCBLP", ltp: 105.2, pointChange: 3.6, percentChange: 3.54 },
];

export const losersData: StockData[] = [
	{ symbol: "NABBC", ltp: 1156.5, pointChange: -128.5, percentChange: -10.0 },
	{ symbol: "CORBL", ltp: 1399.5, pointChange: -155.5, percentChange: -10.0 },
	{ symbol: "SINDU", ltp: 846.0, pointChange: -94.0, percentChange: -10.0 },
	{ symbol: "JOSHI", ltp: 460.3, pointChange: -51.1, percentChange: -9.99 },
	{ symbol: "SAPDBL", ltp: 969.0, pointChange: -101.0, percentChange: -9.44 },
	{ symbol: "GRDBL", ltp: 960.0, pointChange: -88.0, percentChange: -8.4 },
	{ symbol: "SLBSL", ltp: 1917.0, pointChange: -137.8, percentChange: -6.71 },
	{ symbol: "BHL", ltp: 364.6, pointChange: -24.4, percentChange: -6.27 },
];
