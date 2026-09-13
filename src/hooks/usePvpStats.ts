import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getPvpStats, type PvpStats } from "@/lib/ski/pvp.functions";

/** Elo e monete del profilo, aggiornati in tempo reale a fine sfida. */
export function usePvpStats() {
  const { isAuthenticated, user } = useAuth();
  const load = useServerFn(getPvpStats);
  const qc = useQueryClient();

  const query = useQuery<PvpStats>({
    queryKey: ["pvp-stats"],
    queryFn: () => load({ data: undefined as never }),
    enabled: isAuthenticated,
    staleTime: 1000 * 15,
  });

  useEffect(() => {
    const id = user?.id;
    if (!id) return;
    const channel = supabase
      .channel(`profile-stats-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${id}` },
        () => void qc.invalidateQueries({ queryKey: ["pvp-stats"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc, user?.id]);

  return {
    stats: query.data ?? null,
    loading: isAuthenticated && query.isPending,
  };
}
