import { Router } from "express";
import { db } from "@workspace/db";

const router = Router();

let tabelasGarantidas = false;
async function ensureServicosTabelas() {
  if (tabelasGarantidas) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS categorias_servicos (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      icone TEXT NOT NULL DEFAULT 'tool',
      cor TEXT NOT NULL DEFAULT '#45B7D1',
      criado_em TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS servicos_prestadores (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      especialidade TEXT,
      telefone TEXT,
      email TEXT,
      bio TEXT,
      avatar_url TEXT,
      ativo BOOLEAN NOT NULL DEFAULT true,
      criado_em TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS servicos_catalogo (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER NOT NULL,
      prestador_id INTEGER REFERENCES servicos_prestadores(id),
      categoria_id INTEGER REFERENCES categorias_servicos(id),
      nome TEXT NOT NULL,
      descricao TEXT,
      duracao_minutos INTEGER DEFAULT 60,
      preco DECIMAL(10,2),
      ativo BOOLEAN NOT NULL DEFAULT true,
      criado_em TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS servicos_promocoes (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      descricao TEXT,
      tipo TEXT NOT NULL DEFAULT 'percentual',
      valor DECIMAL(10,2) NOT NULL,
      valido_de DATE,
      valido_ate DATE,
      ativo BOOLEAN NOT NULL DEFAULT true,
      criado_em TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS servicos_pacotes (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      descricao TEXT,
      preco_total DECIMAL(10,2) NOT NULL,
      sessoes INTEGER NOT NULL DEFAULT 1,
      validade_dias INTEGER,
      catalogo_ids TEXT,
      ativo BOOLEAN NOT NULL DEFAULT true,
      criado_em TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS agendamentos (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER NOT NULL,
      categoria_id INTEGER,
      catalogo_id INTEGER,
      prestador_id INTEGER,
      cliente_nome TEXT NOT NULL,
      cliente_telefone TEXT,
      servico_nome TEXT NOT NULL DEFAULT 'Serviço',
      data_hora TIMESTAMP NOT NULL,
      valor DECIMAL(10,2),
      valor_pago DECIMAL(10,2),
      pago_em TIMESTAMP,
      metodo_pagamento TEXT,
      comissao_gotaxi DECIMAL(10,2),
      observacoes TEXT,
      status TEXT NOT NULL DEFAULT 'agendado',
      criado_em TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  tabelasGarantidas = true;
}

export { ensureServicosTabelas };

function getEmpresaId(req: any): number {
  const raw = (req.headers["authorization"] || "").replace("Bearer ", "");
  if (raw) {
    try {
      const parts = Buffer.from(raw, "base64").toString().split(":");
      if (parts[1]) return Number(parts[1]);
    } catch {}
  }
  return Number(req.headers["x-empresa-id"] || 1);
}

function esc(v: unknown) { return String(v ?? "").replace(/'/g, "''"); }
function num(v: unknown) { return Number(v) || 0; }

async function semanaAtual() {
  const now = new Date();
  const dow = now.getDay();
  const inicio = new Date(now);
  inicio.setDate(now.getDate() - ((dow + 6) % 7));
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date(inicio);
  fim.setDate(inicio.getDate() + 6);
  fim.setHours(23, 59, 59, 999);
  return { inicio, fim };
}

async function atualizarRepasse(empresaId: number) {
  const { inicio, fim } = await semanaAtual();
  const semIni = inicio.toISOString().substring(0, 10);
  const semFim = fim.toISOString().substring(0, 10);

  const rows = await db.execute(`
    SELECT COALESCE(SUM(valor_pago), 0) AS total
    FROM agendamentos
    WHERE empresa_id = ${empresaId}
      AND status = 'concluido'
      AND valor_pago IS NOT NULL
      AND pago_em >= '${inicio.toISOString()}'
      AND pago_em <= '${fim.toISOString()}'
  `);
  const receitaTotal = Number((rows as any).rows?.[0]?.total ?? (rows as any)[0]?.total ?? 0);
  const valorRepasse = parseFloat((receitaTotal * 0.03).toFixed(2));

  await db.execute(`
    INSERT INTO repasses (empresa_id, semana_inicio, semana_fim, receita_total, taxa_percentual, valor_repasse, status)
    VALUES (${empresaId}, '${semIni}', '${semFim}', ${receitaTotal}, 3.00, ${valorRepasse}, 'pendente')
    ON CONFLICT (empresa_id, semana_inicio)
    DO UPDATE SET receita_total = ${receitaTotal}, valor_repasse = ${valorRepasse}
  `);
}

function rows(r: any): any[] {
  return r.rows ?? r ?? [];
}

// Garantir tabelas antes de qualquer request
router.use(async (_req, _res, next) => { await ensureServicosTabelas(); next(); });

// ─── CATEGORIAS ──────────────────────────────────────────────────────────────
router.get("/categorias", async (req, res) => {
  const empresaId = getEmpresaId(req);
  const r = await db.execute(`SELECT * FROM categorias_servicos WHERE empresa_id = ${empresaId} ORDER BY nome`);
  return res.json(rows(r));
});

router.post("/categorias", async (req, res) => {
  const empresaId = getEmpresaId(req);
  const { nome, icone = "tool", cor = "#45B7D1" } = req.body;
  if (!nome) return res.status(400).json({ error: "nome obrigatório" });
  const r = await db.execute(
    `INSERT INTO categorias_servicos (empresa_id, nome, icone, cor) VALUES (${empresaId}, '${esc(nome)}', '${esc(icone)}', '${esc(cor)}') RETURNING *`
  );
  return res.status(201).json(rows(r)[0]);
});

router.put("/categorias/:id", async (req, res) => {
  const empresaId = getEmpresaId(req);
  const id = num(req.params.id);
  const { nome, icone, cor } = req.body;
  const sets: string[] = [];
  if (nome !== undefined) sets.push(`nome = '${esc(nome)}'`);
  if (icone !== undefined) sets.push(`icone = '${esc(icone)}'`);
  if (cor !== undefined) sets.push(`cor = '${esc(cor)}'`);
  if (sets.length === 0) return res.status(400).json({ error: "nada para atualizar" });
  const r = await db.execute(
    `UPDATE categorias_servicos SET ${sets.join(", ")} WHERE id = ${id} AND empresa_id = ${empresaId} RETURNING *`
  );
  return res.json(rows(r)[0]);
});

router.delete("/categorias/:id", async (req, res) => {
  const empresaId = getEmpresaId(req);
  const id = num(req.params.id);
  // Limpa referências em serviços vinculados antes de remover (evita erro de FK)
  await db.execute(`UPDATE servicos_catalogo SET categoria_id = NULL WHERE categoria_id = ${id} AND empresa_id = ${empresaId}`);
  await db.execute(`DELETE FROM categorias_servicos WHERE id = ${id} AND empresa_id = ${empresaId}`);
  return res.json({ ok: true });
});

// ─── PRESTADORES ─────────────────────────────────────────────────────────────
router.get("/prestadores", async (req, res) => {
  const empresaId = getEmpresaId(req);
  const r = await db.execute(`
    SELECT p.*,
           COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'concluido') AS total_concluidos,
           COALESCE(SUM(a.valor_pago) FILTER (WHERE a.status = 'concluido'), 0) AS receita_total
    FROM servicos_prestadores p
    LEFT JOIN agendamentos a ON a.prestador_id = p.id
    WHERE p.empresa_id = ${empresaId}
    GROUP BY p.id
    ORDER BY p.nome
  `);
  return res.json(rows(r));
});

router.post("/prestadores", async (req, res) => {
  const empresaId = getEmpresaId(req);
  const { nome, especialidade, telefone, email, bio } = req.body;
  if (!nome) return res.status(400).json({ error: "nome obrigatório" });
  const esp = especialidade ? `'${esc(especialidade)}'` : "NULL";
  const tel = telefone ? `'${esc(telefone)}'` : "NULL";
  const eml = email ? `'${esc(email)}'` : "NULL";
  const bio_ = bio ? `'${esc(bio)}'` : "NULL";
  const r = await db.execute(
    `INSERT INTO servicos_prestadores (empresa_id, nome, especialidade, telefone, email, bio)
     VALUES (${empresaId}, '${esc(nome)}', ${esp}, ${tel}, ${eml}, ${bio_}) RETURNING *`
  );
  return res.status(201).json(rows(r)[0]);
});

router.put("/prestadores/:id", async (req, res) => {
  const empresaId = getEmpresaId(req);
  const id = num(req.params.id);
  const { nome, especialidade, telefone, email, bio, ativo } = req.body;
  const sets: string[] = [];
  if (nome !== undefined) sets.push(`nome = '${esc(nome)}'`);
  if (especialidade !== undefined) sets.push(`especialidade = '${esc(especialidade)}'`);
  if (telefone !== undefined) sets.push(`telefone = '${esc(telefone)}'`);
  if (email !== undefined) sets.push(`email = '${esc(email)}'`);
  if (bio !== undefined) sets.push(`bio = '${esc(bio)}'`);
  if (ativo !== undefined) sets.push(`ativo = ${Boolean(ativo)}`);
  if (!sets.length) return res.status(400).json({ error: "nada para atualizar" });
  const r = await db.execute(
    `UPDATE servicos_prestadores SET ${sets.join(", ")} WHERE id = ${id} AND empresa_id = ${empresaId} RETURNING *`
  );
  const row = rows(r)[0];
  if (!row) return res.status(404).json({ error: "not_found" });
  return res.json(row);
});

router.delete("/prestadores/:id", async (req, res) => {
  const empresaId = getEmpresaId(req);
  await db.execute(
    `UPDATE servicos_prestadores SET ativo = false WHERE id = ${num(req.params.id)} AND empresa_id = ${empresaId}`
  );
  return res.json({ ok: true });
});

// ─── CATÁLOGO ─────────────────────────────────────────────────────────────────
router.get("/catalogo", async (req, res) => {
  const empresaId = getEmpresaId(req);
  const prestadorFilter = req.query.prestador_id ? `AND sc.prestador_id = ${num(req.query.prestador_id)}` : "";
  const r = await db.execute(`
    SELECT sc.*, p.nome AS prestador_nome, c.nome AS categoria_nome, c.cor AS categoria_cor
    FROM servicos_catalogo sc
    LEFT JOIN servicos_prestadores p ON p.id = sc.prestador_id
    LEFT JOIN categorias_servicos c ON c.id = sc.categoria_id
    WHERE sc.empresa_id = ${empresaId} AND sc.ativo = true ${prestadorFilter}
    ORDER BY sc.nome
  `);
  return res.json(rows(r));
});

router.post("/catalogo", async (req, res) => {
  const empresaId = getEmpresaId(req);
  const { nome, descricao, duracao_minutos = 60, preco, prestador_id, categoria_id } = req.body;
  if (!nome || !preco) return res.status(400).json({ error: "nome e preco obrigatórios" });
  const pid = prestador_id ? num(prestador_id) : "NULL";
  const cid = categoria_id ? num(categoria_id) : "NULL";
  const desc_ = descricao ? `'${esc(descricao)}'` : "NULL";
  const r = await db.execute(`
    INSERT INTO servicos_catalogo (empresa_id, prestador_id, categoria_id, nome, descricao, duracao_minutos, preco)
    VALUES (${empresaId}, ${pid}, ${cid}, '${esc(nome)}', ${desc_}, ${num(duracao_minutos)}, ${num(preco)})
    RETURNING *
  `);
  return res.status(201).json(rows(r)[0]);
});

router.put("/catalogo/:id", async (req, res) => {
  const empresaId = getEmpresaId(req);
  const id = num(req.params.id);
  const { nome, descricao, duracao_minutos, preco, prestador_id, categoria_id, ativo } = req.body;
  const sets: string[] = [];
  if (nome !== undefined) sets.push(`nome = '${esc(nome)}'`);
  if (descricao !== undefined) sets.push(`descricao = '${esc(descricao)}'`);
  if (duracao_minutos !== undefined) sets.push(`duracao_minutos = ${num(duracao_minutos)}`);
  if (preco !== undefined) sets.push(`preco = ${num(preco)}`);
  if (prestador_id !== undefined) sets.push(`prestador_id = ${prestador_id ? num(prestador_id) : "NULL"}`);
  if (categoria_id !== undefined) sets.push(`categoria_id = ${categoria_id ? num(categoria_id) : "NULL"}`);
  if (ativo !== undefined) sets.push(`ativo = ${Boolean(ativo)}`);
  if (!sets.length) return res.status(400).json({ error: "nada para atualizar" });
  const r = await db.execute(
    `UPDATE servicos_catalogo SET ${sets.join(", ")} WHERE id = ${id} AND empresa_id = ${empresaId} RETURNING *`
  );
  const row = rows(r)[0];
  if (!row) return res.status(404).json({ error: "not_found" });
  return res.json(row);
});

router.delete("/catalogo/:id", async (req, res) => {
  const empresaId = getEmpresaId(req);
  await db.execute(
    `UPDATE servicos_catalogo SET ativo = false WHERE id = ${num(req.params.id)} AND empresa_id = ${empresaId}`
  );
  return res.json({ ok: true });
});

// ─── PROMOÇÕES ───────────────────────────────────────────────────────────────
router.get("/promocoes", async (req, res) => {
  const empresaId = getEmpresaId(req);
  const r = await db.execute(`SELECT * FROM servicos_promocoes WHERE empresa_id = ${empresaId} ORDER BY criado_em DESC`);
  return res.json(rows(r));
});

router.post("/promocoes", async (req, res) => {
  const empresaId = getEmpresaId(req);
  const { nome, descricao, tipo = "percentual", valor, valido_de, valido_ate } = req.body;
  if (!nome || valor === undefined || valor === null) return res.status(400).json({ error: "nome e valor obrigatórios" });
  if (!["percentual", "valor"].includes(tipo)) return res.status(400).json({ error: "tipo inválido" });
  const desc_ = descricao ? `'${esc(descricao)}'` : "NULL";
  const de_ = valido_de ? `'${esc(valido_de)}'` : "NULL";
  const ate_ = valido_ate ? `'${esc(valido_ate)}'` : "NULL";
  const r = await db.execute(`
    INSERT INTO servicos_promocoes (empresa_id, nome, descricao, tipo, valor, valido_de, valido_ate)
    VALUES (${empresaId}, '${esc(nome)}', ${desc_}, '${esc(tipo)}', ${num(valor)}, ${de_}, ${ate_})
    RETURNING *
  `);
  return res.status(201).json(rows(r)[0]);
});

router.put("/promocoes/:id", async (req, res) => {
  const empresaId = getEmpresaId(req);
  const id = num(req.params.id);
  const { nome, descricao, tipo, valor, valido_de, valido_ate, ativo } = req.body;
  const sets: string[] = [];
  if (nome !== undefined) sets.push(`nome = '${esc(nome)}'`);
  if (descricao !== undefined) sets.push(`descricao = ${descricao ? `'${esc(descricao)}'` : "NULL"}`);
  if (tipo !== undefined) sets.push(`tipo = '${esc(tipo)}'`);
  if (valor !== undefined) sets.push(`valor = ${num(valor)}`);
  if (valido_de !== undefined) sets.push(`valido_de = ${valido_de ? `'${esc(valido_de)}'` : "NULL"}`);
  if (valido_ate !== undefined) sets.push(`valido_ate = ${valido_ate ? `'${esc(valido_ate)}'` : "NULL"}`);
  if (ativo !== undefined) sets.push(`ativo = ${Boolean(ativo)}`);
  if (!sets.length) return res.status(400).json({ error: "nada para atualizar" });
  const r = await db.execute(
    `UPDATE servicos_promocoes SET ${sets.join(", ")} WHERE id = ${id} AND empresa_id = ${empresaId} RETURNING *`
  );
  const row = rows(r)[0];
  if (!row) return res.status(404).json({ error: "not_found" });
  return res.json(row);
});

router.delete("/promocoes/:id", async (req, res) => {
  const empresaId = getEmpresaId(req);
  await db.execute(`DELETE FROM servicos_promocoes WHERE id = ${num(req.params.id)} AND empresa_id = ${empresaId}`);
  return res.json({ ok: true });
});

// ─── PACOTES ─────────────────────────────────────────────────────────────────
router.get("/pacotes", async (req, res) => {
  const empresaId = getEmpresaId(req);
  const r = await db.execute(`SELECT * FROM servicos_pacotes WHERE empresa_id = ${empresaId} ORDER BY criado_em DESC`);
  return res.json(rows(r));
});

router.post("/pacotes", async (req, res) => {
  const empresaId = getEmpresaId(req);
  const { nome, descricao, preco_total, sessoes = 1, validade_dias, catalogo_ids } = req.body;
  if (!nome || preco_total === undefined || preco_total === null) return res.status(400).json({ error: "nome e preco_total obrigatórios" });
  const desc_ = descricao ? `'${esc(descricao)}'` : "NULL";
  const val_ = validade_dias ? num(validade_dias) : "NULL";
  const cids = Array.isArray(catalogo_ids) ? catalogo_ids.map(num).filter(Boolean).join(",") : "";
  const cidsCol = cids ? `'${esc(cids)}'` : "NULL";
  const r = await db.execute(`
    INSERT INTO servicos_pacotes (empresa_id, nome, descricao, preco_total, sessoes, validade_dias, catalogo_ids)
    VALUES (${empresaId}, '${esc(nome)}', ${desc_}, ${num(preco_total)}, ${num(sessoes) || 1}, ${val_}, ${cidsCol})
    RETURNING *
  `);
  return res.status(201).json(rows(r)[0]);
});

router.put("/pacotes/:id", async (req, res) => {
  const empresaId = getEmpresaId(req);
  const id = num(req.params.id);
  const { nome, descricao, preco_total, sessoes, validade_dias, catalogo_ids, ativo } = req.body;
  const sets: string[] = [];
  if (nome !== undefined) sets.push(`nome = '${esc(nome)}'`);
  if (descricao !== undefined) sets.push(`descricao = ${descricao ? `'${esc(descricao)}'` : "NULL"}`);
  if (preco_total !== undefined) sets.push(`preco_total = ${num(preco_total)}`);
  if (sessoes !== undefined) sets.push(`sessoes = ${num(sessoes) || 1}`);
  if (validade_dias !== undefined) sets.push(`validade_dias = ${validade_dias ? num(validade_dias) : "NULL"}`);
  if (catalogo_ids !== undefined) {
    const cids = Array.isArray(catalogo_ids) ? catalogo_ids.map(num).filter(Boolean).join(",") : "";
    sets.push(`catalogo_ids = ${cids ? `'${esc(cids)}'` : "NULL"}`);
  }
  if (ativo !== undefined) sets.push(`ativo = ${Boolean(ativo)}`);
  if (!sets.length) return res.status(400).json({ error: "nada para atualizar" });
  const r = await db.execute(
    `UPDATE servicos_pacotes SET ${sets.join(", ")} WHERE id = ${id} AND empresa_id = ${empresaId} RETURNING *`
  );
  const row = rows(r)[0];
  if (!row) return res.status(404).json({ error: "not_found" });
  return res.json(row);
});

router.delete("/pacotes/:id", async (req, res) => {
  const empresaId = getEmpresaId(req);
  await db.execute(`DELETE FROM servicos_pacotes WHERE id = ${num(req.params.id)} AND empresa_id = ${empresaId}`);
  return res.json({ ok: true });
});

// ─── AGENDAMENTOS ─────────────────────────────────────────────────────────────
router.get("/agendamentos", async (req, res) => {
  const empresaId = getEmpresaId(req);
  const r = await db.execute(`
    SELECT a.*,
           p.nome AS prestador_nome, p.especialidade AS prestador_especialidade,
           sc.nome AS catalogo_nome, c.nome AS categoria_nome
    FROM agendamentos a
    LEFT JOIN servicos_prestadores p ON p.id = a.prestador_id
    LEFT JOIN servicos_catalogo sc ON sc.id = a.catalogo_id
    LEFT JOIN categorias_servicos c ON c.id = a.categoria_id
    WHERE a.empresa_id = ${empresaId}
    ORDER BY a.data_hora DESC
    LIMIT 100
  `);
  return res.json(rows(r).map((row: any) => ({
    id: row.id,
    status: row.status,
    servicoNome: row.servico_nome || row.catalogo_nome || "Serviço",
    clienteNome: row.cliente_nome,
    clienteTelefone: row.cliente_telefone,
    prestadorNome: row.prestador_nome,
    prestadorEspecialidade: row.prestador_especialidade,
    categoriaNome: row.categoria_nome,
    dataHora: row.data_hora,
    valor: row.valor,
    valorPago: row.valor_pago,
    pagoEm: row.pago_em,
    metodoPagamento: row.metodo_pagamento,
    comissaoGotaxi: row.comissao_gotaxi,
    observacoes: row.observacoes,
    prestadorId: row.prestador_id,
    catalogoId: row.catalogo_id,
    criadoEm: row.criado_em,
  })));
});

router.post("/agendamentos", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const { clienteNome, clienteTelefone, categoriaId, catalogoId, prestadorId, servicoNome, dataHora, valor, observacoes } = req.body;
    if (!clienteNome || !dataHora) return res.status(400).json({ error: "clienteNome e dataHora obrigatórios" });

    let sNome = servicoNome;
    if (!sNome && catalogoId) {
      const r = await db.execute(`SELECT nome FROM servicos_catalogo WHERE id = ${num(catalogoId)}`);
      sNome = rows(r)[0]?.nome || "Serviço";
    }

    const cid = categoriaId ? num(categoriaId) : "NULL";
    const catalogoid = catalogoId ? num(catalogoId) : "NULL";
    const pid = prestadorId ? num(prestadorId) : "NULL";
    const tel = clienteTelefone ? `'${esc(clienteTelefone)}'` : "NULL";
    const val = valor ? num(valor) : "NULL";
    const obs = observacoes ? `'${esc(observacoes)}'` : "NULL";
    const dt = new Date(dataHora).toISOString();

    const r = await db.execute(`
      INSERT INTO agendamentos
        (empresa_id, categoria_id, catalogo_id, prestador_id, cliente_nome, cliente_telefone, servico_nome, data_hora, valor, observacoes, status)
      VALUES
        (${empresaId}, ${cid}, ${catalogoid}, ${pid}, '${esc(clienteNome)}', ${tel}, '${esc(sNome || "Serviço")}', '${dt}', ${val}, ${obs}, 'agendado')
      RETURNING *
    `);
    return res.status(201).json(rows(r)[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

router.put("/agendamentos/:id/status", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const { status } = req.body;
    const valid = ["agendado", "confirmado", "em_andamento", "concluido", "cancelado"];
    if (!valid.includes(status)) return res.status(400).json({ error: "status inválido" });
    const r = await db.execute(
      `UPDATE agendamentos SET status = '${status}' WHERE id = ${num(req.params.id)} AND empresa_id = ${empresaId} RETURNING *`
    );
    const row = rows(r)[0];
    if (!row) return res.status(404).json({ error: "not_found" });
    return res.json(row);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// Registrar pagamento direto → calcula 3% comissão GoTaxi → atualiza repasse
router.post("/agendamentos/:id/pagar", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    const { valor_pago, metodo_pagamento = "pix" } = req.body;
    if (!valor_pago || Number(valor_pago) <= 0) return res.status(400).json({ error: "valor_pago obrigatório" });

    const comissao = parseFloat((Number(valor_pago) * 0.03).toFixed(2));
    const now = new Date().toISOString();

    const r = await db.execute(`
      UPDATE agendamentos SET
        status = 'concluido',
        valor_pago = ${num(valor_pago)},
        pago_em = '${now}',
        metodo_pagamento = '${esc(metodo_pagamento)}',
        comissao_gotaxi = ${comissao}
      WHERE id = ${num(req.params.id)} AND empresa_id = ${empresaId}
      RETURNING *
    `);
    const row = rows(r)[0];
    if (!row) return res.status(404).json({ error: "not_found" });

    await atualizarRepasse(empresaId);

    return res.json({
      agendamento: row,
      comissao_gotaxi: comissao,
      mensagem: `Pagamento de R$ ${Number(valor_pago).toFixed(2)} registrado. Comissão GoTaxi: R$ ${comissao.toFixed(2)} (3%)`,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ─── FINANCEIRO ────────────────────────────────────────────────────────────────
router.get("/financeiro", async (req, res) => {
  const empresaId = getEmpresaId(req);
  const { inicio, fim } = await semanaAtual();
  const semIni = inicio.toISOString().substring(0, 10);
  const now = new Date();
  const mesIni = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [repasses, mes, repasseAtual, metodos] = await Promise.all([
    db.execute(`SELECT * FROM repasses WHERE empresa_id = ${empresaId} ORDER BY semana_inicio DESC LIMIT 8`),
    db.execute(`SELECT COALESCE(SUM(valor_pago),0) AS receita_mes, COUNT(*) FILTER (WHERE status='concluido') AS concluidos_mes
                FROM agendamentos WHERE empresa_id = ${empresaId} AND pago_em >= '${mesIni}'`),
    db.execute(`SELECT * FROM repasses WHERE empresa_id = ${empresaId} AND semana_inicio = '${semIni}'`),
    db.execute(`SELECT metodo_pagamento, COUNT(*) AS qtd, COALESCE(SUM(valor_pago),0) AS total
                FROM agendamentos WHERE empresa_id = ${empresaId}
                  AND pago_em >= '${inicio.toISOString()}' AND pago_em <= '${fim.toISOString()}'
                  AND status = 'concluido'
                GROUP BY metodo_pagamento`),
  ]);

  return res.json({
    repasse_atual: rows(repasseAtual)[0] || null,
    historico_repasses: rows(repasses),
    receita_mes: Number(rows(mes)[0]?.receita_mes || 0),
    concluidos_mes: Number(rows(mes)[0]?.concluidos_mes || 0),
    pagamentos_por_metodo: rows(metodos),
  });
});

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
router.get("/dashboard", async (req, res) => {
  const empresaId = getEmpresaId(req);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1);

  const [agendHoje, totalAgen, prestadores, receita, repassePendente] = await Promise.all([
    db.execute(`SELECT COUNT(*) AS cnt FROM agendamentos WHERE empresa_id = ${empresaId} AND data_hora >= '${hoje.toISOString()}' AND data_hora < '${amanha.toISOString()}'`),
    db.execute(`SELECT COUNT(*) AS cnt FROM agendamentos WHERE empresa_id = ${empresaId}`),
    db.execute(`SELECT COUNT(*) AS cnt FROM servicos_prestadores WHERE empresa_id = ${empresaId} AND ativo = true`),
    db.execute(`SELECT COALESCE(SUM(valor_pago),0) AS total FROM agendamentos WHERE empresa_id = ${empresaId} AND status = 'concluido'`),
    db.execute(`SELECT valor_repasse, status FROM repasses WHERE empresa_id = ${empresaId} AND status = 'pendente' ORDER BY semana_inicio DESC LIMIT 1`),
  ]);

  return res.json({
    agendamentos_hoje: Number(rows(agendHoje)[0]?.cnt ?? 0),
    total_agendamentos: Number(rows(totalAgen)[0]?.cnt ?? 0),
    prestadores_ativos: Number(rows(prestadores)[0]?.cnt ?? 0),
    receita_total: Number(rows(receita)[0]?.total ?? 0),
    repasse_pendente: rows(repassePendente)[0] ? Number(rows(repassePendente)[0].valor_repasse) : 0,
    repasse_status: rows(repassePendente)[0]?.status || null,
  });
});

export default router;
