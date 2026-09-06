import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";
import { rotasTable, reservasTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { decodeClienteTokenFromReq, gerarComissaoCliente } from "../lib/comissaoAfiliado";
import { verifyPdvFinancialToken } from "../lib/pdvFinancialAuth";

const router: IRouter = Router();

function getAuthenticatedEmpresaId(req: Request): number | null {
  return verifyPdvFinancialToken(req)?.empresaId ?? null;
}

router.get("/rotas", async (req, res) => {
  const empresaId = Number(req.headers["x-empresa-id"] || 1);
  const rotas = await db.select().from(rotasTable).where(eq(rotasTable.empresaId, empresaId));
  return res.json(rotas.map(r => ({ ...r, criadoEm: r.criadoEm.toISOString() })));
});

router.post("/rotas", async (req, res) => {
  try {
    const empresaId = Number(req.headers["x-empresa-id"] || 1);
    const { origem, destino, horarioPartida, horarioChegada, preco, totalAssentos, empresa } = req.body;
    const [rota] = await db.insert(rotasTable).values({
      empresaId,
      origem,
      destino,
      horarioPartida,
      horarioChegada,
      preco: Number(preco),
      assentosDisponiveis: Number(totalAssentos),
      totalAssentos: Number(totalAssentos),
      empresa,
    }).returning();
    return res.status(201).json({ ...rota, criadoEm: rota.criadoEm.toISOString() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error", message: "Erro interno" });
  }
});

router.get("/reservas", async (req, res) => {
  const empresaId = Number(req.headers["x-empresa-id"] || 1);
  const reservas = await db.select().from(reservasTable).where(eq(reservasTable.empresaId, empresaId));
  return res.json(reservas.map(r => ({ ...r, criadoEm: r.criadoEm.toISOString() })));
});

router.post("/reservas", async (req, res) => {
  try {
    const empresaId = Number(req.headers["x-empresa-id"] || 1);
    const { rotaId, passageiroNome, passageiroDocumento, passageiroTelefone, assento } = req.body;

    const rota = await db.select().from(rotasTable).where(eq(rotasTable.id, Number(rotaId))).limit(1);
    if (!rota[0]) return res.status(404).json({ error: "not_found", message: "Rota não encontrada" });

    const [reserva] = await db.insert(reservasTable).values({
      empresaId,
      rotaId: Number(rotaId),
      passageiroNome,
      passageiroDocumento,
      passageiroTelefone,
      assento,
      total: rota[0].preco,
      status: "pendente",
    }).returning();
    return res.status(201).json({ ...reserva, criadoEm: reserva.criadoEm.toISOString() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error", message: "Erro interno" });
  }
});

router.patch("/reservas/:id/status", async (req, res) => {
  try {
    const empresaId = getAuthenticatedEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const reservaId = Number(req.params.id);
    const status = String(req.body.status || "");
    const permitidos = ["pendente", "confirmada", "concluida", "cancelada"];
    if (!permitidos.includes(status)) return res.status(400).json({ error: "invalid_status" });

    const [anterior] = await db.select().from(reservasTable)
      .where(eq(reservasTable.id, reservaId)).limit(1);
    if (!anterior || anterior.empresaId !== empresaId) return res.status(404).json({ error: "not_found" });

    const [reserva] = await db.update(reservasTable).set({ status })
      .where(eq(reservasTable.id, reservaId)).returning();

    if (["confirmada", "concluida"].includes(status)) {
      await gerarComissaoCliente({
        usuarioId: decodeClienteTokenFromReq(req),
        usuarioEmail: req.body.passageiroEmail ?? req.body.passageiro_email ?? null,
        usuarioTelefone: reserva.passageiroTelefone,
        valor: reserva.total,
        tipoEvento: "reserva_passagem",
        referenciaId: reserva.id,
        descricao: `Reserva de passagem #${reserva.id}`,
      });
    }

    return res.json({ ...reserva, criadoEm: reserva.criadoEm.toISOString() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error", message: "Erro interno" });
  }
});

export default router;
