import { createFileRoute, redirect } from "@tanstack/react-router";
import { authSearchSchema, safePath } from "@/lib/auth";

/**
 * Il form di autenticazione è stato separato nelle route /login e /signup.
 * /auth viene mantenuto come alias di compatibilità che redirige a /login,
 * preservando l'eventuale destinazione post-autenticazione.
 */
export const Route = createFileRoute("/auth")({
  validateSearch: authSearchSchema,
  beforeLoad: ({ search }) => {
    const destination = safePath(search.next ?? search.redirectTo ?? search.returnUrl);
    throw redirect({
      to: "/login",
      search: destination === "/profilo" ? {} : { next: destination },
    });
  },
});
