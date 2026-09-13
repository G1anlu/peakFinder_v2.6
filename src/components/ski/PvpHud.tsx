interface Props {
  /** Punti Sfida del match in corso (temporanei). */
  myPoints: number;
  /** Punti Sfida dell'avversario. */
  opponentPoints: number;
  /** Nome dell'avversario. */
  opponentName?: string | null;
  /** Saldo permanente di Monete Spendibili del profilo. */
  coins: number;
}

const fmt = (n: number) => new Intl.NumberFormat("it-IT").format(Math.round(n));

/** HUD in alto a destra: Punti Sfida del match e Monete Spendibili del profilo. */
export function PvpHud({ myPoints, opponentPoints, opponentName, coins }: Props) {
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-50 flex flex-col items-end gap-2">
      <div className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-right backdrop-blur">
        <p className="text-[10px] uppercase tracking-wide text-slate-300">Punti Sfida (oggi)</p>
        <p className="font-display text-sm font-semibold text-slate-50">
          ⚡ Tu: {fmt(myPoints)} pts
          <span className="text-slate-400"> | </span>
          <span className="text-slate-200">
            {opponentName ?? "Avversario"}: {fmt(opponentPoints)} pts
          </span>
        </p>
      </div>
      <div className="rounded-xl border border-amber-300/20 bg-slate-900/80 px-3 py-2 backdrop-blur">
        <p className="font-display text-sm font-semibold text-amber-300">🪙 {fmt(coins)} Monete</p>
        <p className="text-[10px] text-slate-300">Saldo spendibile del profilo</p>
      </div>
    </div>
  );
}
