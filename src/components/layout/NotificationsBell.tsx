import { useState } from "react";
import { Bell, BellRing, CloudSnow, Newspaper, Snowflake, UserPlus, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ensureAbsoluteUrl } from "@/lib/url";
import { useNotifications, usePushPermission } from "@/hooks/useNotifications";
import type { AppNotification } from "@/hooks/useNotifications";

const ICONS = {
  snow: CloudSnow,
  weather: Wind,
  lifts: Snowflake,
  news: Newspaper,
  friend: UserPlus,
} as const;

function Row({ n }: { n: AppNotification }) {
  const Icon = ICONS[n.kind];
  const external = n.href.startsWith("http");
  const content = (
    <span className="flex gap-3 px-4 py-3 text-left hover:bg-accent">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{n.title}</span>
        <span className="block text-xs text-muted-foreground">{n.message}</span>
      </span>
    </span>
  );
  return (
    <li>
      <a
        href={external ? ensureAbsoluteUrl(n.href) : n.href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="block"
      >
        {content}
      </a>
    </li>
  );
}

/** Campanella con la cronologia degli avvisi sulle località preferite. */
export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const { notifications } = useNotifications();
  const { permission, request } = usePushPermission();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifiche: ${notifications.length}`}
        aria-expanded={open}
        className="relative text-muted-foreground hover:text-foreground"
      >
        {notifications.length > 0 ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {notifications.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Chiudi notifiche"
            className="fixed inset-0 z-[9998] cursor-default bg-foreground/30 sm:bg-transparent"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-[9999] max-h-[80vh] w-full overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:bottom-auto sm:mt-2 sm:max-h-none sm:w-80 sm:rounded-2xl">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-card-foreground">Notifiche</p>
              <p className="text-xs text-muted-foreground">
                Meteo, impianti e notizie delle tue località preferite.
              </p>
            </div>
            <ul className="max-h-[55vh] divide-y divide-border overflow-y-auto overscroll-contain sm:max-h-80">
              {notifications.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Nessun avviso al momento.
                </li>
              ) : (
                notifications.map((n) => <Row key={n.id} n={n} />)
              )}
            </ul>
            {permission !== "granted" && permission !== "unsupported" && (
              <div className="border-t border-border px-4 py-3">
                <Button size="sm" className="w-full" onClick={() => void request()}>
                  Attiva le notifiche sul dispositivo
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
