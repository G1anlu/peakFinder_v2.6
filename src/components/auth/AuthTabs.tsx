import { Link } from "@tanstack/react-router";

interface AuthTabsProps {
  active: "login" | "signup";
  next?: string;
}

/** Tab visibili per passare tra Accedi e Registrati mantenendo la destinazione. */
export function AuthTabs({ active, next }: AuthTabsProps) {
  const search = { next: next && next !== "/profilo" ? next : undefined };
  const base =
    "flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors";
  const activeCls = "bg-background text-foreground shadow-sm";
  const inactiveCls = "text-muted-foreground hover:text-foreground";

  return (
    <div
      role="tablist"
      aria-label="Autenticazione"
      className="mt-5 flex gap-1 rounded-xl bg-muted p-1"
    >
      <Link
        role="tab"
        aria-selected={active === "login"}
        to="/login"
        search={search}
        className={`${base} ${active === "login" ? activeCls : inactiveCls}`}
      >
        Accedi
      </Link>
      <Link
        role="tab"
        aria-selected={active === "signup"}
        to="/signup"
        search={search}
        className={`${base} ${active === "signup" ? activeCls : inactiveCls}`}
      >
        Registrati
      </Link>
    </div>
  );
}
