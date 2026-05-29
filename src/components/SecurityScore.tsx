export default function SecurityScore() {
  return (
    <div className="bg-zinc-900/70 border border-blue-500/20 rounded-xl p-8 backdrop-blur-sm mt-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-zinc-400 text-sm uppercase tracking-wider">
            Security Score
          </h3>

          <p className="text-6xl font-bold mt-2">
            87
          </p>

          <p className="text-green-400 mt-2">
            Excellent Security Posture
          </p>
        </div>

        <div className="h-32 w-32 rounded-full border-[10px] border-blue-500 flex items-center justify-center">
          <span className="text-3xl font-bold">
            87%
          </span>
        </div>
      </div>
    </div>
  );
}