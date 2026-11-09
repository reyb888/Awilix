export function clampOverlayPosition(x, y, width, height, viewportWidth, viewportHeight) {
  const margin = 8;
  return {
    x: Math.max(margin, Math.min(x, Math.max(margin, viewportWidth - width - margin))),
    y: Math.max(margin, Math.min(y, Math.max(margin, viewportHeight - height - margin))),
  };
}
