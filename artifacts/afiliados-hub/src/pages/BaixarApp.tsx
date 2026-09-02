import { useSearch } from "wouter";

export default function BaixarApp() {
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const tipo = params.get("tipo") || "cliente";

  const ehMotorista = tipo === "motorista";
  const titulo = ehMotorista ? "Baixe o GoTaxi Pro" : "Baixe o GoTaxi";
  const subtitulo = ehMotorista
    ? "Faça login com seu WhatsApp e a senha que você cadastrou para começar a aceitar corridas."
    : "Faça login com seu WhatsApp e a senha que você cadastrou para pedir sua primeira corrida.";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#7C5CFC] to-[#5B3FD4] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-[#7C5CFC] px-6 pt-8 pb-10 text-center">
          <div className="inline-flex w-20 h-20 rounded-3xl bg-yellow-400 items-center justify-center mb-4 text-5xl">
            🚖
          </div>
          <h1 className="text-3xl font-bold text-white">{titulo}</h1>
          <p className="text-white/90 text-sm mt-3 px-3">{subtitulo}</p>
        </div>
        <div className="p-6 space-y-3">
          <a
            href="https://play.google.com/store/apps/details?id=br.gotaxi.app"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-3 w-full px-5 py-4 bg-black text-white rounded-2xl hover:bg-gray-900 transition"
          >
            <div className="text-3xl">▶</div>
            <div className="text-left leading-tight">
              <div className="text-xs opacity-80">DISPONÍVEL NO</div>
              <div className="text-lg font-bold">Google Play</div>
            </div>
          </a>
          <a
            href="https://apps.apple.com/app/gotaxi"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-3 w-full px-5 py-4 bg-black text-white rounded-2xl hover:bg-gray-900 transition"
          >
            <div className="text-3xl"></div>
            <div className="text-left leading-tight">
              <div className="text-xs opacity-80">Disponível na</div>
              <div className="text-lg font-bold">App Store</div>
            </div>
          </a>
          <p className="text-center text-xs text-gray-500 pt-4">
            Sua conta já foi criada! Basta abrir o app e entrar.
          </p>
        </div>
      </div>
    </div>
  );
}
