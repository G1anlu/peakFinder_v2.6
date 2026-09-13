import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  type FriendEdge,
  type FriendProfile,
  type FriendState,
  getUserProfile,
  listFriendships,
  removeFriend,
  removeFriendship,
  respondToFriendRequest,
  searchUsers,
  sendFriendRequest,
} from "@/lib/ski/social.functions";

type FriendshipsData = {
  friends: FriendEdge[];
  incoming: FriendEdge[];
  outgoing: FriendEdge[];
};

type UserProfileData = { profile: FriendProfile | null; state: FriendState };

/** Amici confermati, richieste ricevute e inviate. */
export function useFriends() {
  const { isAuthenticated, user } = useAuth();
  const load = useServerFn(listFriendships);
  const send = useServerFn(sendFriendRequest);
  const respond = useServerFn(respondToFriendRequest);
  const remove = useServerFn(removeFriendship);
  const unfriend = useServerFn(removeFriend);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["friendships"],
    queryFn: () => load({ data: undefined as never }),
    enabled: isAuthenticated,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["friendships"] });
    void qc.invalidateQueries({ queryKey: ["user-profile"] });
  };

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;

    const channel = supabase
      .channel(`friendships-${userId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        (payload) => {
          const row = (payload.new ?? payload.old) as
            | { requester_id?: string; addressee_id?: string }
            | null;
          if (!row || (row.requester_id !== userId && row.addressee_id !== userId)) return;
          void qc.invalidateQueries({ queryKey: ["friendships"] });
          void qc.invalidateQueries({ queryKey: ["user-profile"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc, user?.id]);


  const sendRequest = useMutation({
    mutationFn: (userId: string) => send({ data: { userId } }),
    onMutate: async (userId) => {
      await qc.cancelQueries({ queryKey: ["user-profile", userId] });
      const previous = qc.getQueryData<UserProfileData>(["user-profile", userId]);
      qc.setQueryData<UserProfileData>(["user-profile", userId], (current) =>
        current ? { ...current, state: "pending_out" } : current,
      );
      return { previous, userId };
    },
    onError: (_error, _userId, context) => {
      if (context?.previous) {
        qc.setQueryData(["user-profile", context.userId], context.previous);
      }
      toast.error("Richiesta non inviata. Riprova.");
    },
    onSuccess: invalidate,
  });
  const answer = useMutation({
    mutationFn: (input: { id: string; accept: boolean }) => respond({ data: input }),
    onMutate: async ({ id, accept }) => {
      await qc.cancelQueries({ queryKey: ["friendships"] });
      const previous = qc.getQueryData<FriendshipsData>(["friendships"]);
      qc.setQueryData<FriendshipsData>(["friendships"], (current) => {
        if (!current) return current;
        const request = current.incoming.find((item) => item.id === id);
        return {
          ...current,
          incoming: current.incoming.filter((item) => item.id !== id),
          friends:
            accept && request
              ? [{ ...request, status: "accepted" }, ...current.friends]
              : current.friends,
        };
      });
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) qc.setQueryData(["friendships"], context.previous);
      toast.error("Non è stato possibile aggiornare la richiesta.");
    },
    onSuccess: invalidate,
  });
  const drop = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: invalidate,
  });
  const dropFriend = useMutation({
    mutationFn: (userId: string) => unfriend({ data: { userId } }),
    onSuccess: invalidate,
  });

  return {
    isAuthenticated,
    friends: query.data?.friends ?? [],
    incoming: query.data?.incoming ?? [],
    outgoing: query.data?.outgoing ?? [],
    loading: isAuthenticated && query.isPending,
    sendRequest: sendRequest.mutateAsync,
    sending: sendRequest.isPending,
    respond: answer.mutateAsync,
    remove: drop.mutateAsync,
    removeFriend: dropFriend.mutateAsync,
    removingFriend: dropFriend.isPending,
  };
}

/** Ricerca utenti per nome utente o email. */
export function useUserSearch(query: string) {
  const { isAuthenticated } = useAuth();
  const search = useServerFn(searchUsers);
  const term = query.trim();

  const result = useQuery({
    queryKey: ["user-search", term],
    queryFn: () => search({ data: { query: term } }),
    enabled: isAuthenticated && term.length >= 2,
    staleTime: 1000 * 30,
  });

  return { users: result.data?.users ?? [], searching: result.isFetching };
}

/** Scheda di un altro utente (sintetica se non siete ancora amici). */
export function useUserProfile(userId: string | null) {
  const get = useServerFn(getUserProfile);
  return useQuery({
    queryKey: ["user-profile", userId],
    queryFn: () => get({ data: { userId: userId as string } }),
    enabled: Boolean(userId),
  });
}
