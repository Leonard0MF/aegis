export default function StatsCards() {
  return (
    <div className="grid grid-cols-2 gap-6 mt-8">
      <div className="bg-zinc-900/70 border border-blue-500/20 rounded-xl p-6 backdrop-blur-sm">
        <h3 className="text-zinc-400">
          Active Alerts
        </h3>

        <p className="text-4xl font-bold mt-2">
          3
        </p>
      </div>

      <div className="bg-zinc-900/70 border border-blue-500/20 rounded-xl p-6 backdrop-blur-sm">
        <h3 className="text-zinc-400">
          Assets Monitored
        </h3>

        <p className="text-4xl font-bold mt-2">
          12
        </p>
      </div>
    </div>
  );
}