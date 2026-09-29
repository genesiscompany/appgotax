/**
 * PDV serves product files at /uploads/produtos. The upload API may return
 * /api/uploads/produtos (or its absolute API URL), which is not served on
 * the PDV host. Leave older PDV links and unrelated images unchanged.
 */
export function productImageUrl(image: string | null | undefined): string | null {
  if (!image) return null;
  const path = image.startsWith("https://api.gotaxi.com.br/")
    ? image.slice("https://api.gotaxi.com.br".length)
    : image;
  if (path.startsWith("/api/uploads/produtos/")) {
    return path.slice("/api".length);
  }
  return image;
}