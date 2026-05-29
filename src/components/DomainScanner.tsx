"use client";

import { mockScan } from "@/data/mockScan";

import { useState } from "react";

export default function DomainScanner() {
  const [domain, setDomain] = useState("");
  const [result, setResult] = useState(false);
  const [loading, setLoading] = useState(false);

 async function handleScan() {
  if (!domain) return;

  setLoading(true);
  setResult(false);

  await new Promise((resolve) =>
    setTimeout(resolve, 2500)
  );

  setLoading(false);
  setResult(true);
}

  return (
    <div className="bg-zinc-900/70 border border-blue-500/20 rounded-xl p-6 backdrop-blur-sm mt-8">
      <h3 className="text-xl font-semibold mb-4">
        Domain Scanner
      </h3>

      <div className="flex gap-4">
        <input
          type="text"
          placeholder="openai.com"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
        />

        <button
          onClick={handleScan}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition"
        >
          Scan
        </button>
      </div>

      {loading && (
  <div className="mt-6 space-y-3 font-mono text-sm">
    <div className="text-green-400">
      ✓ Resolving DNS
    </div>

    <div className="text-green-400">
      ✓ Checking SSL Certificate
    </div>

    <div className="text-green-400">
      ✓ Analyzing Security Headers
    </div>

    <div className="text-green-400">
      ✓ Evaluating Threat Intelligence
    </div>
  </div>
)}

      {result && (
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="bg-zinc-950 rounded-lg p-4">
            <p className="text-zinc-400 text-sm">
              IP Address
            </p>

            <p className="font-mono mt-2">
                {mockScan.ip}
            </p>
          </div>

          <div className="bg-zinc-950 rounded-lg p-4">
            <p className="text-zinc-400 text-sm">
              SSL Certificate
            </p>

            <p className="text-green-400 mt-2">
              Valid
            </p>
          </div>

          <div className="bg-zinc-950 rounded-lg p-4">
            <p className="text-zinc-400 text-sm">
              Security Headers
            </p>

            <p className="mt-2">
              {mockScan.headers}/10
            </p>
          </div>

          <div className="bg-zinc-950 rounded-lg p-4">
            <p className="text-zinc-400 text-sm">
              Threat Score
            </p>

            <p className="text-green-400 mt-2">
              {mockScan.score}/100
            </p>
          </div>
        </div>
      )}
    </div>
  );
}