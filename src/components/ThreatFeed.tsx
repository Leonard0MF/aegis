"use client";

import { useEffect, useState } from "react";

type ThreatLevel = "info" | "warning" | "critical" | "success";

type ThreatEvent = {
  id?: string;
  type: ThreatLevel;
  message: string;
  time: string;
};

interface ThreatFeedProps {
  isLoading: boolean;
}

const levelStyle = (type: ThreatLevel) => {
  switch (type) {
    case "info":
      return {
        text: "text-cyan-400/90",
        bg: "bg-cyan-400",
        border: "border-cyan-500/10",
      };

    case "warning":
      return {
        text: "text-amber-400/90",
        bg: "bg-amber-400",
        border: "border-amber-500/10",
      };

    case "critical":
      return {
        text: "text-rose-500 font-bold",
        bg: "bg-rose-500",
        border: "border-rose-500/20 bg-rose-500/[0.02]",
      };

    case "success":
      return {
        text: "text-emerald-400/90",
        bg: "bg-emerald-400",
        border: "border-emerald-500/10",
      };
  }
};

const initialFeed: ThreatEvent[] = [
  {
    type: "critical",
    message: "OPEN_SSH_PORT_DETECTED // PORT_22",
    time: "16:31:42",
  },
  {
    type: "warning",
    message: "MISSING_CSP_SECURITY_HEADER",
    time: "16:30:15",
  },
  {
    type: "success",
    message: "SSL_CERTIFICATE_VALID_TLS_1.3",
    time: "16:28:59",
  },
  {
    type: "warning",
    message: "OUTDATED_TLS_CONFIGURATION_V1.1",
    time: "16:25:04",
  },
  {
    type: "info",
    message: "TARGET_ASSET_RECON_COMPLETED",
    time: "16:22:11",
  },
];

const mapColorToLevel = (color?: string): ThreatLevel => {
  if (color === "#FF0055") return "critical";
  if (color === "#FFB800") return "warning";
  if (color === "#00FF66") return "success";
  return "info";
};

export default function ThreatFeed({
  isLoading,
}: ThreatFeedProps) {
  const [feed, setFeed] =
    useState<ThreatEvent[]>(initialFeed);

  useEffect(() => {
    const handleNewAttack = (e: Event) => {
      const detail = (e as CustomEvent).detail;

      const now = new Date();
      const timeStr = now
        .toTimeString()
        .split(" ")[0];

      const threatType = mapColorToLevel(
        detail?.color
      );

      const newEvent: ThreatEvent = {
        id: crypto.randomUUID(),
        type: threatType,
        message: `INTERCEPT_PACKET // ORIGIN: ${detail.origin.toUpperCase()} -> TARGET: ${detail.target.toUpperCase()}`,
        time: timeStr,
      };

      setFeed((prev) => [
        newEvent,
        ...prev.slice(0, 19),
      ]);
    };

    window.addEventListener(
      "aegis_attack",
      handleNewAttack
    );

    return () => {
      window.removeEventListener(
        "aegis_attack",
        handleNewAttack
      );
    };
  }, []);

  return (
    <div className="p-6 bg-zinc-950/40 border border-zinc-800/60 rounded-lg backdrop-blur-md relative overflow-hidden h-full flex flex-col min-h-[440px]">

      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-zinc-800"></div>
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-zinc-800"></div>
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-zinc-800"></div>
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-zinc-800"></div>

      <div className="border-b border-zinc-900 pb-2 mb-4 flex items-center justify-between">
        <h3 className="text-[10px] font-mono font-black tracking-widest text-zinc-500 uppercase">
          // LIVE_THREAT_FEED
        </h3>

        <div className="w-2 h-2 rounded-full bg-emerald-500" />
      </div>

      <div className="space-y-2 flex-1 overflow-y-auto max-h-[340px] pr-1">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="font-mono text-[10px] text-zinc-700 uppercase tracking-wider"
            >
              &gt; BUFFERING_STREAM_NODE_{i}
            </div>
          ))
        ) : (
          feed.map((event) => {
            const style = levelStyle(event.type);

            return (
              <div
                key={event.id}
                className={`p-2 border rounded font-mono text-[10px] tracking-wide flex items-start gap-2 ${style.border}`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full mt-1 ${style.bg}`}
                />

                <div className="flex-1">
                  <span className="text-zinc-600 mr-2">
                    [{event.time}]
                  </span>

                  <span className={style.text}>
                    {event.message}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="text-[8px] font-mono text-zinc-600 mt-4 tracking-widest uppercase border-t border-zinc-900/60 pt-2 flex justify-between">
        <span>
          FEED_SOURCE: SHODAN_NODE_MATRIX
        </span>

        <span>
          REC_COUNT: {feed.length}
        </span>
      </div>
    </div>
  );
} 