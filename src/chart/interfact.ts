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