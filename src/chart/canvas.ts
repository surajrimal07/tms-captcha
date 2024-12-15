export function setupCanvas(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  const desiredHeight = 120;

  canvas.width = canvas.offsetWidth * dpr;
  canvas.height = desiredHeight * dpr;
  canvas.style.width = `${canvas.offsetWidth}px`;
  canvas.style.height = `${desiredHeight}px`;

  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.scale(dpr, dpr);
  }

  return {
    width: canvas.offsetWidth,
    height: desiredHeight,
    ctx,
  };
}
