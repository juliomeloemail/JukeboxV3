import { createFileRoute } from "@tanstack/react-router";

import { JukeboxApp } from "@/components/jukebox/JukeboxApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Jukebox de Festa — músicas do seu computador" },
      {
        name: "description",
        content:
          "Jukebox para festas em casa: toca os MP3 do seu computador, organiza por artista e álbum e deixa os convidados pedirem músicas pelo celular.",
      },
      { property: "og:title", content: "Jukebox de Festa" },
      {
        property: "og:description",
        content: "Toque os MP3 do seu computador e receba pedidos dos convidados na rede local.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return <JukeboxApp />;
}
