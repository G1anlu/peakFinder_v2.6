import { createFileRoute } from "@tanstack/react-router";
import { PvpArena } from "@/components/ski/PvpArena";

export const Route = createFileRoute("/pvp")({
  head: () => ({
    meta: [
      { title: "Sfida PvP — duello sugli sci | PeakFinder" },
      {
        name: "description",
        content:
          "Sfida un altro sciatore del tuo livello: km in discesa, impianti e velocità media tracciati dal GPS decidono il vincitore della giornata.",
      },
      { property: "og:title", content: "Sfida PvP — duello sugli sci | PeakFinder" },
      {
        property: "og:description",
        content:
          "Abbinamento per punteggio Elo, tracciamento GPS delle discese e premi in monete PeakFinder.",
      },
    ],
  }),
  component: PvpPage,
});

function PvpPage() {
  return <PvpArena />;
}
