import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { empresasTable, usuariosTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const MODULOS = [
  { id: "motorista", nome: "Motorista App", descricao: "Gestão de corridas e motoristas", icone: "car", ativo: true, cor: "#FF6B35" },
  { id: "ecommerce", nome: "E-commerce", descricao: "Loja virtual e gestão de produtos", icone: "shopping-bag", ativo: true, cor: "#4ECDC4" },
  { id: "servicos", nome: "Serviços", descricao: "Agendamento de serviços", icone: "tool", ativo: true, cor: "#45B7D1" },
  { id: "passagens", nome: "Passagens", descricao: "Venda de passagens e rotas", icone: "map", ativo: true, cor: "#96CEB4" },
  { id: "entrega", nome: "Entrega", descricao: "Logística e rastreamento de entregas", icone: "package", ativo: true, cor: "#FFEAA7" },
  { id: "food", nome: "Food", descricao: "Delivery de alimentação", icone: "coffee", ativo: true, cor: "#DDA0DD" },
];

router.get("/", async (_req, res) => {
  const empresas = await db.select().from(empresasTable);
  return res.json(empresas.map(e => ({ ...e, criadoEm: e.criadoEm.toISOString() })));
});

router.post("/", async (req, res) => {
  try {
    const { nome, codigo, corPrimaria, plano, taxaApp, modulosAtivos } = req.body;
    const [empresa] = await db.insert(empresasTable).values({
      nome,
      codigo,
      corPrimaria: corPrimaria || "#007AFF",
      plano: plano || "basico",
      taxaApp: taxaApp !== undefined ? Number(taxaApp) : 3,
      modulosAtivos: modulosAtivos || [],
      ativo: true,
    }).returning();
    return res.status(201).json({ ...empresa, criadoEm: empresa.criadoEm.toISOString() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error", message: "Erro interno" });
  }
});

router.get("/:id", async (req, res) => {
  const empresa = await db.select().from(empresasTable).where(eq(empresasTable.id, Number(req.params.id))).limit(1);
  if (!empresa[0]) return res.status(404).json({ error: "not_found", message: "Empresa não encontrada" });
  return res.json({ ...empresa[0], criadoEm: empresa[0].criadoEm.toISOString() });
});

router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { ativo, taxaApp, nome, corPrimaria } = req.body;
    const updates: Record<string, any> = {};
    if (ativo !== undefined) updates.ativo = Boolean(ativo);
    if (taxaApp !== undefined) updates.taxaApp = Number(taxaApp);
    if (nome !== undefined) updates.nome = nome;
    if (corPrimaria !== undefined) updates.corPrimaria = corPrimaria;
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: "no_fields" });
    const [updated] = await db.update(empresasTable).set(updates).where(eq(empresasTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "not_found" });
    return res.json({ ...updated, criadoEm: updated.criadoEm.toISOString() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

router.get("/modulos/list", async (_req, res) => {
  return res.json(MODULOS);
});

router.get("/:id/usuarios", async (req, res) => {
  const usuarios = await db.select().from(usuariosTable).where(eq(usuariosTable.empresaId, Number(req.params.id)));
  return res.json(usuarios.map(u => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    telefone: u.telefone,
    avatar: u.avatar,
    papel: u.papel,
    empresaId: u.empresaId,
    ativo: u.ativo,
    criadoEm: u.criadoEm.toISOString(),
  })));
});

export default router;
