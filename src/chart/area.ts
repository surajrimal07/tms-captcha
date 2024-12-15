import type { ChartData } from "./interfact";

export function drawArea(chart: ChartData) {
  const { ctx, data, xScale, yScale, height, width, padding, minY } = chart;

  // Create path first
  ctx.beginPath();
  data.forEach((point, i) => {
    const x = padding + i * xScale;
    const y = height - (padding + (point[1] - minY) * yScale);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  // Complete gradient area path
  ctx.lineTo(width - padding, height - padding);
  ctx.lineTo(padding, height - padding);
  ctx.closePath();

  // Get colors from CSS variables
  const isPositive = ctx.canvas.parentElement?.classList.contains("positive");

  // Fill gradient area
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(
    0,
    isPositive ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)"
  );
  gradient.addColorStop(
    1,
    isPositive ? "rgba(16, 185, 129, 0.01)" : "rgba(239, 68, 68, 0.01)"
  );

  ctx.fillStyle = gradient;
  ctx.fill();

  // Draw line on top
  ctx.beginPath();
  data.forEach((point, i) => {
    const x = padding + i * xScale;
    const y = height - (padding + (point[1] - minY) * yScale);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.strokeStyle = isPositive ? "#10b981" : "#ef4444";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
