import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { pedidosPdvTable, itensPedidoPdvTable } from "@workspace/db/schema";
import bcrypt from "bcryptjs";
import { broadcastToEmpresa, sendExpoPushToEmpresa } from "./pdv";
import { dispatchEntregaToEntregadores } from "./motorista-app";

const router: IRouter = Router();

// ── GET /api/public/config ─────────────────────────────────────────────────
router.get("/config", async (_req, res) => {
  try {
    const rows = await db.execute(`SELECT whatsapp_suporte FROM configuracoes_plataforma LIMIT 1`);
    const cfg = (rows.rows[0] as any) ?? {};
    return res.json({ whatsapp_suporte: cfg.whatsapp_suporte ?? "5511900000000" });
  } catch (err) {
    console.error(err);
    return res.json({ whatsapp_suporte: "5511900000000" });
  }
});

// ── GET /api/public/pedido/:id ─────────────────────────────────────────────
router.get("/pedido/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ error: "invalid_id" });
    const rows = await db.execute(`
      SELECT p.id, p.status, p.tipo, p.cliente_nome, p.total, p.criado_em,
             p.confirmado_em, p.preparando_em, p.pronto_em, p.entregue_em,
             p.cliente_endereco, e.nome as empresa_nome
      FROM pedidos_pdv p LEFT JOIN empresas e ON e.id = p.empresa_id
      WHERE p.id = ${id}
    `);
    const pedido = rows.rows[0] as any;
    if (!pedido) return res.status(404).json({ error: "not_found" });
    const itensRows = await db.execute(`
      SELECT produto_nome, quantidade, preco_unitario, total
      FROM itens_pedido_pdv WHERE pedido_id = ${id}
    `);
    return res.json({ ...pedido, itens: itensRows.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/public/caronas/config ─────────────────────────────────────────
// Retorna config global de caronas (R$/km e taxa) — usado pelo app do parceiro
// para sugerir o valor por vaga ao motorista (estilo BlaBlaCar).
router.get("/caronas/config", async (_req, res) => {
  try {
    const rows = (await db.execute(`SELECT chave, valor FROM configuracoes_sistema WHERE chave IN ('caronas_valor_por_km','caronas_taxa_plataforma')`)).rows as any[];
    const map: Record<string, string> = {};
    for (const r of rows) map[r.chave] = r.valor;
    return res.json({
      valor_por_km: Number(map.caronas_valor_por_km ?? 0.8),
      taxa_plataforma: Number(map.caronas_taxa_plataforma ?? 5),
    });
  } catch (err) {
    console.error("[caronas/config]", err);
    return res.json({ valor_por_km: 0.8, taxa_plataforma: 5 });
  }
});

// ── GET /api/public/distancia?origem=&destino= ─────────────────────────────
// Calcula a distância (km) entre duas cidades usando Google Distance Matrix.
async function geocodeNominatim(q: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { "User-Agent": "GoTaxi-SaaS/1.0 (contato@gotaxi.com.br)" } });
    if (!r.ok) return null;
    const arr: any = await r.json();
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return { lat: Number(arr[0].lat), lon: Number(arr[0].lon) };
  } catch { return null; }
}

async function osrmRouteKm(o: { lat: number; lon: number }, d: { lat: number; lon: number }): Promise<{ km: number; minutos: number } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${o.lon},${o.lat};${d.lon},${d.lat}?overview=false`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const data: any = await r.json();
    const route = data?.routes?.[0];
    if (!route) return null;
    return { km: Math.round((Number(route.distance) / 1000) * 10) / 10, minutos: Math.round(Number(route.duration) / 60) };
  } catch { return null; }
}

router.get("/distancia", async (req, res) => {
  try {
    const origem = String(req.query.origem ?? "").trim();
    const destino = String(req.query.destino ?? "").trim();
    if (!origem || !destino) return res.status(400).json({ error: "origem e destino obrigatórios" });

    // 1) Tenta Google Distance Matrix se a chave existir.
    const key = process.env.GOOGLE_MAPS_KEY;
    if (key) {
      try {
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origem)}&destinations=${encodeURIComponent(destino)}&mode=driving&language=pt-BR&region=br&key=${key}`;
        const r = await fetch(url);
        const data: any = await r.json();
        const elem = data?.rows?.[0]?.elements?.[0];
        if (elem && elem.status === "OK") {
          const metros = Number(elem.distance?.value ?? 0);
          const km = Math.round((metros / 1000) * 10) / 10;
          const segundos = Number(elem.duration?.value ?? 0);
          return res.json({
            distancia_km: km,
            distancia_texto: elem.distance?.text ?? `${km} km`,
            duracao_minutos: Math.round(segundos / 60),
            duracao_texto: elem.duration?.text ?? "",
            fonte: "google",
          });
        }
        console.warn("[distancia] google falhou, usando OSM. detail=", elem?.status ?? data?.status);
      } catch (e: any) {
        console.warn("[distancia] erro google:", e?.message);
      }
    }

    // 2) Fallback OpenStreetMap: Nominatim (geocoding) + OSRM (rota).
    const [oCoord, dCoord] = await Promise.all([geocodeNominatim(origem), geocodeNominatim(destino)]);
    if (!oCoord) return res.status(404).json({ error: "origem_nao_encontrada", detail: origem });
    if (!dCoord) return res.status(404).json({ error: "destino_nao_encontrado", detail: destino });
    const route = await osrmRouteKm(oCoord, dCoord);
    if (!route) return res.status(502).json({ error: "rota_nao_encontrada" });
    return res.json({
      distancia_km: route.km,
      distancia_texto: `${route.km.toString().replace(".", ",")} km`,
      duracao_minutos: route.minutos,
      duracao_texto: route.minutos >= 60 ? `${Math.floor(route.minutos / 60)}h ${route.minutos % 60}min` : `${route.minutos} min`,
      fonte: "osm",
    });
  } catch (err: any) {
    console.error("[distancia]", err);
    return res.status(500).json({ error: "server_error", detail: err?.message });
  }
});

// ── GET /api/public/viagens/rotas?origem=&destino= ─────────────────────────
// Returns all active routes from all companies that have the passagens module active
router.get("/viagens/rotas", async (req, res) => {
  try {
    const { origem, destino, empresa_id } = req.query;
    let filter = "";
    if (origem) filter += ` AND LOWER(vr.origem) LIKE LOWER('%${String(origem).replace(/'/g,"''")}%')`;
    if (destino) filter += ` AND LOWER(vr.destino) LIKE LOWER('%${String(destino).replace(/'/g,"''")}%')`;
    if (empresa_id) filter += ` AND vr.empresa_id = ${Number(empresa_id)}`;

    const rows = await db.execute(`
      SELECT
        vr.id, vr.origem, vr.destino, vr.duracao_minutos, vr.tipo, vr.empresa_id,
        e.nome as empresa_nome, e.cor_primaria,
        COUNT(vh.id) as total_horarios,
        MIN(vh.preco) as preco_min,
        MAX(vh.preco) as preco_max,
        SUM(GREATEST(0, vh.vagas_total - vh.vagas_ocupadas)) as vagas_disponiveis
      FROM viagens_rotas vr
      INNER JOIN empresas e ON e.id = vr.empresa_id
        AND e.ativo = true
        AND e.modulos_ativos::text LIKE '%passagens%'
      LEFT JOIN viagens_horarios vh ON vh.rota_id = vr.id AND vh.ativo = true
        AND vh.data_partida >= CURRENT_DATE
        AND vh.vagas_ocupadas < vh.vagas_total
      WHERE vr.ativo = true ${filter}
      GROUP BY vr.id, vr.origem, vr.destino, vr.duracao_minutos, vr.tipo, vr.empresa_id, e.nome, e.cor_primaria
      ORDER BY vr.origem, vr.destino
    `);

    return res.json(rows.rows.map((r: any) => ({
      ...r,
      total_horarios: Number(r.total_horarios ?? 0),
      preco_min: Number(r.preco_min ?? 0),
      preco_max: Number(r.preco_max ?? 0),
      vagas_disponiveis: Number(r.vagas_disponiveis ?? 0),
    })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/public/viagens/horarios?rota_id=X ────────────────────────────
router.get("/viagens/horarios", async (req, res) => {
  try {
    const rotaId = Number(req.query.rota_id);
    if (!rotaId || isNaN(rotaId)) return res.status(400).json({ error: "rota_id required" });

    const rows = await db.execute(`
      SELECT
        vh.id, vh.rota_id, vh.data_partida, vh.hora_partida, vh.hora_chegada,
        vh.vagas_total, vh.vagas_ocupadas, vh.preco, vh.veiculo,
        (vh.vagas_total - vh.vagas_ocupadas) as vagas_livres,
        vr.origem, vr.destino, vr.duracao_minutos, vr.tipo,
        e.nome as empresa_nome, e.id as empresa_id
      FROM viagens_horarios vh
      INNER JOIN viagens_rotas vr ON vr.id = vh.rota_id
      INNER JOIN empresas e ON e.id = vh.empresa_id
      WHERE vh.rota_id = ${rotaId}
        AND vh.ativo = true
        AND vh.data_partida >= CURRENT_DATE
        AND vh.vagas_ocupadas < vh.vagas_total
      ORDER BY vh.data_partida, vh.hora_partida
    `);

    return res.json(rows.rows.map((r: any) => ({
      ...r,
      preco: Number(r.preco ?? 0),
      vagas_livres: Number(r.vagas_livres ?? 0),
      vagas_total: Number(r.vagas_total ?? 0),
      vagas_ocupadas: Number(r.vagas_ocupadas ?? 0),
    })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/public/ecommerce/:empresaId/produtos ──────────────────────────
// Public product catalog for a specific ecommerce partner (customer mobile app)
router.get("/ecommerce/:empresaId/produtos", async (req, res) => {
  try {
    const empresaId = Number(req.params.empresaId);
    if (!empresaId || isNaN(empresaId)) return res.status(400).json({ error: "invalid_id" });
    const rows = await db.execute(`
      SELECT
        p.id,
        p.nome,
        p.descricao,
        p.preco,
        NULL::numeric AS preco_promocional,
        COALESCE(c.nome, 'Geral') AS categoria,
        p.imagem,
        NULL::int AS estoque,
        p.ativo
      FROM produtos_pdv p
      LEFT JOIN categorias_pdv c ON c.id = p.categoria_id
      WHERE p.empresa_id = ${empresaId} AND p.ativo = true
      ORDER BY COALESCE(c.nome, 'Geral'), p.nome
    `);
    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── POST /api/public/ecommerce/pedido ──────────────────────────────────────
// Create an ecommerce order from the mobile customer app
router.post("/ecommerce/pedido", async (req, res) => {
  try {
    const { empresa_id, itens, total, cliente_nome, cliente_telefone, cliente_endereco, forma_pagamento } = req.body;
    if (!empresa_id || !itens || !Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ error: "bad_request", message: "empresa_id e itens são obrigatórios" });
    }
    const itensJson = JSON.stringify(itens.map((i: any) => ({
      nome: String(i.nome ?? ""),
      quantidade: Number(i.quantidade ?? 1),
      preco: Number(i.preco ?? 0),
    }))).replace(/'/g, "''");
    const row = await db.execute(`
      INSERT INTO pedidos
        (empresa_id, cliente_nome, cliente_telefone, itens, total, endereco_entrega, status, criado_em)
      VALUES
        (${Number(empresa_id)},
         '${String(cliente_nome || "Cliente App").replace(/'/g, "''")}',
         '${String(cliente_telefone || "").replace(/'/g, "''")}',
         '${itensJson}'::json,
         ${Number(total) || 0},
         '${String(cliente_endereco || "").replace(/'/g, "''")}',
         'pendente', NOW())
      RETURNING id, status
    `);
    const pedido = (row.rows as any[])[0];
    if (!pedido) return res.status(500).json({ error: "server_error" });

    // Mirror order into pedidos_pdv so the partner PDV can see it in real time
    try {
      const ALLOWED_PAG = ["pix", "dinheiro", "credito", "debito", "vr", "sodexo"];
      const fp = forma_pagamento && ALLOWED_PAG.includes(String(forma_pagamento))
        ? String(forma_pagamento) : "pix";
      const [pdvPedido] = await db.insert(pedidosPdvTable).values({
        empresaId: Number(empresa_id),
        modulo: "ecommerce",
        tipo: "delivery",
        status: "novo",
        clienteNome: String(cliente_nome || "Cliente App"),
        clienteWhatsapp: cliente_telefone ? String(cliente_telefone) : null,
        clienteEndereco: cliente_endereco ? String(cliente_endereco) : null,
        total: Number(total) || 0,
        formaPagamento: fp,
      }).returning();
      const itensSalvos: any[] = [];
      for (const i of itens) {
        const qtd = Number(i.quantidade ?? 1);
        const preco = Number(i.preco ?? 0);
        const [salvo] = await db.insert(itensPedidoPdvTable).values({
          pedidoId: pdvPedido.id,
          produtoNome: String(i.nome ?? ""),
          quantidade: qtd,
          precoUnitario: preco,
          total: qtd * preco,
        }).returning();
        itensSalvos.push(salvo);
      }
      broadcastToEmpresa(Number(empresa_id), {
        event: "novo_pedido",
        pedido: {
          ...pdvPedido,
          criadoEm: pdvPedido.criadoEm.toISOString(),
          atualizadoEm: pdvPedido.atualizadoEm.toISOString(),
          itens: itensSalvos,
        },
      });
      sendExpoPushToEmpresa(Number(empresa_id), "🛎️ Novo Pedido! (E-commerce)", `${pdvPedido.clienteNome || "Cliente"} — R$ ${Number(pdvPedido.total).toFixed(2)}`);
    } catch (mirrorErr) {
      console.error("[ecommerce/pedido] mirror to pedidos_pdv failed", mirrorErr);
    }

    // Generate affiliate commission for the logged-in customer (if referred)
    try {
      const { gerarComissaoCliente, decodeClienteTokenFromReq } = await import("../lib/comissaoAfiliado");
      const usuarioId = decodeClienteTokenFromReq(req);
      await gerarComissaoCliente({
        usuarioId,
        valor: Number(total) || 0,
        tipoEvento: "pedido_ecommerce",
        referenciaId: Number(pedido.id),
        descricao: `Pedido ecommerce #${pedido.id}`,
      });
    } catch (commErr) {
      console.error("[ecommerce/pedido] comissão erro:", commErr);
    }

    return res.status(201).json({ id: pedido.id, status: pedido.status });
  } catch (err) {
    console.error("[ecommerce/pedido]", err);
    return res.status(500).json({ error: "server_error", message: "Erro ao criar pedido" });
  }
});

// ── GET /api/public/servicos/:empresaId/prestadores ────────────────────────
// Public list of service professionals + their catalog for a given empresa
router.get("/servicos/:empresaId/prestadores", async (req, res) => {
  try {
    const { ensureServicosTabelas } = await import("./servicos");
    await ensureServicosTabelas();
    const empresaId = Number(req.params.empresaId);
    if (!empresaId || isNaN(empresaId)) return res.status(400).json({ error: "invalid_id" });
    const prestadores = await db.execute(`
      SELECT id, nome, especialidade, bio, avatar_url
      FROM servicos_prestadores
      WHERE empresa_id = ${empresaId} AND ativo = true
      ORDER BY nome
    `);
    const catalogo = await db.execute(`
      SELECT sc.id, sc.prestador_id, sc.nome, sc.descricao, sc.duracao_minutos, sc.preco,
             c.nome as categoria_nome, c.cor as categoria_cor
      FROM servicos_catalogo sc
      LEFT JOIN categorias_servicos c ON c.id = sc.categoria_id
      WHERE sc.empresa_id = ${empresaId} AND sc.ativo = true
      ORDER BY sc.nome
    `);
    return res.json({
      prestadores: prestadores.rows,
      catalogo: catalogo.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/public/servicos/:empresaId/formas-pagamento ──────────────────
// Public list of accepted payment methods for a service-provider empresa
router.get("/servicos/:empresaId/formas-pagamento", async (req, res) => {
  try {
    const empresaId = Number(req.params.empresaId);
    if (!empresaId || isNaN(empresaId)) return res.status(400).json({ error: "invalid_id" });
    await db.execute(`
      CREATE TABLE IF NOT EXISTS config_pagamento_pdv (
        empresa_id INTEGER PRIMARY KEY,
        metodos TEXT[] NOT NULL DEFAULT ARRAY['pix','dinheiro','credito','debito']::text[],
        atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    const r = await db.execute(`SELECT metodos FROM config_pagamento_pdv WHERE empresa_id = ${empresaId}`);
    const row = (r.rows as any[])[0];
    return res.json({ metodos: row?.metodos ?? ["pix", "dinheiro", "credito", "debito"] });
  } catch (err) {
    console.error("[servicos/formas-pagamento]", err);
    return res.json({ metodos: ["pix", "dinheiro", "credito", "debito"] });
  }
});

// ── POST /api/public/servicos/agendar ──────────────────────────────────────
// Create a service appointment from the mobile customer app
router.post("/servicos/agendar", async (req, res) => {
  try {
    const { empresa_id, catalogo_id, prestador_id, cliente_nome, cliente_telefone, data_hora, valor, observacoes, metodo_pagamento } = req.body;
    if (!empresa_id || !cliente_nome || !data_hora) {
      return res.status(400).json({ error: "bad_request", message: "empresa_id, cliente_nome e data_hora são obrigatórios" });
    }
    let servicoNome = "Serviço";
    if (catalogo_id) {
      const cat = await db.execute(`SELECT nome FROM servicos_catalogo WHERE id = ${Number(catalogo_id)} LIMIT 1`);
      servicoNome = (cat.rows as any[])[0]?.nome || servicoNome;
    }
    const pid = prestador_id ? Number(prestador_id) : "NULL";
    const cid = catalogo_id ? Number(catalogo_id) : "NULL";
    const tel = cliente_telefone ? `'${String(cliente_telefone).replace(/'/g, "''")}'` : "NULL";
    const val = valor ? Number(valor) : "NULL";
    const obs = observacoes ? `'${String(observacoes).replace(/'/g, "''")}'` : "NULL";
    const ALLOWED_PAG = ["pix", "dinheiro", "credito", "debito", "vr", "sodexo"];
    const mp = metodo_pagamento && ALLOWED_PAG.includes(String(metodo_pagamento))
      ? `'${String(metodo_pagamento)}'`
      : "NULL";
    const dt = new Date(data_hora).toISOString();
    const row = await db.execute(`
      INSERT INTO agendamentos
        (empresa_id, catalogo_id, prestador_id, cliente_nome, cliente_telefone,
         servico_nome, data_hora, valor, observacoes, status, metodo_pagamento)
      VALUES
        (${Number(empresa_id)}, ${cid}, ${pid},
         '${String(cliente_nome).replace(/'/g, "''")}',
         ${tel}, '${String(servicoNome).replace(/'/g, "''")}',
         '${dt}', ${val}, ${obs}, 'agendado', ${mp})
      RETURNING id, status
    `);
    const agendamento = (row.rows as any[])[0];
    if (!agendamento) return res.status(500).json({ error: "server_error" });

    try {
      const { gerarComissaoCliente, decodeClienteTokenFromReq } = await import("../lib/comissaoAfiliado");
      const usuarioId = decodeClienteTokenFromReq(req);
      await gerarComissaoCliente({
        usuarioId,
        valor: Number(valor) || 0,
        tipoEvento: "agendamento_servico",
        referenciaId: Number(agendamento.id),
        descricao: `Agendamento ${servicoNome} #${agendamento.id}`,
      });
    } catch (commErr) {
      console.error("[servicos/agendar] comissão erro:", commErr);
    }

    return res.status(201).json({ id: agendamento.id, status: agendamento.status });
  } catch (err) {
    console.error("[servicos/agendar]", err);
    return res.status(500).json({ error: "server_error", message: "Erro ao criar agendamento" });
  }
});

// ── GET /api/public/parceiros ──────────────────────────────────────────────
// Returns all active partner companies (for mobile customer home)
router.get("/parceiros", async (req, res) => {
  try {
    const rows = await db.execute(`
      SELECT
        e.id,
        e.nome,
        e.cor_primaria as cor,
        e.logo as logo,
        e.modulos_ativos::text as modulos_ativos_text,
        e.destaque,
        e.ecommerce_categoria as categoria,
        COALESCE(
          (SELECT c.nome FROM categorias_pdv c WHERE c.empresa_id = e.id ORDER BY c.ordem LIMIT 1),
          'Parceiro'
        ) as categoria_pdv,
        COUNT(DISTINCT p.id) as total_produtos
      FROM empresas e
      LEFT JOIN produtos_pdv p ON p.empresa_id = e.id AND p.ativo = true
      WHERE e.ativo = true
      GROUP BY e.id, e.nome, e.cor_primaria, e.logo, e.destaque, e.ecommerce_categoria
      ORDER BY e.destaque DESC, e.nome
    `);
    return res.json((rows.rows as any[]).map((r: any) => {
      let modulos: string[] = [];
      try {
        const raw = r.modulos_ativos_text ? JSON.parse(r.modulos_ativos_text) : [];
        modulos = Array.isArray(raw) ? raw.filter((m: string) => !m.startsWith("destaque:")) : [];
      } catch {}
      return {
        id: r.id,
        nome: r.nome,
        cor: r.cor ?? "#22C55E",
        logo: r.logo ?? null,
        modulos,
        destaque: r.destaque === true,
        categoria: r.categoria ?? r.categoria_pdv ?? "Parceiro",
        total_produtos: Number(r.total_produtos ?? 0),
      };
    }));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/public/empresa/:id/pix ───────────────────────────────────────
// Returns the partner empresa's PIX key for direct customer payment
router.get("/empresa/:id/pix", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ error: "invalid_id" });
    const rows = await db.execute(`
      SELECT chave_pix, tipo_chave_pix, nome, responsavel
      FROM empresas WHERE id = ${id} AND ativo = true LIMIT 1
    `);
    const emp = rows.rows[0] as any;
    if (!emp) return res.status(404).json({ error: "not_found" });
    if (!emp.chave_pix) return res.status(404).json({ error: "no_pix" });
    return res.json({
      chave_pix: emp.chave_pix,
      tipo_chave_pix: emp.tipo_chave_pix ?? "aleatoria",
      beneficiario: emp.responsavel || emp.nome,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// TUR VIAGENS — Caronas públicas (app mobile)
// ════════════════════════════════════════════════════════════════════════════

const safeStr = (v: unknown) => String(v ?? "").replace(/'/g, "''");

// ── POST /api/public/tur-viagens/register ─────────────────────────────────
// Cadastro público de novo operador Tur Viagens (cria empresa + usuário PDV)
router.post("/tur-viagens/register", async (req, res) => {
  try {
    const { nome, responsavel, email, senha, telefone, cidade, estado, cnpj, tipo } = req.body;
    if (!nome || !email || !senha || !telefone || !cidade) {
      return res.status(400).json({ error: "bad_request", message: "Nome, e-mail, senha, telefone e cidade são obrigatórios" });
    }
    // Checar se email já existe
    const existente = await db.execute(`SELECT id FROM usuarios WHERE email = '${safeStr(email.toLowerCase())}' LIMIT 1`);
    if ((existente.rows as any[]).length > 0) {
      return res.status(400).json({ error: "conflict", message: "Este e-mail já está cadastrado. Faça login ou use outro e-mail." });
    }
    const senhaHash = await bcrypt.hash(senha, 10);
    // Criar empresa
    const endereco = [cidade, estado].filter(Boolean).join(", ");
    const codigoEmp = nome.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16) + "-" + Date.now().toString(36).toUpperCase();
    const empresaRow = await db.execute(`
      INSERT INTO empresas (nome, codigo, responsavel, email, telefone, endereco, cnpj, modulos_ativos, ativo)
      VALUES ('${safeStr(nome)}', '${codigoEmp}', '${safeStr(responsavel || nome)}', '${safeStr(email.toLowerCase())}',
              '${safeStr(telefone)}', '${safeStr(endereco)}',
              '${safeStr(cnpj || "")}', '["passagens"]'::json, true)
      RETURNING *`);
    const empresa = (empresaRow.rows as any[])[0];
    if (!empresa) return res.status(500).json({ error: "server_error", message: "Erro ao criar empresa" });
    // Criar usuário PDV
    const usuarioRow = await db.execute(`
      INSERT INTO usuarios (nome, email, senha_hash, telefone, empresa_id, papel, ativo)
      VALUES ('${safeStr(responsavel || nome)}', '${safeStr(email.toLowerCase())}', '${senhaHash}',
              '${safeStr(telefone)}', ${empresa.id}, 'parceiro', true)
      RETURNING id, nome, email, telefone, empresa_id, papel`);
    const usuario = (usuarioRow.rows as any[])[0];
    const token = Buffer.from(`${usuario.id}:${empresa.id}:${Date.now()}`).toString("base64");
    return res.status(201).json({
      token,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel },
      empresa: { id: empresa.id, nome: empresa.nome, cidade: empresa.cidade, estado: empresa.estado },
    });
  } catch (err) {
    console.error("[tur-viagens/register]", err);
    return res.status(500).json({ error: "server_error", message: "Erro interno ao criar conta" });
  }
});

// GET /api/public/caronas?origem=&destino=&data=
router.get("/caronas", async (req, res) => {
  try {
    const { origem, destino, data } = req.query as Record<string, string>;
    const conditions: string[] = ["c.status = 'ativa'", "c.vagas_ocupadas < c.vagas_total"];
    if (origem) conditions.push(`LOWER(c.origem) LIKE LOWER('%${safeStr(origem)}%')`);
    if (destino) conditions.push(`LOWER(c.destino) LIKE LOWER('%${safeStr(destino)}%')`);
    if (data) conditions.push(`c.data_viagem = '${safeStr(data)}'`);
    const where = conditions.join(" AND ");
    const rows = await db.execute(`
      SELECT c.id, c.origem, c.destino, c.distancia_km, c.data_viagem,
             c.hora_partida, c.vagas_total, c.vagas_ocupadas, c.valor_por_vaga,
             c.tipo, c.observacoes, c.tipo_profissional, c.profissional_id,
             COALESCE(e.nome, ma.nome) as empresa_nome,
             COALESCE(e.id, ma.id) as empresa_id,
             COALESCE(v.modelo, ma.veiculo_modelo) as veiculo_modelo,
             COALESCE(v.cor, ma.veiculo_cor) as veiculo_cor
      FROM caronas c
      LEFT JOIN empresas e ON e.id = c.empresa_id
      LEFT JOIN carona_veiculos v ON v.id = c.veiculo_id
      LEFT JOIN motoristas_app ma ON ma.id = c.profissional_id AND c.tipo_profissional = 'motorista'
      WHERE ${where}
      ORDER BY c.data_viagem ASC, c.hora_partida ASC
      LIMIT 50`);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// GET /api/public/caronas/:id
router.get("/caronas/:id", async (req, res) => {
  try {
    const cId = Number(req.params.id);
    const [carRow, paradasRow] = await Promise.all([
      db.execute(`
        SELECT c.*,
               COALESCE(e.nome, ma.nome) as empresa_nome,
               COALESCE(e.id, ma.id) as empresa_id,
               COALESCE(e.telefone, ma.telefone) as empresa_telefone,
               COALESCE(v.modelo, ma.veiculo_modelo) as veiculo_modelo,
               COALESCE(v.placa, ma.veiculo_placa) as veiculo_placa,
               COALESCE(v.cor, ma.veiculo_cor) as veiculo_cor,
               v.vagas as veiculo_vagas
        FROM caronas c
        LEFT JOIN empresas e ON e.id = c.empresa_id
        LEFT JOIN carona_veiculos v ON v.id = c.veiculo_id
        LEFT JOIN motoristas_app ma ON ma.id = c.profissional_id AND c.tipo_profissional = 'motorista'
        WHERE c.id=${cId} AND c.status='ativa'`),
      db.execute(`SELECT * FROM carona_paradas WHERE carona_id=${cId} ORDER BY ordem`),
    ]);
    const carona = (carRow.rows as any[])[0];
    if (!carona) return res.status(404).json({ error: "not_found" });
    return res.json({ ...carona, paradas: paradasRow.rows });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// POST /api/public/caronas/:id/reservas
router.post("/caronas/:id/reservas", async (req, res) => {
  try {
    const cId = Number(req.params.id);
    const { passageiro_nome, passageiro_telefone, passageiro_cpf, parada_embarque, parada_desembarque, valor, forma_pagamento, observacoes } = req.body;
    if (!passageiro_nome || !passageiro_telefone) return res.status(400).json({ error: "nome e telefone obrigatórios" });
    // Reserva atômica: tenta ocupar uma vaga só se houver disponibilidade. Evita overbooking sob concorrência.
    const upd = await db.execute(`
      UPDATE caronas SET vagas_ocupadas = vagas_ocupadas + 1
      WHERE id=${cId} AND status='ativa' AND vagas_ocupadas < vagas_total
      RETURNING valor_por_vaga`);
    const updRow = (upd.rows as any[])[0];
    if (!updRow) return res.status(409).json({ error: "sem_vagas_ou_indisponivel" });
    const valorFinal = valor ? Number(valor) : Number(updRow.valor_por_vaga);
    const row = await db.execute(`
      INSERT INTO carona_reservas (carona_id, passageiro_nome, passageiro_telefone, passageiro_cpf, parada_embarque, parada_desembarque, valor, forma_pagamento, observacoes)
      VALUES (${cId}, '${safeStr(passageiro_nome)}', '${safeStr(passageiro_telefone)}', '${safeStr(passageiro_cpf)}',
              '${safeStr(parada_embarque)}', '${safeStr(parada_desembarque)}', ${valorFinal},
              '${safeStr(forma_pagamento || "pix")}', '${safeStr(observacoes)}')
      RETURNING *`);
    return res.json((row.rows as any[])[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// GET /api/public/reservas?telefone=XX
router.get("/reservas", async (req, res) => {
  try {
    const tel = String(req.query.telefone ?? "").replace(/\D/g, "");
    if (!tel || tel.length < 8) return res.status(400).json({ error: "telefone obrigatório" });
    const rows = await db.execute(`
      SELECT r.*, c.origem, c.destino, c.data_viagem, c.hora_partida, c.valor_por_vaga,
             COALESCE(e.nome, ma.nome) as empresa_nome,
             COALESCE(e.telefone, ma.telefone) as empresa_telefone,
             COALESCE(v.modelo, ma.veiculo_modelo) as veiculo_modelo
      FROM carona_reservas r
      JOIN caronas c ON c.id = r.carona_id
      LEFT JOIN empresas e ON e.id = c.empresa_id
      LEFT JOIN carona_veiculos v ON v.id = c.veiculo_id
      LEFT JOIN motoristas_app ma ON ma.id = c.profissional_id AND c.tipo_profissional = 'motorista'
      WHERE REGEXP_REPLACE(r.passageiro_telefone, '\\D', '', 'g') LIKE '%${safeStr(tel.slice(-8))}%'
      ORDER BY c.data_viagem ASC, c.hora_partida ASC
      LIMIT 20`);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/public/entrega/rastrear/:codigo ──────────────────────────────
// Public: track any encomenda by code (no auth needed)
router.get("/entrega/rastrear/:codigo", async (req, res) => {
  try {
    const codigo = String(req.params.codigo ?? "").replace(/'/g, "''").toUpperCase().trim();
    if (!codigo) return res.status(400).json({ error: "codigo obrigatório" });
    const rows = await db.execute(`
      SELECT e.*, emp.nome as empresa_nome
      FROM encomendas e
      LEFT JOIN empresas emp ON emp.id = e.empresa_id
      WHERE UPPER(e.codigo) = '${codigo}'
      ORDER BY e.criado_em DESC LIMIT 1
    `);
    const enc = rows.rows[0] as any;
    if (!enc) return res.status(404).json({ error: "not_found" });
    const hist = await db.execute(`
      SELECT status, descricao, operador_nome, registrado_em
      FROM encomendas_historico WHERE encomenda_id = ${enc.id}
      ORDER BY registrado_em ASC
    `);
    return res.json({ ...enc, historico: hist.rows });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── POST /api/public/entrega/solicitar ────────────────────────────────────
// Public: customer requests a package pickup + delivery
router.post("/entrega/solicitar", async (req, res) => {
  try {
    const {
      empresa_id,
      remetente_nome, remetente_telefone,
      destinatario_nome, destinatario_telefone,
      endereco_coleta, endereco_entrega,
      descricao_pacote, valor,
      categoria, distancia_km,
      coleta_lat, coleta_lng, entrega_lat, entrega_lng,
    } = req.body;
    if (!remetente_nome?.trim() || !endereco_coleta?.trim() || !endereco_entrega?.trim()) {
      return res.status(400).json({ error: "Nome do remetente, endereço de coleta e entrega são obrigatórios" });
    }
    const safe = (v: any) => v ? `'${String(v).replace(/'/g, "''")}'` : "NULL";
    const num = (v: any) => (v == null || v === "" || isNaN(Number(v))) ? "NULL" : String(Number(v));
    const eId = empresa_id ? Number(empresa_id) : "NULL";
    const row = await db.execute(`
      INSERT INTO entregas (empresa_id, remetente_nome, remetente_telefone, destinatario_nome, destinatario_telefone,
        endereco_coleta, endereco_entrega, descricao_pacote, status, valor,
        categoria, distancia_km, coleta_lat, coleta_lng, entrega_lat, entrega_lng)
      VALUES (${eId}, ${safe(remetente_nome)}, ${safe(remetente_telefone)},
              ${safe(destinatario_nome)}, ${safe(destinatario_telefone)},
              ${safe(endereco_coleta)}, ${safe(endereco_entrega)},
              ${safe(descricao_pacote)}, 'pendente', ${Number(valor) || 0},
              ${safe(categoria)}, ${num(distancia_km)},
              ${num(coleta_lat)}, ${num(coleta_lng)}, ${num(entrega_lat)}, ${num(entrega_lng)})
      RETURNING *
    `);
    const inserted = row.rows[0] as any;
    // Fire-and-forget: dispatch to entregadores (broadcast + FCM push)
    dispatchEntregaToEntregadores(inserted).catch((e) => console.error("dispatch:", e));
    return res.status(201).json(inserted);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── POST /api/public/parceiro-register ─────────────────────────────────────
router.post("/parceiro-register", async (req, res) => {
  try {
    const { nome, empresa: nomeEmpresa, email, whatsapp, senha, seguimento } = req.body;
    if (!nome || !nomeEmpresa || !email || !whatsapp || !senha) {
      return res.status(400).json({ error: "bad_request", message: "Preencha todos os campos obrigatórios" });
    }
    if (senha.length < 6) {
      return res.status(400).json({ error: "bad_request", message: "A senha deve ter pelo menos 6 caracteres" });
    }

    // Check if email already exists
    const existing = await db.execute(sql`SELECT id FROM usuarios WHERE email = ${email.toLowerCase().trim()} LIMIT 1`);
    if ((existing.rows as any[]).length > 0) {
      return res.status(409).json({ error: "conflict", message: "Já existe uma conta com este e-mail" });
    }

    // Check if phone already exists
    const phoneNum = String(whatsapp).replace(/\D/g, "");
    if (phoneNum.length >= 8) {
      const existingPhone = await db.execute(sql`SELECT id FROM usuarios WHERE telefone = ${phoneNum} LIMIT 1`);
      if ((existingPhone.rows as any[]).length > 0) {
        return res.status(409).json({ error: "conflict", message: "Já existe uma conta com este WhatsApp" });
      }
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    // Create empresa
    const codigo = String(nomeEmpresa).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) + Date.now().toString(36).toUpperCase().slice(-4);
    const modulos = seguimento ? [seguimento] : [];
    const empRow = await db.execute(sql`
      INSERT INTO empresas (nome, codigo, plano, cor_primaria, ativo, modulos_ativos, taxa_app, ecommerce_taxa_comissao)
      VALUES (${nomeEmpresa.trim()}, ${codigo}, 'basico', '#22C55E', false, ${JSON.stringify(modulos)}::json, 3, 3)
      RETURNING id, nome
    `);
    const empresa = (empRow.rows as any[])[0];

    // Create usuario
    const userRow = await db.execute(sql`
      INSERT INTO usuarios (nome, email, senha_hash, papel, empresa_id, telefone)
      VALUES (${nome.trim()}, ${email.toLowerCase().trim()}, ${senhaHash}, 'parceiro', ${empresa.id}, ${whatsapp.replace(/\D/g, "")})
      RETURNING id, nome, email, papel, empresa_id
    `);
    const usuario = (userRow.rows as any[])[0];

    // Generate referral code
    const codigoReferral = String(nome.replace(/[^A-Za-z0-9]/g, "").slice(0, 4)).toUpperCase().padEnd(4, "X") + String(usuario.id).padStart(4, "0");
    await db.execute(sql`UPDATE usuarios SET codigo_referral = ${codigoReferral} WHERE id = ${usuario.id} AND codigo_referral IS NULL`);

    return res.status(201).json({
      message: "Cadastro realizado! Sua conta será ativada em breve.",
      usuario: { ...usuario, codigo_referral: codigoReferral },
      empresa,
    });
  } catch (err) {
    console.error("[parceiro-register]", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── POST /api/public/pedido/comprovante — upload PIX receipt ─────────────────
// Accepts both multipart/form-data (file field) and JSON (imagem_base64 field)
router.post("/pedido/comprovante", async (req, res) => {
  try {
    const { uploadImageToGCS, memoryUpload } = await import("../lib/uploadImage");

    const handleUpload = async (buffer: Buffer) => {
      const url = await uploadImageToGCS(buffer, `comprovante_${Date.now()}.jpg`, "comprovantes");
      const { modulo, pedido_id } = req.body;
      if (pedido_id && modulo === "food") {
        await db.execute(`UPDATE pedidos_pdv SET comprovante_pix = '${url}' WHERE id = ${Number(pedido_id)}`);
      } else if (pedido_id && modulo === "ecommerce") {
        await db.execute(`UPDATE ecommerce_pedidos SET comprovante_pix = '${url}' WHERE id = ${Number(pedido_id)}`);
      }
      return url;
    };

    const contentType = req.headers["content-type"] ?? "";

    if (contentType.includes("multipart/form-data")) {
      const upload = memoryUpload();
      upload.single("file")(req as any, res as any, async (err: any) => {
        if (err) return res.status(400).json({ error: "upload_error", detail: String(err) });
        const file = (req as any).file as { buffer: Buffer } | undefined;
        if (!file?.buffer) return res.status(400).json({ error: "file_required" });
        try {
          const url = await handleUpload(file.buffer);
          return res.json({ url });
        } catch (e) {
          console.error("[POST /pedido/comprovante multipart]", e);
          return res.status(500).json({ error: "server_error" });
        }
      });
      return;
    } else {
      const { imagem_base64 } = req.body;
      if (!imagem_base64) return res.status(400).json({ error: "imagem_base64 required" });
      const buffer = Buffer.from(imagem_base64, "base64");
      const url = await handleUpload(buffer);
      return res.json({ url });
    }
  } catch (err) {
    console.error("[POST /pedido/comprovante]", err);
    return res.status(500).json({ error: "server_error" });
  }
});

export default router;
