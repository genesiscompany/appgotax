import DocumentosPage from "@/components/DocumentosPage";

const DOCS = [
  {
    tipo: "cnh",
    label: "CNH",
    descricao: "Carteira Nacional de Habilitação (obrigatória para moto)",
    somentePara: (p: any) => p.tipo_veiculo !== "bicicleta",
  },
  {
    tipo: "veiculo",
    label: "CRLV da Moto",
    descricao: "Certificado de Registro e Licenciamento do Veículo",
    somentePara: (p: any) => p.tipo_veiculo !== "bicicleta",
  },
  {
    tipo: "rg",
    label: "RG / CNH",
    descricao: "Documento de identidade (para entregadores de bicicleta)",
    somentePara: (p: any) => p.tipo_veiculo === "bicicleta",
  },
  {
    tipo: "selfie",
    label: "Selfie c/ Documento",
    descricao: "Foto segurando o documento de identidade",
  },
];

export default function DeliveryDocs() {
  return (
    <DocumentosPage
      titulo="Documentos — Boy Delivery"
      subtitulo="Revisão e aprovação de documentos dos entregadores de delivery"
      fetchUrl="/api/delivery/admin/documentos"
      patchUrlBase="/api/delivery/admin"
      docFields={DOCS}
      pessoaLabel="Boy Delivery"
    />
  );
}
