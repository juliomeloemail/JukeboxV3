// Servidor local da Jukebox (Windows / Node.js)
// Lê as músicas de C:\musicas\jukebox (e subpastas) e serve para a tela
// principal e para os celulares dos convidados na mesma rede Wi-Fi.
//
// Como usar:  node servidor-jukebox.mjs
// Opcional:   node servidor-jukebox.mjs "D:\\minhas musicas" 8099

import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const DEFAULT_FOLDER = process.argv[2] || "C:\\musicas\\jukebox";
const PORT = Number(process.argv[3] || process.env.JUKEBOX_PORT || 8099);
const AUDIO_EXT = new Set([".mp3", ".m4a", ".aac", ".ogg", ".wav", ".flac"]);

const state = {
  folder: DEFAULT_FOLDER,
  scannedAt: new Date().toISOString(),
  tracks: [],
  byId: new Map(),
  settings: {},
  requests: [],
  nowPlaying: null,
};

/* ------------------------------ leitura de tags ------------------------------ */

function readSyncSafe(buf, off) {
  return (buf[off] << 21) | (buf[off + 1] << 14) | (buf[off + 2] << 7) | buf[off + 3];
}

function decodeText(buf) {
  if (buf.length === 0) return "";
  const enc = buf[0];
  const body = buf.subarray(1);
  let text;
  if (enc === 1 || enc === 2) text = body.toString("utf16le").replace(/^\uFEFF/, "");
  else if (enc === 3) text = body.toString("utf8");
  else text = body.toString("latin1");
  return text.replace(/\0+$/, "").trim();
}

async function readId3(file) {
  const tags = {};
  let fh;
  try {
    fh = await fsp.open(file, "r");
    const head = Buffer.alloc(10);
    await fh.read(head, 0, 10, 0);
    if (head.toString("latin1", 0, 3) !== "ID3") return tags;
    const size = readSyncSafe(head, 6);
    const body = Buffer.alloc(Math.min(size, 1_000_000));
    await fh.read(body, 0, body.length, 10);
    let off = 0;
    while (off + 10 <= body.length) {
      const id = body.toString("latin1", off, off + 4);
      if (!/^[A-Z0-9]{4}$/.test(id)) break;
      const fsize = head[3] >= 4 ? readSyncSafe(body, off + 4) : body.readUInt32BE(off + 4);
      if (fsize <= 0 || off + 10 + fsize > body.length) break;
      const value = decodeText(body.subarray(off + 10, off + 10 + fsize));
      if (id === "TIT2") tags.title = value;
      else if (id === "TPE1") tags.artist = value;
      else if (id === "TALB") tags.album = value;
      else if (id === "TCON") tags.genre = value;
      else if (id === "TRCK") tags.trackNo = parseInt(value, 10) || undefined;
      else if (id === "TYER" || id === "TDRC")
        tags.year = parseInt(value.slice(0, 4), 10) || undefined;
      off += 10 + fsize;
    }
  } catch {
    /* arquivo sem tags */
  } finally {
    await fh?.close();
  }
  return tags;
}

const BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];

async function estimateDuration(file, size) {
  try {
    const fh = await fsp.open(file, "r");
    const buf = Buffer.alloc(8192);
    await fh.read(buf, 0, buf.length, 0);
    await fh.close();
    for (let i = 0; i < buf.length - 4; i++) {
      if (buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0) {
        const kbps = BITRATES[(buf[i + 2] & 0xf0) >> 4];
        if (kbps) return Math.round((size * 8) / (kbps * 1000));
      }
    }
  } catch {
    /* ignora */
  }
  return 210;
}

function titleCase(s) {
  return s.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

/* -------------------------------- varredura -------------------------------- */

async function walk(dir, out = []) {
  let entries = [];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, out);
    else if (AUDIO_EXT.has(path.extname(e.name).toLowerCase())) out.push(full);
  }
  return out;
}

async function scan(folder) {
  const files = await walk(folder);
  const tracks = [];
  let n = 0;
  for (const file of files) {
    const rel = path.relative(folder, file);
    const parts = rel.split(path.sep);
    const stat = await fsp.stat(file).catch(() => null);
    const tags = await readId3(file);
    const base = titleCase(path.basename(file, path.extname(file)));
    const id = `t${(n++).toString(36)}`;
    tracks.push({
      id,
      title: tags.title || base.replace(/^\d+\s*[-.]?\s*/, ""),
      artist: tags.artist || (parts.length > 1 ? titleCase(parts[0]) : "Desconhecido"),
      album: tags.album || (parts.length > 2 ? titleCase(parts[1]) : "Sem álbum"),
      year: tags.year,
      genre: tags.genre,
      trackNo: tags.trackNo,
      duration: stat ? await estimateDuration(file, stat.size) : 210,
      url: `/jb/audio/${id}`,
      file,
    });
  }
  tracks.sort(
    (a, b) =>
      a.artist.localeCompare(b.artist, "pt-BR") ||
      a.album.localeCompare(b.album, "pt-BR") ||
      (a.trackNo ?? 0) - (b.trackNo ?? 0) ||
      a.title.localeCompare(b.title, "pt-BR"),
  );
  state.folder = folder;
  state.tracks = tracks;
  state.scannedAt = new Date().toISOString();
  state.byId = new Map(tracks.map((t) => [t.id, t]));
  console.log(`[jukebox] ${tracks.length} músicas encontradas em ${folder}`);
}

function publicTracks() {
  return state.tracks.map(({ file: _file, ...t }) => t);
}

function addresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) {
      if (ni.family === "IPv4" && !ni.internal) out.push(ni.address);
    }
  }
  return out;
}

/* ------------------------------ arquivos de som ------------------------------ */

function serveAudio(req, res, track) {
  let stat;
  try {
    stat = fs.statSync(track.file);
  } catch {
    res.writeHead(404).end("não encontrado");
    return;
  }
  const type =
    {
      ".mp3": "audio/mpeg",
      ".m4a": "audio/mp4",
      ".aac": "audio/aac",
      ".ogg": "audio/ogg",
      ".wav": "audio/wav",
      ".flac": "audio/flac",
    }[path.extname(track.file).toLowerCase()] || "application/octet-stream";
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = Number(m?.[1] || 0);
    const end = m?.[2] ? Number(m[2]) : stat.size - 1;
    res.writeHead(206, {
      "content-type": type,
      "accept-ranges": "bytes",
      "content-range": `bytes ${start}-${end}/${stat.size}`,
      "content-length": end - start + 1,
      "access-control-allow-origin": "*",
    });
    fs.createReadStream(track.file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, {
    "content-type": type,
    "content-length": stat.size,
    "accept-ranges": "bytes",
    "access-control-allow-origin": "*",
  });
  fs.createReadStream(track.file).pipe(res);
}

/* --------------------------------- servidor --------------------------------- */

function json(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    });
    return res.end();
  }

  if (p === "/jb/api/health") return json(res, { ok: true, tracks: state.tracks.length });

  if (p === "/jb/api/library")
    return json(res, {
      folder: state.folder,
      scannedAt: state.scannedAt,
      tracks: publicTracks(),
    });

  if (p === "/jb/api/rescan" && req.method === "POST") {
    const body = await readBody(req);
    await scan(body.folder || state.folder);
    return json(res, { folder: state.folder, scannedAt: state.scannedAt, tracks: publicTracks() });
  }

  if (p === "/jb/api/network") {
    const ips = addresses();
    return json(res, {
      addresses: ips,
      port: PORT,
      guestUrl: ips[0] ? `http://${ips[0]}:${PORT}/guest` : null,
    });
  }

  if (p === "/jb/api/settings" && req.method === "POST") {
    state.settings = await readBody(req);
    return json(res, { ok: true });
  }

  if (p === "/jb/api/requests") {
    if (req.method === "POST") {
      if (state.settings.allowGuests === false) return json(res, { ok: false }, 403);
      const body = await readBody(req);
      const track = state.byId.get(body.trackId);
      if (!track) return json(res, { ok: false }, 404);
      const by = String(body.requestedBy || "Convidado").slice(0, 24);
      const limit = Number(state.settings.guestLimit ?? 3);
      const mine = state.requests.filter((r) => r.requestedBy === by).length;
      if (mine >= limit) return json(res, { ok: false, reason: "limite" }, 429);
      state.requests.push({
        uid: `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        trackId: track.id,
        requestedBy: by,
      });
      return json(res, { ok: true });
    }
    const list = state.requests;
    if (url.searchParams.get("consume")) state.requests = [];
    return json(res, list);
  }

  if (p === "/jb/api/now-playing") {
    if (req.method === "POST") {
      state.nowPlaying = await readBody(req);
      return json(res, { ok: true });
    }
    return json(res, state.nowPlaying ?? { current: null, queue: [] });
  }

  if (p.startsWith("/jb/audio/")) {
    const track = state.byId.get(p.slice("/jb/audio/".length));
    if (!track) return res.writeHead(404).end("não encontrado");
    return serveAudio(req, res, track);
  }

  if (p === "/guest" || p === "/guest/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(guestPage());
  }

  res.writeHead(302, { location: "/guest" }).end();
});

/* ------------------------------ tela do convidado ---------------------------- */

function guestPage() {
  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pedir música</title>
<style>
 :root{color-scheme:dark}
 *{box-sizing:border-box}
 body{margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#0d0b14;color:#f4f1fa}
 header{position:sticky;top:0;background:#16121f;padding:16px;border-bottom:1px solid #2a2338}
 h1{margin:0 0 10px;font-size:18px}
 input{width:100%;padding:12px;border-radius:12px;border:1px solid #2a2338;background:#0d0b14;color:inherit;font-size:16px}
 .row{padding:12px 16px;border-bottom:1px solid #1e1929;display:flex;gap:12px;align-items:center}
 .row b{display:block;font-size:15px}
 .row span{font-size:12px;color:#9c93b5}
 button{margin-left:auto;background:#a855f7;color:#fff;border:0;border-radius:999px;padding:10px 16px;font-size:14px}
 #now{padding:12px 16px;font-size:13px;color:#c9bfe3;background:#1b1527}
 #toast{position:fixed;left:16px;right:16px;bottom:16px;background:#a855f7;color:#fff;padding:14px;border-radius:14px;text-align:center;display:none}
</style></head><body>
<header>
 <h1 id="party">Jukebox da Festa</h1>
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

await scan(DEFAULT_FOLDER);
server.listen(PORT, "0.0.0.0", () => {
  const ips = addresses();
  console.log(`[jukebox] servidor em http://localhost:${PORT}`);
  for (const ip of ips) console.log(`[jukebox] convidados: http://${ip}:${PORT}/guest`);
});
