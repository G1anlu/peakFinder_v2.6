import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { deleteOwnAccount } from "@/lib/ski/social.functions";

/** Eliminazione definitiva dell'account e di tutti i dati collegati. */
export function DeleteAccountCard() {
  const { isAuthenticated } = useAuth();
  const runDelete = useServerFn(deleteOwnAccount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAuthenticated) return null;

  const handleDelete = async () => {
    if (
      !confirm(
        "ATTENZIONE: questa azione eliminerà definitivamente il tuo profilo e tutti i tuoi dati. Continuare?",
      )
    )
      return;
    if (!confirm("Conferma definitiva: vuoi davvero eliminare il tuo account?")) return;

    setBusy(true);
    setError(null);
    try {
      await runDelete({ data: undefined as never });
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eliminazione non riuscita");
      setBusy(false);
    }
  };

  return (
    <section className="mt-6 rounded-3xl border border-destructive/40 bg-destructive/5 p-6">
      <h2 className="font-display text-lg font-semibold text-destructive">Elimina account</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Cancella per sempre profilo, preferiti, itinerari e amicizie. L'operazione non è
        reversibile.
      </p>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <Button variant="destructive" className="mt-4" disabled={busy} onClick={() => void handleDelete()}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
        Elimina account
      </Button>
    </section>
  );
}
