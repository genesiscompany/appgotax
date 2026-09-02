import DocumentosPage from "@/components/DocumentosPage";

const DOCS = [
  {
    tipo: "cnpj",
    label: "CNPJ",
    descricao: "Comprovante de CNPJ da empresa de transporte",
  },
  {
    tipo: "cnh",
    label: "CNH do Motorista",
    descricao: "Carteira Nacional de Habilitação categoria D ou E",
  },
  {
    tipo: "crlv",
    label: "CRLV do Veículo",
    descricao: "Certificado de Registro e Licenciamento (Ônibus, Van ou Carro)",
  },
  {
    tipo: "selfie",
    label: "Selfie c/ Documento",
    descricao: "Foto do responsável segurando o documento",
  },
];

export default function TurViagensDocs() {
  return (
    <DocumentosPage
      titulo="Documentos — Tur Viagens"
      subtitulo="Revisão e aprovação de documentos das empresas de transporte de passageiros"
      fetchUrl="/api/tur-viagens/admin/documentos"
      patchUrlBase="/api/tur-viagens/admin"
      docFields={DOCS}
      pessoaLabel="Empresa"
    />
  );
}
