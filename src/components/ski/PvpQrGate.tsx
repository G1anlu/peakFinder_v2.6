import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";

/**
 * Blocco desktop della Sfida PvP: mostra un QR Code con l'URL corrente
 * così da passare al volo sullo smartphone.
 */
export function PvpQrGate() {
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState("");

  useEffect(() => {
    const current = window.location.href;
    setUrl(current);
    void (async () => {
      const QRCode = (await import("qrcode")).default;
      const data = await QRCode.toDataURL(current, {
        width: 320,
        margin: 1,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      setQr(data);
    })();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-center backdrop-blur">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-slate-700 bg-slate-800">
          <Smartphone className="h-7 w-7 text-lime-400" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold text-slate-50">Sfida PvP</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          La Sfida PvP è disponibile esclusivamente da dispositivo mobile. Inquadra il QR Code con
          il tuo smartphone per accedere al campo di gara!
        </p>
        <div className="mt-6 grid place-items-center rounded-2xl bg-white p-4">
          {qr ? (
            <img src={qr} alt="QR Code per aprire la Sfida PvP sullo smartphone" className="h-56 w-56" />
          ) : (
            <div className="h-56 w-56 animate-pulse rounded-xl bg-slate-200" />
          )}
        </div>
        <p className="mt-4 break-all text-xs text-slate-500">{url}</p>
      </div>
    </div>
  );
}
