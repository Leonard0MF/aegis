export default function SecurityStatus() {
  return (
    <div className="bg-zinc-900/70 border border-blue-500/20 rounded-xl p-6 backdrop-blur-sm">
      <h3 className="text-lg font-semibold mb-4">
        Security Status
      </h3>

      <div className="space-y-4">
        <div>
          <p className="text-zinc-400 text-sm">
            Firewall
          </p>

          <p className="text-green-400 font-semibold">
            Operational
          </p>
        </div>

        <div>
          <p className="text-zinc-400 text-sm">
            SSL/TLS
          </p>

          <p className="text-green-400 font-semibold">
            Protected
          </p>
        </div>

        <div>
          <p className="text-zinc-400 text-sm">
            Threat Detection
          </p>

          <p className="text-yellow-400 font-semibold">
            Elevated Activity
          </p>
        </div>

        <div>
          <p className="text-zinc-400 text-sm">
            Infrastructure
          </p>

          <p className="text-green-400 font-semibold">
            Stable
          </p>
        </div>
      </div>
    </div>
  );
}