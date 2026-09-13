import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mantiene i dati dell'app sempre freschi:
 * 1. Sottoscrizione Realtime sulla tabella `lifts`: a ogni inserimento o
 *    modifica riga, le query correlate vengono invalidate e React si aggiorna
 *    da solo, senza ricaricare la pagina.
 * 2. Al ritorno in primo piano (focus finestra o app Capacitor riattivata)
 *    tutte le query attive vengono rieseguite.
 */
export function useLiveDataRefresh() {
  const queryClient = useQueryClient();

  // Realtime su impianti/aggiornamenti
  useEffect(() => {
    const channel = supabase
      .channel("live-lifts")
      .on("postgres_changes", { event: "*", schema: "public", table: "lifts" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["lifts"] });
        void queryClient.invalidateQueries({ queryKey: ["lift-status"] });
        void queryClient.invalidateQueries({ queryKey: ["resort-news"] });
        void queryClient.invalidateQueries({ queryKey: ["ski-news"] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Re-fetch al ritorno in primo piano (browser e app nativa)
  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);

    let removeAppListener: (() => void) | undefined;
    void import("@capacitor/app")
      .then(async ({ App }) => {
        const handle = await App.addListener("appStateChange", (state) => {
          if (state.isActive) refresh();
        });
        removeAppListener = () => void handle.remove();
      })
      .catch(() => undefined); // non in ambiente Capacitor

    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
      removeAppListener?.();
    };
  }, [queryClient]);
}
