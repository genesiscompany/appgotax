import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

function decodeClienteToken(token: string): number | null {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const match = decoded.match(/^cl_(\d+):/);
    return match ? Number(match[1]) : null;
  } catch { return null; }
}

function requireCliente(req: any, res: any): number | null {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : req.body?.token;
  if (!token) { res.status(401).json({ error: "unauthorized" }); return null; }
  const id = decodeClienteToken(token);
  if (!id) { res.status(401).json({ error: "invalid_token" }); return null; }
  return id;
}

// ── POST /api/cliente/push-token ───────────────────────────────────────────
router.post("/push-token", async (req, res) => {
  try {
    const { token: authToken, pushToken, modulo } = req.body;
    if (!pushToken) return res.status(400).json({ error: "bad_request", message: "pushToken obrigatório" });

    let usuarioId: number | null = null;
    if (authToken) usuarioId = decodeClienteToken(authToken);

    await db.execute(sql`
      INSERT INTO push_tokens (usuario_id, token, plataforma, modulos, ativo, atualizado_em)
      VALUES (${usuarioId}, ${pushToken}, 'expo', ${modulo ? sql`ARRAY[${modulo}]::text[]` : sql`'{}'::text[]`}, true, NOW())
      ON CONFLICT (token) DO UPDATE SET
        usuario_id = COALESCE(EXCLUDED.usuario_id, push_tokens.usuario_id),
        modulos = CASE
          WHEN ${modulo} IS NOT NULL AND NOT (push_tokens.modulos @> ARRAY[${modulo}]::text[])
          THEN array_append(push_tokens.modulos, ${modulo})
          ELSE push_tokens.modulos
        END,
        ativo = true,
        atualizado_em = NOW()
    `);
    return res.json({ ok: true });
  } catch (err) {
    console.error("push-token error:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/cliente/passagens ─────────────────────────────────────────────
// Returns all passagens for the authenticated customer
router.get("/passagens", async (req, res) => {
  const usuarioId = requireCliente(req, res);
  if (!usuarioId) return;
  try {
    const rows = await db.execute(`
      SELECT
        vp.id, vp.assento, vp.valor, vp.forma_pagamento, vp.status,
        vp.observacoes, vp.vendido_em, vp.empresa_id,
        vh.data_partida, vh.hora_partida, vh.hora_chegada, vh.preco, vh.veiculo,
        vr.origem, vr.destino, vr.duracao_minutos, vr.tipo as tipo_transporte,
        vc.nome as passageiro_nome, vc.cpf as passageiro_cpf,
        e.nome as empresa_nome
      FROM viagens_passagens vp
      LEFT JOIN viagens_horarios vh ON vh.id = vp.horario_id
      LEFT JOIN viagens_rotas vr ON vr.id = vh.rota_id
      LEFT JOIN viagens_clientes vc ON vc.id = vp.cliente_id
      LEFT JOIN empresas e ON e.id = vp.empresa_id
      WHERE vp.usuario_id = ${usuarioId}
      ORDER BY vp.vendido_em DESC
      LIMIT 100
    `);

    return res.json(rows.rows.map((r: any) => ({
      ...r,
      valor: Number(r.valor ?? 0),
      codigo: `PASS-${String(r.id).padStart(5, "0")}`,
    })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── POST /api/cliente/passagens ────────────────────────────────────────────
// Purchase a passagem linked to a customer account
router.post("/passagens", async (req, res) => {
  const usuarioId = requireCliente(req, res);
  if (!usuarioId) return;
  try {
    const {
      horario_id,
      assento,
      valor,
      forma_pagamento = "pix",
      passageiro_nome,
      passageiro_cpf,
      passageiro_telefone,
    } = req.body;

    if (!horario_id || !assento || !valor) {
      return res.status(400).json({ error: "horario_id, assento e valor são obrigatórios" });
    }

    // Check horario availability
    const horarioRows = await db.execute(`
      SELECT vh.id, vh.empresa_id, vh.vagas_total, vh.vagas_ocupadas, vh.preco
      FROM viagens_horarios vh WHERE vh.id = ${Number(horario_id)} AND vh.ativo = true
    `);
    const horario = horarioRows.rows[0] as any;
    if (!horario) return res.status(404).json({ error: "Horário não encontrado" });
    if (Number(horario.vagas_ocupadas) >= Number(horario.vagas_total)) {
      return res.status(400).json({ error: "Sem vagas disponíveis neste horário" });
    }

    const empresaId = horario.empresa_id;

    // Find or create viagens_cliente record
    let clienteId: number | null = null;
    if (passageiro_nome || passageiro_cpf) {
      const nomeSafe = String(passageiro_nome ?? "").replace(/'/g, "''");
      const cpfSafe = String(passageiro_cpf ?? "").replace(/\D/g, "");
      const telSafe = String(passageiro_telefone ?? "").replace(/'/g, "''");

      if (cpfSafe) {
        const existing = await db.execute(`
          SELECT id FROM viagens_clientes WHERE empresa_id = ${empresaId} AND cpf = '${cpfSafe}' LIMIT 1
        `);
        if (existing.rows[0]) {
          clienteId = (existing.rows[0] as any).id;
        }
      }

      if (!clienteId && nomeSafe) {
        const inserted = await db.execute(`
          INSERT INTO viagens_clientes (empresa_id, nome, cpf, telefone)
          VALUES (${empresaId}, '${nomeSafe}', ${cpfSafe ? `'${cpfSafe}'` : "NULL"}, ${telSafe ? `'${telSafe}'` : "NULL"})
          RETURNING id
        `);
        clienteId = (inserted.rows[0] as any)?.id ?? null;
      }
    }

    const assentoSafe = String(assento).replace(/'/g, "''");
    const fpSafe = String(forma_pagamento).replace(/'/g, "''");

    // Insert passagem
    const inserted = await db.execute(`
      INSERT INTO viagens_passagens
        (empresa_id, cliente_id, horario_id, assento, valor, forma_pagamento, status, usuario_id)
      VALUES
        (${empresaId}, ${clienteId ?? "NULL"}, ${Number(horario_id)},
         '${assentoSafe}', ${Number(valor)}, '${fpSafe}', 'confirmado', ${usuarioId})
      RETURNING id
    `);

    const passagemId = (inserted.rows[0] as any)?.id;

    // Update vagas_ocupadas
    await db.execute(`
      UPDATE viagens_horarios SET vagas_ocupadas = vagas_ocupadas + 1 WHERE id = ${Number(horario_id)}
    `);

    // Generate affiliate commission for the logged-in customer (if referred)
    try {
      const { gerarComissaoCliente } = await import("../lib/comissaoAfiliado");
      await gerarComissaoCliente({
        usuarioId,
        valor: Number(valor) || 0,
        tipoEvento: "passagem",
        referenciaId: Number(passagemId),
        descricao: `Passagem #${passagemId}`,
      });
    } catch (commErr) {
      console.error("[cliente/passagens] comissão erro:", commErr);
    }

    // Recalcula repasse semanal da empresa (Tur Viagens conta na receita)
    try {
      const cfgRows = await db.execute(`SELECT taxa_repasse FROM configuracoes_plataforma LIMIT 1`);
      const taxa = Number((cfgRows.rows[0] as any)?.taxa_repasse ?? 3);
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now); monday.setDate(now.getDate() + diffToMon); monday.setHours(0,0,0,0);
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
      const semanaInicio = monday.toISOString().slice(0,10);
      const semanaFim = sunday.toISOString().slice(0,10);
      const receitaRow = await db.execute(`
        SELECT
          COALESCE((SELECT SUM(total) FROM pedidos_pdv
            WHERE empresa_id = ${empresaId} AND status = 'entregue'
            AND criado_em >= '${semanaInicio}' AND criado_em <= '${semanaFim} 23:59:59'), 0)
          + COALESCE((SELECT SUM(valor_frete) FROM encomendas
            WHERE empresa_id = ${empresaId} AND status = 'entregue'
            AND criado_em >= '${semanaInicio}' AND criado_em <= '${semanaFim} 23:59:59'), 0)
          + COALESCE((SELECT SUM(valor) FROM viagens_passagens
            WHERE empresa_id = ${empresaId} AND status = 'confirmado'
            AND vendido_em >= '${semanaInicio}' AND vendido_em <= '${semanaFim} 23:59:59'), 0)
          AS receita
      `);
      const receita = Number((receitaRow.rows[0] as any)?.receita ?? 0);
      const valorRep = parseFloat((receita * taxa / 100).toFixed(2));
      await db.execute(`
        INSERT INTO repasses (empresa_id, semana_inicio, semana_fim, receita_total, taxa_percentual, valor_repasse, status)
        VALUES (${empresaId}, '${semanaInicio}', '${semanaFim}', ${receita}, ${taxa}, ${valorRep}, 'pendente')
        ON CONFLICT (empresa_id, semana_inicio) DO UPDATE SET
          receita_total = EXCLUDED.receita_total,
          taxa_percentual = EXCLUDED.taxa_percentual,
          valor_repasse = EXCLUDED.valor_repasse
        WHERE repasses.status = 'pendente'
      `);
    } catch (repErr) {
      console.error("[cliente/passagens] repasse erro:", repErr);
    }

    return res.status(201).json({
      ok: true,
      id: passagemId,
      codigo: `PASS-${String(passagemId).padStart(5, "0")}`,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── PUT /api/cliente/passagens/:id/cancelar ────────────────────────────────
router.put("/passagens/:id/cancelar", async (req, res) => {
  const usuarioId = requireCliente(req, res);
  if (!usuarioId) return;
  try {
    const passagemId = Number(req.params.id);

    const rows = await db.execute(`
      SELECT id, status, horario_id FROM viagens_passagens
      WHERE id = ${passagemId} AND usuario_id = ${usuarioId}
    `);
    const passagem = rows.rows[0] as any;
    if (!passagem) return res.status(404).json({ error: "Passagem não encontrada" });
    if (passagem.status === "cancelado") return res.status(400).json({ error: "Passagem já cancelada" });

    await db.execute(`
      UPDATE viagens_passagens SET status = 'cancelado' WHERE id = ${passagemId}
    `);

    // Free the seat
    if (passagem.horario_id) {
      await db.execute(`
        UPDATE viagens_horarios SET vagas_ocupadas = GREATEST(0, vagas_ocupadas - 1)
        WHERE id = ${passagem.horario_id}
      `);
    }

    // Recalcula repasse semanal — passagem cancelada deve sair da receita
    try {
      const empresaRow = await db.execute(
        `SELECT empresa_id FROM viagens_passagens WHERE id = ${passagemId} LIMIT 1`
      );
      const empresaId = Number((empresaRow.rows[0] as any)?.empresa_id);
      if (empresaId) {
        const cfgRows = await db.execute(`SELECT taxa_repasse FROM configuracoes_plataforma LIMIT 1`);
        const taxa = Number((cfgRows.rows[0] as any)?.taxa_repasse ?? 3);
        const now = new Date();
        const dayOfWeek = now.getDay();
        const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(now); monday.setDate(now.getDate() + diffToMon); monday.setHours(0,0,0,0);
        const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
        const semanaInicio = monday.toISOString().slice(0,10);
        const semanaFim = sunday.toISOString().slice(0,10);
        const receitaRow = await db.execute(`
          SELECT
            COALESCE((SELECT SUM(total) FROM pedidos_pdv
              WHERE empresa_id = ${empresaId} AND status = 'entregue'
              AND criado_em >= '${semanaInicio}' AND criado_em <= '${semanaFim} 23:59:59'), 0)
            + COALESCE((SELECT SUM(valor_frete) FROM encomendas
              WHERE empresa_id = ${empresaId} AND status = 'entregue'
              AND criado_em >= '${semanaInicio}' AND criado_em <= '${semanaFim} 23:59:59'), 0)
            + COALESCE((SELECT SUM(valor) FROM viagens_passagens
              WHERE empresa_id = ${empresaId} AND status = 'confirmado'
              AND vendido_em >= '${semanaInicio}' AND vendido_em <= '${semanaFim} 23:59:59'), 0)
            AS receita
        `);
        const receita = Number((receitaRow.rows[0] as any)?.receita ?? 0);
        const valorRep = parseFloat((receita * taxa / 100).toFixed(2));
        await db.execute(`
          INSERT INTO repasses (empresa_id, semana_inicio, semana_fim, receita_total, taxa_percentual, valor_repasse, status)
          VALUES (${empresaId}, '${semanaInicio}', '${semanaFim}', ${receita}, ${taxa}, ${valorRep}, 'pendente')
          ON CONFLICT (empresa_id, semana_inicio) DO UPDATE SET
            receita_total = EXCLUDED.receita_total,
            taxa_percentual = EXCLUDED.taxa_percentual,
            valor_repasse = EXCLUDED.valor_repasse
          WHERE repasses.status = 'pendente'
        `);
      }
    } catch (repErr) {
      console.error("[cliente/passagens cancelar] repasse erro:", repErr);
    }

    return res.json({ ok: true, status: "cancelado" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PROGRAMA DE AFILIADOS
// ─────────────────────────────────────────────────────────────────────────────

function gerarCodigoAfiliado(nome: string, userId: number): string {
  const prefix = (nome || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "GO";
  const suffix = String(userId).padStart(4, "0");
  return `${prefix}${suffix}`;
}

// GET /api/cliente/afiliados/perfil — busca ou cria perfil de afiliado
router.get("/afiliados/perfil", async (req, res) => {
  try {
    const usuarioId = requireCliente(req, res);
    if (!usuarioId) return;

    // busca ou cria
    let rows: any[] = (await db.execute(sql`
      SELECT a.*, u.nome FROM afiliados a
      JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.usuario_id = ${usuarioId}
    `)).rows;

    if (!rows.length) {
      const user = (await db.execute(sql`SELECT nome FROM usuarios WHERE id = ${usuarioId}`)).rows[0] as any;
      for (let attempt = 0; attempt < 3 && !rows.length; attempt++) {
        const base = gerarCodigoAfiliado(user?.nome ?? "", usuarioId);
        const codigo = attempt === 0 ? base : `${base}${Math.floor(Math.random() * 900) + 100}`;
        try {
          const inserted = (await db.execute(sql`
            INSERT INTO afiliados (usuario_id, codigo) VALUES (${usuarioId}, ${codigo})
            ON CONFLICT (usuario_id) DO NOTHING
            RETURNING *, (SELECT nome FROM usuarios WHERE id = ${usuarioId}) AS nome
          `)).rows;
          if (inserted.length) {
            rows = inserted as any[];
          } else {
            rows = (await db.execute(sql`
              SELECT a.*, u.nome FROM afiliados a
              JOIN usuarios u ON u.id = a.usuario_id
              WHERE a.usuario_id = ${usuarioId}
            `)).rows;
          }
        } catch (e: any) {
          if (e.code === "23505" && attempt < 2) continue;
          throw e;
        }
      }
    }

    const perfil = rows[0] as any;
    const domain = process.env.PUBLIC_DOMAIN || "https://gotaxi.com.br";
    perfil.link_afiliado = `${domain}/afiliados/r/${perfil.codigo}`;
    return res.json(perfil);
  } catch (err) {
    console.error("afiliados/perfil err:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// GET /api/cliente/afiliados/indicados — lista quem foi indicado por mim
router.get("/afiliados/indicados", async (req, res) => {
  try {
    const usuarioId = requireCliente(req, res);
    if (!usuarioId) return;

    const rows = (await db.execute(sql`
      SELECT ai.*, u.nome AS nome_indicado_real
      FROM afiliados a
      JOIN afiliado_indicacoes ai ON ai.afiliado_id = a.id
      LEFT JOIN usuarios u ON u.id = ai.usuario_indicado_id
      WHERE a.usuario_id = ${usuarioId}
      ORDER BY ai.criado_em DESC
      LIMIT 50
    `)).rows;

    return res.json(rows);
  } catch (err) {
    console.error("afiliados/indicados err:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// GET /api/cliente/afiliados/resgates — histórico de resgates
router.get("/afiliados/resgates", async (req, res) => {
  try {
    const usuarioId = requireCliente(req, res);
    if (!usuarioId) return;

    const rows = (await db.execute(sql`
      SELECT ar.* FROM afiliados a
      JOIN afiliado_resgates ar ON ar.afiliado_id = a.id
      WHERE a.usuario_id = ${usuarioId}
      ORDER BY ar.criado_em DESC LIMIT 20
    `)).rows;

    return res.json(rows);
  } catch (err) {
    console.error("afiliados/resgates err:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// POST /api/cliente/afiliados/resgatar — solicita resgate de saldo
router.post("/afiliados/resgatar", async (req, res) => {
  try {
    const usuarioId = requireCliente(req, res);
    if (!usuarioId) return;

    const { valor, chave_pix } = req.body;
    if (!valor || Number(valor) <= 0) return res.status(400).json({ error: "Valor inválido" });
    if (!chave_pix) return res.status(400).json({ error: "Informe a chave Pix" });

    const afiliadoRows = (await db.execute(sql`
      SELECT * FROM afiliados WHERE usuario_id = ${usuarioId}
    `)).rows as any[];
    if (!afiliadoRows.length) return res.status(404).json({ error: "Afiliado não encontrado" });

    const afiliado = afiliadoRows[0] as any;
    if (Number(afiliado.saldo) < Number(valor)) return res.status(400).json({ error: "Saldo insuficiente" });

    const cfgRows = (await db.execute(sql`SELECT valor_minimo_saque FROM afiliados_config LIMIT 1`)).rows as any[];
    const minimo = Number(cfgRows[0]?.valor_minimo_saque ?? 50);
    if (Number(valor) < minimo) return res.status(400).json({ error: `Valor mínimo para resgate é R$ ${minimo.toFixed(2).replace(".", ",")}` });

    // Debita saldo
    await db.execute(sql`
      UPDATE afiliados SET saldo = saldo - ${Number(valor)} WHERE id = ${afiliado.id}
    `);

    await db.execute(sql`
      INSERT INTO afiliado_resgates (afiliado_id, valor, chave_pix, status)
      VALUES (${afiliado.id}, ${Number(valor)}, ${chave_pix}, 'pendente')
    `);

    return res.json({ ok: true, message: "Resgate solicitado! Será processado em até 3 dias úteis." });
  } catch (err) {
    console.error("afiliados/resgatar err:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// GET /api/cliente/afiliados/comissoes — histórico de comissões do afiliado
router.get("/afiliados/comissoes", async (req, res) => {
  try {
    const usuarioId = requireCliente(req, res);
    if (!usuarioId) return;

    const rows = (await db.execute(sql`
      SELECT ac.*, ai.nome_indicado
      FROM afiliados a
      JOIN afiliado_comissoes ac ON ac.afiliado_id = a.id
      LEFT JOIN afiliado_indicacoes ai ON ai.id = ac.indicado_id
      WHERE a.usuario_id = ${usuarioId}
      ORDER BY ac.criado_em DESC
      LIMIT 100
    `)).rows;

    return res.json(rows);
  } catch (err) {
    console.error("afiliados/comissoes err:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// GET /api/cliente/afiliados/credito — retorna saldo de crédito do usuário
router.get("/afiliados/credito", async (req, res) => {
  try {
    const usuarioId = requireCliente(req, res);
    if (!usuarioId) return;
    const rows = (await db.execute(sql`SELECT credito_aplicativo FROM usuarios WHERE id = ${usuarioId}`)).rows as any[];
    const saldo = rows[0]?.credito_aplicativo ?? 0;
    return res.json({ saldo: Number(saldo) });
  } catch (err) {
    console.error("afiliados/credito err:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// POST /api/cliente/afiliados/usar-credito — converte saldo de afiliado em crédito para corridas
router.post("/afiliados/usar-credito", async (req, res) => {
  try {
    const usuarioId = requireCliente(req, res);
    if (!usuarioId) return;

    const { valor } = req.body;
    if (!valor || Number(valor) <= 0) return res.status(400).json({ error: "Valor inválido" });

    const afiliadoRows = (await db.execute(sql`
      SELECT * FROM afiliados WHERE usuario_id = ${usuarioId}
    `)).rows as any[];
    if (!afiliadoRows.length) return res.status(404).json({ error: "Sem perfil de afiliado" });

    const afiliado = afiliadoRows[0] as any;
    if (Number(afiliado.saldo) < Number(valor)) return res.status(400).json({ error: "Saldo insuficiente" });
    if (Number(valor) < 1) return res.status(400).json({ error: "Valor mínimo R$ 1,00" });

    await db.execute(sql`UPDATE afiliados SET saldo = saldo - ${Number(valor)} WHERE id = ${afiliado.id}`);
    await db.execute(sql`UPDATE usuarios SET credito_aplicativo = COALESCE(credito_aplicativo, 0) + ${Number(valor)} WHERE id = ${usuarioId}`);

    const novo = (await db.execute(sql`SELECT credito_aplicativo FROM usuarios WHERE id = ${usuarioId}`)).rows[0] as any;

    return res.json({ ok: true, credito_atual: novo?.credito_aplicativo ?? 0 });
  } catch (err) {
    console.error("afiliados/usar-credito err:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// POST /api/public/afiliados/usar-codigo — chamado durante cadastro com código de afiliado
// (Endpoint público — não precisa de auth de usuário)
router.post("/afiliados/usar-codigo", async (req, res) => {
  try {
    const { codigo, nome_indicado } = req.body;
    if (!codigo) return res.status(400).json({ error: "Código inválido" });

    const afiliadoRows = (await db.execute(sql`
      SELECT * FROM afiliados WHERE UPPER(codigo) = UPPER(${codigo}) AND status = 'ativo'
    `)).rows as any[];

    if (!afiliadoRows.length) return res.status(404).json({ error: "Código não encontrado" });
    const afiliado = afiliadoRows[0] as any;

    const bonus = 10.00;
    await db.execute(sql`
      INSERT INTO afiliado_indicacoes (afiliado_id, nome_indicado, status, bonus_valor)
      VALUES (${afiliado.id}, ${nome_indicado ?? "Novo usuário"}, 'pendente', ${bonus})
    `);

    await db.execute(sql`
      UPDATE afiliados SET total_indicados = total_indicados + 1 WHERE id = ${afiliado.id}
    `);

    return res.json({ ok: true, bonus_gerado: bonus });
  } catch (err) {
    console.error("afiliados/usar-codigo err:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

export default router;

