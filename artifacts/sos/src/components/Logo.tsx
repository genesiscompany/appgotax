export default function Logo({ claro = false }: { claro?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-sos flex items-center justify-center text-white font-black text-sm shadow-lg shadow-red-500/30">SOS</div>
      <div className="leading-tight">
        <p className={`font-extrabold text-sm ${claro ? "text-white" : "text-gray-900"}`}>SOS GoTaxi</p>
        <p className={`text-xs ${claro ? "text-red-100" : "text-gray-500"}`}>Solidariedade que transforma</p>
      </div>
    </div>
  );
}
