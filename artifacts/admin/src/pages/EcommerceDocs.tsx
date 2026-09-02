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
    descricao: "Comprovante de CNPJ e contrato social (empresas)",
    somentePara: (p: any) => p.tipo_pessoa === "empresa" || !p.tipo_pessoa,
  },
  {
    tipo: "selfie",
    label: "Selfie c/ Documento",
    descricao: "Foto do responsável segurando o documento",
  },
];

export default function EcommerceDocs() {
  return (
    <DocumentosPage
      titulo="Documentos — E-commerce"
      subtitulo="Revisão e aprovação de documentos das lojas parceiras"
      fetchUrl="/api/ecommerce/admin/documentos"
      patchUrlBase="/api/ecommerce/admin"
      docFields={DOCS}
      pessoaLabel="Loja"
    />
  );
}
