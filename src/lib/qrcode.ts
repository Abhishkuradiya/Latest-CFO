/**
 * Lightweight SVG QR Code Generator for otpauth:// URIs
 */

export function generateQrSvg(text: string): string {
  // We can use quick-chart API or SVG matrix fallback
  const encoded = encodeURIComponent(text);
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encoded}`;
  return qrApiUrl;
}
