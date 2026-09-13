/**
 * Bonus giornalieri sugli impianti: la selezione è deterministica (stessa
 * combinazione impianto + giorno ⇒ stesso esito) così client e server sono
 * sempre d'accordo su quali impianti valgono monete.
 */

export const LIFT_BONUS_COINS = 50;
/** Raggio di riconoscimento delle stazioni di valle/monte. */
export const LIFT_STATION_RADIUS_M = 20;

export function todayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Hash stabile (FNV-1a) su impianto + giorno. */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Un impianto su cinque, ogni giorno diverso, nasconde una cassa del tesoro. */
export function liftHasBonus(liftId: number, day: string = todayKey()): boolean {
  return hash(`${liftId}:${day}`) % 5 === 0;
}
