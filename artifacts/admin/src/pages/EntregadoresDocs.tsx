import DocumentosPage from "@/components/DocumentosPage";

const DOCS = [
  {
    tipo: "cnh",
    label: "CNH",
    descricao: "Carteira Nacional de Habilitação (para moto ou carro)",
    somentePara: (p: any) => p.tipo_veiculo !== "bicicleta",
  },
  {
    tipo: "veiculo",
    label: "CRLV",
    descricao: "Certificado de Registro e Licenciamento do Veículo",
    somentePara: (p: any) => p.tipo_veiculo !== "bicicleta",
  },
  {
    tipo: "rg",
    label: "RG / Identidade",
    descricao: "Documento de identidade (para entregadores de bicicleta)",
    somentePara: (p: any) => p.tipo_veiculo === "bicicleta",
  },
  {
    tipo: "selfie",
    label: "Selfie c/ Documento",
    descricao: "Foto segurando o documento de identidade",
  },
];

export default function EntregadoresDocs() {
  return (
    <DocumentosPage
      titulo="Documentos — Entregadores"
      subtitulo="Revisão e aprovação de documentos dos entregadores de pacotes"
      fetchUrl="/api/motorista-app/admin/entregadores/documentos"
      patchUrlBase="/api/motorista-app/admin"
      docFields={DOCS}
      pessoaLabel="Entregador"
    />
  );
}
