"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { GeoInfo } from "@/types/scan";
import { LAND_MASK_B64, LAND_MASK_H, LAND_MASK_W } from "./landMask";

/*
 * Globo em pontos (canvas 2D, sem dependências). Camadas, de trás pra frente:
 *   atmosfera → esfera → terra (pontos) → órbitas/satélites → tráfego simulado → arcos reais → marcadores → rótulos
 * - Tráfego simulado: conexões/ataques ilustrativos entre grandes cidades (NÃO são dados reais).
 *   Quando há um scan, ele fica discreto e os dados reais (servidores) ganham prioridade.
 * - A "câmera" pode ser compartilhada entre instâncias (prop `camera`) para transições sem salto.
 * Performance: ~30 fps, pausa fora da tela / aba oculta / prop `paused`, pontos desenhados em lote.
 */

export type MarkerKind = "server" | "mail" | "origin";

export const MARKER_RGB: Record<MarkerKind, string> = {
  server: "61,214,192", // verde-água (accent)
  mail: "127,167,207", // azul (info)
  origin: "242,184,75", // âmbar (warn)
};

/** Estado de rotação compartilhável entre o globo do painel e o de tela cheia. */
export interface GlobeCamera {
  lon0: number;
  lat0: number;
  velLon: number;
  velLat: number;
  target: { lat: number; lon: number } | null;
  userTouched: boolean;
  /** 0→1: animação de entrada dos arcos reais */
  enterT: number;
  /** scan que a câmera já focou (evita refazer o foco ao trocar de instância) */
  focusedKey: string | null;
}

export function createCamera(): GlobeCamera {
  return {
    lon0: -50 * (Math.PI / 180), // começa olhando para as Américas
    lat0: 18 * (Math.PI / 180),
    velLon: 0,
    velLat: 0,
    target: null,
    userTouched: false,
    enterT: 1,
    focusedKey: null,
  };
}

interface GlobeProps {
  geo?: GeoInfo;
  /** identifica o scan; quando muda, a câmera gira até os servidores */
  focusKey?: string;
  className?: string;
  /** "pan-y" deixa a página rolar no mobile; "none" captura todo gesto (tela cheia) */
  touchAction?: "pan-y" | "none";
  labels?: boolean;
  /** tráfego simulado e órbitas em volta do globo */
  ambient?: boolean;
  /** quanto tráfego simulado mostrar quando há um scan: "low" (painel) ou "high" (tela cheia) */
  traffic?: "low" | "high";
  /** para de desenhar e de mover a câmera (ex.: instância escondida) */
  paused?: boolean;
  camera?: RefObject<GlobeCamera>;
}

type Vec3 = [number, number, number];

interface Marker {
  v: Vec3;
  kind: MarkerKind;
  label: string;
  primary: boolean;
}

interface ArcPath {
  pts: Float32Array;
  kind: MarkerKind;
  phase: number;
}

interface AmbientArc {
  pts: Float32Array;
  rgb: string;
  born: number;
  dur: number;
}

const LABEL_PRIORITY: Record<MarkerKind, number> = { server: 0, mail: 1, origin: 2 };

const DEG = Math.PI / 180;
const FRAME_MS = 1000 / 30;
const DOT_STEP = 1.35;
const ALPHA_BUCKETS = 6;
const ARC_SAMPLES = 72;
const IMPACT_MS = 900;

// Cidades usadas pelo tráfego simulado
const HUBS: [number, number][] = [
  [40.7, -74], [37.4, -122.1], [43.7, -79.4], [19.4, -99.1], [4.7, -74.1], [-23.5, -46.6],
  [-34.6, -58.4], [51.5, -0.1], [50.1, 8.7], [48.9, 2.35], [40.4, -3.7], [59.3, 18.1],
  [55.75, 37.6], [41, 29], [25.2, 55.3], [6.5, 3.4], [-26.2, 28], [30, 31.2], [19.1, 72.9],
  [1.35, 103.8], [22.3, 114.2], [35.7, 139.7], [37.6, 127], [-33.9, 151.2], [39.9, 116.4],
  [-12, -77], [-33.4, -70.6], [-22.9, -43.2], [-3.7, -38.5], [-1.3, 36.8], [-8.8, 13.2],
  [25.8, -80.2], [38.7, -9.1],
];

// cor dos ataques: maioria coral, alguns âmbar, poucos azul
const AMBIENT_RGB = ["240,113,103", "240,113,103", "240,113,103", "240,113,103", "242,184,75", "242,184,75", "127,167,207"];

// Órbitas: inclinação, nó, raio, velocidade (rad/s), nº de satélites
const ORBITS = [
  { inc: 58 * DEG, node: 20 * DEG, r: 1.2, speed: 0.22, sats: 2 },
  { inc: -24 * DEG, node: 110 * DEG, r: 1.32, speed: -0.14, sats: 1 },
];

/* ---------------- geometria ---------------- */

function toVec(lat: number, lon: number): Vec3 {
  const p = lat * DEG, l = lon * DEG;
  return [Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l)];
}

function toLatLon([x, y, z]: Vec3): { lat: number; lon: number } {
  return { lat: Math.asin(Math.max(-1, Math.min(1, y))) / DEG, lon: Math.atan2(x, z) / DEG };
}

let cachedDots: Float32Array | null = null;

/** Pontos da terra: linhas de latitude com espaçamento uniforme na superfície. */
function landDots(): Float32Array {
  if (cachedDots) return cachedDots;
  const bin = atob(LAND_MASK_B64);
  const mask = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) mask[i] = bin.charCodeAt(i);

  const isLand = (lat: number, lon: number) => {
    const r = Math.min(LAND_MASK_H - 1, Math.max(0, Math.floor(90 - lat)));
    const c = Math.min(LAND_MASK_W - 1, Math.max(0, Math.floor(lon + 180)));
    const i = r * LAND_MASK_W + c;
    return (mask[i >> 3] >> (i & 7)) & 1;
  };

  const out: number[] = [];
  for (let lat = 84; lat > -60; lat -= DOT_STEP) {
    const n = Math.max(1, Math.round((360 * Math.cos(lat * DEG)) / DOT_STEP));
    for (let k = 0; k < n; k++) {
      const lon = -180 + ((k + 0.5) * 360) / n;
      if (isLand(lat, lon)) out.push(...toVec(lat, lon));
    }
  }
  cachedDots = new Float32Array(out);
  return cachedDots;
}

function angleBetween(a: Vec3, b: Vec3) {
  return Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
}

/** Arco de grande círculo com "altura" proporcional à distância. */
function buildArc(a: Vec3, b: Vec3, liftScale = 1): Float32Array | null {
  const w = angleBetween(a, b);
  if (w < 1.5 * DEG) return null;
  const sinW = Math.sin(w);
  const lift = Math.min(0.32, 0.04 + w * 0.16) * liftScale;
  const pts = new Float32Array((ARC_SAMPLES + 1) * 3);
  for (let i = 0; i <= ARC_SAMPLES; i++) {
    const t = i / ARC_SAMPLES;
    const ka = Math.sin((1 - t) * w) / sinW;
    const kb = Math.sin(t * w) / sinW;
    const h = 1 + lift * Math.sin(Math.PI * t);
    pts[i * 3] = (a[0] * ka + b[0] * kb) * h;
    pts[i * 3 + 1] = (a[1] * ka + b[1] * kb) * h;
    pts[i * 3 + 2] = (a[2] * ka + b[2] * kb) * h;
  }
  return pts;
}

const HUB_VECS = HUBS.map(([la, lo]) => toVec(la, lo));

function buildScene(geo?: GeoInfo) {
  const markers: Marker[] = [];
  const arcs: ArcPath[] = [];
  if (!geo) return { markers, arcs, focus: null as { lat: number; lon: number } | null };

  const seen = new Set<string>();
  const add = (kind: MarkerKind, lat: number, lon: number, label: string, primary = false) => {
    const key = `${kind}:${lat.toFixed(1)},${lon.toFixed(1)}`;
    if (seen.has(key)) return null;
    seen.add(key);
    const v = toVec(lat, lon);
    markers.push({ v, kind, label, primary });
    return v;
  };
  const place = (city: string, cc: string) => [city, cc].filter(Boolean).join(" · ");

  const origin = geo.origin ? add("origin", geo.origin.lat, geo.origin.lon, `Origem · ${geo.origin.city}`) : null;
  const servers = geo.servers
    .map((s, i) => add("server", s.lat, s.lon, place(s.city, s.countryCode), i === 0))
    .filter(Boolean) as Vec3[];
  const mail = geo.mail.map((m) => add("mail", m.lat, m.lon, `MX · ${place(m.city, m.countryCode)}`)).filter(Boolean) as Vec3[];

  if (origin) {
    [...servers.map((v) => [v, "server"] as const), ...mail.map((v) => [v, "mail"] as const)].forEach(([v, kind], i) => {
      const pts = buildArc(origin, v);
      if (pts) arcs.push({ pts, kind, phase: i * 0.37 });
    });
  }

  // foco: o destino (servidor principal). Se a origem estiver perto, enquadra os dois (peso 70/30 no destino).
  const main = servers[0] ?? mail[0] ?? origin;
  let focus: { lat: number; lon: number } | null = null;
  if (main) {
    let f: Vec3 = main;
    if (origin && main !== origin && angleBetween(origin, main) < 60 * DEG) {
      const m: Vec3 = [origin[0] * 0.3 + main[0] * 0.7, origin[1] * 0.3 + main[1] * 0.7, origin[2] * 0.3 + main[2] * 0.7];
      const len = Math.hypot(...m);
      f = [m[0] / len, m[1] / len, m[2] / len];
    }
    focus = toLatLon(f);
  }
  return { markers, arcs, focus };
}

/* ---------------- componente ---------------- */

export default function Globe({
  geo,
  focusKey,
  className = "",
  touchAction = "pan-y",
  labels = true,
  ambient = true,
  traffic = "low",
  paused = false,
  camera,
}: GlobeProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<ReturnType<typeof buildScene>>({ markers: [], arcs: [], focus: null });
  const sceneKey = useRef<string | null>(null);
  const opts = useRef({ labels, ambient, paused, traffic });
  const ownCamera = useRef<GlobeCamera | null>(null);

  useEffect(() => {
    opts.current = { labels, ambient, paused, traffic };
  }, [labels, ambient, paused, traffic]);

  useEffect(() => {
    sceneRef.current = buildScene(geo);
    sceneKey.current = focusKey ?? null;
    // focusKey identifica o scan; geo muda junto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const maybeCtx = canvas.getContext("2d");
    if (!maybeCtx) return;
    const ctx: CanvasRenderingContext2D = maybeCtx;

    if (!camera && !ownCamera.current) ownCamera.current = createCamera();
    const cam = (): GlobeCamera => (camera?.current ?? ownCamera.current)!;

    const DOTS = landDots();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = 0, H = 0, dpr = 1;
    let dragging = false, lastX = 0, lastY = 0;
    let visible = true;
    let raf = 0, lastFrame = 0;
    const ambientArcs: AmbientArc[] = [];
    let nextSpawn = 0;

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.floor(r.width));
      H = Math.max(1, Math.floor(r.height));
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
    };
    // redimensionar apaga o canvas: redesenha na hora para não piscar (ex.: durante a transição do mapa)
    const ro = new ResizeObserver(() => {
      resize();
      if (!opts.current.paused) render(performance.now());
    });
    ro.observe(wrap);
    resize();

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(wrap);

    /* ---- arrastar ---- */
    const radius = () => Math.min(W, H) * 0.42;
    const onDown = (e: PointerEvent) => {
      const c = cam();
      dragging = true;
      c.userTouched = true;
      c.target = null;
      lastX = e.clientX; lastY = e.clientY;
      c.velLon = c.velLat = 0;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const c = cam();
      const k = 1 / radius();
      const dx = (e.clientX - lastX) * k, dy = (e.clientY - lastY) * k;
      c.lon0 -= dx; c.lat0 = Math.max(-1.2, Math.min(1.2, c.lat0 + dy));
      c.velLon = -dx; c.velLat = dy;
      lastX = e.clientX; lastY = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    const shortest = (from: number, to: number) => {
      let d = (to - from) % (2 * Math.PI);
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      return d;
    };

    /** profundidade de um ponto na visão atual (>0 = virado para a câmera) */
    const facing = (v: Vec3, c: GlobeCamera) => {
      const z1 = v[2] * Math.cos(c.lon0) + v[0] * Math.sin(c.lon0);
      return v[1] * Math.sin(c.lat0) + z1 * Math.cos(c.lat0);
    };

    function spawnAmbient(now: number) {
      // o destino do "ataque" é sempre uma cidade visível; a origem pode vir de trás do globo
      const c = cam();
      const front = HUB_VECS.map((v, i) => [i, facing(v, c)] as const).filter(([, z]) => z > 0.25).map(([i]) => i);
      const pool = front.length >= 2 ? front : HUB_VECS.map((_, i) => i);
      const b = pool[Math.floor(Math.random() * pool.length)];
      let a = Math.floor(Math.random() * HUB_VECS.length);
      if (a === b) a = (a + 1) % HUB_VECS.length;
      const pts = buildArc(HUB_VECS[a], HUB_VECS[b], 0.85);
      if (!pts) return;
      ambientArcs.push({
        pts,
        rgb: AMBIENT_RGB[Math.floor(Math.random() * AMBIENT_RGB.length)],
        born: now,
        dur: 1400 + Math.random() * 1200,
      });
    }

    function loop(now: number) {
      raf = requestAnimationFrame(loop);
      if (opts.current.paused || !visible || document.hidden || now - lastFrame < FRAME_MS) return;
      lastFrame = now;
      render(now);
    }

    function render(now: number) {
      const c = cam();
      const scene = sceneRef.current;
      const hasScene = scene.markers.length > 0;

      // scan novo → foca no destino (uma vez por scan, mesmo trocando de instância)
      if (sceneKey.current && sceneKey.current !== c.focusedKey) {
        c.focusedKey = sceneKey.current;
        if (scene.focus) {
          c.target = { lat: Math.max(-50, Math.min(55, scene.focus.lat)) * DEG, lon: scene.focus.lon * DEG };
          c.userTouched = false;
          c.enterT = reduceMotion ? 1 : 0;
        }
      }

      /* ---- movimento ---- */
      if (!dragging) {
        if (c.target) {
          const dl = shortest(c.lon0, c.target.lon), dt = c.target.lat - c.lat0;
          c.lon0 += dl * 0.07; c.lat0 += dt * 0.07;
          if (Math.abs(dl) < 0.002 && Math.abs(dt) < 0.002) c.target = null;
        } else if (Math.abs(c.velLon) > 1e-4 || Math.abs(c.velLat) > 1e-4) {
          c.lon0 += c.velLon; c.lat0 = Math.max(-1.2, Math.min(1.2, c.lat0 + c.velLat));
          c.velLon *= 0.9; c.velLat *= 0.9;
        } else if (!reduceMotion && !(hasScene && c.userTouched)) {
          // com scan: deriva bem lenta (o destino continua em vista); sem scan: rotação contínua
          c.lon0 -= hasScene ? 0.0005 : 0.002;
        }
      }
      if (c.enterT < 1) c.enterT = Math.min(1, c.enterT + 0.025);

      const cl = Math.cos(c.lon0), sl = Math.sin(c.lon0), ct = Math.cos(c.lat0), st = Math.sin(c.lat0);
      const R = radius();
      const cx = W / 2, cy = H / 2;
      const t = now / 1000;

      let px = 0, py = 0, pz = 0;
      const project = (x0: number, y0: number, z0: number) => {
        const x = x0 * cl - z0 * sl;
        const z1 = z0 * cl + x0 * sl;
        px = cx + x * R;
        py = cy - (y0 * ct - z1 * st) * R;
        pz = y0 * st + z1 * ct;
      };
      // visível: na frente da esfera, ou fora do disco (ponto elevado na borda)
      const visibleNow = () => pz > 0 || (px - cx) ** 2 + (py - cy) ** 2 > R * R;

      /** traça pts[from..to] (índices de amostra), pulando trechos escondidos atrás da Terra */
      const tracePath = (pts: Float32Array, from: number, to: number) => {
        ctx.beginPath();
        let pen = false;
        for (let i = Math.max(0, from); i <= to; i++) {
          project(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
          if (!visibleNow()) { pen = false; continue; }
          if (pen) ctx.lineTo(px, py); else { ctx.moveTo(px, py); pen = true; }
        }
      };

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = "round";

      /* ---- atmosfera ---- */
      const atm = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.3);
      atm.addColorStop(0, "rgba(61,214,192,0.16)");
      atm.addColorStop(0.35, "rgba(61,214,192,0.06)");
      atm.addColorStop(1, "rgba(61,214,192,0)");
      ctx.fillStyle = atm;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.3, 0, Math.PI * 2);
      ctx.fill();

      /* ---- esfera com luz vinda do alto-esquerda ---- */
      const body = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.45, R * 0.1, cx, cy, R * 1.05);
      body.addColorStop(0, "#17344d");
      body.addColorStop(0.55, "#10253a");
      body.addColorStop(1, "#0b1a29");
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(127,167,207,0.22)";
      ctx.lineWidth = 1;
      ctx.stroke();

      /* ---- terra (pontos em lote por opacidade) ---- */
      const dotR = Math.max(0.75, R / 300);
      for (let b = 0; b < ALPHA_BUCKETS; b++) {
        const lo = b / ALPHA_BUCKETS, hi = (b + 1) / ALPHA_BUCKETS;
        ctx.beginPath();
        for (let i = 0; i < DOTS.length; i += 3) {
          project(DOTS[i], DOTS[i + 1], DOTS[i + 2]);
          if (pz <= lo || pz > hi) continue;
          const s = dotR * (0.75 + 0.45 * pz);
          ctx.moveTo(px + s, py);
          ctx.arc(px, py, s, 0, Math.PI * 2);
        }
        ctx.fillStyle = `rgba(160,190,214,${(0.12 + 0.72 * ((lo + hi) / 2)).toFixed(3)})`;
        ctx.fill();
      }

      /* ---- órbitas + satélites (giram no espaço, independentes da Terra) ---- */
      if (opts.current.ambient) {
        // órbita usa só a inclinação da câmera, não a rotação da Terra
        const projectSpace = ([x, y, z]: Vec3) => {
          px = cx + x * R;
          py = cy - (y * ct - z * st) * R;
          pz = y * st + z * ct;
        };
        ctx.setLineDash([2, 7]);
        for (const o of ORBITS) {
          const ci = Math.cos(o.inc), si = Math.sin(o.inc), cn = Math.cos(o.node), sn = Math.sin(o.node);
          const orbitPoint = (a: number): Vec3 => {
            const x = Math.cos(a) * o.r, z = Math.sin(a) * o.r;
            const y = -z * si, z2 = z * ci; // inclina em torno de X
            return [x * cn + z2 * sn, y, -x * sn + z2 * cn]; // gira o nó em torno de Y
          };
          ctx.beginPath();
          let pen = false;
          for (let k = 0; k <= 120; k++) {
            projectSpace(orbitPoint((k / 120) * Math.PI * 2));
            if (!visibleNow()) { pen = false; continue; }
            if (pen) ctx.lineTo(px, py); else { ctx.moveTo(px, py); pen = true; }
          }
          ctx.strokeStyle = `rgba(127,167,207,${hasScene ? 0.1 : 0.16})`;
          ctx.lineWidth = 1;
          ctx.stroke();
          for (let s = 0; s < o.sats; s++) {
            projectSpace(orbitPoint(t * (reduceMotion ? 0 : o.speed) + (s * Math.PI * 2) / o.sats));
            if (!visibleNow()) continue;
            ctx.beginPath();
            ctx.arc(px, py, 5, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(230,237,243,0.08)";
            ctx.fill();
            ctx.beginPath();
            ctx.arc(px, py, 1.8, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(230,237,243,0.85)";
            ctx.fill();
          }
        }
        ctx.setLineDash([]);
      }

      /* ---- tráfego simulado (discreto quando há um scan) ---- */
      if (opts.current.ambient && !reduceMotion) {
        // sem scan: tráfego cheio; com scan: some para o fundo (o destino tem prioridade)
        const high = opts.current.traffic === "high";
        const intensity = !hasScene ? 0.9 : high ? 0.6 : 0.35;
        const maxArcs = !hasScene ? 11 : high ? 8 : 4;
        if (now >= nextSpawn && ambientArcs.length < maxArcs) {
          spawnAmbient(now);
          const base = !hasScene ? 520 : high ? 650 : 1500;
          nextSpawn = now + base * (0.6 + Math.random() * 0.8);
        }
        for (let i = ambientArcs.length - 1; i >= 0; i--) {
          const a = ambientArcs[i];
          const total = a.pts.length / 3 - 1;
          const age = now - a.born;
          const p = Math.min(1, age / a.dur);
          const head = Math.floor((1 - (1 - p) ** 2) * total); // ease-out
          const impact = (age - a.dur) / IMPACT_MS; // 0→1 depois de chegar
          if (impact > 1) { ambientArcs.splice(i, 1); continue; }
          const fadeOut = impact > 0 ? 1 - impact : 1;

          // rastro fraco
          tracePath(a.pts, 0, head);
          ctx.strokeStyle = `rgba(${a.rgb},${(0.13 * intensity * fadeOut).toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
          // cometa
          if (p < 1) {
            tracePath(a.pts, head - Math.floor(total * 0.28), head);
            ctx.strokeStyle = `rgba(${a.rgb},${(0.85 * intensity).toFixed(3)})`;
            ctx.lineWidth = 1.6;
            ctx.stroke();
          }
          // impacto: duas ondas no destino
          if (impact > 0) {
            project(a.pts[total * 3], a.pts[total * 3 + 1], a.pts[total * 3 + 2]);
            if (pz > 0) {
              for (const delay of [0, 0.25]) {
                const k = impact - delay;
                if (k <= 0) continue;
                ctx.beginPath();
                ctx.arc(px, py, 2 + k * 14, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(${a.rgb},${((1 - k) * 0.7 * intensity).toFixed(3)})`;
                ctx.lineWidth = 1.2;
                ctx.stroke();
              }
              ctx.beginPath();
              ctx.arc(px, py, 2, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(${a.rgb},${(fadeOut * intensity).toFixed(3)})`;
              ctx.fill();
            }
          }
        }
      }

      /* ---- arcos reais (prioridade: por cima, mais grossos e fortes) ---- */
      for (const arc of scene.arcs) {
        const rgb = MARKER_RGB[arc.kind];
        const total = arc.pts.length / 3 - 1;
        const n = Math.floor(total * c.enterT);
        if (n < 1) continue;
        tracePath(arc.pts, 0, n);
        ctx.strokeStyle = `rgba(${rgb},0.45)`;
        ctx.lineWidth = 1.6;
        ctx.stroke();
        if (c.enterT >= 1 && !reduceMotion) {
          const head = ((t * 0.45 + arc.phase) % 1.4) * total;
          tracePath(arc.pts, Math.floor(head - total * 0.22), Math.min(total, Math.floor(head)));
          ctx.strokeStyle = `rgba(${rgb},1)`;
          ctx.lineWidth = 2.4;
          ctx.stroke();
        }
      }

      /* ---- marcadores (destino principal maior) ---- */
      const labelQueue: { x: number; y: number; text: string; rgb: string; prio: number }[] = [];
      for (const m of scene.markers) {
        project(m.v[0], m.v[1], m.v[2]);
        if (pz <= 0.02) continue;
        const rgb = MARKER_RGB[m.kind];
        const fade = Math.min(1, pz * 3);
        const big = m.primary ? 1.4 : 1;

        if (!reduceMotion) {
          const ph = (((t * 0.6 + m.v[0]) % 1) + 1) % 1; // % do JS pode ser negativo
          ctx.beginPath();
          ctx.arc(px, py, (4 + ph * 12) * big, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${rgb},${((1 - ph) * 0.6 * fade).toFixed(3)})`;
          ctx.lineWidth = 1.25;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(px, py, 6 * big, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb},${(0.2 * fade).toFixed(3)})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px, py, 3.25 * big, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb},${fade.toFixed(3)})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(11,22,34,${fade.toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (opts.current.labels && pz > 0.25) {
          labelQueue.push({ x: px, y: py, text: m.label, rgb, prio: m.primary ? -1 : LABEL_PRIORITY[m.kind] });
        }
      }

      /* ---- rótulos (destino primeiro; colisões descartam os de menor prioridade) ---- */
      ctx.font = "500 11px ui-sans-serif, system-ui, sans-serif";
      ctx.textBaseline = "middle";
      labelQueue.sort((a, b) => a.prio - b.prio);
      const placed: { x: number; y: number; w: number; h: number }[] = [];
      for (const l of labelQueue.slice(0, 6)) {
        const w = ctx.measureText(l.text).width + 16, h = 22;
        let x = l.x + 12, y = l.y - h - 6;
        if (x + w > W - 4) x = l.x - w - 12;
        if (y < 4) y = l.y + 8;
        if (placed.some((p) => x < p.x + p.w && x + w > p.x && y < p.y + p.h && y + h > p.y)) continue;
        placed.push({ x, y, w, h });
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 6);
        ctx.fillStyle = "rgba(15,31,46,0.92)";
        ctx.fill();
        ctx.strokeStyle = `rgba(${l.rgb},${l.prio < 0 ? 0.7 : 0.35})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#e6edf3";
        ctx.fillText(l.text, x + 8, y + h / 2 + 0.5);
      }
    }

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, [camera]);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        style={{ touchAction }}
        aria-label="Globo com a localização dos servidores"
        role="img"
      />
    </div>
  );
}
