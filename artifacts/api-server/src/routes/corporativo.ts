import { Router } from "express";
import { db } from "@workspace/db";
import { sendFcmNotification } from "./motorista-app";

const router: Router = Router();

function getEmpresaId(req: any): number | null {
  const auth = req.headers.authorization?.replace("Bearer ", "") ?? "";
  if (!auth) return null;
  try {
    const decoded = Buffer.from(auth, "base64").toString();
    const parts = decoded.split(":");
    const id = parseInt(parts[1]);
    return isNaN(id) ? null : id;
  } catch { return null; }
}

function esc(s: string) { return String(s).replace(/'/g, "''"); }

// ── PIX BR Code (EMV) helper ─────────────────────────────────────────────────
// Builds a "Copia e Cola" PIX payload (EMV BR Code). Used in /pix-config.
function _emv(id: string, value: string) {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}
function _crc16(payload: string) {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
// Remove diacritics (acentos) — PIX exige ASCII em nome/cidade.
function _ascii(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "");
}
function buildPixBrCode(opts: {
  chave: string; nomeBeneficiario: string; cidade?: string;
  valor?: number; txid?: string; descricao?: string;
}) {
  const chave = _ascii((opts.chave || "").trim());
  const nome = _ascii((opts.nomeBeneficiario || "GOTAXI")).substring(0, 25).toUpperCase();
  const cidade = _ascii((opts.cidade || "BRASIL")).substring(0, 15).toUpperCase();
  const txid = (opts.txid || "***").replace(/[^A-Za-z0-9]/g, "").substring(0, 25) || "***";
  const merchantAccountInfo =
    _emv("00", "br.gov.bcb.pix") +
    _emv("01", chave) +
    (opts.descricao ? _emv("02", String(opts.descricao).substring(0, 50)) : "");
  const additionalData = _emv("05", txid);
  let payload =
    _emv("00", "01") + // payload format
    _emv("26", merchantAccountInfo) +
    _emv("52", "0000") + // merchant category code
    _emv("53", "986") +  // BRL
    (opts.valor && opts.valor > 0 ? _emv("54", opts.valor.toFixed(2)) : "") +
    _emv("58", "BR") +
    _emv("59", nome) +
    _emv("60", cidade) +
    _emv("62", additionalData) +
    "6304";
  return payload + _crc16(payload);
}

// ── Helper: get platform config (radius, PIX, repasse rate) ──────────────────
async function getPlatformConfig() {
  try {
    const r = await db.execute(`SELECT taxa_repasse, chave_pix, tipo_chave_pix,
      nome_beneficiario, dia_vencimento, hora_vencimento, raio_busca_motorista_km
      FROM configuracoes_plataforma ORDER BY id ASC LIMIT 1`);
    return (r.rows[0] as any) || {};
  } catch { return {}; }
}

// ── Helper: server-side geocode fallback via Google Maps ─────────────────────
// Quando o frontend não captura lat/lng (apenas texto do endereço), o backend
// faz geocoding antes de despachar para garantir coordenadas reais.
async function geocodeFallback(endereco: string): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.GOOGLE_MAPS_KEY;
  if (!key || !endereco) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(endereco)}&region=br&language=pt-BR&key=${key}`;
    const r = await fetch(url);
    const j: any = await r.json();
    const loc = j?.results?.[0]?.geometry?.location;
    if (loc && typeof loc.lat === "number" && typeof loc.lng === "number") {
      return { lat: loc.lat, lng: loc.lng };
    }
  } catch (e) { console.error("[geocode]", e); }
  return null;
}

// ── Helper: limites da semana corrente em horário do Brasil ──────────────────
// Retorna [segunda 00:00 local, próxima segunda 00:00 local) como strings ISO date.
function semanaCorrenteRange() {
  const agora = new Date();
  const dow = agora.getDay(); // 0=dom..6=sab
  const diasParaSegunda = dow === 0 ? 6 : dow - 1;
  const segunda = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - diasParaSegunda);
  const proxSegunda = new Date(segunda); proxSegunda.setDate(segunda.getDate() + 7);
  const domingo = new Date(segunda); domingo.setDate(segunda.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return {
    inicio: fmt(segunda),
    fim: fmt(domingo),       // exibido para o usuário
    proxInicio: fmt(proxSegunda), // limite superior exclusivo na consulta
  };
}

// ── GET /maps-config ─────────────────────────────────────────────────────────
router.get("/maps-config", (_req, res) => {
  res.json({ key: process.env.GOOGLE_MAPS_KEY ?? "" });
});

// ── GET /dashboard ───────────────────────────────────────────────────────────
router.get("/dashboard", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });

    const now = new Date();
    const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const mesFim = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    const [corridas, pendentes, gastoPeriodo, funcionarios, centros] = await Promise.all([
      db.execute(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'concluida') as concluidas,
        COUNT(*) FILTER (WHERE status = 'em_andamento') as em_andamento,
        COUNT(*) FILTER (WHERE status = 'pendente_aprovacao') as aguardando
        FROM pro_corridas WHERE empresa_id = ${empresaId}
        AND criado_em >= '${mesInicio}' AND criado_em <= '${mesFim} 23:59:59'`),
      db.execute(`SELECT COUNT(*) as total FROM pro_corridas WHERE empresa_id = ${empresaId} AND status = 'pendente_aprovacao'`),
      db.execute(`SELECT COALESCE(SUM(valor_final), 0) as total FROM pro_corridas WHERE empresa_id = ${empresaId}
        AND status = 'concluida' AND criado_em >= '${mesInicio}' AND criado_em <= '${mesFim} 23:59:59'`),
      db.execute(`SELECT COUNT(*) as total FROM pro_funcionarios WHERE empresa_id = ${empresaId} AND ativo = true`),
      db.execute(`SELECT COUNT(*) as total FROM pro_centros_custo WHERE empresa_id = ${empresaId} AND ativo = true`),
    ]);

    const gastoHoje = await db.execute(`SELECT COALESCE(SUM(valor_final), 0) as total FROM pro_corridas
      WHERE empresa_id = ${empresaId} AND status = 'concluida'
      AND criado_em >= CURRENT_DATE AND criado_em < CURRENT_DATE + INTERVAL '1 day'`);

    const corridasSemana = await db.execute(`SELECT DATE(criado_em) as dia, COUNT(*) as qtd, COALESCE(SUM(valor_final), 0) as valor
      FROM pro_corridas WHERE empresa_id = ${empresaId}
      AND criado_em >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(criado_em) ORDER BY dia`);

    return res.json({
      corridas: corridas.rows[0],
      pendentes_aprovacao: Number((pendentes.rows[0] as any)?.total ?? 0),
      gasto_mes: Number((gastoPeriodo.rows[0] as any)?.total ?? 0),
      gasto_hoje: Number((gastoHoje.rows[0] as any)?.total ?? 0),
      funcionarios: Number((funcionarios.rows[0] as any)?.total ?? 0),
      centros_custo: Number((centros.rows[0] as any)?.total ?? 0),
      grafico_semana: corridasSemana.rows,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ── CENTROS DE CUSTO ─────────────────────────────────────────────────────────
router.get("/centros-custo", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const r = await db.execute(`SELECT * FROM pro_centros_custo WHERE empresa_id = ${empresaId} ORDER BY nome`);
    return res.json(r.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.post("/centros-custo", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { nome, descricao, limite_mensal } = req.body;
    if (!nome) return res.status(400).json({ error: "Nome obrigatório" });
    const r = await db.execute(`INSERT INTO pro_centros_custo (empresa_id, nome, descricao, limite_mensal)
      VALUES (${empresaId}, '${nome.replace(/'/g, "''")}', '${(descricao ?? "").replace(/'/g, "''")}', ${Number(limite_mensal ?? 0)})
      RETURNING *`);
    return res.json(r.rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.put("/centros-custo/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { nome, descricao, limite_mensal, ativo } = req.body;
    const r = await db.execute(`UPDATE pro_centros_custo SET nome = '${(nome ?? "").replace(/'/g, "''")}',
      descricao = '${(descricao ?? "").replace(/'/g, "''")}', limite_mensal = ${Number(limite_mensal ?? 0)},
      ativo = ${ativo !== false}
      WHERE id = ${req.params.id} AND empresa_id = ${empresaId} RETURNING *`);
    return res.json(r.rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.delete("/centros-custo/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    await db.execute(`DELETE FROM pro_centros_custo WHERE id = ${req.params.id} AND empresa_id = ${empresaId}`);
    return res.json({ ok: true });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── FUNCIONÁRIOS ──────────────────────────────────────────────────────────────
router.get("/funcionarios", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const r = await db.execute(`SELECT f.*, c.nome as centro_custo_nome
      FROM pro_funcionarios f LEFT JOIN pro_centros_custo c ON c.id = f.centro_custo_id
      WHERE f.empresa_id = ${empresaId} ORDER BY f.nome`);
    return res.json(r.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.post("/funcionarios", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { nome, email, cargo, telefone, pode_solicitar, precisa_aprovacao, limite_corrida, centro_custo_id } = req.body;
    if (!nome) return res.status(400).json({ error: "Nome obrigatório" });
    const r = await db.execute(`INSERT INTO pro_funcionarios
      (empresa_id, nome, email, cargo, telefone, pode_solicitar, precisa_aprovacao, limite_corrida, centro_custo_id)
      VALUES (${empresaId}, '${nome.replace(/'/g,"''")}', ${email ? `'${email}'` : "NULL"},
        ${cargo ? `'${cargo.replace(/'/g,"''")}'` : "NULL"}, ${telefone ? `'${telefone}'` : "NULL"},
        ${pode_solicitar !== false}, ${precisa_aprovacao === true}, ${limite_corrida ? Number(limite_corrida) : "NULL"},
        ${centro_custo_id ? Number(centro_custo_id) : "NULL"}) RETURNING *`);
    return res.json(r.rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.put("/funcionarios/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { nome, email, cargo, telefone, pode_solicitar, precisa_aprovacao, limite_corrida, centro_custo_id, ativo } = req.body;
    const r = await db.execute(`UPDATE pro_funcionarios SET
      nome = '${(nome ?? "").replace(/'/g,"''")}',
      email = ${email ? `'${email}'` : "NULL"},
      cargo = ${cargo ? `'${cargo.replace(/'/g,"''")}'` : "NULL"},
      telefone = ${telefone ? `'${telefone}'` : "NULL"},
      pode_solicitar = ${pode_solicitar !== false},
      precisa_aprovacao = ${precisa_aprovacao === true},
      limite_corrida = ${limite_corrida ? Number(limite_corrida) : "NULL"},
      centro_custo_id = ${centro_custo_id ? Number(centro_custo_id) : "NULL"},
      ativo = ${ativo !== false}
      WHERE id = ${req.params.id} AND empresa_id = ${empresaId} RETURNING *`);
    return res.json(r.rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.delete("/funcionarios/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    await db.execute(`DELETE FROM pro_funcionarios WHERE id = ${req.params.id} AND empresa_id = ${empresaId}`);
    return res.json({ ok: true });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── CORRIDAS ─────────────────────────────────────────────────────────────────
router.get("/corridas", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { status, limit = 50, offset = 0 } = req.query as any;
    const where = status ? `AND c.status = '${status}'` : "";
    const r = await db.execute(`SELECT c.*, f.nome as funcionario_nome, cc.nome as centro_custo_nome
      FROM pro_corridas c
      LEFT JOIN pro_funcionarios f ON f.id = c.funcionario_id
      LEFT JOIN pro_centros_custo cc ON cc.id = c.centro_custo_id
      WHERE c.empresa_id = ${empresaId} ${where}
      ORDER BY c.criado_em DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`);
    const total = await db.execute(`SELECT COUNT(*) as cnt FROM pro_corridas WHERE empresa_id = ${empresaId} ${where}`);
    return res.json({ corridas: r.rows, total: Number((total.rows[0] as any)?.cnt ?? 0) });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.post("/corridas", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { funcionario_id, centro_custo_id, passageiro_nome, passageiro_telefone,
      origem, origem_lat, origem_lng, destino, destino_lat, destino_lng,
      motivo, tipo, data_agendamento, valor_estimado, observacoes } = req.body;

    if (!passageiro_nome || !origem || !destino) {
      return res.status(400).json({ error: "Passageiro, origem e destino são obrigatórios" });
    }

    let func = null;
    if (funcionario_id) {
      const fr = await db.execute(`SELECT * FROM pro_funcionarios WHERE id = ${funcionario_id} AND empresa_id = ${empresaId}`);
      func = fr.rows[0] as any;
    }

    const precisaAprovacao = func?.precisa_aprovacao === true ||
      (func?.limite_corrida && valor_estimado && Number(valor_estimado) > Number(func.limite_corrida));
    const statusInicial = precisaAprovacao ? "pendente_aprovacao" : "aprovada";

    const esc = (s: any) => s ? `'${String(s).replace(/'/g, "''")}'` : "NULL";
    const r = await db.execute(`INSERT INTO pro_corridas
      (empresa_id, funcionario_id, centro_custo_id, passageiro_nome, passageiro_telefone,
       origem, origem_lat, origem_lng, destino, destino_lat, destino_lng,
       motivo, tipo, data_agendamento, valor_estimado, observacoes, status)
      VALUES (${empresaId}, ${funcionario_id ? Number(funcionario_id) : "NULL"},
        ${centro_custo_id ? Number(centro_custo_id) : "NULL"},
        ${esc(passageiro_nome)}, ${esc(passageiro_telefone)},
        ${esc(origem)}, ${origem_lat ?? "NULL"}, ${origem_lng ?? "NULL"},
        ${esc(destino)}, ${destino_lat ?? "NULL"}, ${destino_lng ?? "NULL"},
        ${esc(motivo)}, ${esc(tipo ?? "imediato")},
        ${data_agendamento ? `'${data_agendamento}'` : "NULL"},
        ${valor_estimado ? Number(valor_estimado) : "NULL"},
        ${esc(observacoes)}, '${statusInicial}') RETURNING *`);
    return res.json({ corrida: r.rows[0], precisa_aprovacao: precisaAprovacao });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.get("/corridas/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const r = await db.execute(`SELECT c.*, f.nome as funcionario_nome, cc.nome as centro_custo_nome
      FROM pro_corridas c
      LEFT JOIN pro_funcionarios f ON f.id = c.funcionario_id
      LEFT JOIN pro_centros_custo cc ON cc.id = c.centro_custo_id
      WHERE c.id = ${req.params.id} AND c.empresa_id = ${empresaId}`);
    if (!r.rows[0]) return res.status(404).json({ error: "not found" });
    const aprovs = await db.execute(`SELECT * FROM pro_aprovacoes WHERE corrida_id = ${req.params.id} ORDER BY criado_em`);
    return res.json({ ...r.rows[0] as any, aprovacoes: aprovs.rows });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.put("/corridas/:id/status", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { status, valor_final } = req.body;
    const extraSet = valor_final ? `, valor_final = ${Number(valor_final)}` : "";
    const r = await db.execute(`UPDATE pro_corridas SET status = '${status}', atualizado_em = now() ${extraSet}
      WHERE id = ${req.params.id} AND empresa_id = ${empresaId} RETURNING *`);
    return res.json(r.rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── APROVAÇÕES ───────────────────────────────────────────────────────────────
router.get("/aprovacoes", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const r = await db.execute(`SELECT c.*, f.nome as funcionario_nome, cc.nome as centro_custo_nome
      FROM pro_corridas c
      LEFT JOIN pro_funcionarios f ON f.id = c.funcionario_id
      LEFT JOIN pro_centros_custo cc ON cc.id = c.centro_custo_id
      WHERE c.empresa_id = ${empresaId} AND c.status = 'pendente_aprovacao'
      ORDER BY c.criado_em DESC`);
    return res.json(r.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.post("/aprovacoes/:corridaId", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { acao, observacao, aprovador_nome } = req.body;
    if (!["aprovada", "recusada"].includes(acao)) return res.status(400).json({ error: "acao inválida" });

    const corrida = await db.execute(`SELECT * FROM pro_corridas WHERE id = ${req.params.corridaId} AND empresa_id = ${empresaId}`);
    if (!corrida.rows[0]) return res.status(404).json({ error: "not found" });

    await db.execute(`INSERT INTO pro_aprovacoes (corrida_id, aprovador_nome, acao, observacao)
      VALUES (${req.params.corridaId}, '${(aprovador_nome ?? "Gestor").replace(/'/g,"''")}', '${acao}', '${(observacao ?? "").replace(/'/g,"''")}') `);
    await db.execute(`UPDATE pro_corridas SET status = '${acao}', atualizado_em = now() WHERE id = ${req.params.corridaId}`);

    return res.json({ ok: true, status: acao });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── FINANCEIRO ───────────────────────────────────────────────────────────────
router.get("/financeiro", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });

    const { mes } = req.query as any;
    const dataRef = mes ? new Date(mes + "-01") : new Date();
    const mesInicio = new Date(dataRef.getFullYear(), dataRef.getMonth(), 1).toISOString().split("T")[0];
    const mesFim = new Date(dataRef.getFullYear(), dataRef.getMonth() + 1, 0).toISOString().split("T")[0];

    const [totais, porCentro, porFuncionario, porDia] = await Promise.all([
      db.execute(`SELECT COUNT(*) as corridas, COALESCE(SUM(valor_final), 0) as total,
        COUNT(*) FILTER (WHERE status = 'concluida') as concluidas,
        COUNT(*) FILTER (WHERE status = 'recusada') as recusadas
        FROM pro_corridas WHERE empresa_id = ${empresaId}
        AND criado_em >= '${mesInicio}' AND criado_em <= '${mesFim} 23:59:59'`),
      db.execute(`SELECT cc.nome as centro, COUNT(c.id) as corridas, COALESCE(SUM(c.valor_final), 0) as total
        FROM pro_corridas c LEFT JOIN pro_centros_custo cc ON cc.id = c.centro_custo_id
        WHERE c.empresa_id = ${empresaId} AND c.status = 'concluida'
        AND c.criado_em >= '${mesInicio}' AND c.criado_em <= '${mesFim} 23:59:59'
        GROUP BY cc.nome ORDER BY total DESC`),
      db.execute(`SELECT f.nome as funcionario, COUNT(c.id) as corridas, COALESCE(SUM(c.valor_final), 0) as total
        FROM pro_corridas c LEFT JOIN pro_funcionarios f ON f.id = c.funcionario_id
        WHERE c.empresa_id = ${empresaId} AND c.status = 'concluida'
        AND c.criado_em >= '${mesInicio}' AND c.criado_em <= '${mesFim} 23:59:59'
        GROUP BY f.nome ORDER BY total DESC LIMIT 10`),
      db.execute(`SELECT DATE(criado_em) as dia, COUNT(*) as corridas, COALESCE(SUM(valor_final), 0) as total
        FROM pro_corridas WHERE empresa_id = ${empresaId} AND status = 'concluida'
        AND criado_em >= '${mesInicio}' AND criado_em <= '${mesFim} 23:59:59'
        GROUP BY DATE(criado_em) ORDER BY dia`),
    ]);

    return res.json({
      mes: mesInicio.substring(0, 7),
      totais: totais.rows[0],
      por_centro_custo: porCentro.rows,
      por_funcionario: porFuncionario.rows,
      por_dia: porDia.rows,
    });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── FATURAS ──────────────────────────────────────────────────────────────────
router.get("/faturas", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const r = await db.execute(`SELECT * FROM pro_faturas WHERE empresa_id = ${empresaId} ORDER BY mes_referencia DESC`);
    return res.json(r.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.post("/faturas/gerar", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { mes } = req.body;
    const dataRef = mes ? new Date(mes + "-01") : new Date();
    const mesInicio = new Date(dataRef.getFullYear(), dataRef.getMonth(), 1).toISOString().split("T")[0];

    const stats = await db.execute(`SELECT COUNT(*) as total_corridas, COALESCE(SUM(valor_final), 0) as valor_total
      FROM pro_corridas WHERE empresa_id = ${empresaId} AND status = 'concluida'
      AND criado_em >= '${mesInicio}' AND criado_em <= '${mesInicio.substring(0,7)}-31 23:59:59'`);

    const s = stats.rows[0] as any;
    const r = await db.execute(`INSERT INTO pro_faturas (empresa_id, mes_referencia, total_corridas, valor_total, status)
      VALUES (${empresaId}, '${mesInicio}', ${Number(s.total_corridas)}, ${Number(s.valor_total)}, 'aberta')
      ON CONFLICT (empresa_id, mes_referencia) DO UPDATE SET
        total_corridas = EXCLUDED.total_corridas, valor_total = EXCLUDED.valor_total
      RETURNING *`);
    return res.json(r.rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.put("/faturas/:id/status", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { status } = req.body;
    const extra = status === "paga" ? ", paga_em = now()" : status === "fechada" ? ", fechada_em = now()" : "";
    const r = await db.execute(`UPDATE pro_faturas SET status = '${status}' ${extra}
      WHERE id = ${req.params.id} AND empresa_id = ${empresaId} RETURNING *`);
    return res.json(r.rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ── POST /corridas/:id/chamar-motorista ──────────────────────────────────────
// Despacha a corrida corporativa (status 'aprovada') para TODOS os motoristas
// online dentro do raio configurado (configuracoes_plataforma.raio_busca_motorista_km).
// Cria 1 row em `corridas` (forma_pagamento='corporativo'), insere 1
// corridas_solicitadas por motorista (60s) e dispara FCM para cada.
router.post("/corridas/:id/chamar-motorista", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });

    // Carrega a corrida corporativa
    const corpR = await db.execute(`SELECT * FROM pro_corridas
      WHERE id = ${Number(req.params.id)} AND empresa_id = ${empresaId} LIMIT 1`);
    const corp = corpR.rows[0] as any;
    if (!corp) return res.status(404).json({ error: "not_found" });
    if (!["aprovada", "chamando_motoristas"].includes(corp.status)) {
      return res.status(409).json({ error: "status_invalido", message: "Corrida precisa estar aprovada para chamar motorista." });
    }
    const cfg = await getPlatformConfig();
    const raioKm = Number(cfg.raio_busca_motorista_km ?? 10);
    const valor = Number(corp.valor_estimado || corp.valor_final || 0);
    const km = Number(corp.distancia_km || 0);

    // Coordenadas: usa as salvas; se vierem 0/0 ou null, faz geocode no servidor.
    let latO = corp.origem_lat != null ? Number(corp.origem_lat) : NaN;
    let lngO = corp.origem_lng != null ? Number(corp.origem_lng) : NaN;
    if (!Number.isFinite(latO) || !Number.isFinite(lngO) || (latO === 0 && lngO === 0)) {
      const g = await geocodeFallback(String(corp.origem || ""));
      if (!g) {
        return res.status(400).json({ error: "sem_coordenadas",
          message: "Não foi possível localizar o endereço de origem. Edite a corrida com um endereço válido." });
      }
      latO = g.lat; lngO = g.lng;
      // Persiste pra evitar geocode repetido em re-broadcasts.
      await db.execute(`UPDATE pro_corridas SET origem_lat = ${latO}, origem_lng = ${lngO}
        WHERE id = ${corp.id} AND empresa_id = ${empresaId}`);
    }
    let latD = corp.destino_lat != null ? Number(corp.destino_lat) : null;
    let lngD = corp.destino_lng != null ? Number(corp.destino_lng) : null;
    if ((latD === 0 && lngD === 0) || latD == null || lngD == null) {
      const g = await geocodeFallback(String(corp.destino || ""));
      if (g) {
        latD = g.lat; lngD = g.lng;
        await db.execute(`UPDATE pro_corridas SET destino_lat = ${latD}, destino_lng = ${lngD}
          WHERE id = ${corp.id} AND empresa_id = ${empresaId}`);
      } else { latD = null; lngD = null; }
    }
    // Validação de faixa geográfica básica
    if (Math.abs(latO) > 90 || Math.abs(lngO) > 180) {
      return res.status(400).json({ error: "coordenadas_invalidas", message: "Coordenadas fora da faixa válida." });
    }

    // 1º busca motoristas online no raio — só cria a corrida se houver alguém
    const drvR = await db.execute(`
      SELECT ma.id, ma.nome, ma.fcm_token, ma.lat, ma.lng,
        (6371 * acos(LEAST(1.0,
          cos(radians(${latO})) * cos(radians(ma.lat)) *
          cos(radians(ma.lng) - radians(${lngO})) +
          sin(radians(${latO})) * sin(radians(ma.lat))
        ))) AS dist_km
      FROM motoristas_app ma
      WHERE ma.online = true AND ma.lat IS NOT NULL AND ma.lng IS NOT NULL
        AND ma.ultimo_ping > NOW() - INTERVAL '3 minutes'
        AND ma.status = 'aprovado'
      HAVING (6371 * acos(LEAST(1.0,
          cos(radians(${latO})) * cos(radians(ma.lat)) *
          cos(radians(ma.lng) - radians(${lngO})) +
          sin(radians(${latO})) * sin(radians(ma.lat))
        ))) <= ${raioKm}
      ORDER BY dist_km ASC
      LIMIT 50
    `);
    const drivers = drvR.rows as any[];

    if (drivers.length === 0) {
      return res.status(409).json({ error: "sem_motoristas",
        message: `Nenhum motorista online em um raio de ${raioKm} km neste momento.` });
    }

    // Reusa corrida existente se já existir (re-broadcast, tenant-isolated);
    // senão cria nova só agora que sabemos que há motoristas.
    let corridaId: number;
    if (corp.corrida_id) {
      corridaId = Number(corp.corrida_id);
      await db.execute(`UPDATE corridas SET status = 'aguardando'
        WHERE id = ${corridaId} AND empresa_id = ${empresaId}
        AND status NOT IN ('aceita','em_andamento','concluida','finalizada')`);
    } else {
      const novaR = await db.execute(`
        INSERT INTO corridas (
          empresa_id, passageiro_nome, passageiro_telefone,
          origem_endereco, destino_endereco, tipo_veiculo,
          forma_pagamento, distancia_km, valor, status, tempo_espera_min,
          lat_origem, lng_origem, lat_destino, lng_destino, observacoes
        ) VALUES (
          ${empresaId},
          '${esc(corp.passageiro_nome || "Passageiro")}',
          ${corp.passageiro_telefone ? `'${esc(corp.passageiro_telefone)}'` : "NULL"},
          '${esc(corp.origem || "")}',
          '${esc(corp.destino || "")}',
          'corporativo',
          'corporativo',
          ${km}, ${valor}, 'aguardando', 5,
          ${latO}, ${lngO},
          ${latD != null ? latD : "NULL"}, ${lngD != null ? lngD : "NULL"},
          ${corp.observacoes ? `'${esc(corp.observacoes)}'` : "NULL"}
        ) RETURNING id
      `);
      corridaId = Number((novaR.rows[0] as any).id);
    }

    // Cancela solicitações antigas pendentes pra essa corrida (se re-broadcast)
    await db.execute(`UPDATE corridas_solicitadas SET status = 'expirada'
      WHERE corrida_id = ${corridaId} AND status = 'aguardando'`);

    // Insere uma corridas_solicitadas por motorista (60s)
    const tempoViagemMin = km > 0 ? Math.round((km / 40) * 60) : 5;
    let inseridos = 0;
    for (const d of drivers) {
      const distM = Number(d.dist_km || 0);
      const tempoMotMin = Math.max(1, Math.round((distM / 30) * 60));
      try {
        await db.execute(`
          INSERT INTO corridas_solicitadas (
            motorista_id, corrida_id, tipo_servico, categoria_nome,
            valor_estimado, origem_endereco, destino_endereco,
            distancia_motorista_km, tempo_motorista_min,
            distancia_viagem_km, tempo_viagem_min,
            lat_origem, lng_origem, lat_destino, lng_destino,
            cliente_nome, forma_pagamento, status, expira_em
          ) VALUES (
            ${d.id}, ${corridaId}, 'corrida', 'Corporativo',
            ${valor},
            '${esc(corp.origem || "")}',
            '${esc(corp.destino || "")}',
            ${distM.toFixed(2)}, ${tempoMotMin},
            ${km}, ${tempoViagemMin},
            ${latO}, ${lngO},
            ${latD != null ? latD : "NULL"}, ${lngD != null ? lngD : "NULL"},
            '${esc(corp.passageiro_nome || "Passageiro")}',
            'corporativo',
            'aguardando', NOW() + INTERVAL '60 seconds'
          )
        `);
        inseridos++;
        // Push FCM (best-effort)
        if (d.fcm_token) {
          sendFcmNotification(
            d.fcm_token,
            "🚖 Nova corrida corporativa!",
            `${corp.origem || "Origem"} → ${corp.destino || "Destino"}${valor ? ` • R$ ${valor.toFixed(2).replace(".", ",")}` : ""}`,
            { type: "nova_corrida", corrida_id: String(corridaId) }
          ).catch(() => {});
        }
      } catch (e) {
        console.error("[chamar-motorista] insert corridas_solicitadas:", e);
      }
    }

    // Atualiza pro_corridas
    await db.execute(`
      UPDATE pro_corridas SET
        corrida_id = ${corridaId},
        motoristas_chamados = ${inseridos},
        chamado_em = NOW(),
        status = 'chamando_motoristas',
        atualizado_em = NOW()
      WHERE id = ${corp.id} AND empresa_id = ${empresaId}
    `);

    return res.json({
      ok: true,
      corrida_id: corridaId,
      motoristas_chamados: inseridos,
      raio_km: raioKm,
    });
  } catch (e: any) {
    console.error("[chamar-motorista]", e);
    return res.status(500).json({ error: e.message });
  }
});

// ── GET /repasses ────────────────────────────────────────────────────────────
// Lista repasses semanais da empresa para a GoTaxi.
// Calcula on-the-fly a semana atual (em aberto) somando pro_corridas concluidas.
router.get("/repasses", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });

    const cfg = await getPlatformConfig();
    const taxa = Number(cfg.taxa_repasse ?? 20) / 100; // % sobre o valor da corrida

    // Histórico: tudo que já foi consolidado em repasses_corporativos
    const histR = await db.execute(`
      SELECT id, semana_inicio, semana_fim, total_corridas,
        valor_total, status, vencimento, pago_em, comprovante_url
      FROM repasses_corporativos
      WHERE empresa_id = ${empresaId}
      ORDER BY semana_inicio DESC
      LIMIT 52
    `);

    // Semana atual (aberta) — [segunda 00:00, próxima segunda 00:00)
    const semana = semanaCorrenteRange();
    const semanaR = await db.execute(`
      SELECT COUNT(*) AS qtd, COALESCE(SUM(COALESCE(valor_final, valor_estimado, 0)), 0) AS total
      FROM pro_corridas
      WHERE empresa_id = ${empresaId} AND status = 'concluida'
        AND atualizado_em >= '${semana.inicio}' AND atualizado_em < '${semana.proxInicio}'
    `);
    const sem = semanaR.rows[0] as any;
    const valorBruto = Number(sem?.total ?? 0);
    const valorRepasse = Math.round(valorBruto * taxa * 100) / 100;

    return res.json({
      taxa_repasse_pct: Number(cfg.taxa_repasse ?? 20),
      semana_atual: {
        inicio: semana.inicio,
        fim: semana.fim,
        total_corridas: Number(sem?.qtd ?? 0),
        valor_bruto: valorBruto,
        valor_repasse: valorRepasse,
        status: "em_aberto",
      },
      historico: histR.rows,
    });
  } catch (e: any) {
    console.error("[GET /repasses]", e);
    return res.status(500).json({ error: e.message });
  }
});

// ── GET /pix-config ──────────────────────────────────────────────────────────
// Retorna a chave PIX da GoTaxi e o BR Code com o valor devido na semana atual.
router.get("/pix-config", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });

    const cfg = await getPlatformConfig();
    const taxa = Number(cfg.taxa_repasse ?? 20) / 100;

    // Calcula valor devido (semana atual) — mesmo intervalo de /repasses
    const semana = semanaCorrenteRange();
    const semanaR = await db.execute(`
      SELECT COALESCE(SUM(COALESCE(valor_final, valor_estimado, 0)), 0) AS total
      FROM pro_corridas
      WHERE empresa_id = ${empresaId} AND status = 'concluida'
        AND atualizado_em >= '${semana.inicio}' AND atualizado_em < '${semana.proxInicio}'
    `);
    const valorRepasse = Math.round(Number((semanaR.rows[0] as any)?.total ?? 0) * taxa * 100) / 100;

    // Soma também repasses pendentes anteriores
    const pendR = await db.execute(`
      SELECT COALESCE(SUM(valor_total), 0) AS total
      FROM repasses_corporativos
      WHERE empresa_id = ${empresaId} AND status = 'pendente'
    `);
    const valorPendente = Number((pendR.rows[0] as any)?.total ?? 0);
    const valorTotalDevido = Math.round((valorRepasse + valorPendente) * 100) / 100;

    const chave = String(cfg.chave_pix || "").trim();
    const beneficiario = String(cfg.nome_beneficiario || "GoTaxi").trim();
    const txid = `GTX${empresaId}${semana.inicio.replace(/-/g, "")}`;

    let brCode = "";
    if (chave) {
      brCode = buildPixBrCode({
        chave,
        nomeBeneficiario: beneficiario,
        valor: valorTotalDevido > 0 ? valorTotalDevido : undefined,
        txid,
        descricao: `Repasse ${semana.inicio}`,
      });
    }

    return res.json({
      chave_pix: chave,
      tipo_chave: cfg.tipo_chave_pix || "",
      nome_beneficiario: beneficiario,
      dia_vencimento: cfg.dia_vencimento || "segunda",
      hora_vencimento: cfg.hora_vencimento || "18:00",
      taxa_repasse_pct: Number(cfg.taxa_repasse ?? 20),
      valor_semana_atual: valorRepasse,
      valor_pendente_anterior: valorPendente,
      valor_total_devido: valorTotalDevido,
      semana_inicio: semana.inicio,
      semana_fim: semana.fim,
      br_code: brCode,
    });
  } catch (e: any) {
    console.error("[GET /pix-config]", e);
    return res.status(500).json({ error: e.message });
  }
});

export default router;
