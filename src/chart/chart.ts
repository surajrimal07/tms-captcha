import { drawArea } from "./area";
import { setupCanvas } from "./canvas";
import { getMinMaxValues } from "./chartdata";
import type { ChartData, ChartDataPoint } from "./interfact";
import { Tooltip } from "./tooltip";

export class Chart {
  private canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private data: ChartDataPoint[];
  private padding: number;
  private tooltip: Tooltip;

  private xScale: number;
  private yScale: number;
  private minY: number;
  private maxY: number;
  private minX: number;

  constructor(canvas: HTMLCanvasElement, data: ChartDataPoint[]) {
    const setup = setupCanvas(canvas);
    if (!setup.ctx) throw new Error("Failed to get canvas context");

    this.canvas = canvas;
    this.ctx = setup.ctx;
    this.width = setup.width;
    this.height = setup.height;
    this.data = data;
    this.padding = 0;
    this.xScale = 0;
    this.yScale = 0;
    this.minY = 0;
    this.maxY = 0;
    this.minX = data[0]?.[0] ?? 0;

    this.tooltip = new Tooltip();
    this.calculateScales();
    this.setupEventListeners();
  }

  public updateData(newData: ChartDataPoint[]): void {
    this.data = newData;
    this.minX = newData[0]?.[0] ?? 0;
    this.calculateScales();
  }

  private calculateScales(): void {
    const { minY, maxY } = getMinMaxValues(this.data);
    this.xScale = (this.width - this.padding * 2) / (this.data.length - 1);
    this.yScale = (this.height - this.padding * 2) / (maxY - minY);
    this.minY = minY;
    this.maxY = maxY;
  }

  private getDataPointFromMouse(
    mouseX: number,
    mouseY: number
  ): ChartDataPoint | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = mouseX - rect.left;
    const y = mouseY - rect.top;

    const dataIndex = Math.round((x - this.padding) / this.xScale);
    if (dataIndex >= 0 && dataIndex < this.data.length) {
      const point = this.data[dataIndex];
      const pointX = this.padding + dataIndex * this.xScale;
      const pointY =
        this.height - (this.padding + (point[1] - this.minY) * this.yScale);

      const distance = Math.sqrt((x - pointX) ** 2 + (y - pointY) ** 2);
      return distance <= 20 ? point : null;
    }
    return null;
  }

  private handleMouseMove = (e: MouseEvent): void => {
    const point = this.getDataPointFromMouse(e.clientX, e.clientY);
    if (point) {
      const [timestamp, value] = point;
      const tooltipContent = `
     <div>
        <div>${new Date(timestamp * 1000).toLocaleString("en-US", {
          timeZone: "Asia/Kathmandu",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })}</div>
        <div>${value.toFixed(2)}</div>
      </div>
    `;
      const rect = this.canvas.getBoundingClientRect();
      const x =
        this.padding + this.data.indexOf(point) * this.xScale + rect.left;
      const y =
        this.height -
        (this.padding + (value - this.minY) * this.yScale) +
        rect.top;
      this.tooltip.show(x, y, tooltipContent);
    } else {
      this.tooltip.hide();
    }
  };

  private handleMouseLeave = (): void => {
    this.tooltip.hide();
  };

  private setupEventListeners(): void {
    this.canvas.addEventListener("mousemove", this.handleMouseMove);
    this.canvas.addEventListener("mouseleave", this.handleMouseLeave);
  }

  public destroy(): void {
    this.canvas.removeEventListener("mousemove", this.handleMouseMove);
    this.canvas.removeEventListener("mouseleave", this.handleMouseLeave);
    this.tooltip.destroy();
  }

  public render(): void {
    const chartProps: ChartData = {
      ctx: this.ctx,
      data: this.data,
      xScale: this.xScale,
      yScale: this.yScale,
      height: this.height,
      width: this.width,
      padding: this.padding,
      minY: this.minY,
      minX: this.minX,
    };

    this.ctx.clearRect(0, 0, this.width, this.height);
    drawArea(chartProps);
  }
}
