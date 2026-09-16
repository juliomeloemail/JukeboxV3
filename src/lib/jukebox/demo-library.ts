import type { Library, Track } from "./types";

const raw: Array<[string, string, number, string[]]> = [
  ["Adriana Calcanhotto", "Marítimo", 1998, ["Devolva-me", "Vambora", "Mais Feliz", "Cariocas"]],
  [
    "Barão Vermelho",
    "Maior Abandonado",
    1984,
    ["Pro Dia Nascer Feliz", "Bete Balanço", "Menina Mulher"],
  ],
  ["Caetano Veloso", "Livro", 1997, ["Não Enche", "Alexandre", "Livros", "Manhatã"]],
  ["Djavan", "Luz", 1982, ["Sina", "Esquinas", "Açaí", "Pétala"]],
  ["Elis Regina", "Falso Brilhante", 1976, ["Fascinação", "Atrás da Porta", "Como Nossos Pais"]],
  [
    "Jorge Ben Jor",
    "África Brasil",
    1976,
    ["Ponta de Lança Africano", "Taj Mahal", "Xica da Silva"],
  ],
  [
    "Legião Urbana",
    "Dois",
    1986,
    ["Tempo Perdido", "Eduardo e Mônica", "Índios", "Quase Sem Querer"],
  ],
  ["Marisa Monte", "Verde Anil", 1994, ["Segue o Seco", "Maraçá", "Na Estrada", "Bem Leve"]],
  [
    "Novos Baianos",
    "Acabou Chorare",
    1972,
    ["Preta Pretinha", "Mistério do Planeta", "Tinindo Trincando"],
  ],
  ["Tim Maia", "Racional", 1975, ["Que Beleza", "Bom Senso", "Imunização Racional"]],
];

function slug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

export const demoTracks: Track[] = raw.flatMap(([artist, album, year, titles]) =>
  titles.map((title, i) => ({
    id: `demo-${slug(artist)}-${slug(album)}-${i}`,
    title,
    artist,
    album,
    year,
    trackNo: i + 1,
    genre: "MPB",
    duration: 170 + ((title.length * 13) % 140),
    url: "",
  })),
);

export const demoLibrary: Library = {
  folder: "C:\\musicas\\jukebox (demonstração)",
  scannedAt: new Date().toISOString(),
  tracks: demoTracks,
  demo: true,
};
