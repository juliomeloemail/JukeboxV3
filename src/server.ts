/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-empty */
import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { demoTracks } from "./lib/jukebox/demo-library";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// In-memory Jukebox server state
const state = {
  folder: "C:\\musicas\\jukebox",
  folderExists: false,
  scannedAt: new Date().toISOString(),
  tracks: demoTracks.map((t, idx) => ({
    ...t,
    id: `demo-${idx}`,
    url: `/jb/audio/demo-${idx}`,
  })),
  settings: {
    allowGuests: true,
    guestLimit: 3,
    partyName: "Jukebox de Festa",
  } as any,
  requests: [] as any[],
  nowPlaying: null as any,
};

// Map for quick track lookup
const tracksMap = new Map<string, any>();
for (const track of state.tracks) {
  tracksMap.set(track.id, track);
}

const AUDIO_EXT = new Set([".mp3", ".m4a", ".aac", ".ogg", ".wav", ".flac"]);

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  let entries: fs.Dirent[] = [];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      await walk(full, out);
    } else if (AUDIO_EXT.has(path.extname(e.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

function titleCase(s: string) {
  return s.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

async function scan(folder: string) {
  let resolvedFolder = folder;
  let isReal = false;
  try {
    const stat = await fsp.stat(folder).catch(() => null);
    if (stat && stat.isDirectory()) {
      isReal = true;
    } else {
      const workspacePath = path.join(
        process.cwd(),
        folder.replace(/^[a-zA-Z]:\\/, "").replace(/\\/g, "/"),
      );
      const workspaceStat = await fsp.stat(workspacePath).catch(() => null);
      if (workspaceStat && workspaceStat.isDirectory()) {
        resolvedFolder = workspacePath;
        isReal = true;
      }
    }
  } catch {
    // ignore
  }

  if (isReal) {
    const files = await walk(resolvedFolder);
    const scannedTracks: any[] = [];
    let n = 0;
    for (const file of files) {
      const rel = path.relative(resolvedFolder, file);
      const parts = rel.split(path.sep);
      const stat = await fsp.stat(file).catch(() => null);
      const base = titleCase(path.basename(file, path.extname(file)));
      const id = `t-${(n++).toString(36)}`;

      scannedTracks.push({
        id,
        title: base.replace(/^\d+\s*[-.]?\s*/, ""),
        artist: parts.length > 1 ? titleCase(parts[0]!) : "Desconhecido",
        album: parts.length > 2 ? titleCase(parts[1]!) : "Sem álbum",
        year: undefined,
        genre: "Music",
        trackNo: undefined,
        duration: stat ? Math.round((stat.size * 8) / (128 * 1000)) : 210,
        url: `/jb/audio/${id}`,
        file,
      });
    }

    scannedTracks.sort(
      (a, b) =>
        a.artist.localeCompare(b.artist, "pt-BR") ||
        a.album.localeCompare(b.album, "pt-BR") ||
        a.title.localeCompare(b.title, "pt-BR"),
    );

    state.folder = folder;
    state.folderExists = true;
    state.tracks = scannedTracks;
    state.scannedAt = new Date().toISOString();
    tracksMap.clear();
    for (const track of scannedTracks) {
      tracksMap.set(track.id, track);
    }
  } else {
    state.folder = folder || "C:\\musicas\\jukebox (Simulado)";
    state.folderExists = false;
    state.tracks = demoTracks.map((t, idx) => ({
      ...t,
      id: `demo-${idx}`,
      url: `/jb/audio/demo-${idx}`,
    }));
    state.scannedAt = new Date().toISOString();
    tracksMap.clear();
    for (const track of state.tracks) {
      tracksMap.set(track.id, track);
    }
  }
}

// Generates a 10-second beautiful procedural ambient synth audio
function generateAmbientWav(): Buffer {
  const sampleRate = 8000;
  const duration = 10;
  const numSamples = sampleRate * duration;
  const buffer = Buffer.alloc(44 + numSamples);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeInt32LE(36 + numSamples, 4);
  buffer.write("WAVE", 8);

  // "fmt " subchunk
  buffer.write("fmt ", 12);
  buffer.writeInt32LE(16, 16);
  buffer.writeInt16LE(1, 20);
  buffer.writeInt16LE(1, 22);
  buffer.writeInt32LE(sampleRate, 24);
  buffer.writeInt32LE(sampleRate, 28);
  buffer.writeInt16LE(1, 32);
  buffer.writeInt16LE(8, 34);

  // "data" subchunk
  buffer.write("data", 36);
  buffer.writeInt32LE(numSamples, 40);

  // Synthesize soft ambient bells / pad (E Major -> A Major)
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;

    let chord = [164.81, 207.65, 246.94, 329.63]; // E Major
    if (t > 5) {
      chord = [220.0, 277.18, 329.63, 440.0]; // A Major
    }

    let signal = 0;
    for (const freq of chord) {
      signal += Math.sin(2 * Math.PI * freq * t);
    }
    signal /= chord.length;

    const tremolo = 1 + 0.15 * Math.sin(2 * Math.PI * 4 * t);
    const envelope = Math.sin((Math.PI * t) / duration);

    const sample = signal * tremolo * envelope;
    const val = Math.max(0, Math.min(255, Math.floor((sample + 1) * 127.5)));
    buffer.writeUInt8(val, 44 + i);
  }

  return buffer;
}

// Guest screen template
function guestPage() {
  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pedir música</title>
<style>
 :root{color-scheme:dark}
 *{box-sizing:border-box}
 body{margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#0d0b14;color:#f4f1fa}
 header{position:sticky;top:0;background:#16121f;padding:16px;border-bottom:1px solid #2a2338;z-index:100}
 h1{margin:0 0 10px;font-size:18px}
 input{width:100%;padding:12px;border-radius:12px;border:1px solid #2a2338;background:#0d0b14;color:inherit;font-size:16px}
 .row{padding:12px 16px;border-bottom:1px solid #1e1929;display:flex;gap:12px;align-items:center}
 .row b{display:block;font-size:15px}
 .row span{font-size:12px;color:#9c93b5}
 button{margin-left:auto;background:#a855f7;color:#fff;border:0;border-radius:999px;padding:10px 16px;font-size:14px;font-weight:600;cursor:pointer}
 button:hover{background:#9333ea}
 #now{padding:12px 16px;font-size:13px;color:#c9bfe3;background:#1b1527}
 #toast{position:fixed;left:16px;right:16px;bottom:16px;background:#a855f7;color:#fff;padding:14px;border-radius:14px;text-align:center;display:none;z-index:200}
</style></head><body>
<header>
 <h1 id="party">Jukebox de Festa</h1>
 <input id="nome" placeholder="Seu nome" maxlength="24">
 <div style="height:8px"></div>
 <input id="busca" placeholder="Buscar música ou artista">
</header>
<div id="now"></div>
<div id="lista"></div>
<div id="toast"></div>
<script>
let tracks=[],nome=localStorage.getItem('jb.nome')||'';
document.getElementById('nome').value=nome;
document.getElementById('nome').oninput=e=>{nome=e.target.value;localStorage.setItem('jb.nome',nome)};
function toast(t){const el=document.getElementById('toast');el.textContent=t;el.style.display='block';setTimeout(()=>el.style.display='none',2200)}
function render(){
 const q=document.getElementById('busca').value.toLowerCase();
 const list=tracks.filter(t=>!q||(t.title+' '+t.artist+' '+t.album).toLowerCase().includes(q)).slice(0,300);
 document.getElementById('lista').innerHTML=list.map(t=>
  '<div class="row"><div><b>'+esc(t.title)+'</b><span>'+esc(t.artist)+' · '+esc(t.album)+'</span></div><button onclick="pedir(\\''+t.id+'\\')">Pedir</button></div>').join('');
}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
async function pedir(id){
 if(!nome){toast('Escreva seu nome primeiro');return}
 const r=await fetch('/jb/api/requests',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({trackId:id,requestedBy:nome})});
 toast(r.ok?'Pedido enviado!':(r.status===429?'Você já pediu muitas músicas':'Não foi possível pedir'));
}
document.getElementById('busca').oninput=render;
fetch('/jb/api/library').then(r=>r.json()).then(d=>{tracks=d.tracks;render()});
setInterval(()=>fetch('/jb/api/now-playing').then(r=>r.json()).then(d=>{
 if(d.partyName)document.getElementById('party').textContent=d.partyName;
 document.getElementById('now').textContent=d.current?('Tocando agora: '+d.current.title+' — '+d.current.artist):'Nada tocando';
 }),3000);
</script></body></html>`;
}

// Jukebox request router/handler
async function handleJukeboxRequest(request: Request, url: URL): Promise<Response> {
  const p = url.pathname;
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Range",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (p === "/guest" || p === "/guest/") {
    return new Response(guestPage(), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        ...corsHeaders,
      },
    });
  }

  if (p === "/jb/api/health") {
    return new Response(JSON.stringify({ ok: true, tracks: state.tracks.length }), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...corsHeaders,
      },
    });
  }

  if (p === "/jb/api/library") {
    return new Response(
      JSON.stringify({
        folder: state.folder,
        folderExists: state.folderExists,
        scannedAt: state.scannedAt,
        tracks: state.tracks,
      }),
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          ...corsHeaders,
        },
      },
    );
  }

  if (p === "/jb/api/rescan" && request.method === "POST") {
    try {
      const body = (await request.json()) as any;
      await scan(body.folder || state.folder);
    } catch (e) {
      await scan(state.folder);
    }
    return new Response(
      JSON.stringify({
        folder: state.folder,
        folderExists: state.folderExists,
        scannedAt: state.scannedAt,
        tracks: state.tracks,
      }),
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          ...corsHeaders,
        },
      },
    );
  }

  if (p === "/jb/api/network") {
    const host = request.headers.get("host") || url.host;
    const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
    const guestUrl = `${proto}://${host}/guest`;

    return new Response(
      JSON.stringify({
        addresses: [host],
        port: 3000,
        guestUrl: guestUrl,
      }),
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          ...corsHeaders,
        },
      },
    );
  }

  if (p === "/jb/api/settings" && request.method === "POST") {
    try {
      state.settings = await request.json();
    } catch (e) {}
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...corsHeaders,
      },
    });
  }

  if (p === "/jb/api/requests") {
    if (request.method === "POST") {
      try {
        const body = (await request.json()) as any;
        const track = tracksMap.get(body.trackId);
        if (!track) {
          return new Response(JSON.stringify({ ok: false, reason: "not_found" }), {
            status: 404,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
        const by = String(body.requestedBy || "Convidado").slice(0, 24);
        state.requests.push({
          uid: `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
          trackId: track.id,
          requestedBy: by,
        });
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    const list = [...state.requests];
    if (url.searchParams.get("consume") === "1") {
      state.requests = [];
    }
    return new Response(JSON.stringify(list), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...corsHeaders,
      },
    });
  }

  if (p === "/jb/api/now-playing") {
    if (request.method === "POST") {
      try {
        state.nowPlaying = await request.json();
      } catch (e) {}
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    return new Response(JSON.stringify(state.nowPlaying || { current: null, queue: [] }), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...corsHeaders,
      },
    });
  }

  if (p.startsWith("/jb/audio/")) {
    const id = p.slice("/jb/audio/".length);
    const track = tracksMap.get(id);
    if (!track) {
      return new Response("Not found", { status: 404, headers: corsHeaders });
    }

    if (track.file) {
      try {
        const stat = await fsp.stat(track.file);
        const ext = path.extname(track.file).toLowerCase();
        const contentType =
          {
            ".mp3": "audio/mpeg",
            ".m4a": "audio/mp4",
            ".aac": "audio/aac",
            ".ogg": "audio/ogg",
            ".wav": "audio/wav",
            ".flac": "audio/flac",
          }[ext] || "application/octet-stream";

        const range = request.headers.get("range");
        if (range) {
          const m = /bytes=(\d*)-(\d*)/.exec(range);
          const start = Number(m?.[1] || 0);
          const end = m?.[2] ? Number(m[2]) : stat.size - 1;

          const audioStream = fs.createReadStream(track.file, { start, end });
          const webStream = new ReadableStream({
            start(controller) {
              audioStream.on("data", (chunk) => controller.enqueue(chunk));
              audioStream.on("end", () => controller.close());
              audioStream.on("error", (err) => controller.error(err));
            },
            cancel() {
              audioStream.destroy();
            },
          });

          return new Response(webStream, {
            status: 206,
            headers: {
              "Content-Type": contentType,
              "Accept-Ranges": "bytes",
              "Content-Range": `bytes ${start}-${end}/${stat.size}`,
              "Content-Length": String(end - start + 1),
              ...corsHeaders,
            },
          });
        }

        const audioStream = fs.createReadStream(track.file);
        const webStream = new ReadableStream({
          start(controller) {
            audioStream.on("data", (chunk) => controller.enqueue(chunk));
            audioStream.on("end", () => controller.close());
            audioStream.on("error", (err) => controller.error(err));
          },
          cancel() {
            audioStream.destroy();
          },
        });

        return new Response(webStream, {
          headers: {
            "Content-Type": contentType,
            "Content-Length": String(stat.size),
            "Accept-Ranges": "bytes",
            ...corsHeaders,
          },
        });
      } catch (e) {
        return new Response("Error playing audio", { status: 500, headers: corsHeaders });
      }
    } else {
      const wavBuffer = generateAmbientWav();
      return new Response(wavBuffer, {
        headers: {
          "Content-Type": "audio/wav",
          "Content-Length": String(wavBuffer.length),
          ...corsHeaders,
        },
      });
    }
  }

  return new Response("Not Found", { status: 404, headers: corsHeaders });
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    const p = url.pathname;

    if (p.startsWith("/jb/") || p === "/guest" || p === "/guest/") {
      return handleJukeboxRequest(request, url);
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
