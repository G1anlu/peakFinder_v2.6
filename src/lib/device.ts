/**
 * Verifica multi-fattore che il dispositivo sia un vero smartphone/tablet.
 * Non basta ridimensionare la finestra del browser da PC: serve il touch
 * E un user agent mobile O un puntatore "coarse" (dito).
 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;

  // 1. User Agent mobile
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || "";
  const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

  // 2. Touch screen reale
  const hasTouchScreen =
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0;

  // 3. Puntatore primario impreciso (dito, non mouse)
  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;

  return (isMobileUA || isCoarsePointer) && hasTouchScreen;
}
