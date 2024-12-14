

export function getMinMaxValues(data: [number, number][]) {
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of data) {
    const value = point[1];
    minY = Math.min(minY, value);
    maxY = Math.max(maxY, value);
  }

  const padding = (maxY - minY) * 0.1;
  return {
    minY: Math.floor(minY - padding),
    maxY: Math.ceil(maxY + padding),
  };
}
