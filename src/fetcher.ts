import { defaultNepseIndexData } from "./chart/data";
import type { ChartDataArray, ChartDataPoint } from "./chart/interfact";
import { type NepseData, NepseState, defaultNepseData } from "./interface";

export async function loadDefaultNepseData(): Promise<NepseData> {
  try {
    const response = await fetch(
      "https://nepse.surajrimal.dev/nepse/index-intraday?refresh=true"
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch NEPSE data: ${response.statusText}`);
    }

    const data = (await response.json()) as NepseData;
    chrome.storage.local.set({ nepseData: data });

    return data;
  } catch (error) {
    console.error("Error fetching NEPSE data:", error);
    return defaultNepseData;
  }
}

export async function loadNepseOpen(): Promise<NepseState> {
  try {
    const response = await fetch("https://nepse.surajrimal.dev/nepse/isOpen");

    if (!response.ok) {
      throw new Error(
        `Failed to fetch NEPSE Open data: ${response.statusText}`
      );
    }

    const data = (await response.json()) as NepseState;

    chrome.storage.local.set({ data });
    return data;
  } catch (error) {
    console.error("Error fetching NEPSE Open data:", error);
    return NepseState.CLOSE;
  }
}

export async function loadDefaultNepseIndexData(): Promise<ChartDataArray> {
  try {
    const response = await fetch(
      "https://nepse.surajrimal.dev/nepse/nepseintradaychart?refresh=true"
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch NEPSE Intraday data: ${response.statusText}`
      );
    }

    const data = (await response.json()) as NepseData;

    if (
      Array.isArray(data) &&
      data.every(
        (point): point is ChartDataPoint =>
          Array.isArray(point) &&
          point.length === 2 &&
          typeof point[0] === "number" &&
          typeof point[1] === "number"
      )
    ) {
      chrome.storage.local.set({ nepseChartData: data });
      return data;
    }

    throw new Error("Invalid data structure received from API");
  } catch (error) {
    console.error("Error fetching NEPSE data:", error);
    return defaultNepseIndexData;
  }
}
