export function clampOverlaySize(width, height, viewportWidth, viewportHeight) {
  const maxWidth = Math.max(1, viewportWidth - 16);
  const maxHeight = Math.max(1, viewportHeight - 16);
  return {
    width: Math.min(maxWidth, Math.max(Math.min(310, maxWidth), width)),
    height: Math.min(maxHeight, Math.max(Math.min(360, maxHeight), height)),
  };
}
