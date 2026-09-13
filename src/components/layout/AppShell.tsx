import { Link } from "@tanstack/react-router";
import { Compass, LogOut, MapPlus, Snowflake, Swords, User } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useLiveDataRefresh } from "@/hooks/useLiveDataRefresh";
import { NotificationsBell } from "@/components/layout/NotificationsBell";
import { useSkiProfile } from "@/hooks/useSkiProfile";
import { OnboardingFlow } from "@/components/ski/OnboardingFlow";
import { WelcomeGate } from "@/components/ski/WelcomeScreen";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { CookieBanner } from "@/components/legal/CookieBanner";


/** Onboarding non aggirabile finché il profilo non è completo. */
function OnboardingGate() {
  const { needsOnboarding } = useSkiProfile();
  if (!needsOnboarding) return null;
  return <OnboardingFlow />;
}

const NAV = [
  { to: "/", label: "Esplora", icon: Compass, exact: true },
  { to: "/itinerario", label: "Crea itinerario", icon: MapPlus, exact: false },
  { to: "/pvp", label: "Sfida PvP", icon: Swords, exact: false },
  { to: "/profilo", label: "Profilo", icon: User, exact: false },
] as const;

function AccountBar() {
  const { isAuthenticated, username: authUsername, loading, signOut } = useAuth();
  // Unica sorgente di verità per foto e nome: il profilo condiviso.
  const { profile } = useSkiProfile();
  const username = profile.username || authUsername;
  const avatar = profile.avatarUrl;
  if (loading) return null;
  return (
    <div className="flex items-center justify-end gap-3 border-b border-border bg-card/60 px-5 py-2">
      {isAuthenticated ? (
        <>
          <NotificationsBell />
          <Link to="/profilo" className="flex items-center gap-2 text-sm font-medium text-foreground">
            {avatar ? (
              <img
                src={avatar}
                alt="Foto profilo"
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {username.slice(0, 2).toUpperCase()}
              </span>
            )}
            <span className="hidden sm:inline">{username}</span>
          </Link>
          <Button size="sm" variant="ghost" onClick={() => void signOut()} aria-label="Esci">
            <LogOut className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <Button asChild size="sm" variant="secondary">
          <Link to="/login" search={{ next: "/profilo" }}>
            Accedi
          </Link>
        </Button>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  useLiveDataRefresh();
  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-card px-4 py-6 lg:flex">
        <Link to="/" className="flex items-center gap-2 px-2 text-primary">
          <Snowflake className="h-5 w-5" />
          <span className="font-display text-lg font-semibold text-foreground">PeakFinder</span>
        </Link>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, exact }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact }}
              activeProps={{ className: "bg-primary/10 text-primary" }}
              inactiveProps={{ className: "text-muted-foreground hover:bg-accent" }}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          ))}
        </nav>
        <p className="mt-auto px-3 text-xs text-muted-foreground">
          Ore reali sugli sci, non solo chilometri.
        </p>
      </aside>

      {/* Contenuto */}
      <div className="lg:pl-60">
        <AccountBar />
        <div className="pb-24 lg:pb-0">{children}</div>
        <SiteFooter />
        <OnboardingGate />
        <WelcomeGate />
        <CookieBanner />

      </div>

      {/* Bottom bar mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur lg:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-4 items-end px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {NAV.map(({ to, label, icon: Icon, exact }) => {
            return (
              <li key={to} className="flex justify-center">
                <Link
                  to={to}
                  activeOptions={{ exact }}
                  activeProps={{ className: "text-primary" }}
                  inactiveProps={{ className: "text-muted-foreground" }}
                  className="flex w-full flex-col items-center gap-1 rounded-xl py-1 text-[11px] font-medium"
                >
                  <Icon className="h-5 w-5" />
                  <span className="truncate">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
