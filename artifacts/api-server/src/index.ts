import app from "./app";
import { db } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function runStartupMigrations() {
  const migrations = [
    // Unique constraints needed for ON CONFLICT (empresa_id) upserts
    `ALTER TABLE restaurantes ADD CONSTRAINT restaurantes_empresa_id_unique UNIQUE (empresa_id)`,
    `ALTER TABLE config_entrega_pdv ADD CONSTRAINT config_entrega_pdv_empresa_id_unique UNIQUE (empresa_id)`,
    `ALTER TABLE config_pagamento_pdv ADD CONSTRAINT config_pagamento_pdv_empresa_id_unique UNIQUE (empresa_id)`,
    `ALTER TABLE config_ecommerce_pdv ADD CONSTRAINT config_ecommerce_pdv_empresa_id_unique UNIQUE (empresa_id)`,
    `ALTER TABLE repasses ADD CONSTRAINT repasses_empresa_semana_unique UNIQUE (empresa_id, semana_inicio)`,
    `ALTER TABLE entregas ALTER COLUMN empresa_id DROP NOT NULL`,
    `ALTER TABLE entregas ALTER COLUMN valor DROP NOT NULL`,
    `ALTER TABLE entregas ALTER COLUMN destinatario_nome DROP NOT NULL`,

    // ── Caronas (BlaBlaCar-like ride-sharing) ────────────────────────────────
    `CREATE TABLE IF NOT EXISTS carona_veiculos (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER NOT NULL,
      modelo VARCHAR(120) NOT NULL,
      placa VARCHAR(20),
      ano INTEGER,
      cor VARCHAR(60),
      vagas INTEGER NOT NULL DEFAULT 4,
      combustivel VARCHAR(20) DEFAULT 'gasolina',
      consumo_km_l NUMERIC(6,2) DEFAULT 10,
      observacoes TEXT,
      ativo BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS caronas (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER NOT NULL,
      veiculo_id INTEGER,
      origem VARCHAR(200) NOT NULL,
      destino VARCHAR(200) NOT NULL,
      distancia_km INTEGER,
      data_viagem DATE NOT NULL,
      hora_partida TIME NOT NULL,
      vagas_total INTEGER NOT NULL DEFAULT 3,
      vagas_ocupadas INTEGER DEFAULT 0,
      valor_por_vaga NUMERIC(10,2) NOT NULL DEFAULT 0,
      tipo VARCHAR(20) DEFAULT 'com_paradas',
      status VARCHAR(20) DEFAULT 'ativa',
      observacoes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS carona_paradas (
      id SERIAL PRIMARY KEY,
      carona_id INTEGER NOT NULL,
      cidade VARCHAR(200) NOT NULL,
      hora_prevista TIME,
      ordem INTEGER NOT NULL DEFAULT 0,
      aceita_embarque BOOLEAN DEFAULT true,
      aceita_desembarque BOOLEAN DEFAULT true
    )`,
    // ── Afiliados program tables ─────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS afiliados (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL UNIQUE,
      codigo VARCHAR(20) NOT NULL UNIQUE,
      status VARCHAR(20) NOT NULL DEFAULT 'ativo',
      saldo NUMERIC(10,2) NOT NULL DEFAULT 0,
      total_indicados INTEGER NOT NULL DEFAULT 0,
      total_ganhos NUMERIC(10,2) NOT NULL DEFAULT 0,
      total_comissoes NUMERIC(10,2) NOT NULL DEFAULT 0,
      percentual_comissao NUMERIC(5,2) NOT NULL DEFAULT 10,
      chave_pix VARCHAR(255),
      tipo_pessoa VARCHAR(20) DEFAULT 'fisica',
      banco_nome VARCHAR(100),
      criado_em TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS afiliado_indicacoes (
      id SERIAL PRIMARY KEY,
      afiliado_id INTEGER NOT NULL REFERENCES afiliados(id),
      nome_indicado VARCHAR(200),
      email_indicado VARCHAR(255),
      tipo_indicado VARCHAR(20) DEFAULT 'usuario',
      tipo_dispositivo VARCHAR(20),
      status VARCHAR(20) NOT NULL DEFAULT 'pendente',
      bonus_valor NUMERIC(10,2) NOT NULL DEFAULT 0,
      criado_em TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS afiliado_resgates (
      id SERIAL PRIMARY KEY,
      afiliado_id INTEGER NOT NULL REFERENCES afiliados(id),
      valor NUMERIC(10,2) NOT NULL,
      chave_pix VARCHAR(255),
      status VARCHAR(20) NOT NULL DEFAULT 'pendente',
      observacao TEXT,
      processado_em TIMESTAMP,
      processado_por VARCHAR(100),
      criado_em TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS afiliado_comissoes (
      id SERIAL PRIMARY KEY,
      afiliado_id INTEGER NOT NULL REFERENCES afiliados(id),
      indicado_id INTEGER REFERENCES afiliado_indicacoes(id),
      tipo_evento VARCHAR(50) NOT NULL DEFAULT 'pedido',
      valor_transacao NUMERIC(10,2) NOT NULL DEFAULT 0,
      percentual NUMERIC(5,2) NOT NULL DEFAULT 10,
      valor_comissao NUMERIC(10,2) NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'pendente',
      referencia_id INTEGER,
      descricao TEXT,
      criado_em TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS afiliados_config (
      id SERIAL PRIMARY KEY,
      percentual_comissao NUMERIC(5,2) NOT NULL DEFAULT 10,
      valor_minimo_saque NUMERIC(10,2) NOT NULL DEFAULT 50,
      ativo BOOLEAN NOT NULL DEFAULT true,
      atualizado_em TIMESTAMP NOT NULL DEFAULT NOW(),
      atualizado_por VARCHAR(100)
    )`,
    `INSERT INTO afiliados_config (percentual_comissao, valor_minimo_saque)
     SELECT 10, 50 WHERE NOT EXISTS (SELECT 1 FROM afiliados_config)`,
    // Upgrade columns for existing afiliados tables
    `ALTER TABLE afiliados ADD COLUMN IF NOT EXISTS percentual_comissao NUMERIC(5,2) NOT NULL DEFAULT 10`,
    `ALTER TABLE afiliados ADD COLUMN IF NOT EXISTS chave_pix VARCHAR(255)`,
    `ALTER TABLE afiliados ADD COLUMN IF NOT EXISTS tipo_pessoa VARCHAR(20) DEFAULT 'fisica'`,
    `ALTER TABLE afiliados ADD COLUMN IF NOT EXISTS banco_nome VARCHAR(100)`,
    `ALTER TABLE afiliados ADD COLUMN IF NOT EXISTS total_comissoes NUMERIC(10,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE afiliado_indicacoes ADD COLUMN IF NOT EXISTS tipo_indicado VARCHAR(20) DEFAULT 'usuario'`,
    `ALTER TABLE afiliado_indicacoes ADD COLUMN IF NOT EXISTS tipo_dispositivo VARCHAR(20)`,
    `ALTER TABLE afiliado_indicacoes ADD COLUMN IF NOT EXISTS email_indicado VARCHAR(255)`,
    `ALTER TABLE afiliado_resgates ADD COLUMN IF NOT EXISTS processado_em TIMESTAMP`,
    `ALTER TABLE afiliado_resgates ADD COLUMN IF NOT EXISTS processado_por VARCHAR(100)`,
    `ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS afiliado_origem_codigo VARCHAR(20)`,
    `ALTER TABLE empresas ADD COLUMN IF NOT EXISTS afiliado_origem_codigo VARCHAR(20)`,

    `CREATE TABLE IF NOT EXISTS configuracoes_sistema (
      chave VARCHAR(100) PRIMARY KEY,
      valor TEXT NOT NULL DEFAULT '',
      atualizado_em TIMESTAMP DEFAULT NOW()
    )`,
    `INSERT INTO configuracoes_sistema (chave, valor) VALUES
      ('politica_privacidade', ''),
      ('termos_de_uso', ''),
      ('afiliados_descricao', 'O programa de afiliados GoTaxi Brasil Plus permite que você ganhe comissões indicando novos usuários para a plataforma.'),
      ('afiliados_como_funciona', 'Compartilhe seu link único, seus indicados se cadastram e usam o app, e você ganha 10% do lucro GoTaxi gerado por eles.'),
      ('afiliados_prazo_pagamento_dias', '3'),
      ('afiliados_requisitos', 'Ter conta ativa no GoTaxi Brasil Plus. Não há limite de indicações.')
    ON CONFLICT (chave) DO NOTHING`,

    `CREATE TABLE IF NOT EXISTS carona_reservas (
      id SERIAL PRIMARY KEY,
      carona_id INTEGER NOT NULL,
      passageiro_nome VARCHAR(200) NOT NULL,
      passageiro_telefone VARCHAR(30),
      passageiro_cpf VARCHAR(20),
      parada_embarque VARCHAR(200),
      parada_desembarque VARCHAR(200),
      valor NUMERIC(10,2) NOT NULL DEFAULT 0,
      forma_pagamento VARCHAR(30) DEFAULT 'pix',
      status VARCHAR(20) DEFAULT 'confirmada',
      observacoes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    // ── Sistema de referral universal ─────────────────────────────────────────
    `ALTER TABLE motoristas_app ADD COLUMN IF NOT EXISTS codigo_referral VARCHAR(20) UNIQUE`,
    `ALTER TABLE motoristas_app ADD COLUMN IF NOT EXISTS indicado_por VARCHAR(20)`,
    `UPDATE motoristas_app SET codigo_referral = UPPER(LEFT(REGEXP_REPLACE(nome, '[^A-Za-z0-9]', '', 'g'), 4)) || LPAD(id::text, 4, '0') WHERE codigo_referral IS NULL`,

    `ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS codigo_referral VARCHAR(20) UNIQUE`,
    `ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS indicado_por VARCHAR(20)`,
    `UPDATE usuarios SET codigo_referral = UPPER(LEFT(REGEXP_REPLACE(nome, '[^A-Za-z0-9]', '', 'g'), 4)) || LPAD(id::text, 4, '0') WHERE codigo_referral IS NULL`,

    // Reclassifica usuarios papel='admin' que na verdade são parceiros do PDV.
    // Critério: tem empresa_id e a empresa NÃO é a "GoTaxi Sistema" (id=1).
    // Exceção: admin@gotaxi.com nunca é rebaixado (super-admin real).
    // Idempotente: roda em todo boot mas só atualiza quem ainda tiver papel='admin'.
    `UPDATE usuarios SET papel = 'parceiro'
       WHERE papel = 'admin'
         AND email <> 'admin@gotaxi.com'
         AND empresa_id IS NOT NULL
         AND empresa_id <> 1`,

    `ALTER TABLE empresas ADD COLUMN IF NOT EXISTS indicado_por VARCHAR(20)`,
    `ALTER TABLE motoristas_app ADD COLUMN IF NOT EXISTS email VARCHAR(255)`,

    `ALTER TABLE produtos_pdv ADD COLUMN IF NOT EXISTS tamanhos JSONB`,

    `ALTER TABLE entregas ADD COLUMN IF NOT EXISTS categoria VARCHAR(50)`,
    `ALTER TABLE entregas ADD COLUMN IF NOT EXISTS distancia_km NUMERIC(8,2)`,
    `ALTER TABLE entregas ADD COLUMN IF NOT EXISTS coleta_lat NUMERIC(10,6)`,
    `ALTER TABLE entregas ADD COLUMN IF NOT EXISTS coleta_lng NUMERIC(10,6)`,
    `ALTER TABLE entregas ADD COLUMN IF NOT EXISTS entrega_lat NUMERIC(10,6)`,
    `ALTER TABLE entregas ADD COLUMN IF NOT EXISTS entrega_lng NUMERIC(10,6)`,
    `ALTER TABLE entregas ADD COLUMN IF NOT EXISTS motorista_id INTEGER`,
    `ALTER TABLE entregas_solicitadas ADD COLUMN IF NOT EXISTS entrega_id INTEGER`,

    // ── Reconciliação caronas: aceita NULL (dados antigos sem empresa) ───────
    `UPDATE caronas SET empresa_id = 1 WHERE empresa_id IS NULL`,
    `ALTER TABLE caronas ALTER COLUMN empresa_id DROP NOT NULL`,
    `ALTER TABLE carona_veiculos ALTER COLUMN empresa_id DROP NOT NULL`,

    // ── Cadastro de empresas para Plataforma Corporativa ─────────────────────
    `CREATE TABLE IF NOT EXISTS empresas_corporativas_pendentes (
      id SERIAL PRIMARY KEY,
      nome_fantasia VARCHAR(200) NOT NULL,
      razao_social VARCHAR(200),
      cnpj VARCHAR(20) NOT NULL,
      email_empresa VARCHAR(200) NOT NULL,
      telefone_empresa VARCHAR(40),
      cep VARCHAR(15),
      endereco_rua VARCHAR(200),
      endereco_numero VARCHAR(20),
      endereco_complemento VARCHAR(100),
      endereco_bairro VARCHAR(120),
      endereco_cidade VARCHAR(120),
      endereco_estado VARCHAR(4),
      responsavel_nome VARCHAR(200),
      responsavel_cpf VARCHAR(20),
      responsavel_cargo VARCHAR(120),
      responsavel_email VARCHAR(200),
      responsavel_telefone VARCHAR(40),
      qtde_funcionarios INTEGER,
      limite_credito NUMERIC(12,2) DEFAULT 0,
      observacoes TEXT,
      origem VARCHAR(20) DEFAULT 'admin',
      afiliado_id INTEGER,
      status VARCHAR(20) DEFAULT 'pendente',
      empresa_id_aprovada INTEGER,
      usuario_id_aprovado INTEGER,
      login_pdv VARCHAR(200),
      senha_pdv VARCHAR(80),
      motivo_rejeicao TEXT,
      criado_em TIMESTAMP DEFAULT NOW(),
      decidido_em TIMESTAMP,
      decidido_por INTEGER
    )`,
    `CREATE INDEX IF NOT EXISTS idx_empresas_corp_pendentes_status ON empresas_corporativas_pendentes (status)`,
    `CREATE INDEX IF NOT EXISTS idx_empresas_corp_pendentes_afiliado ON empresas_corporativas_pendentes (afiliado_id)`,

    // ── Despacho de corridas corporativas ────────────────────────────────────
    // Raio de busca de motoristas para corridas corporativas (km), default 10.
    `ALTER TABLE configuracoes_plataforma ADD COLUMN IF NOT EXISTS raio_busca_motorista_km NUMERIC(6,2) DEFAULT 10`,
    // Liga pro_corridas (corporativa) à corrida real despachada e conta motoristas notificados.
    `ALTER TABLE pro_corridas ADD COLUMN IF NOT EXISTS corrida_id INTEGER`,
    `ALTER TABLE pro_corridas ADD COLUMN IF NOT EXISTS motoristas_chamados INTEGER DEFAULT 0`,
    `ALTER TABLE pro_corridas ADD COLUMN IF NOT EXISTS chamado_em TIMESTAMP`,

    // ── Repasses semanais das empresas corporativas para a GoTaxi ────────────
    // Cada linha representa o débito de uma semana (segunda→domingo) que a
    // empresa corporativa deve pagar para a GoTaxi via PIX (vencimento: segunda-feira 18h).
    `CREATE TABLE IF NOT EXISTS repasses_corporativos (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER NOT NULL,
      semana_inicio DATE NOT NULL,
      semana_fim DATE NOT NULL,
      total_corridas INTEGER NOT NULL DEFAULT 0,
      valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'pendente',
      vencimento DATE,
      pago_em TIMESTAMP,
      comprovante_url VARCHAR(500),
      observacoes TEXT,
      criado_em TIMESTAMP DEFAULT NOW(),
      atualizado_em TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_repasses_corp_empresa_semana ON repasses_corporativos (empresa_id, semana_inicio)`,
    `CREATE INDEX IF NOT EXISTS idx_repasses_corp_status ON repasses_corporativos (status)`,

    // ── Despacho de delivery PDV (alimentação) — broadcast a todos motoboys ─
    // Raio de busca de motoboys (km) para auto-despacho do PDV de alimentação. Default 5km.
    `ALTER TABLE config_entrega_pdv ADD COLUMN IF NOT EXISTS raio_motoboy_km NUMERIC(6,2) DEFAULT 5`,
    // Liga uma entrega solicitada a um pedido do PDV (food delivery), não a uma entrega comum.
    `ALTER TABLE entregas_solicitadas ADD COLUMN IF NOT EXISTS pedido_pdv_id INTEGER`,
    `ALTER TABLE entregas_solicitadas ADD COLUMN IF NOT EXISTS empresa_id INTEGER`,
    `CREATE INDEX IF NOT EXISTS idx_entregas_solic_pedido_pdv ON entregas_solicitadas (pedido_pdv_id) WHERE pedido_pdv_id IS NOT NULL`,

    // ── Chat cliente ↔ lojista ────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS chat_conversas (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER NOT NULL,
      cliente_nome TEXT NOT NULL DEFAULT 'Cliente',
      cliente_token TEXT,
      ultima_mensagem TEXT,
      ultima_at TIMESTAMPTZ DEFAULT NOW(),
      nao_lidas_loja INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_chat_conversas_empresa ON chat_conversas (empresa_id)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_conversas_token ON chat_conversas (cliente_token)`,
    `CREATE TABLE IF NOT EXISTS chat_mensagens (
      id SERIAL PRIMARY KEY,
      conversa_id INTEGER NOT NULL REFERENCES chat_conversas(id) ON DELETE CASCADE,
      remetente TEXT NOT NULL CHECK (remetente IN ('cliente', 'loja')),
      mensagem TEXT NOT NULL,
      lida BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_chat_mensagens_conversa ON chat_mensagens (conversa_id, created_at)`,

    // ── Financeiro PDV ────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS financeiro_lancamentos (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('receita','despesa')),
      valor NUMERIC(12,2) NOT NULL,
      descricao TEXT NOT NULL,
      categoria TEXT NOT NULL DEFAULT 'outros',
      data DATE NOT NULL DEFAULT CURRENT_DATE,
      observacoes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_fin_lanc_empresa ON financeiro_lancamentos (empresa_id, data)`,

    // ── Suporte lojista ↔ super admin (com IA) ───────────────────────────────
    `CREATE TABLE IF NOT EXISTS suporte_tickets (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER NOT NULL,
      empresa_nome TEXT NOT NULL DEFAULT '',
      titulo TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_andamento','resolvido','fechado')),
      prioridade TEXT NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('baixa','normal','alta','urgente')),
      categoria TEXT NOT NULL DEFAULT 'geral',
      nao_lidas_admin INTEGER NOT NULL DEFAULT 0,
      nao_lidas_loja INTEGER NOT NULL DEFAULT 0,
      ultima_mensagem TEXT,
      ultima_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_suporte_tickets_empresa ON suporte_tickets (empresa_id)`,
    `DROP INDEX IF EXISTS idx_suporte_tickets_status`,
    `CREATE INDEX IF NOT EXISTS idx_suporte_tickets_status ON suporte_tickets (status, ultima_at)`,
    `CREATE TABLE IF NOT EXISTS suporte_mensagens (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER NOT NULL REFERENCES suporte_tickets(id) ON DELETE CASCADE,
      remetente TEXT NOT NULL CHECK (remetente IN ('loja','admin','ia')),
      mensagem TEXT NOT NULL,
      lida BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_suporte_mens_ticket ON suporte_mensagens (ticket_id, created_at)`,

    // ── Fornecedores e Compras ───────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS fornecedores (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER NOT NULL,
      nome VARCHAR(200) NOT NULL,
      categoria VARCHAR(50) NOT NULL DEFAULT 'geral',
      telefone VARCHAR(30),
      email VARCHAR(120),
      observacoes TEXT,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS compras (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER NOT NULL,
      fornecedor_id INTEGER REFERENCES fornecedores(id) ON DELETE SET NULL,
      fornecedor_nome TEXT NOT NULL DEFAULT '',
      data_compra DATE NOT NULL DEFAULT CURRENT_DATE,
      total NUMERIC(12,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pago' CHECK (status IN ('pago','pendente','cancelado')),
      observacoes TEXT,
      lancamento_id INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS compras_itens (
      id SERIAL PRIMARY KEY,
      compra_id INTEGER NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
      produto VARCHAR(200) NOT NULL,
      quantidade NUMERIC(10,3) NOT NULL DEFAULT 1,
      unidade VARCHAR(20) NOT NULL DEFAULT 'un',
      valor_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
      subtotal NUMERIC(12,2) NOT NULL DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_fornecedores_empresa ON fornecedores (empresa_id)`,
    `DROP INDEX IF EXISTS idx_compras_empresa`,
    `CREATE INDEX IF NOT EXISTS idx_compras_empresa ON compras (empresa_id, data_compra)`,

    // ── Comprovante PIX nos pedidos ──────────────────────────────────────────
    `ALTER TABLE pedidos_pdv ADD COLUMN IF NOT EXISTS comprovante_pix TEXT`,
    `ALTER TABLE ecommerce_pedidos ADD COLUMN IF NOT EXISTS comprovante_pix TEXT`,

    // ── Configurações globais (chave/valor) ──────────────────────────────────
    `CREATE TABLE IF NOT EXISTS gotatxi_config (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `INSERT INTO gotatxi_config (chave, valor) VALUES ('ia_suporte_prompt', 'Você é o assistente virtual de suporte da GoTaxi, uma plataforma SaaS de gestão para lojistas e parceiros (restaurantes, delivery, e-commerce, mototaxistas etc.).\n\nVocê responde dúvidas dos lojistas de forma clara, objetiva e em português do Brasil.\n\nTópicos que você conhece:\n- PDV (painel do parceiro): pedidos, cardápio, produtos, pagamentos, configurações\n- Financeiro: como interpretar relatórios, lançamentos, receitas e despesas\n- Chat com clientes: como responder, quando aparecem as mensagens\n- Módulos disponíveis: Food Delivery, E-commerce, Motoristas, Encomendas, Caronas\n- Conta e acesso: senha, email, perfil, planos\n- Integrações: Google Maps, métodos de pagamento\n\nQuando não souber a resposta com certeza, diga que vai verificar e que um atendente humano irá ajudar em breve.\n\nSeja sempre cordial, use no máximo 3 parágrafos curtos por resposta e nunca peça dados sensíveis como senhas.') ON CONFLICT (chave) DO NOTHING`,
  ];

  for (const sql of migrations) {
    try {
      await db.execute(sql as any);
    } catch (_e: any) {
      // Constraint already exists — safe to ignore
    }
  }
  console.log("Startup migrations done");
}

runStartupMigrations().then(() => {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}).catch((err) => {
  console.error("Startup migration failed:", err);
  app.listen(port, () => {
    console.log(`Server listening on port ${port} (migrations skipped)`);
  });
});
