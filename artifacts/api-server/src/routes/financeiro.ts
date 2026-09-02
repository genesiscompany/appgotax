import { Router } from "express";
import { db } from "@workspace/db";

const router = Router();

function getEmpresaId(req: any): number | null {
  const raw = req.headers["x-empresa-id"] || req.headers["authorization"]?.replace("Bearer ", "");
  if (!raw) return null;
  try {
    const decoded = Buffer.from(String(raw), "base64").toString();
    const parts = decoded.split(":");
    if (parts.length >= 2) return Number(parts[1]);
  } catch {}
  return Number(req.headers["x-empresa-id"]) || null;
}

function esc(s: string) { return String(s ?? "").replace(/'/g, "''"); }

function periodFilter(periodo: string): string {
  switch (periodo) {
    case "hoje":   return `DATE(criado_em) = CURRENT_DATE`;
    case "semana": return `criado_em >= date_trunc('week', NOW())`;
    case "mes":    return `criado_em >= date_trunc('month', NOW())`;
    case "ano":    return `criado_em >= date_trunc('year', NOW())`;
    default:       return `criado_em >= date_trunc('month', NOW())`;
  }
}

// GET /api/pdv/financeiro/resumo?periodo=hoje|semana|mes|ano
router.get("/resumo", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const periodo = String(req.query.periodo ?? "mes");
    const pf = periodFilter(periodo);

    const pedidosQ = await db.execute(`
      SELECT
        COUNT(*) FILTER (WHERE status <> 'cancelado') AS total_pedidos,
        COALESCE(SUM(total) FILTER (WHERE status <> 'cancelado'), 0) AS receita_bruta,
        COALESCE(SUM(taxa_entrega) FILTER (WHERE status <> 'cancelado'), 0) AS total_frete,
        COALESCE(AVG(total) FILTER (WHERE status <> 'cancelado'), 0) AS ticket_medio
      FROM pedidos_pdv
      WHERE empresa_id = ${empresaId} AND ${pf}
    `);

    // Lancamentos manuais no mesmo período
    const lancFilter = periodo === "hoje"   ? `data = CURRENT_DATE`
                     : periodo === "semana" ? `data >= date_trunc('week', NOW())::date`
                     : periodo === "mes"    ? `data >= date_trunc('month', NOW())::date`
                     :                        `data >= date_trunc('year', NOW())::date`;

    const lancQ = await db.execute(`
      SELECT
        COALESCE(SUM(valor) FILTER (WHERE tipo = 'receita'), 0) AS receitas_manuais,
        COALESCE(SUM(valor) FILTER (WHERE tipo = 'despesa'), 0)  AS despesas_total
      FROM financeiro_lancamentos
      WHERE empresa_id = ${empresaId} AND ${lancFilter}
    `);

    const p = pedidosQ.rows[0] as any;
    const l = lancQ.rows[0] as any;

    const receitaBruta = Number(p.receita_bruta) + Number(l.receitas_manuais);
    const despesas = Number(l.despesas_total);

    return res.json({
      total_pedidos: Number(p.total_pedidos),
      receita_bruta: receitaBruta,
      receita_pedidos: Number(p.receita_bruta),
      receitas_manuais: Number(l.receitas_manuais),
      despesas,
      receita_liquida: receitaBruta - despesas,
      total_frete: Number(p.total_frete),
      ticket_medio: Number(Number(p.ticket_medio).toFixed(2)),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// GET /api/pdv/financeiro/fluxo-diario?dias=30
router.get("/fluxo-diario", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const dias = Math.min(Number(req.query.dias ?? 30), 90);

    const rows = await db.execute(`
      SELECT
        DATE(criado_em) AS dia,
        COALESCE(SUM(total) FILTER (WHERE status <> 'cancelado'), 0) AS receita,
        COUNT(*) FILTER (WHERE status <> 'cancelado') AS pedidos
      FROM pedidos_pdv
      WHERE empresa_id = ${empresaId}
        AND criado_em >= NOW() - INTERVAL '${dias} days'
      GROUP BY DATE(criado_em)
      ORDER BY dia ASC
    `);

    // Fill missing days with 0
    const dataMap: Record<string, { receita: number; pedidos: number }> = {};
    for (const r of rows.rows as any[]) {
      dataMap[r.dia.toISOString().slice(0, 10)] = { receita: Number(r.receita), pedidos: Number(r.pedidos) };
    }

    const result = [];
    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      result.push({
        dia: key,
        label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        receita: dataMap[key]?.receita ?? 0,
        pedidos: dataMap[key]?.pedidos ?? 0,
      });
    }
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// GET /api/pdv/financeiro/por-pagamento?periodo=mes
router.get("/por-pagamento", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const pf = periodFilter(String(req.query.periodo ?? "mes"));

    const rows = await db.execute(`
      SELECT
        COALESCE(forma_pagamento, 'pix') AS forma,
        COUNT(*) AS total_pedidos,
        COALESCE(SUM(total), 0) AS valor_total
      FROM pedidos_pdv
      WHERE empresa_id = ${empresaId} AND ${pf} AND status <> 'cancelado'
      GROUP BY COALESCE(forma_pagamento, 'pix')
      ORDER BY valor_total DESC
    `);

    return res.json(rows.rows.map((r: any) => ({
      forma: r.forma,
      total_pedidos: Number(r.total_pedidos),
      valor_total: Number(r.valor_total),
    })));
  } catch (err) {
    return res.status(500).json({ error: "server_error" });
  }
});

// GET /api/pdv/financeiro/lancamentos?mes=2026-05
router.get("/lancamentos", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const mes = req.query.mes ? `DATE_TRUNC('month', data) = DATE_TRUNC('month', DATE '${String(req.query.mes)}-01')` : `data >= date_trunc('month', NOW())::date`;
    const rows = await db.execute(`
      SELECT id, tipo, valor, descricao, categoria, data, observacoes, created_at
      FROM financeiro_lancamentos
      WHERE empresa_id = ${empresaId} AND ${mes}
      ORDER BY data DESC, id DESC
    `);
    return res.json(rows.rows);
  } catch (err) {
    return res.status(500).json({ error: "server_error" });
  }
});

// POST /api/pdv/financeiro/lancamentos
router.post("/lancamentos", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { tipo, valor, descricao, categoria, data, observacoes } = req.body;
    if (!tipo || !valor || !descricao) return res.status(400).json({ error: "campos obrigatórios" });
    const row = await db.execute(`
      INSERT INTO financeiro_lancamentos (empresa_id, tipo, valor, descricao, categoria, data, observacoes)
      VALUES (${empresaId}, '${esc(tipo)}', ${Number(valor)}, '${esc(descricao)}', '${esc(categoria || "outros")}', '${esc(data || new Date().toISOString().slice(0, 10))}', ${observacoes ? `'${esc(observacoes)}'` : "NULL"})
      RETURNING *
    `);
    return res.json(row.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// DELETE /api/pdv/financeiro/lancamentos/:id
router.delete("/lancamentos/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    await db.execute(`DELETE FROM financeiro_lancamentos WHERE id = ${Number(req.params.id)} AND empresa_id = ${empresaId}`);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "server_error" });
  }
});

// ── Fornecedores ──────────────────────────────────────────────────────────────

// GET /api/pdv/financeiro/fornecedores
router.get("/fornecedores", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const rows = await db.execute(
      `SELECT id, nome, categoria, telefone, email, observacoes, ativo, created_at
       FROM fornecedores WHERE empresa_id = ${empresaId} AND ativo = TRUE ORDER BY nome ASC`
    );
    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// POST /api/pdv/financeiro/fornecedores
router.post("/fornecedores", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { nome, categoria, telefone, email, observacoes } = req.body;
    if (!nome?.trim()) return res.status(400).json({ error: "nome obrigatório" });
    const row = await db.execute(`
      INSERT INTO fornecedores (empresa_id, nome, categoria, telefone, email, observacoes)
      VALUES (${empresaId}, '${esc(nome.trim())}', '${esc(categoria || "geral")}',
        ${telefone ? `'${esc(telefone)}'` : "NULL"},
        ${email ? `'${esc(email)}'` : "NULL"},
        ${observacoes ? `'${esc(observacoes)}'` : "NULL"})
      RETURNING *
    `);
    return res.json(row.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// PUT /api/pdv/financeiro/fornecedores/:id
router.put("/fornecedores/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { nome, categoria, telefone, email, observacoes } = req.body;
    if (!nome?.trim()) return res.status(400).json({ error: "nome obrigatório" });
    await db.execute(`
      UPDATE fornecedores SET
        nome = '${esc(nome.trim())}',
        categoria = '${esc(categoria || "geral")}',
        telefone = ${telefone ? `'${esc(telefone)}'` : "NULL"},
        email = ${email ? `'${esc(email)}'` : "NULL"},
        observacoes = ${observacoes ? `'${esc(observacoes)}'` : "NULL"}
      WHERE id = ${Number(req.params.id)} AND empresa_id = ${empresaId}
    `);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "server_error" });
  }
});

// DELETE /api/pdv/financeiro/fornecedores/:id
router.delete("/fornecedores/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    await db.execute(
      `UPDATE fornecedores SET ativo = FALSE WHERE id = ${Number(req.params.id)} AND empresa_id = ${empresaId}`
    );
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "server_error" });
  }
});

// ── Compras ──────────────────────────────────────────────────────────────────

// GET /api/pdv/financeiro/compras?mes=2026-05
router.get("/compras", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const mes = req.query.mes
      ? `DATE_TRUNC('month', data_compra) = DATE_TRUNC('month', DATE '${String(req.query.mes)}-01')`
      : `data_compra >= date_trunc('month', NOW())::date`;
    const rows = await db.execute(`
      SELECT c.id, c.fornecedor_id, c.fornecedor_nome, c.data_compra, c.total, c.status, c.observacoes, c.created_at,
        (SELECT COUNT(*) FROM compras_itens ci WHERE ci.compra_id = c.id) AS itens_count
      FROM compras c
      WHERE c.empresa_id = ${empresaId} AND ${mes}
      ORDER BY c.data_compra DESC, c.id DESC
    `);
    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// GET /api/pdv/financeiro/compras/:id  (detalhe com itens)
router.get("/compras/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const compraId = Number(req.params.id);
    const cRow = await db.execute(
      `SELECT * FROM compras WHERE id = ${compraId} AND empresa_id = ${empresaId}`
    );
    if (!cRow.rows[0]) return res.status(404).json({ error: "not_found" });
    const itensRow = await db.execute(
      `SELECT id, produto, quantidade, unidade, valor_unitario, subtotal FROM compras_itens WHERE compra_id = ${compraId} ORDER BY id ASC`
    );
    return res.json({ ...(cRow.rows[0] as any), itens: itensRow.rows });
  } catch (err) {
    return res.status(500).json({ error: "server_error" });
  }
});

// POST /api/pdv/financeiro/compras
router.post("/compras", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { fornecedor_id, fornecedor_nome, data_compra, total, status, observacoes, itens } = req.body;
    if (!itens?.length) return res.status(400).json({ error: "itens obrigatórios" });

    const fid = fornecedor_id ? Number(fornecedor_id) : null;
    const fnome = esc(fornecedor_nome || "");
    const data = esc(data_compra || new Date().toISOString().slice(0, 10));
    const tot = Number(total) || 0;
    const st = ["pago", "pendente", "cancelado"].includes(status) ? status : "pago";
    const obs = observacoes ? `'${esc(observacoes)}'` : "NULL";

    const compraRow = await db.execute(`
      INSERT INTO compras (empresa_id, fornecedor_id, fornecedor_nome, data_compra, total, status, observacoes)
      VALUES (${empresaId}, ${fid ?? "NULL"}, '${fnome}', '${data}', ${tot}, '${st}', ${obs})
      RETURNING id
    `);
    const compraId = (compraRow.rows[0] as any).id;

    for (const item of itens) {
      const sub = Number(item.subtotal) || (Number(item.quantidade) * Number(item.valor_unitario));
      await db.execute(`
        INSERT INTO compras_itens (compra_id, produto, quantidade, unidade, valor_unitario, subtotal)
        VALUES (${compraId}, '${esc(item.produto)}', ${Number(item.quantidade)}, '${esc(item.unidade || "un")}', ${Number(item.valor_unitario)}, ${sub})
      `);
    }

    // Auto-lançamento de despesa se status = 'pago'
    if (st === "pago" && tot > 0) {
      const descricao = `Compra: ${fornecedor_nome || "Fornecedor"}${observacoes ? ` - ${observacoes}` : ""}`;
      const lancRow = await db.execute(`
        INSERT INTO financeiro_lancamentos (empresa_id, tipo, valor, descricao, categoria, data, observacoes)
        VALUES (${empresaId}, 'despesa', ${tot}, '${esc(descricao)}', 'fornecedor', '${data}', ${obs})
        RETURNING id
      `);
      const lancId = (lancRow.rows[0] as any).id;
      await db.execute(`UPDATE compras SET lancamento_id = ${lancId} WHERE id = ${compraId}`);
    }

    return res.json({ id: compraId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// DELETE /api/pdv/financeiro/compras/:id
router.delete("/compras/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const compraId = Number(req.params.id);
    const row = await db.execute(
      `SELECT lancamento_id FROM compras WHERE id = ${compraId} AND empresa_id = ${empresaId}`
    );
    const lancId = (row.rows[0] as any)?.lancamento_id;
    if (lancId) {
      await db.execute(`DELETE FROM financeiro_lancamentos WHERE id = ${lancId} AND empresa_id = ${empresaId}`);
    }
    await db.execute(`DELETE FROM compras WHERE id = ${compraId} AND empresa_id = ${empresaId}`);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "server_error" });
  }
});

export default router;
