/**
 * Link di prenotazione Booking.com.
 * Se l'API RapidAPI restituisce l'URL diretto della struttura lo usiamo così
 * com'è; altrimenti costruiamo una ricerca pubblica su Booking.com con nome
 * struttura e comprensorio.
 */
export function bookingHotelUrl(
  hotelName: string,
  resortName: string,
  directUrl?: string | null,
): string {
  const direct = (directUrl ?? "").trim();
  if (direct.startsWith("http")) return direct;
  const query = [hotelName, resortName].filter(Boolean).join(" ");
  return `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(query)}`;
}

/** Ricerca Booking.com per la località, usata quando l'API hotel non risponde. */
export function bookingDestinationUrl(
  resortName: string,
  checkIn?: string | null,
  checkOut?: string | null,
  adults = 2,
): string {
  const params = new URLSearchParams({ ss: resortName, group_adults: String(adults) });
  if (checkIn) params.set("checkin", checkIn);
  if (checkOut) params.set("checkout", checkOut);
  return `https://www.booking.com/searchresults.it.html?${params}`;
}
