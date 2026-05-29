export default function ThreatFeed() {
  return (
    <div className="bg-zinc-900/70 border border-blue-500/20 rounded-xl p-6 backdrop-blur-sm">
      <h3 className="text-lg font-semibold mb-4">
        Threat Feed
      </h3>

      <div className="space-y-3 font-mono text-sm">
        <div className="text-green-400">
          [INFO] Asset scan completed
        </div>

        <div className="text-yellow-400">
          [WARNING] Missing CSP Header
        </div>

        <div className="text-red-400">
          [CRITICAL] Open SSH Port Detected
        </div>

        <div className="text-green-400">
          [SUCCESS] SSL Certificate Valid
        </div>

        <div className="text-yellow-400">
          [WARNING] Outdated TLS Configuration
        </div>
      </div>
    </div>
  );
}