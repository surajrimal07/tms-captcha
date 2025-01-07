import type { IndexKey } from "../interface";

export interface ChartData {
	data: [number, number][];
	ctx: CanvasRenderingContext2D;
	xScale: number;
	yScale: number;
	height: number;
	width: number;
	padding: number;
	minY: number;
	minX: number;
}

export type ChartDataPoint = [number, number];

export type ChartDataArray = ChartDataPoint[];

export interface OtherIndexChartData {
	data: ChartDataPoint[];
	type: IndexKey;
}

//for other indexes we have to add type too , type of type IndexKey
export type OtherChartDataArray = OtherIndexChartData[];
