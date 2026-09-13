import { useState } from "react";
import { Check, Loader2, Search, UserMinus, UserPlus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RESORT_CATALOG } from "@/lib/ski/catalog";
import { SKI_LEVEL_LABELS, type SkiLevelId } from "@/lib/ski/profile.functions";
import { useFriends, useUserProfile, useUserSearch } from "@/hooks/useFriends";
import type { UserSummary } from "@/lib/ski/social.functions";

function Avatar({ user, size = 40 }: { user: UserSummary; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-xs font-semibold text-primary"
      style={{ width: size, height: size }}
    >
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={`Foto profilo di ${user.username}`}
          className="h-full w-full object-cover"
        />
      ) : (
        user.username.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}

/** Scheda dell'utente: sintetica se non è ancora amico, completa se lo è. */
function UserDialog({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { data, isPending } = useUserProfile(userId);
  const { sendRequest, sending, removeFriend, removingFriend } = useFriends();
  const profile = data?.profile;
  const state = data?.state ?? "none";

  const names = (profile?.visitedResorts ?? []).map(
    (id) => RESORT_CATALOG.find((r) => r.id === id)?.name ?? id,
  );

  return (
    <Dialog open={Boolean(userId)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Profilo sciatore</DialogTitle>
        </DialogHeader>
        {isPending || !profile ? (
          <Skeleton className="h-32 w-full rounded-2xl" />
        ) : (
          <div>
            <div className="flex items-center gap-4">
              <Avatar user={profile} size={64} />
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-semibold text-foreground">
                  {profile.username}
                </p>
                <p className="text-xs font-semibold text-primary">
                  🏆 {profile.eloRating} ELO
                </p>
                <p className="text-sm text-muted-foreground">
                  {state === "friends"
                    ? "Siete amici"
                    : state === "pending_out"
                      ? "Richiesta inviata"
                      : state === "pending_in"
                        ? "Ti ha inviato una richiesta"
                        : "Non siete ancora amici"}
                </p>
              </div>
            </div>

            {profile.isFriend ? (
              <div className="mt-5 space-y-3 text-sm">
                {profile.bio && <p className="text-muted-foreground">{profile.bio}</p>}
                <p className="text-foreground">
                  Livello:{" "}
                  <span className="font-semibold">
                    {SKI_LEVEL_LABELS[(profile.skiLevel ?? "intermediate") as SkiLevelId]}
                  </span>
                </p>
                <div>
                  <p className="font-medium text-foreground">
                    Comprensori visitati ({names.length})
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {names.length > 0 ? names.join(" · ") : "Nessuno ancora."}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="w-full text-destructive hover:text-destructive"
                  disabled={removingFriend}
                  onClick={() => {
                    if (!confirm("Sei sicuro di voler rimuovere questo amico?")) return;
                    void removeFriend(profile.id).then(onClose);
                  }}
                >
                  {removingFriend ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserMinus className="mr-2 h-4 w-4" />
                  )}
                  Rimuovi amico
                </Button>
              </div>
            ) : (
              <div className="mt-5">
                <p className="text-sm text-muted-foreground">
                  Il profilo completo (itinerari, livello, comprensori e preferiti) è visibile solo
                  agli amici.
                </p>
                {state === "none" || state === "declined" ? (
                  <Button
                    className="mt-4 w-full"
                    disabled={sending}
                    onClick={() => void sendRequest(profile.id)}
                  >
                    {sending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="mr-2 h-4 w-4" />
                    )}
                    Invia richiesta di amicizia
                  </Button>
                ) : (
                  <p className="mt-4 rounded-xl bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                    {state === "pending_out"
                      ? "Richiesta in attesa di risposta."
                      : "Rispondi alla richiesta dalla sezione Amici."}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Sezione Amici: ricerca, richieste in sospeso ed elenco amici. */
export function FriendsPanel() {
  const {
    isAuthenticated,
    friends,
    incoming,
    outgoing,
    loading,
    respond,
    remove,
    removeFriend,
    removingFriend,
  } = useFriends();
  const [query, setQuery] = useState("");
  const { users, searching } = useUserSearch(query);
  const [selected, setSelected] = useState<string | null>(null);

  if (!isAuthenticated) return null;

  return (
    <section className="mt-6 rounded-3xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-semibold text-foreground">Amici</h2>
        <span className="ml-auto rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          {friends.length}
        </span>
      </div>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca un amico per nome utente o email…"
          className="pl-9"
          aria-label="Cerca amico"
        />
      </div>

      {query.trim().length >= 2 && (
        <ul className="mt-3 divide-y divide-border rounded-2xl border border-border">
          {searching && (
            <li className="px-4 py-3">
              <Skeleton className="h-6 w-40" />
            </li>
          )}
          {!searching && users.length === 0 && (
            <li className="px-4 py-3 text-sm text-muted-foreground">Nessun utente trovato.</li>
          )}
          {users.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => setSelected(u.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent"
              >
                <Avatar user={u} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {u.username}
                  <span className="block truncate text-xs text-muted-foreground">
                    🏆 {u.eloRating} ELO
                  </span>
                </span>
                <span className="text-xs font-semibold text-primary">Vedi profilo</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {incoming.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-semibold text-foreground">Richieste ricevute</p>
          <ul className="mt-2 space-y-2">
            {incoming.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-2xl border border-border px-3 py-2"
              >
                <Avatar user={r.user} />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {r.user.username}
                  <span className="block truncate text-xs text-muted-foreground">
                    🏆 {r.user.eloRating} ELO
                  </span>
                </span>
                <Button size="sm" onClick={() => void respond({ id: r.id, accept: true })}>
                  <Check className="h-4 w-4" /> Accetta
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void respond({ id: r.id, accept: false })}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-semibold text-foreground">Richieste inviate</p>
          <ul className="mt-2 space-y-2">
            {outgoing.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-2xl border border-dashed border-border px-3 py-2"
              >
                <Avatar user={r.user} />
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  {r.user.username} · in attesa
                </span>
                <Button size="sm" variant="ghost" onClick={() => void remove(r.id)}>
                  Annulla
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5">
        {loading ? (
          <Skeleton className="h-12 w-full rounded-2xl" />
        ) : friends.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Non hai ancora amici: cercali per nome utente o email.
          </p>
        ) : (
          <ul className="space-y-2">
            {friends.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-2 rounded-2xl border border-border px-3 py-2"
              >
                <button
                  type="button"
                  onClick={() => setSelected(f.user.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <Avatar user={f.user} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {f.user.username}
                    <span className="block truncate text-xs text-muted-foreground">
                      🏆 {f.user.eloRating} ELO
                    </span>
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    Profilo completo
                  </span>
                </button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0 text-destructive hover:text-destructive"
                  disabled={removingFriend}
                  onClick={() => {
                    if (!confirm("Sei sicuro di voler rimuovere questo amico?")) return;
                    void removeFriend(f.user.id);
                  }}
                >
                  <UserMinus className="h-4 w-4" />
                  <span className="sr-only">Rimuovi amico</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <UserDialog userId={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
