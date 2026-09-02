import DocumentosPage from "@/components/DocumentosPage";

const DOCS = [
  {
    tipo: "cnh",
    label: "CNH",
    descricao: "Carteira Nacional de Habilitação válida",
  },
  {
    tipo: "veiculo",
    label: "CRLV",
    descricao: "Certificado de Registro e Licenciamento do Veículo",
  },
  {
    tipo: "selfie",
    label: "Selfie c/ Documento",
    descricao: "Foto segurando o documento de identidade",
  },
  {
    tipo: "antecedentes",
    label: "Antecedentes Criminais",
    descricao: "Certidão de antecedentes criminais atualizada",
  },
];

export default function MotoristasDocs() {
  return (
    <DocumentosPage
      titulo="Documentos — Motoristas"
      subtitulo="Revisão e aprovação de documentos dos candidatos a motorista"
      fetchUrl="/api/motorista-app/admin/documentos"
      patchUrlBase="/api/motorista-app/admin"
      docFields={DOCS}
      pessoaLabel="Motorista"
    />
  );
}
