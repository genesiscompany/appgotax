import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { customerIdFromRequest } from "../lib/customerToken";
import { roadRoute } from "../lib/roadDistance";

const router: IRouter = Router();

// ── Ensure corrida_mensagens table ────────────────────────────────────────────
async function ensureMensagensTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS corrida_mensagens (
      id SERIAL PRIMARY KEY,
      corrida_id INTEGER NOT NULL,
      remetente TEXT NOT NULL CHECK (remetente IN ('passageiro', 'motorista')),
      texto TEXT NOT NULL,
      criado_em TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}
ensureMensagensTable().catch(console.error);

// ── SSE broadcast helpers ─────────────────────────────────────────────────────
const sseClients = new Map<string, Set<Response>>();

function broadcast(empresaId: number, data: object) {
  const key = String(empresaId);
  sseClients.get(key)?.forEach(res => {
    try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch (_) {}
  });
}

// GET /api/motorista/stream?empresa_id=X
router.get("/stream", (req, res) => {
  const key = String(req.query.empresa_id || "1");
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.flushHeaders();
  res.write(":ok\n\n");
  if (!sseClients.has(key)) sseClients.set(key, new Set());
  sseClients.get(key)!.add(res);
  const ping = setInterval(() => { try { res.write(":ping\n\n"); } catch (_) {} }, 25000);
  req.on("close", () => { clearInterval(ping); sseClients.get(key)?.delete(res); });
});

function esc(s: string) { return s.replace(/'/g, "''"); }

// GET /api/motorista/categorias — public, returns active ride categories with pricing
router.get("/categorias", async (_req, res) => {
  try {
    const rows = await db.execute(`
      SELECT id, nome, taxa_minima, taxa_por_km, dist_chamada_km
      FROM categorias_corrida
      WHERE ativo = true
      ORDER BY taxa_por_km ASC
    `);
    return res.json(rows.rows);
  } catch (_) {
    return res.json([
      { id: 1, nome: "GoTaxi X",    taxa_minima: 10, taxa_por_km: 2.5, dist_chamada_km: 5 },
      { id: 2, nome: "GoTaxi Plus", taxa_minima: 10, taxa_por_km: 3.5, dist_chamada_km: 5 },
      { id: 3, nome: "GoTaxi Black",taxa_minima: 15, taxa_por_km: 5.0, dist_chamada_km: 5 },
    ]);
  }
});

function estimaEspera(tipo: string): number {
  return tipo === "premium" ? 8 : tipo === "conforto" ? 5 : 3;
}

// ── POST /api/motorista/estimativa — mesma regra de preço do /solicitar ─────
router.post("/estimativa", async (req, res) => {
  try {
    const { lat_origem, lng_origem, lat_destino, lng_destino, categoria_nome, payment_source } = req.body;
    const coords = [lat_origem, lng_origem, lat_destino, lng_destino].map(Number);
    const validCoords = coords.every(Number.isFinite)
      && Math.abs(coords[0]) <= 90 && Math.abs(coords[2]) <= 90
      && Math.abs(coords[1]) <= 180 && Math.abs(coords[3]) <= 180;
    const categoria = String(categoria_nome || "");
    if (!validCoords || !categoria) return res.status(422).json({ error: "authoritative_quote_unavailable" });
    const tariffRows = await db.execute(sql`SELECT taxa_minima, taxa_por_km FROM categorias_corrida WHERE nome = ${categoria} AND ativo = true LIMIT 1`);
    const tariff = tariffRows.rows[0] as any;
    if (!tariff) return res.status(422).json({ error: "authoritative_quote_unavailable" });
    const rawSource = payment_source === "carteira" ? "wallet" : String(payment_source || "direto");
    const paymentSource = ["direto", "mercado_pago", "wallet"].includes(rawSource) ? rawSource : "direto";

    const route = await roadRoute(coords[0], coords[1], coords[2], coords[3]);
    const tripKm = Math.max(0.1, Math.round(route.km * 100) / 100);

    const nearestRows = await db.execute(`
      SELECT (6371 * acos(LEAST(1.0,
        cos(radians(${coords[0]})) * cos(radians(ma.lat)) *
        cos(radians(ma.lng) - radians(${coords[1]})) +
        sin(radians(${coords[0]})) * sin(radians(ma.lat))
      ))) AS distancia_motorista_km
      FROM motoristas_app ma
      WHERE ma.online = true AND ma.lat IS NOT NULL AND ma.lng IS NOT NULL
        AND ma.ultimo_ping > NOW() - INTERVAL '3 minutes'
        AND ma.status = 'aprovado'
        AND (
          ('${paymentSource}' = 'direto' AND ma.aceita_pagamento_direto = true)
          OR ('${paymentSource}' IN ('mercado_pago', 'wallet') AND ma.aceita_pagamento_app = true)
        )
        AND EXISTS (SELECT 1 FROM motorista_categorias mc WHERE mc.motorista_id = ma.id AND mc.categoria_nome = '${esc(categoria)}')
      ORDER BY distancia_motorista_km ASC LIMIT 1
    `);
    const pickupKm = Math.max(0, Number((nearestRows.rows[0] as any)?.distancia_motorista_km ?? 0));
    const km = Math.round((tripKm + pickupKm) * 100) / 100;
    const price = km <= 3 ? Number(tariff.taxa_minima) : Number(tariff.taxa_por_km) * km;
    return res.json({
      distancia_viagem_km: tripKm,
      distancia_cobrada_km: km,
      tempo_viagem_min: route.minutos,
      valor: Math.round(price * 100) / 100,
      fonte: route.fonte,
    });
  } catch (err) {
    console.error("[estimativa]", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── POST /api/motorista/solicitar ────────────────────────────────────────────
router.post("/solicitar", async (req, res) => {
  try {
    const {
      empresa_id, passageiro_nome, passageiro_telefone,
      origem_endereco, destino_endereco, tipo_veiculo, categoria_nome,
      forma_pagamento, payment_source,
      lat_origem, lng_origem, lat_destino, lng_destino, observacoes,
    } = req.body;
    const empresaId = Number(empresa_id || 1);
    // Whitelist enum-like fields to prevent SQL injection (these are interpolated into raw SQL below)
    const ALLOWED_TIPOS = new Set(["economico", "conforto", "premium", "GoTaxi X", "GoTaxi Plus", "GoTaxi Black"]);
    const ALLOWED_PAG = new Set(["pix", "dinheiro", "credito", "debito", "vr", "sodexo", "credito_gotaxi"]);
    const ALLOWED_PAYMENT_SOURCES = new Set(["direto", "mercado_pago", "wallet"]);
    const tipoSafe = ALLOWED_TIPOS.has(String(tipo_veiculo)) ? String(tipo_veiculo) : "economico";
    const pagSafe = ALLOWED_PAG.has(String(forma_pagamento)) ? String(forma_pagamento) : "dinheiro";
    const rawPaymentSource = payment_source === undefined ? "direto" : String(payment_source);
    const paymentSource = rawPaymentSource === "carteira" ? "wallet" : rawPaymentSource;
    if (!ALLOWED_PAYMENT_SOURCES.has(paymentSource)) {
      return res.status(400).json({ error: "payment_source_invalido", message: "payment_source deve ser direto, mercado_pago ou wallet" });
    }
    const coords = [lat_origem, lng_origem, lat_destino, lng_destino].map(Number);
    const validCoords = coords.every(Number.isFinite)
      && Math.abs(coords[0]) <= 90 && Math.abs(coords[2]) <= 90
      && Math.abs(coords[1]) <= 180 && Math.abs(coords[3]) <= 180;
    let quotedKm: number | null = null;
    if (validCoords) {
      const route = await roadRoute(coords[0], coords[1], coords[2], coords[3]);
      quotedKm = Math.max(0.1, Math.round(route.km * 100) / 100);
    }
    const requestedCategory = String(categoria_nome || tipo_veiculo || "");
    const tariffRows = requestedCategory
      ? await db.execute(sql`SELECT nome, taxa_minima, taxa_por_km FROM categorias_corrida WHERE nome = ${requestedCategory} AND ativo = true LIMIT 1`)
      : { rows: [] };
    const tariff = tariffRows.rows[0] as any;
    if (!quotedKm || !tariff) {
      return res.status(422).json({ error: "authoritative_quote_unavailable", message: "Coordenadas válidas e categoria ativa são obrigatórias para calcular a corrida" });
    }
    const tripKm = quotedKm;
    let pickupKm = 0;
    let selectedDriver: any = null;
    if (validCoords && requestedCategory) {
      const nearestRows = await db.execute(`
        SELECT ma.id, ma.nome, ma.veiculo_modelo, ma.veiculo_cor, ma.veiculo_placa,
          ma.avaliacao_media, ma.lat, ma.lng, (
          6371 * acos(LEAST(1.0,
            cos(radians(${coords[0]})) * cos(radians(ma.lat)) *
            cos(radians(ma.lng) - radians(${coords[1]})) +
            sin(radians(${coords[0]})) * sin(radians(ma.lat))
          ))
        ) AS distancia_motorista_km
        FROM motoristas_app ma
        WHERE ma.online = true
          AND ma.lat IS NOT NULL AND ma.lng IS NOT NULL
          AND ma.ultimo_ping > NOW() - INTERVAL '3 minutes'
          AND ma.status = 'aprovado'
          AND (
            ('${paymentSource}' = 'direto' AND ma.aceita_pagamento_direto = true)
            OR ('${paymentSource}' IN ('mercado_pago', 'wallet') AND ma.aceita_pagamento_app = true)
          )
          AND EXISTS (
            SELECT 1 FROM motorista_categorias mc
            WHERE mc.motorista_id = ma.id
              AND mc.categoria_nome = '${esc(requestedCategory)}'
          )
        ORDER BY distancia_motorista_km ASC
        LIMIT 1
      `);
      selectedDriver = nearestRows.rows[0] as any;
      pickupKm = Math.max(0, Number(selectedDriver?.distancia_motorista_km ?? 0));
    }
    if (!selectedDriver) {
      return res.status(409).json({ error: "no_driver_available", message: "Nenhum motorista disponível para esta categoria e forma de pagamento" });
    }
    const km = Math.round((tripKm + pickupKm) * 100) / 100;
    const serverPrice = km <= 3
      ? Number(tariff.taxa_minima)
      : Number(tariff.taxa_por_km) * km;
    const valorFinal = Math.round(serverPrice * 100) / 100;

    // Persist authenticated ownership so a later payment intent cannot be staged by another customer.
    const authToken = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : "";
    const signedCustomerId = customerIdFromRequest(req);
    const clienteId: number | null = signedCustomerId;
    if (!clienteId) {
      return res.status(401).json({ error: "signed_customer_token_required" });
    }
    await db.execute(sql`ALTER TABLE corridas ADD COLUMN IF NOT EXISTS customer_id INTEGER`);
    // Handle Crédito GoTaxi payment: deduct from credito_aplicativo before creating ride
    let creditoDescontado = 0;
    if (forma_pagamento === "credito_gotaxi" && paymentSource !== "wallet") {
      if (!authToken) return res.status(401).json({ error: "unauthorized", message: "Token necessário para pagamento com crédito" });
      if (!clienteId) return res.status(401).json({ error: "invalid_token" });

      const userRows = (await db.execute(sql`SELECT credito_aplicativo FROM usuarios WHERE id = ${clienteId}`)).rows as any[];
      const saldoCredito = Number(userRows[0]?.credito_aplicativo ?? 0);
      const valorCorrida = Number(valorFinal);
      if (saldoCredito < valorCorrida) {
        return res.status(400).json({ error: "credito_insuficiente", message: `Saldo insuficiente. Disponível: R$ ${saldoCredito.toFixed(2)}` });
      }
      await db.execute(sql`UPDATE usuarios SET credito_aplicativo = credito_aplicativo - ${valorCorrida} WHERE id = ${clienteId}`);
      creditoDescontado = valorCorrida;
    }

    // Create main corrida record
    const rows = await db.execute(`
      INSERT INTO corridas (
         empresa_id, customer_id, passageiro_nome, passageiro_telefone,
        origem_endereco, destino_endereco, tipo_veiculo,
         forma_pagamento, payment_source, distancia_km, valor, status, tempo_espera_min,
        lat_origem, lng_origem, lat_destino, lng_destino, observacoes
      ) VALUES (
         ${empresaId}, ${clienteId ?? "NULL"},
        '${esc(String(passageiro_nome || "Cliente"))}',
        ${passageiro_telefone ? `'${esc(String(passageiro_telefone))}'` : "NULL"},
        '${esc(String(origem_endereco || ""))}',
        '${esc(String(destino_endereco || ""))}',
        '${tipoSafe}',
        '${pagSafe}',
         '${paymentSource}',
        ${km}, ${Number(valorFinal)}, 'aguardando',
        ${estimaEspera(tipoSafe)},
        ${lat_origem ?? "NULL"}, ${lng_origem ?? "NULL"},
        ${lat_destino ?? "NULL"}, ${lng_destino ?? "NULL"},
        ${observacoes ? `'${esc(String(observacoes))}'` : "NULL"}
      ) RETURNING *
    `);
    const corrida = rows.rows[0] as any;

    // ── Dispatch to nearest online driver (motoristas_app) ──────────────────
    if (lat_origem != null && lng_origem != null) {
      try {
        const driverRows = { rows: selectedDriver ? [selectedDriver] : [] };

        if (driverRows.rows.length > 0) {
          const driver = driverRows.rows[0] as any;
          const distMotorista = 6371 * Math.acos(
            Math.cos(Number(lat_origem) * Math.PI / 180) * Math.cos(Number(driver.lat) * Math.PI / 180) *
            Math.cos((Number(driver.lng) - Number(lng_origem)) * Math.PI / 180) +
            Math.sin(Number(lat_origem) * Math.PI / 180) * Math.sin(Number(driver.lat) * Math.PI / 180)
          );
          const tempoMotoristaMin = Math.round((distMotorista / 30) * 60); // ~30 km/h urban

          await db.execute(`
            INSERT INTO corridas_solicitadas (
              motorista_id, corrida_id, tipo_servico, categoria_nome,
              valor_estimado, origem_endereco, destino_endereco,
              distancia_motorista_km, tempo_motorista_min,
              distancia_viagem_km, tempo_viagem_min,
              lat_origem, lng_origem, lat_destino, lng_destino,
               cliente_nome, forma_pagamento, payment_source,
              status, expira_em
            ) VALUES (
              ${driver.id}, ${corrida.id}, 'corrida',
              '${esc(String(categoria_nome || tipo_veiculo || "GoTaxi X"))}',
              ${Number(valorFinal)},
              '${esc(String(origem_endereco || ""))}',
              '${esc(String(destino_endereco || ""))}',
              ${distMotorista.toFixed(2)}, ${tempoMotoristaMin},
              ${tripKm}, ${Math.round((tripKm / 40) * 60)},
              ${Number(lat_origem)}, ${Number(lng_origem)},
              ${lat_destino != null ? Number(lat_destino) : "NULL"},
              ${lng_destino != null ? Number(lng_destino) : "NULL"},
              '${esc(String(passageiro_nome || "Passageiro"))}',
              '${pagSafe}',
               '${paymentSource}',
              'aguardando', NOW() + INTERVAL '60 seconds'
            )
          `);

          // Store dispatched driver info in corrida
          await db.execute(`
            UPDATE corridas SET motorista_app_id = ${driver.id}, motorista_app_nome = '${esc(String(driver.nome))}'
            WHERE id = ${corrida.id}
          `);
          corrida.motorista_app_id = driver.id;
          corrida.motorista_app_nome = driver.nome;
          corrida.driver_dispatched = true;
        }
      } catch (dispatchErr) {
        console.error("dispatch error:", dispatchErr);
      }
    }

    // Generate affiliate commission for the logged-in customer (if referred)
    try {
      const { gerarComissaoCliente, decodeClienteTokenFromReq } = await import("../lib/comissaoAfiliado");
      const uid = clienteId ?? decodeClienteTokenFromReq(req);
      await gerarComissaoCliente({
        usuarioId: uid,
        valor: Number(valorFinal) || 0,
        tipoEvento: "corrida",
        referenciaId: Number(corrida.id),
        descricao: `Corrida #${corrida.id}`,
      });
    } catch (commErr) {
      console.error("[motorista/solicitar] comissão erro:", commErr);
    }

    broadcast(empresaId, { tipo: "nova_corrida", corrida });
    return res.status(201).json(corrida);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/motorista/corridas ──────────────────────────────────────────────
router.get("/corridas", async (req, res) => {
  try {
    const empresaId = Number(req.query.empresa_id || req.headers["x-empresa-id"] || 1);
    const statusFilter = req.query.status ? `AND c.status = '${req.query.status}'` : "";
    const rows = await db.execute(`
      SELECT c.*,
        m.nome as motorista_nome_real, m.telefone as motorista_telefone,
        m.veiculo as motorista_veiculo, m.placa as motorista_placa
      FROM corridas c
      LEFT JOIN motoristas_pdv m ON m.id = c.motorista_id
      WHERE c.empresa_id = ${empresaId} ${statusFilter}
      ORDER BY c.criado_em DESC LIMIT 100
    `);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/motorista/corridas/disponiveis ──────────────────────────────────
router.get("/corridas/disponiveis", async (req, res) => {
  try {
    const empresaId = Number(req.query.empresa_id || 1);
    const rows = await db.execute(`
      SELECT * FROM corridas
      WHERE empresa_id = ${empresaId} AND status = 'aguardando' AND motorista_id IS NULL
      ORDER BY criado_em DESC LIMIT 20
    `);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/motorista/corridas/:id ─────────────────────────────────────────
router.get("/corridas/:id", async (req, res) => {
  try {
    const rows = await db.execute(`
      SELECT c.*,
        m.nome as motorista_nome_real, m.telefone as motorista_telefone,
        m.veiculo as motorista_veiculo, m.placa as motorista_placa,
        ma.nome as ma_nome, ma.telefone as ma_telefone,
        ma.veiculo_modelo as ma_veiculo, ma.veiculo_placa as ma_placa,
        ma.foto as ma_foto, ma.avaliacao_media as ma_avaliacao,
        ma.lat as ma_lat, ma.lng as ma_lng
      FROM corridas c
      LEFT JOIN motoristas_pdv m ON m.id = c.motorista_id
      LEFT JOIN motoristas_app ma ON ma.id = c.motorista_app_id
      WHERE c.id = ${req.params.id}
    `);
    if (!rows.rows[0]) return res.status(404).json({ error: "not_found" });
    const row = rows.rows[0] as any;
    // Normalize: prefer motoristas_app data when present
    if (row.motorista_app_id) {
      row.motorista_nome_real = row.motorista_nome_real || row.ma_nome;
      row.motorista_telefone = row.motorista_telefone || row.ma_telefone;
      row.motorista_veiculo = row.motorista_veiculo || row.ma_veiculo;
      row.motorista_placa = row.motorista_placa || row.ma_placa;
      row.motorista_foto = row.ma_foto;
      row.motorista_avaliacao = row.ma_avaliacao;
      row.motorista_lat = row.ma_lat;
      row.motorista_lng = row.ma_lng;
    }
    return res.json(row);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── POST /api/motorista/corridas/:id/aceitar ─────────────────────────────────
router.post("/corridas/:id/aceitar", async (req, res) => {
  try {
    const { motorista_id, motorista_nome } = req.body;
    const rows = await db.execute(`
      UPDATE corridas SET
        status = 'aceita',
        motorista_id = ${motorista_id ?? "NULL"},
        motorista_nome = ${motorista_nome ? `'${esc(String(motorista_nome))}'` : "NULL"}
      WHERE id = ${req.params.id} AND status = 'aguardando'
      RETURNING *
    `);
    if (!rows.rows[0]) return res.status(409).json({ error: "corrida_indisponivel" });
    const corrida = rows.rows[0] as any;
    broadcast(corrida.empresa_id, { tipo: "corrida_aceita", corrida });
    return res.json(corrida);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── PATCH /api/motorista/corridas/:id/status ─────────────────────────────────
router.patch("/corridas/:id/status", async (req, res) => {
  return res.status(403).json({
    error: "status_update_forbidden",
    message: "Use o fluxo autenticado de cancelamento ou os endpoints do motorista.",
  });
});

// ── POST /api/motorista/corridas/:id/avaliar ─────────────────────────────────
router.post("/corridas/:id/avaliar", async (req, res) => {
  try {
    const { avaliacao } = req.body;
    const nota = Number(avaliacao);
    if (!nota || nota < 1 || nota > 5) return res.status(400).json({ error: "avaliacao_invalida" });
    const rows = await db.execute(`
      UPDATE corridas SET avaliacao = ${nota}
      WHERE id = ${req.params.id} AND status = 'concluida' RETURNING *
    `);
    return res.json(rows.rows[0] ?? null);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/motorista/historico ─────────────────────────────────────────────
router.get("/historico", async (req, res) => {
  try {
    const empresaId = Number(req.query.empresa_id || 1);
    const rows = await db.execute(`
      SELECT * FROM corridas
      WHERE empresa_id = ${empresaId} AND status IN ('concluida', 'cancelada')
      ORDER BY criado_em DESC LIMIT 50
    `);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/motorista/stats ─────────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  try {
    const empresaId = Number(req.query.empresa_id || req.headers["x-empresa-id"] || 1);
    const rows = await db.execute(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'aguardando') as aguardando,
        COUNT(*) FILTER (WHERE status IN ('aceita','a_caminho')) as aceitas,
        COUNT(*) FILTER (WHERE status = 'em_andamento') as em_andamento,
        COUNT(*) FILTER (WHERE status = 'concluida' AND DATE(criado_em) = CURRENT_DATE) as concluidas_hoje,
        COUNT(*) FILTER (WHERE status = 'cancelada' AND DATE(criado_em) = CURRENT_DATE) as canceladas_hoje,
        COALESCE(SUM(valor) FILTER (WHERE status = 'concluida' AND DATE(criado_em) = CURRENT_DATE), 0) as receita_hoje,
        COALESCE(AVG(avaliacao) FILTER (WHERE avaliacao IS NOT NULL), 0) as avaliacao_media,
        COUNT(*) FILTER (WHERE status = 'concluida') as total_concluidas
      FROM corridas WHERE empresa_id = ${empresaId}
    `);
    return res.json(rows.rows[0] ?? {});
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/motorista/motoristas-disponiveis ─────────────────────────────────
router.get("/motoristas-disponiveis", async (req, res) => {
  try {
    const empresaId = Number(req.query.empresa_id || req.headers["x-empresa-id"] || 1);
    const rows = await db.execute(`
      SELECT * FROM motoristas_pdv WHERE empresa_id = ${empresaId} AND ativo = true ORDER BY nome
    `);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/motorista/disponiveis ───────────────────────────────────────────
// Returns online drivers with recent ping (last 2 minutes) and their positions.
// Optional query param: ?categoria=GoTaxi%20X  to filter by category
router.get("/disponiveis", async (req, res) => {
  try {
    const catParam = req.query.categoria as string | undefined;
    const paymentSourceParam = String(req.query.payment_source || "");
    const catJoin = catParam
      ? `JOIN motorista_categorias mc ON mc.motorista_id = ma.id AND mc.categoria_nome = '${esc(catParam)}'`
      : "";
    const paymentFilter = paymentSourceParam === "direto"
      ? "AND ma.aceita_pagamento_direto = true"
      : paymentSourceParam === "mercado_pago" || paymentSourceParam === "wallet"
        ? "AND ma.aceita_pagamento_app = true"
        : "";
    const rows = await db.execute(`
      SELECT ma.id, ma.nome, ma.veiculo_modelo, ma.veiculo_cor, ma.veiculo_placa,
             ma.avaliacao_media, ma.lat, ma.lng, ma.tipo_profissional
      FROM motoristas_app ma
      ${catJoin}
      WHERE ma.online = true
        AND ma.lat IS NOT NULL
        AND ma.lng IS NOT NULL
        AND ma.ultimo_ping > NOW() - INTERVAL '3 minutes'
        AND ma.status = 'aprovado'
        ${paymentFilter}
      ORDER BY ma.ultimo_ping DESC
    `);
    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.json([]);
  }
});

// ── GET /api/motorista/corridas/:id/mensagens ─────────────────────────────────
router.get("/corridas/:id/mensagens", async (req, res) => {
  try {
    const rows = await db.execute(`
      SELECT id, corrida_id, remetente, texto, criado_em
      FROM corrida_mensagens
      WHERE corrida_id = ${Number(req.params.id)}
      ORDER BY criado_em ASC
    `);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── POST /api/motorista/corridas/:id/mensagens ────────────────────────────────
router.post("/corridas/:id/mensagens", async (req, res) => {
  try {
    const { remetente, texto } = req.body;
    if (!remetente || !texto?.trim()) return res.status(400).json({ error: "missing_fields" });
    if (!["passageiro", "motorista"].includes(remetente)) return res.status(400).json({ error: "remetente_invalido" });
    const rows = await db.execute(`
      INSERT INTO corrida_mensagens (corrida_id, remetente, texto)
      VALUES (${Number(req.params.id)}, '${esc(String(remetente))}', '${esc(String(texto.trim()))}')
      RETURNING *
    `);
    return res.status(201).json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

export default router;
