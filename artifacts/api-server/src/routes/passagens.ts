import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { rotasTable, reservasTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

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

export default router;
