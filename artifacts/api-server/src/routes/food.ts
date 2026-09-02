import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { restaurantesTable, itensCardapioTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { broadcastToEmpresa, sendExpoPushToEmpresa } from "./pdv";

function decodeClienteToken(token: string): number | null {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const match = decoded.match(/^cl_(\d+):/);
    return match ? Number(match[1]) : null;
  } catch { return null; }
}

const router: IRouter = Router();

// ── Legacy routes (kept for compatibility) ────────────────────────────────────
router.get("/restaurantes", async (req, res) => {
  const empresaId = Number(req.headers["x-empresa-id"] || 1);
  const restaurantes = await db.select().from(restaurantesTable).where(eq(restaurantesTable.empresaId, empresaId));
  return res.json(restaurantes.map(r => ({ ...r, criadoEm: r.criadoEm.toISOString() })));
});

router.post("/restaurantes", async (req, res) => {
  try {
    const empresaId = Number(req.headers["x-empresa-id"] || 1);
    const { nome, descricao, categoria, tempoEntregaMin, taxaEntrega } = req.body;
    const [restaurante] = await db.insert(restaurantesTable).values({
      empresaId, nome, descricao, categoria,
      tempoEntregaMin: Number(tempoEntregaMin) || 30,
      taxaEntrega: Number(taxaEntrega) || 0,
      aberto: true,
    }).returning();
    return res.status(201).json({ ...restaurante, criadoEm: restaurante.criadoEm.toISOString() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error", message: "Erro interno" });
  }
});

router.get("/cardapio/:restauranteId", async (req, res) => {
  const itens = await db.select().from(itensCardapioTable).where(eq(itensCardapioTable.restauranteId, Number(req.params.restauranteId)));
  return res.json(itens);
});

router.post("/cardapio/:restauranteId", async (req, res) => {
  try {
    const { nome, descricao, preco, categoria } = req.body;
    const [item] = await db.insert(itensCardapioTable).values({
      restauranteId: Number(req.params.restauranteId),
      nome, descricao, preco: Number(preco), categoria, disponivel: true,
    }).returning();
    return res.status(201).json(item);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error", message: "Erro interno" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  PUBLIC ROUTES — PDV catalog exposed to the customer mobile app
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/food/parceiros — all active partner restaurants that have PDV products
// Supports ?lat=&lng= for area-based filtering using Haversine formula
router.get("/parceiros", async (req, res) => {
  try {
    const userLat = req.query.lat ? Number(req.query.lat) : null;
    const userLng = req.query.lng ? Number(req.query.lng) : null;
    const subcategoriaIdRaw = req.query.subcategoria_id;
    const subcategoriaId = subcategoriaIdRaw !== undefined && subcategoriaIdRaw !== ""
      ? Number(subcategoriaIdRaw)
      : null;

    const rows = await db.execute(`
      SELECT
        e.id,
        e.nome,
        e.cor_primaria as cor,
        COALESCE(
          (SELECT json_build_object('nome', c.nome)
           FROM categorias_pdv c
           WHERE c.empresa_id = e.id
           ORDER BY c.ordem LIMIT 1),
          json_build_object('nome', 'Restaurante')
        ) as categoria_info,
        COUNT(DISTINCT p.id) as total_produtos,
        r.lat_loja,
        r.lng_loja,
        r.raio_visibilidade_km,
        COALESCE(r.tempo_entrega_min, 30) as tempo_entrega_min,
        COALESCE(r.taxa_entrega, 0) as taxa_entrega,
        r.subcategoria_id,
        sa.nome  as subcategoria_nome,
        sa.slug  as subcategoria_slug,
        sa.emoji as subcategoria_emoji
      FROM empresas e
      LEFT JOIN produtos_pdv p ON p.empresa_id = e.id AND p.ativo = true
      LEFT JOIN restaurantes r ON r.empresa_id = e.id
      LEFT JOIN subcategorias_alimentacao sa ON sa.id = r.subcategoria_id AND sa.ativo = true
      WHERE e.ativo = true
        AND e.modulos_ativos::text LIKE '%food%'
      GROUP BY e.id, e.nome, e.cor_primaria, r.lat_loja, r.lng_loja, r.raio_visibilidade_km, r.tempo_entrega_min, r.taxa_entrega, r.subcategoria_id, sa.nome, sa.slug, sa.emoji
      ORDER BY e.nome
    `);

    let parceiros: any[] = rows.rows as any[];

    // Filter by area if user location provided
    if (userLat !== null && userLng !== null) {
      parceiros = parceiros.filter((p: any) => {
        if (!p.lat_loja || !p.lng_loja) return true; // no location set → show to all
        const raio = Number(p.raio_visibilidade_km) || 50;
        const dist = haversineKm(userLat, userLng, Number(p.lat_loja), Number(p.lng_loja));
        return dist <= raio;
      });
    }

    // Filter by subcategoria_id if provided (only restaurantes that have it set)
    if (subcategoriaId !== null && Number.isFinite(subcategoriaId)) {
      parceiros = parceiros.filter((p: any) => Number(p.subcategoria_id) === subcategoriaId);
    }

    return res.json(parceiros);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GET /api/food/empresa/:id/config-entrega — public delivery config from config_entrega_pdv
router.get("/empresa/:id/config-entrega", async (req, res) => {
  try {
    const empresaId = Number(req.params.id);
    if (!empresaId) return res.status(400).json({ error: "invalid_id" });
    const rows = await db.execute(`SELECT * FROM config_entrega_pdv WHERE empresa_id = ${empresaId}`);
    const cfg = rows.rows[0] as any;
    if (!cfg || !cfg.ativo) {
      return res.json({ tipo: "fixa", taxa_fixa: 0, taxa_minima: 0, taxa_por_km: 0, km_minimo: 0, raio_max_km: null, ativo: false });
    }
    return res.json({
      tipo: cfg.tipo,
      taxa_fixa: Number(cfg.taxa_fixa || 0),
      taxa_por_km: Number(cfg.taxa_por_km || 0),
      km_minimo: Number(cfg.km_minimo || 0),
      taxa_minima: Number(cfg.taxa_minima || 0),
      raio_max_km: cfg.raio_max_km ? Number(cfg.raio_max_km) : null,
      endereco_restaurante: cfg.endereco_restaurante ?? null,
      ativo: cfg.ativo,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// GET /api/food/places/autocomplete — proxy Google Places Autocomplete (keeps key server-side)
router.get("/places/autocomplete", async (req, res) => {
  try {
    const input = String(req.query.input ?? "").trim();
    const sessiontoken = String(req.query.sessiontoken ?? "");
    if (!input || input.length < 3) return res.json([]);
    const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.GOOGLE_MAPS_KEY;
    if (!apiKey) return res.json([]);
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&language=pt-BR&components=country:br&types=address&key=${apiKey}${sessiontoken ? `&sessiontoken=${sessiontoken}` : ""}`;
    const r = await fetch(url);
    const data = await r.json() as any;
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      return res.json([]);
    }
    const suggestions = (data.predictions ?? []).map((p: any) => ({
      place_id: p.place_id,
      description: p.description,
      main_text: p.structured_formatting?.main_text ?? p.description,
      secondary_text: p.structured_formatting?.secondary_text ?? "",
    }));
    return res.json(suggestions);
  } catch (err) {
    console.error(err);
    return res.json([]);
  }
});

// POST /api/food/empresa/:id/calcular-frete — public fee calculator
router.post("/empresa/:id/calcular-frete", async (req, res) => {
  try {
    const empresaId = Number(req.params.id);
    if (!empresaId) return res.status(400).json({ error: "invalid_id" });
    const { endereco_destino } = req.body;
    if (!endereco_destino) return res.status(400).json({ error: "endereco_destino required" });

    const cfgRows = await db.execute(`SELECT * FROM config_entrega_pdv WHERE empresa_id = ${empresaId}`);
    const cfg = cfgRows.rows[0] as any;
    if (!cfg || !cfg.ativo) return res.json({ taxa_entrega: 0, mensagem: "Entrega não configurada" });

    if (cfg.tipo === "fixa") {
      return res.json({ taxa_entrega: Number(cfg.taxa_fixa), tipo: "fixa" });
    }

    const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.GOOGLE_MAPS_KEY;
    if (!apiKey || !cfg.endereco_restaurante) {
      return res.json({ taxa_entrega: Number(cfg.taxa_minima || 0), tipo: "km", mensagem: "Usando taxa mínima" });
    }

    const origin = encodeURIComponent(cfg.endereco_restaurante);
    const destination = encodeURIComponent(endereco_destino);
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&key=${apiKey}&language=pt-BR&units=metric`;

    const response = await fetch(url);
    const data = await response.json() as any;

    if (data.status !== "OK" || data.rows[0]?.elements[0]?.status !== "OK") {
      return res.json({ taxa_entrega: Number(cfg.taxa_minima || 0), tipo: "km", mensagem: "Não foi possível calcular distância" });
    }

    const distMeters = data.rows[0].elements[0].distance.value;
    const distKm = distMeters / 1000;
    const duracao = data.rows[0].elements[0].duration.text;

    if (cfg.raio_max_km && distKm > Number(cfg.raio_max_km)) {
      return res.json({ taxa_entrega: null, distancia_km: distKm, fora_raio: true, mensagem: `Fora do raio de entrega (${Number(cfg.raio_max_km)} km)` });
    }

    const kmCobrado = Math.max(0, distKm - Number(cfg.km_minimo || 0));
    const taxa = Math.max(Number(cfg.taxa_minima || 0), Number(cfg.taxa_por_km) * kmCobrado);

    return res.json({
      taxa_entrega: Math.round(taxa * 100) / 100,
      distancia_km: Math.round(distKm * 10) / 10,
      duracao,
      tipo: "km",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// GET /api/food/promocoes — active promotions across all restaurants (or for one empresa)
router.get("/promocoes", async (req, res) => {
  try {
    const empresaId = req.query.empresa_id ? Number(req.query.empresa_id) : null;
    const where = empresaId
      ? `pr.empresa_id = ${empresaId} AND`
      : "";
    const rows = await db.execute(`
      SELECT
        pr.id, pr.empresa_id, pr.nome, pr.descricao, pr.tipo, pr.valor,
        pr.codigo_cupom, pr.min_pedido, pr.validade,
        pr.produto_id, pr.preco_promocional, pr.quantidade_disponivel,
        p.nome AS produto_nome, p.preco AS produto_preco, p.imagem AS produto_imagem,
        e.nome as empresa_nome, e.cor_primaria as empresa_cor
      FROM promocoes_pdv pr
      JOIN empresas e ON e.id = pr.empresa_id
      LEFT JOIN produtos_pdv p ON p.id = pr.produto_id
      WHERE ${where} pr.ativo = true
        AND (pr.validade IS NULL OR pr.validade >= CURRENT_DATE)
        AND (pr.quantidade_disponivel IS NULL OR pr.quantidade_disponivel > 0)
      ORDER BY pr.criado_em DESC
      LIMIT 40
    `);
    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// POST /api/food/pedido — create an order from the mobile app
router.post("/pedido", async (req, res) => {
  try {
    const {
      empresa_id, itens, total, forma_pagamento,
      cliente_nome, cliente_whatsapp, cliente_endereco,
      observacoes, taxa_entrega,
    } = req.body;

    if (!empresa_id || !itens || !Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ error: "bad_request", message: "empresa_id e itens são obrigatórios" });
    }

    // Handle Crédito GoTaxi payment: deduct from credito_aplicativo
    const totalNum = Number(total) || 0;
    let creditoDescontado = 0;
    let usuarioId: number | null = null;
    if (forma_pagamento === "credito_gotaxi") {
      const auth = req.headers.authorization;
      const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
      if (!token) return res.status(401).json({ error: "unauthorized", message: "Token necessário para pagamento com crédito" });
      usuarioId = decodeClienteToken(token);
      if (!usuarioId) return res.status(401).json({ error: "invalid_token" });

      const userRows = (await db.execute(sql`SELECT credito_aplicativo FROM usuarios WHERE id = ${usuarioId}`)).rows as any[];
      const saldoCredito = Number(userRows[0]?.credito_aplicativo ?? 0);
      if (saldoCredito < totalNum) {
        return res.status(400).json({ error: "credito_insuficiente", message: `Saldo insuficiente. Disponível: R$ ${saldoCredito.toFixed(2)}` });
      }
      await db.execute(sql`UPDATE usuarios SET credito_aplicativo = credito_aplicativo - ${totalNum} WHERE id = ${usuarioId}`);
      creditoDescontado = totalNum;
    }

    // Create the order
    const pedidoRow = await db.execute(`
      INSERT INTO pedidos_pdv
        (empresa_id, modulo, tipo, status, cliente_nome, cliente_whatsapp, cliente_endereco,
         total, forma_pagamento, observacoes, taxa_entrega, criado_em, atualizado_em)
      VALUES
        (${Number(empresa_id)}, 'food', 'delivery', 'pendente',
         '${String(cliente_nome || "App").replace(/'/g, "''")}',
         '${String(cliente_whatsapp || "").replace(/'/g, "''")}',
         '${String(cliente_endereco || "").replace(/'/g, "''")}',
         ${totalNum},
         '${String(forma_pagamento || "pix").replace(/'/g, "''")}',
         '${String(observacoes || "").replace(/'/g, "''")}',
         ${Number(taxa_entrega) || 0},
         NOW(), NOW())
      RETURNING *
    `);

    const pedido = (pedidoRow.rows as any[])[0];
    if (!pedido) {
      // Rollback credit if order failed
      if (creditoDescontado > 0 && usuarioId) {
        await db.execute(sql`UPDATE usuarios SET credito_aplicativo = credito_aplicativo + ${creditoDescontado} WHERE id = ${usuarioId}`).catch(() => {});
      }
      return res.status(500).json({ error: "server_error" });
    }

    // Insert order items
    for (const item of itens) {
      await db.execute(`
        INSERT INTO itens_pedido_pdv (pedido_id, produto_nome, quantidade, preco_unitario, total, observacoes)
        VALUES (${pedido.id},
                '${String(item.nome || "").replace(/'/g, "''")}',
                ${Number(item.quantidade) || 1},
                ${Number(item.preco_unitario) || 0},
                ${Number(item.total) || 0},
                '${String(item.observacoes || "").replace(/'/g, "''")}')
      `);
    }

    // Generate affiliate commission for the logged-in customer (if referred)
    try {
      const { gerarComissaoCliente, decodeClienteTokenFromReq } = await import("../lib/comissaoAfiliado");
      const uid = usuarioId ?? decodeClienteTokenFromReq(req);
      await gerarComissaoCliente({
        usuarioId: uid,
        valor: totalNum,
        tipoEvento: "pedido_food",
        referenciaId: Number(pedido.id),
        descricao: `Pedido food #${pedido.id}`,
      });
    } catch (commErr) {
      console.error("[food/pedido] comissão erro:", commErr);
    }

    broadcastToEmpresa(Number(empresa_id), {
      event: "novo_pedido",
      pedido: {
        id: pedido.id, empresaId: pedido.empresa_id, modulo: "food", tipo: "delivery",
        status: pedido.status, clienteNome: pedido.cliente_nome,
        clienteWhatsapp: pedido.cliente_whatsapp, clienteEndereco: pedido.cliente_endereco,
        total: pedido.total, formaPagamento: pedido.forma_pagamento,
        observacoes: pedido.observacoes, criadoEm: pedido.criado_em, atualizadoEm: pedido.atualizado_em, itens: [],
      },
    });
    sendExpoPushToEmpresa(Number(empresa_id), "🛎️ Novo Pedido! (Cardápio)", `${cliente_nome || "Cliente"} — R$ ${totalNum.toFixed(2)}`);

    return res.status(201).json({ id: pedido.id, status: pedido.status, credito_descontado: creditoDescontado });
  } catch (err) {
    console.error("[food/pedido]", err);
    return res.status(500).json({ error: "server_error", message: "Erro ao criar pedido" });
  }
});

// GET /api/food/parceiros/:empresaId/cardapio — real-time catalog for a partner
router.get("/parceiros/:empresaId/cardapio", async (req, res) => {
  try {
    const empresaId = Number(req.params.empresaId);
    const [categorias, produtos, pagamento] = await Promise.all([
      db.execute(`
        SELECT id, nome, ordem
        FROM categorias_pdv
        WHERE empresa_id = ${empresaId}
        ORDER BY ordem, id
      `),
      db.execute(`
        SELECT
          p.id, p.nome, p.descricao, p.preco, p.imagem, p.categoria_id,
          p.tamanhos, c.nome as categoria_nome,
          promo.preco_promocional,
          COALESCE((
            SELECT json_agg(json_build_object('id', e.id, 'nome', e.nome, 'preco', e.preco, 'obrigatorio', COALESCE(e.obrigatorio, false)))
            FROM produto_extras_pdv pe2
            JOIN extras_pdv e ON e.id = pe2.extra_id
            WHERE pe2.produto_id = p.id AND e.ativo = true
          ), '[]'::json) as extras,
          COALESCE((
            SELECT json_agg(
              json_build_object(
                'id', g.id, 'nome', g.nome,
                'min_selecoes', COALESCE(pg.min_selecoes, g.min_selecoes),
                'max_selecoes', COALESCE(pg.max_selecoes, g.max_selecoes),
                'obrigatorio', COALESCE(pg.obrigatorio, g.obrigatorio),
                'opcoes', COALESCE((
                  SELECT json_agg(json_build_object('id', o.id, 'nome', o.nome, 'preco_adicional', o.preco_adicional) ORDER BY o.ordem, o.id)
                  FROM opcoes_grupo_extras_pdv o WHERE o.grupo_id = g.id AND o.ativo IS NOT FALSE
                ), '[]'::json)
              ) ORDER BY pg.ordem, g.id
            )
            FROM produto_grupos_extras_pdv pg
            JOIN grupos_extras_pdv g ON g.id = pg.grupo_id
            WHERE pg.produto_id = p.id AND g.ativo IS NOT FALSE
          ), '[]'::json) as grupos
        FROM produtos_pdv p
        LEFT JOIN categorias_pdv c ON c.id = p.categoria_id
        LEFT JOIN (
          SELECT produto_id, MIN(preco_promocional) AS preco_promocional
          FROM promocoes_pdv
          WHERE ativo = true
            AND produto_id IS NOT NULL
            AND preco_promocional IS NOT NULL
            AND (validade IS NULL OR validade >= CURRENT_DATE)
            AND (quantidade_disponivel IS NULL OR quantidade_disponivel > 0)
          GROUP BY produto_id
        ) promo ON promo.produto_id = p.id
        WHERE p.empresa_id = ${empresaId} AND p.ativo = true
        ORDER BY c.nome NULLS LAST, p.nome
      `),
      db.execute(`
        SELECT metodos FROM config_pagamento_pdv WHERE empresa_id = ${empresaId}
      `).catch(() => ({ rows: [] })),
    ]);
    const pagRow = pagamento.rows[0] as any;
    const formasPagamento: string[] = pagRow?.metodos ?? ["pix", "dinheiro", "credito", "debito"];
    // Garantir que grupos e tamanhos sejam arrays parseados (não strings JSON)
    const produtosNormalizados = (produtos.rows as any[]).map(p => ({
      ...p,
      grupos: typeof p.grupos === "string" ? JSON.parse(p.grupos) : (Array.isArray(p.grupos) ? p.grupos : []),
      tamanhos: typeof p.tamanhos === "string" ? JSON.parse(p.tamanhos) : (Array.isArray(p.tamanhos) ? p.tamanhos : null),
      extras: typeof p.extras === "string" ? JSON.parse(p.extras) : (Array.isArray(p.extras) ? p.extras : []),
    }));
    return res.json({ categorias: categorias.rows, produtos: produtosNormalizados, formasPagamento });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

export default router;
