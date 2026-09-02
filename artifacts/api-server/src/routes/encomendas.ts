import { Router, type IRouter } from "express";
import { db } from "@workspace/db";

const router: IRouter = Router();

function getEmpresaId(req: any): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const raw = auth.slice(7);
    const decoded = Buffer.from(String(raw), "base64").toString();
    const parts = decoded.split(":");
    const empresaId = Number(parts[1]);
    return isNaN(empresaId) ? null : empresaId;
  } catch { return null; }
}

function nextCodigo(max: number | null): string {
  const n = (max ?? 0) + 1;
  return "ENK-" + String(n).padStart(5, "0");
}

// ── GET /api/pdv/encomendas/dashboard ─────────────────────────────────────
router.get("/dashboard", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const today = new Date().toISOString().split("T")[0];
    const [hoje, transporte, entregues, pendentes, semana, recentes] = await Promise.all([
      db.execute(`SELECT COUNT(*) FROM encomendas WHERE empresa_id=${empresaId} AND DATE(criado_em)='${today}'`),
      db.execute(`SELECT COUNT(*) FROM encomendas WHERE empresa_id=${empresaId} AND status IN ('coletado','em_transporte','saiu_entrega')`),
      db.execute(`SELECT COUNT(*) FROM encomendas WHERE empresa_id=${empresaId} AND status='entregue' AND DATE(criado_em)='${today}'`),
      db.execute(`SELECT COUNT(*) FROM encomendas WHERE empresa_id=${empresaId} AND status='pendente'`),
      db.execute(`SELECT COALESCE(SUM(valor_frete),0) as total FROM encomendas WHERE empresa_id=${empresaId} AND status='entregue' AND criado_em >= NOW() - INTERVAL '7 days'`),
      db.execute(`SELECT id,codigo,cliente_nome,destino_cidade,valor_frete,status,criado_em FROM encomendas WHERE empresa_id=${empresaId} ORDER BY criado_em DESC LIMIT 8`),
    ]);
    return res.json({
      hoje: Number((hoje.rows[0] as any)?.count ?? 0),
      em_transporte: Number((transporte.rows[0] as any)?.count ?? 0),
      entregues_hoje: Number((entregues.rows[0] as any)?.count ?? 0),
      pendentes: Number((pendentes.rows[0] as any)?.count ?? 0),
      faturamento_semana: Number((semana.rows[0] as any)?.total ?? 0),
      recentes: recentes.rows,
    });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/pdv/encomendas — list with filters ────────────────────────────
router.get("/", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { status, busca, data } = req.query;
    let where = `WHERE e.empresa_id = ${empresaId}`;
    if (status && status !== "todos") where += ` AND e.status = '${String(status).replace(/'/g,"''")}'`;
    if (data) where += ` AND DATE(e.criado_em) = '${String(data).replace(/'/g,"''")}'`;
    if (busca) {
      const b = String(busca).replace(/'/g,"''");
      where += ` AND (e.codigo ILIKE '%${b}%' OR e.cliente_nome ILIKE '%${b}%' OR e.destino_cidade ILIKE '%${b}%')`;
    }
    const rows = await db.execute(`
      SELECT e.*, ec.nome as cliente_cadastrado_nome
      FROM encomendas e
      LEFT JOIN encomendas_clientes ec ON ec.id = e.cliente_id
      ${where}
      ORDER BY e.criado_em DESC LIMIT 200
    `);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/pdv/encomendas/rastrear/:codigo ──────────────────────────────
router.get("/rastrear/:codigo", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const codigo = String(req.params.codigo).replace(/'/g,"''").toUpperCase();
    const rows = await db.execute(`
      SELECT e.*, ec.nome as cliente_cadastrado_nome
      FROM encomendas e
      LEFT JOIN encomendas_clientes ec ON ec.id = e.cliente_id
      WHERE e.empresa_id = ${empresaId} AND UPPER(e.codigo) = '${codigo}'
      LIMIT 1
    `);
    const enc = rows.rows[0] as any;
    if (!enc) return res.status(404).json({ error: "not_found" });
    const hist = await db.execute(`
      SELECT * FROM encomendas_historico WHERE encomenda_id = ${enc.id} ORDER BY registrado_em ASC
    `);
    return res.json({ ...enc, historico: hist.rows });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── POST /api/pdv/encomendas ───────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const {
      cliente_id, cliente_nome, cliente_telefone, cliente_documento,
      origem_endereco, destino_endereco, destino_bairro, destino_cidade,
      tipo_pacote = "pequeno", peso_kg, valor_declarado = 0, valor_frete,
      tipo_servico = "normal", data_envio, data_previsao,
      forma_pagamento = "dinheiro", observacoes, operador_nome,
    } = req.body;

    if (!valor_frete) return res.status(400).json({ error: "valor_frete obrigatório" });

    const maxRow = await db.execute(`SELECT MAX(CAST(SUBSTRING(codigo FROM 5) AS INT)) as max FROM encomendas WHERE empresa_id=${empresaId}`);
    const codigo = nextCodigo((maxRow.rows[0] as any)?.max);

    const safe = (v: any) => v ? `'${String(v).replace(/'/g,"''")}'` : "NULL";
    const row = await db.execute(`
      INSERT INTO encomendas (empresa_id,codigo,cliente_id,cliente_nome,cliente_telefone,cliente_documento,
        origem_endereco,destino_endereco,destino_bairro,destino_cidade,
        tipo_pacote,peso_kg,valor_declarado,valor_frete,tipo_servico,
        data_envio,data_previsao,forma_pagamento,observacoes,operador_nome,status)
      VALUES (${empresaId},${safe(codigo)},${cliente_id ?? "NULL"},${safe(cliente_nome)},${safe(cliente_telefone)},${safe(cliente_documento)},
        ${safe(origem_endereco)},${safe(destino_endereco)},${safe(destino_bairro)},${safe(destino_cidade)},
        ${safe(tipo_pacote)},${peso_kg ?? "NULL"},${Number(valor_declarado)},${Number(valor_frete)},${safe(tipo_servico)},
        ${data_envio ? `'${data_envio}'` : "CURRENT_DATE"},${data_previsao ? `'${data_previsao}'` : "NULL"},
        ${safe(forma_pagamento)},${safe(observacoes)},${safe(operador_nome)},'pendente')
      RETURNING *
    `);
    const enc = row.rows[0] as any;
    await db.execute(`
      INSERT INTO encomendas_historico (encomenda_id,status,descricao,operador_nome)
      VALUES (${enc.id},'pendente','Encomenda registrada',${safe(operador_nome)})
    `);
    return res.status(201).json(enc);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── PUT /api/pdv/encomendas/:id ────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const id = Number(req.params.id);
    const {
      cliente_nome, cliente_telefone, cliente_documento,
      origem_endereco, destino_endereco, destino_bairro, destino_cidade,
      tipo_pacote, peso_kg, valor_declarado, valor_frete,
      tipo_servico, data_envio, data_previsao, status,
      forma_pagamento, observacoes, operador_nome,
    } = req.body;

    const safe = (v: any) => v !== undefined ? `'${String(v).replace(/'/g,"''")}'` : null;
    const sets: string[] = ["atualizado_em = NOW()"];
    if (cliente_nome !== undefined) sets.push(`cliente_nome = ${safe(cliente_nome)}`);
    if (cliente_telefone !== undefined) sets.push(`cliente_telefone = ${safe(cliente_telefone)}`);
    if (cliente_documento !== undefined) sets.push(`cliente_documento = ${safe(cliente_documento)}`);
    if (origem_endereco !== undefined) sets.push(`origem_endereco = ${safe(origem_endereco)}`);
    if (destino_endereco !== undefined) sets.push(`destino_endereco = ${safe(destino_endereco)}`);
    if (destino_bairro !== undefined) sets.push(`destino_bairro = ${safe(destino_bairro)}`);
    if (destino_cidade !== undefined) sets.push(`destino_cidade = ${safe(destino_cidade)}`);
    if (tipo_pacote !== undefined) sets.push(`tipo_pacote = ${safe(tipo_pacote)}`);
    if (peso_kg !== undefined) sets.push(`peso_kg = ${Number(peso_kg)}`);
    if (valor_declarado !== undefined) sets.push(`valor_declarado = ${Number(valor_declarado)}`);
    if (valor_frete !== undefined) sets.push(`valor_frete = ${Number(valor_frete)}`);
    if (tipo_servico !== undefined) sets.push(`tipo_servico = ${safe(tipo_servico)}`);
    if (data_envio !== undefined) sets.push(`data_envio = '${data_envio}'`);
    if (data_previsao !== undefined) sets.push(`data_previsao = '${data_previsao}'`);
    if (forma_pagamento !== undefined) sets.push(`forma_pagamento = ${safe(forma_pagamento)}`);
    if (observacoes !== undefined) sets.push(`observacoes = ${safe(observacoes)}`);
    if (operador_nome !== undefined) sets.push(`operador_nome = ${safe(operador_nome)}`);

    // Status change: also record history
    if (status !== undefined) {
      sets.push(`status = ${safe(status)}`);
      const STATUS_LABELS: Record<string,string> = {
        pendente: "Registrado / Pendente", coletado: "Coletado no remetente",
        em_transporte: "Em transporte", saiu_entrega: "Saiu para entrega",
        entregue: "Entregue ao destinatário", cancelado: "Cancelado",
      };
      await db.execute(`
        INSERT INTO encomendas_historico (encomenda_id,status,descricao,operador_nome)
        VALUES (${id},${safe(status)},${safe(STATUS_LABELS[status] ?? status)},${safe(operador_nome)})
      `);
    }

    const row = await db.execute(`
      UPDATE encomendas SET ${sets.join(", ")} WHERE id=${id} AND empresa_id=${empresaId} RETURNING *
    `);
    if (!row.rows.length) return res.status(404).json({ error: "not_found" });
    return res.json(row.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── DELETE /api/pdv/encomendas/:id ────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const id = Number(req.params.id);
    await db.execute(`UPDATE encomendas SET status='cancelado', atualizado_em=NOW() WHERE id=${id} AND empresa_id=${empresaId}`);
    await db.execute(`INSERT INTO encomendas_historico (encomenda_id,status,descricao) VALUES (${id},'cancelado','Encomenda cancelada')`);
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/pdv/encomendas/clientes ─────────────────────────────────────
router.get("/clientes", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { busca } = req.query;
    let where = `WHERE empresa_id=${empresaId}`;
    if (busca) {
      const b = String(busca).replace(/'/g,"''");
      where += ` AND (nome ILIKE '%${b}%' OR telefone ILIKE '%${b}%' OR documento ILIKE '%${b}%')`;
    }
    const rows = await db.execute(`SELECT * FROM encomendas_clientes ${where} ORDER BY nome LIMIT 200`);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── POST /api/pdv/encomendas/clientes ────────────────────────────────────
router.post("/clientes", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { nome, telefone, documento, endereco, cidade } = req.body;
    if (!nome?.trim()) return res.status(400).json({ error: "nome obrigatório" });
    const safe = (v: any) => v ? `'${String(v).replace(/'/g,"''")}'` : "NULL";
    const row = await db.execute(`
      INSERT INTO encomendas_clientes (empresa_id,nome,telefone,documento,endereco,cidade)
      VALUES (${empresaId},${safe(nome)},${safe(telefone)},${safe(documento)},${safe(endereco)},${safe(cidade)})
      RETURNING *
    `);
    return res.status(201).json(row.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── PUT /api/pdv/encomendas/clientes/:id ──────────────────────────────────
router.put("/clientes/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const id = Number(req.params.id);
    const { nome, telefone, documento, endereco, cidade } = req.body;
    const safe = (v: any) => v !== undefined ? `'${String(v).replace(/'/g,"''")}'` : null;
    const sets: string[] = [];
    if (nome !== undefined) sets.push(`nome = ${safe(nome)}`);
    if (telefone !== undefined) sets.push(`telefone = ${safe(telefone)}`);
    if (documento !== undefined) sets.push(`documento = ${safe(documento)}`);
    if (endereco !== undefined) sets.push(`endereco = ${safe(endereco)}`);
    if (cidade !== undefined) sets.push(`cidade = ${safe(cidade)}`);
    if (!sets.length) return res.status(400).json({ error: "nenhum campo" });
    const row = await db.execute(`UPDATE encomendas_clientes SET ${sets.join(",")} WHERE id=${id} AND empresa_id=${empresaId} RETURNING *`);
    if (!row.rows.length) return res.status(404).json({ error: "not_found" });
    return res.json(row.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── DELETE /api/pdv/encomendas/clientes/:id ───────────────────────────────
router.delete("/clientes/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const id = Number(req.params.id);
    await db.execute(`DELETE FROM encomendas_clientes WHERE id=${id} AND empresa_id=${empresaId}`);
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/pdv/encomendas/financeiro ────────────────────────────────────
router.get("/financeiro", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { periodo = "30" } = req.query;
    const dias = Number(periodo);
    const [faturamento, porStatus, porTipo, repasse, repassePendente] = await Promise.all([
      db.execute(`
        SELECT
          COALESCE(SUM(valor_frete) FILTER (WHERE status='entregue'),0) as entregue,
          COALESCE(SUM(valor_frete) FILTER (WHERE status NOT IN ('cancelado','entregue')),0) as em_aberto,
          COALESCE(SUM(valor_frete),0) as total,
          COUNT(*) as total_encomendas,
          COUNT(*) FILTER (WHERE status='entregue') as entregues,
          COUNT(*) FILTER (WHERE status='cancelado') as canceladas
        FROM encomendas
        WHERE empresa_id=${empresaId} AND criado_em >= NOW() - INTERVAL '${dias} days'
      `),
      db.execute(`
        SELECT status, COUNT(*) as qtd, COALESCE(SUM(valor_frete),0) as total
        FROM encomendas WHERE empresa_id=${empresaId} AND criado_em >= NOW() - INTERVAL '${dias} days'
        GROUP BY status ORDER BY total DESC
      `),
      db.execute(`
        SELECT tipo_pacote, COUNT(*) as qtd, COALESCE(SUM(valor_frete),0) as total
        FROM encomendas WHERE empresa_id=${empresaId} AND criado_em >= NOW() - INTERVAL '${dias} days'
        GROUP BY tipo_pacote ORDER BY total DESC
      `),
      db.execute(`SELECT * FROM repasses WHERE empresa_id=${empresaId} ORDER BY semana_inicio DESC LIMIT 4`),
      db.execute(`SELECT COUNT(*) FROM repasses WHERE empresa_id=${empresaId} AND status='pendente'`),
    ]);
    const fat = faturamento.rows[0] as any;
    const taxa = 3;
    return res.json({
      faturamento: {
        entregue: Number(fat.entregue ?? 0),
        em_aberto: Number(fat.em_aberto ?? 0),
        total: Number(fat.total ?? 0),
        total_encomendas: Number(fat.total_encomendas ?? 0),
        entregues: Number(fat.entregues ?? 0),
        canceladas: Number(fat.canceladas ?? 0),
        comissao_gotaxi: parseFloat((Number(fat.entregue ?? 0) * taxa / 100).toFixed(2)),
        taxa_percentual: taxa,
      },
      por_status: porStatus.rows,
      por_tipo: porTipo.rows,
      repasses: repasse.rows,
      repasses_pendentes: Number((repassePendente.rows[0] as any)?.count ?? 0),
    });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/pdv/encomendas/relatorios ────────────────────────────────────
router.get("/relatorios", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { periodo = "30" } = req.query;
    const dias = Number(periodo);
    const [diario, ranking, servico] = await Promise.all([
      db.execute(`
        SELECT DATE(criado_em) as dia,
          COUNT(*) as total,
          COALESCE(SUM(valor_frete) FILTER (WHERE status='entregue'),0) as faturamento,
          COUNT(*) FILTER (WHERE status='entregue') as entregues
        FROM encomendas WHERE empresa_id=${empresaId} AND criado_em >= NOW() - INTERVAL '${dias} days'
        GROUP BY dia ORDER BY dia DESC LIMIT 30
      `),
      db.execute(`
        SELECT destino_cidade, COUNT(*) as qtd, COALESCE(SUM(valor_frete),0) as faturamento
        FROM encomendas WHERE empresa_id=${empresaId} AND criado_em >= NOW() - INTERVAL '${dias} days'
        GROUP BY destino_cidade ORDER BY qtd DESC LIMIT 10
      `),
      db.execute(`
        SELECT tipo_servico, COUNT(*) as qtd, COALESCE(SUM(valor_frete),0) as faturamento
        FROM encomendas WHERE empresa_id=${empresaId} AND criado_em >= NOW() - INTERVAL '${dias} days'
        GROUP BY tipo_servico
      `),
    ]);
    return res.json({
      diario: diario.rows,
      destinos: ranking.rows,
      por_servico: servico.rows,
    });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/pdv/encomendas/:id (must be last to avoid capturing named routes) ──
router.get("/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(404).json({ error: "not_found" });
    const rows = await db.execute(`SELECT * FROM encomendas WHERE id=${id} AND empresa_id=${empresaId} LIMIT 1`);
    const enc = rows.rows[0] as any;
    if (!enc) return res.status(404).json({ error: "not_found" });
    const hist = await db.execute(`SELECT * FROM encomendas_historico WHERE encomenda_id=${id} ORDER BY registrado_em ASC`);
    return res.json({ ...enc, historico: hist.rows });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

export default router;
