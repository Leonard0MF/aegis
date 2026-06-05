"use client";

import { useEffect, useRef } from "react";

interface BackgroundProps {
  mode?: string;
  isFocusMode?: boolean;
}

const HUBS = [
  { name: "São Paulo",      lat: -23.5, lon:  -46.6 },
  { name: "Nova York",      lat:  40.7, lon:  -74.0 },
  { name: "Londres",        lat:  51.5, lon:   -0.1 },
  { name: "Frankfurt",      lat:  50.1, lon:    8.7 },
  { name: "Tóquio",         lat:  35.7, lon:  139.7 },
  { name: "Sydney",         lat: -33.9, lon:  151.2 },
  { name: "Silicon Valley", lat:  37.4, lon: -122.1 },
  { name: "Pequim",         lat:  39.9, lon:  116.4 },
  { name: "Cidade do Cabo", lat: -33.9, lon:   18.4 },
  { name: "Mumbai",         lat:  19.1, lon:   72.9 },
  { name: "Dubai",          lat:  25.2, lon:   55.3 },
  { name: "Singapura",      lat:   1.3, lon:  103.8 },
  { name: "Seoul",          lat:  37.6, lon:  126.9 },
  { name: "Paris",          lat:  48.8, lon:    2.3 },
];

const COLORS = ["#FF0055", "#00FF66", "#00F0FF", "#FFB800"];

// Continentes melhorados com geometria completa
const CONTINENTS: [number, number][][][] = [
  // América do Norte - MELHORADO
  [
    [
      [-170, 70], [-140, 72], [-100, 72], [-80, 70], [-70, 60], [-65, 50],
      [-60, 45], [-55, 40], [-52, 35], [-50, 30], [-48, 25], [-47, 20],
      [-90, 18], [-95, 20], [-100, 25], [-110, 30], [-120, 35], [-125, 40],
      [-130, 45], [-140, 50], [-145, 55], [-160, 60], [-170, 65], [-170, 70]
    ]
  ],
  // América do Sul - MELHORADO
  [
    [
      [-78, 12], [-75, 10], [-72, 5], [-70, 0], [-68, -5], [-65, -10],
      [-62, -15], [-60, -20], [-58, -25], [-56, -30], [-54, -35], [-52, -40],
      [-50, -45], [-48, -45], [-46, -42], [-44, -38], [-42, -32], [-40, -25],
      [-38, -18], [-36, -10], [-35, 0], [-36, 8], [-38, 12], [-40, 15],
      [-50, 12], [-60, 10], [-70, 8], [-78, 12]
    ]
  ],
  // Europa - MELHORADO
  [
    [
      [-10, 36], [0, 35], [10, 35], [20, 36], [30, 38], [40, 42],
      [35, 48], [25, 52], [15, 55], [5, 58], [-5, 60], [-10, 62],
      [-15, 58], [-8, 50], [-5, 45], [0, 40], [8, 38], [15, 38],
      [20, 40], [25, 45], [20, 50], [10, 52], [0, 52], [-5, 48],
      [-10, 42], [-8, 38], [-5, 36], [-10, 36]
    ]
  ],
  // África - MELHORADO
  [
    [
      [-18, 35], [0, 37], [20, 36], [40, 35], [52, 30], [40, 20],
      [35, 10], [30, 0], [35, -10], [40, -20], [35, -30], [25, -33],
      [15, -32], [10, -25], [5, -15], [0, -5], [-5, 0], [-10, 10],
      [-12, 20], [-10, 30], [-5, 35], [-18, 35]
    ]
  ],
  // Ásia Ocidental e Central
  [
    [
      [30, 45], [40, 45], [50, 42], [60, 40], [70, 38], [75, 35],
      [70, 25], [60, 20], [50, 15], [40, 18], [35, 25], [30, 30],
      [28, 40], [30, 45]
    ]
  ],
  // Ásia do Sul e Sudeste
  [
    [
      [65, 35], [75, 30], [85, 25], [95, 20], [105, 15], [115, 12],
      [120, 10], [125, 8], [120, 2], [110, 0], [100, -5], [95, -10],
      [90, -8], [85, 0], [80, 8], [75, 15], [70, 20], [65, 25], [65, 35]
    ]
  ],
  // Ásia Oriental e Sudeste (continuação)
  [
    [
      [105, 25], [120, 20], [130, 25], [140, 35], [145, 45], [140, 50],
      [130, 48], [120, 45], [110, 40], [105, 30], [105, 25]
    ]
  ],
  // Rússia e Norte da Ásia
  [
    [
      [25, 65], [40, 67], [60, 68], [80, 70], [100, 72], [120, 70],
      [140, 68], [160, 70], [170, 68], [160, 60], [140, 55], [120, 52],
      [100, 50], [80, 52], [60, 55], [40, 57], [25, 60], [25, 65]
    ]
  ],
  // Austrália
  [
    [
      [113, -10], [125, -10], [130, -15], [135, -20], [140, -25], [135, -35],
      [125, -37], [115, -35], [113, -25], [113, -10]
    ]
  ],
  // Nova Zelândia
  [
    [
      [166, -34], [172, -36], [174, -42], [172, -46], [166, -44], [166, -34]
    ]
  ],
  // Groenlândia
  [
    [
      [-60, 70], [-40, 72], [-30, 75], [-20, 77], [-30, 82], [-50, 83],
      [-70, 80], [-75, 75], [-70, 70], [-60, 70]
    ]
  ],
  // Japão
  [
    [
      [130, 31], [132, 33], [135, 36], [138, 40], [140, 45], [138, 42],
      [135, 38], [132, 35], [130, 33], [130, 31]
    ]
  ],
];

const COLORS_GLOW = ["#FF0055", "#00FF66", "#00F0FF", "#FFB800"];

function ll2xyz(lat: number, lon: number, r: number): [number, number, number] {
  const phi   = (90 - lat) * Math.PI / 180;
  const theta = (lon + 180) * Math.PI / 180;
  return [
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  ];
}

function proj(
  x: number, y: number, z: number,
  ry: number, rx: number,
  cx: number, cy: number, R: number
) {
  const cosY = Math.cos(ry), sinY = Math.sin(ry);
  let px =  x * cosY + z * sinY;
  let py =  y;
  let pz = -x * sinY + z * cosY;
  const cosX = Math.cos(rx), sinX = Math.sin(rx);
  const py2 = py * cosX - pz * sinX;
  const pz2 = py * sinX + pz * cosX;
  py = py2; pz = pz2;

  const fov = R * 3;
  const d   = fov + pz;
  if (d < 1) return null;
  const s = fov / d;
  return { sx: cx + px * s, sy: cy - py * s, rz: pz };
}

function interpolateArc(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
  steps: number
): [number,number,number][] {
  const p1 = ll2xyz(lat1, lon1, 1);
  const p2 = ll2xyz(lat2, lon2, 1);
  const pts: [number,number,number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = p1[0]+(p2[0]-p1[0])*t;
    const y = p1[1]+(p2[1]-p1[1])*t;
    const z = p1[2]+(p2[2]-p1[2])*t;
    const l = Math.sqrt(x*x+y*y+z*z);
    const ar = 1 + Math.sin(t*Math.PI)*0.32;
    pts.push([x/l*ar, y/l*ar, z/l*ar]);
  }
  return pts;
}

// Melhor subdivisão com menos artefatos
function subdivideRing(ring: [number,number][], stepsPerEdge = 3): [number,number,number][] {
  const result: [number,number,number][] = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[i+1];
    const p1 = ll2xyz(lat1, lon1, 1.001);
    const p2 = ll2xyz(lat2, lon2, 1.001);
    
    for (let s = 0; s < stepsPerEdge; s++) {
      const t = s / stepsPerEdge;
      const x = p1[0]+(p2[0]-p1[0])*t;
      const y = p1[1]+(p2[1]-p1[1])*t;
      const z = p1[2]+(p2[2]-p1[2])*t;
      const l = Math.sqrt(x*x+y*y+z*z);
      if (l > 0) result.push([x/l*1.001, y/l*1.001, z/l*1.001]);
    }
  }
  
  // Fechar anel
  if (ring.length > 0) {
    const [lon, lat] = ring[ring.length-1];
    result.push(ll2xyz(lat, lon, 1.001));
  }
  return result;
}

function buildContinentXYZ(): [number,number,number][][][] {
  return CONTINENTS.map(poly =>
    poly.map(ring => subdivideRing(ring, 2))
  );
}

function buildDots(): [number, number, number][] {
  const dots: [number, number, number][] = [];
  for (let i = 0; i < 1000; i++) {
    const lat = Math.random() * 180 - 90;
    const lon = Math.random() * 360 - 180;
    const φ = lat * Math.PI / 180;
    const λ = lon * Math.PI / 180;
    const land = Math.sin(φ*4)*Math.sin(λ*4) + Math.cos(φ*2)*Math.cos(λ*5) > -0.15;
    dots.push(ll2xyz(lat, lon, land ? 1 : 0.97));
  }
  return dots;
}

interface Arc {
  pts: [number,number,number][];
  color: string;
  prog: number;
  alpha: number;
}

export default function CyberGlobeBackground({ isFocusMode = false }: BackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const focusRef     = useRef(isFocusMode);

  useEffect(() => { focusRef.current = isFocusMode; }, [isFocusMode]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas    = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext("2d")!;
    if (!ctx) return;

    const DOTS    = buildDots();
    const CONTXYZ = buildContinentXYZ();
    const arcs: Arc[] = [];
    let lastArc  = 0;
    let ry       = 0;
    let rxTilt   = 0.2;
    let focusT   = focusRef.current ? 1 : 0;
    let W = 0, H = 0;

    let dragging  = false;
    let dragX     = 0, dragY = 0;
    let velX      = 0, velY      = 0;
    let manualRY  = 0;
    let manualRX  = 0;

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        W = Math.floor(e.contentRect.width);
        H = Math.floor(e.contentRect.height);
        canvas.width  = W;
        canvas.height = H;
      }
    });
    ro.observe(container);
    W = container.clientWidth  || window.innerWidth;
    H = container.clientHeight || window.innerHeight;
    canvas.width  = W;
    canvas.height = H;

    const onDown = (e: MouseEvent) => {
      dragging = true;
      dragX = e.clientX; 
      dragY = e.clientY;
      velX = velY = 0;
    };

    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragX;
      const dy = e.clientY - dragY;
      velX = dx * 0.003;
      velY = dy * 0.003;
      manualRY += dx * 0.003;
      manualRX += dy * 0.003;
      manualRX = Math.max(-0.8, Math.min(0.8, manualRX));
      dragX = e.clientX;
      dragY = e.clientY;
    };

    const onUp = () => { 
      dragging = false; 
    };

    const onTouchStart = (e: TouchEvent) => {
      dragging = true;
      dragX = e.touches[0].clientX;
      dragY = e.touches[0].clientY;
      velX = velY = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!dragging) return;
      const dx = e.touches[0].clientX - dragX;
      const dy = e.touches[0].clientY - dragY;
      velX = dx * 0.003;
      velY = dy * 0.003;
      manualRY += dx * 0.003;
      manualRX += dy * 0.003;
      manualRX = Math.max(-0.8, Math.min(0.8, manualRX));
      dragX = e.touches[0].clientX;
      dragY = e.touches[0].clientY;
    };

    // Adicionar listeners - AGORA SEMPRE ATIVO
    canvas.addEventListener("mousedown",  onDown);
    canvas.addEventListener("mousemove",  onMove);
    canvas.addEventListener("mouseup",    onUp);
    canvas.addEventListener("mouseleave", onUp);
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove",  onTouchMove,  { passive: true });
    canvas.addEventListener("touchend",   onUp);

    function spawnArc() {
      const ai = Math.floor(Math.random() * HUBS.length);
      let   bi = Math.floor(Math.random() * HUBS.length);
      while (bi === ai) bi = Math.floor(Math.random() * HUBS.length);
      const a = HUBS[ai], b = HUBS[bi];
      arcs.push({
        pts: interpolateArc(a.lat, a.lon, b.lat, b.lon, 60),
        color: COLORS_GLOW[Math.floor(Math.random()*COLORS_GLOW.length)],
        prog: 0,
        alpha: 1,
      });
      window.dispatchEvent(new CustomEvent("aegis_attack", {
        detail: { origin: a.name, target: b.name },
      }));
    }

    function drawContinent(
      poly: [number,number,number][][],
      totalRY: number, totalRX: number,
      cx: number, cy: number, R: number,
      contAlpha: number, focusT: number
    ) {
      for (const ring of poly) {
        const segments: {sx:number;sy:number}[][] = [];
        let current: {sx:number;sy:number}[] = [];

        for (const [x, y, z] of ring) {
          const p = proj(x*R, y*R, z*R, totalRY, totalRX, cx, cy, R);
          
          // Melhor clipping - evitar fragmentação
          if (!p || p.rz < -R * 0.1) {
            if (current.length > 1) segments.push([...current]);
            current = [];
          } else {
            current.push({ sx: p.sx, sy: p.sy });
          }
        }
        if (current.length > 1) segments.push(current);

        // Desenhar segmentos sem brechas
        for (const seg of segments) {
          if (seg.length < 2) continue;
          
          ctx.beginPath();
          ctx.moveTo(seg[0].sx, seg[0].sy);
          for (let i = 1; i < seg.length; i++) {
            ctx.lineTo(seg[i].sx, seg[i].sy);
          }

          ctx.fillStyle = `rgba(6,182,212,${(contAlpha * 0.15).toFixed(3)})`;
          ctx.fill();
          
          ctx.strokeStyle = `rgba(6,182,212,${(contAlpha * 0.85).toFixed(3)})`;
          ctx.lineWidth   = 1.2 + focusT * 0.8;
          ctx.shadowColor = "rgba(6,182,212,0.6)";
          ctx.shadowBlur  = 4 + focusT * 6;
          ctx.stroke();
          ctx.shadowBlur  = 0;
        }
      }
    }

    function draw(now: number) {
      if (W === 0 || H === 0) { 
        requestAnimationFrame(draw); 
        return; 
      }

      const focus = focusRef.current;
      focusT += ((focus ? 1 : 0) - focusT) * 0.04;

      if (!dragging) {
        velX *= 0.92;
        velY *= 0.92;
        manualRY += velX;
        manualRX += velY;
        manualRX = Math.max(-0.8, Math.min(0.8, manualRX));
      }

      // Rotação automática mais suave quando não está arrastando
      if (!dragging && Math.abs(velX) < 0.001 && Math.abs(velY) < 0.001) {
        ry += 0.0008 + focusT * 0.0015;
      }

      const totalRY = ry + manualRY;
      const totalRX = rxTilt + manualRX;
      const cx = W / 2, cy = H / 2;
      const R  = Math.min(W, H) * (0.22 + focusT * 0.2);

      // Background
      ctx.fillStyle = "#050507";
      ctx.fillRect(0, 0, W, H);

      // Halo glow
      const g = ctx.createRadialGradient(cx, cy, R*0.1, cx, cy, R*1.7);
      g.addColorStop(0,   `rgba(6,182,212,${(0.06+focusT*0.12).toFixed(3)})`);
      g.addColorStop(0.5, `rgba(6,182,212,${(0.02+focusT*0.04).toFixed(3)})`);
      g.addColorStop(1,   "rgba(6,182,212,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Ocean sphere
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI*2);
      ctx.fillStyle = "rgba(3,20,35,0.88)";
      ctx.fill();

      // Ocean grid
      ctx.strokeStyle = "rgba(6,182,212,0.05)";
      ctx.lineWidth   = 0.6;
      
      for (let lat = -80; lat <= 80; lat += 20) {
        ctx.beginPath();
        let first = true;
        for (let lon = -180; lon <= 180; lon += 4) {
          const p = proj(...(ll2xyz(lat, lon, 1).map(v => v*R) as [number,number,number]), 
                         totalRY, totalRX, cx, cy, R);
          if (!p || p.rz < -R*0.1) { 
            first = true; 
            continue; 
          }
          first ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy);
          first = false;
        }
        ctx.stroke();
      }

      for (let lon = -180; lon <= 180; lon += 30) {
        ctx.beginPath();
        let first = true;
        for (let lat = -90; lat <= 90; lat += 4) {
          const p = proj(...(ll2xyz(lat, lon, 1).map(v => v*R) as [number,number,number]), 
                         totalRY, totalRX, cx, cy, R);
          if (!p || p.rz < -R*0.1) { 
            first = true; 
            continue; 
          }
          first ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy);
          first = false;
        }
        ctx.stroke();
      }

      // Desenhar continentes
      const contAlpha = 0.2 + focusT * 0.6;
      for (const poly of CONTXYZ) {
        drawContinent(poly, totalRY, totalRX, cx, cy, R, contAlpha, focusT);
      }

      // Dots
      const dotOpacity = 0.55 - focusT * 0.3;
      if (dotOpacity > 0.05) {
        for (const [dx, dy, dz] of DOTS) {
          const p = proj(dx*R, dy*R, dz*R, totalRY, totalRX, cx, cy, R);
          if (!p || p.rz < 0) continue;
          const d01  = (p.rz/R + 1) / 2;
          const a    = (0.12 + d01 * 0.35) * dotOpacity;
          const size = Math.max((0.6+d01*0.9)*(R/220), 0.6);
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, size, 0, Math.PI*2);
          ctx.fillStyle = `rgba(6,182,212,${a.toFixed(2)})`;
          ctx.fill();
        }
      }

      // Hub nodes
      const hubAlpha = Math.min(focusT / 0.4, 1);
      if (hubAlpha > 0.02) {
        for (const hub of HUBS) {
          const [hx,hy,hz] = ll2xyz(hub.lat, hub.lon, 1);
          const p = proj(hx*R, hy*R, hz*R, totalRY, totalRX, cx, cy, R);
          if (!p || p.rz < 0) continue;
          
          const pulse = (Math.sin(now*0.003 + hx*10)+1)/2;
          
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, 5+pulse*6, 0, Math.PI*2);
          ctx.strokeStyle = `rgba(0,240,255,${((0.12+pulse*0.18)*hubAlpha).toFixed(2)})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
          
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, 3, 0, Math.PI*2);
          ctx.fillStyle   = `rgba(0,240,255,${hubAlpha.toFixed(2)})`;
          ctx.shadowColor = "#00F0FF";
          ctx.shadowBlur  = 10 * hubAlpha;
          ctx.fill();
          ctx.shadowBlur  = 0;
          
          if (hubAlpha > 0.3) {
            ctx.font      = `bold ${Math.round(9+focusT*2.5)}px monospace`;
            ctx.fillStyle = `rgba(0,240,255,${(hubAlpha*0.9).toFixed(2)})`;
            ctx.fillText(hub.name, p.sx+8, p.sy-6);
          }
        }
      }

      // Arcs
      const gap   = focus ? 500 : 2000;
      const speed = 0.013 + focusT * 0.012;
      if (now - lastArc > gap) { 
        spawnArc(); 
        lastArc = now; 
      }

      for (const arc of arcs) {
        if (arc.prog < 1) arc.prog = Math.min(arc.prog + speed, 1);
        else              arc.alpha = Math.max(arc.alpha - 0.007, 0);
        
        const n = Math.floor(arc.prog * arc.pts.length);
        if (n < 2) continue;

        ctx.beginPath();
        let started = false;
        for (let i = 0; i < n; i++) {
          const [ax,ay,az] = arc.pts[i];
          const p = proj(ax*R, ay*R, az*R, totalRY, totalRX, cx, cy, R);
          if (!p) continue;
          if (!started) { 
            ctx.moveTo(p.sx, p.sy); 
            started = true; 
          }
          else ctx.lineTo(p.sx, p.sy);
        }
        
        const op  = arc.alpha * (0.35 + focusT * 0.55);
        const hex = Math.round(op*255).toString(16).padStart(2,"0");
        ctx.strokeStyle = arc.color + hex;
        ctx.lineWidth   = 1.5 + focusT * 0.8;
        ctx.shadowColor = arc.color;
        ctx.shadowBlur  = 6 + focusT * 10;
        ctx.stroke();
        ctx.shadowBlur  = 0;

        // Arc head
        if (arc.prog < 1) {
          const [tx,ty,tz] = arc.pts[n-1];
          const tp = proj(tx*R, ty*R, tz*R, totalRY, totalRX, cx, cy, R);
          if (tp) {
            ctx.beginPath();
            ctx.arc(tp.sx, tp.sy, 3+focusT*2, 0, Math.PI*2);
            ctx.fillStyle   = arc.color;
            ctx.shadowColor = arc.color;
            ctx.shadowBlur  = 4;
            ctx.fill();
            ctx.shadowBlur  = 0;
          }
        }
      }

      // Limpar arcs finished
      for (let i = arcs.length-1; i >= 0; i--)
        if (arcs[i].prog >= 1 && arcs[i].alpha <= 0) arcs.splice(i,1);
      
      const max = focus ? 25 : 10;
      if (arcs.length > max) arcs.splice(0, arcs.length - max);

      // Focus mode hint
      if (focus) {
        ctx.font      = "11px monospace";
        ctx.fillStyle = "rgba(6,182,212,0.3)";
        ctx.fillText("// DRAG TO ROTATE", 16, H - 16);
      }

      requestAnimationFrame(draw);
    }

    requestAnimationFrame(draw);

    return () => {
      ro.disconnect();
      canvas.removeEventListener("mousedown",  onDown);
      canvas.removeEventListener("mousemove",  onMove);
      canvas.removeEventListener("mouseup",    onUp);
      canvas.removeEventListener("mouseleave", onUp);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove",  onTouchMove);
      canvas.removeEventListener("touchend",   onUp);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        backgroundColor: "#050507",
        pointerEvents: "none",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          pointerEvents: "auto", // SEMPRE ATIVO AGORA
          cursor: "grab",
        }}
      />
    </div>
  );
}