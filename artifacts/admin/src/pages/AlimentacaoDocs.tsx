import DocumentosPage from "@/components/DocumentosPage";

const DOCS = [
  {
    tipo: "rg",
    label: "RG / Identidade",
    descricao: "Documento de identidade do responsável",
  },
  {
    tipo: "cnpj",
    label: "CNPJ",
    descricao: "Comprovante de CNPJ e contrato social da empresa",
    somentePara: (p: any) => p.tipo_pessoa === "empresa" || !p.tipo_pessoa,
  },
  {
    tipo: "selfie",
    label: "Selfie c/ Documento",
    descricao: "Foto do responsável segurando o documento",
  },
];

export default function AlimentacaoDocs() {
  return (
    <DocumentosPage
      titulo="Documentos — Alimentação"
      subtitulo="Revisão e aprovação de documentos dos restaurantes e lanchonetes"
      fetchUrl="/api/empresas-alimentos/admin/documentos"
      patchUrlBase="/api/empresas-alimentos/admin"
      docFields={DOCS}
      pessoaLabel="Restaurante"
    />
  );
}
