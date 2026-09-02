CREATE TABLE "empresas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"codigo" text NOT NULL,
	"logo" text,
	"cor_primaria" text DEFAULT '#007AFF' NOT NULL,
	"plano" text DEFAULT 'basico' NOT NULL,
	"taxa_app" real DEFAULT 3,
	"modulos_ativos" json DEFAULT '[]'::json NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "empresas_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"senha_hash" text NOT NULL,
	"telefone" text,
	"avatar" text,
	"papel" text DEFAULT 'cliente' NOT NULL,
	"empresa_id" integer NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	"endereco" text,
	"forma_pagamento" text,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "corridas" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"passageiro_nome" text NOT NULL,
	"passageiro_telefone" text,
	"origem_endereco" text NOT NULL,
	"destino_endereco" text NOT NULL,
	"tipo_veiculo" text DEFAULT 'economico',
	"forma_pagamento" text DEFAULT 'dinheiro',
	"status" text DEFAULT 'aguardando' NOT NULL,
	"valor" real NOT NULL,
	"distancia_km" real,
	"lat_origem" real,
	"lng_origem" real,
	"lat_destino" real,
	"lng_destino" real,
	"motorista_nome" text,
	"motorista_id" integer,
	"avaliacao" real,
	"tempo_espera_min" integer DEFAULT 5,
	"observacoes" text,
	"cancelado_em" timestamp,
	"concluido_em" timestamp,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "motoristas_app" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"cpf" text,
	"telefone" text NOT NULL,
	"email" text,
	"senha_hash" text,
	"foto" text,
	"status" text DEFAULT 'pendente' NOT NULL,
	"cidade" text,
	"estado" text,
	"veiculo_marca" text,
	"veiculo_modelo" text,
	"veiculo_ano" integer,
	"veiculo_cor" text,
	"veiculo_placa" text,
	"tipo_veiculo" text DEFAULT 'economico',
	"doc_cnh" text,
	"doc_cnh_status" text DEFAULT 'pendente',
	"doc_veiculo" text,
	"doc_veiculo_status" text DEFAULT 'pendente',
	"doc_selfie" text,
	"doc_selfie_status" text DEFAULT 'pendente',
	"ativo" boolean DEFAULT true,
	"percentual_repasse" real DEFAULT 20,
	"saldo" real DEFAULT 0,
	"total_ganhos" real DEFAULT 0,
	"total_corridas" integer DEFAULT 0,
	"avaliacao_media" real DEFAULT 0,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	"atualizado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pedidos" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"cliente_nome" text NOT NULL,
	"cliente_telefone" text,
	"itens" json DEFAULT '[]'::json NOT NULL,
	"total" real NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"endereco_entrega" text,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "produtos" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"preco" real NOT NULL,
	"preco_promocional" real,
	"estoque" integer DEFAULT 0 NOT NULL,
	"categoria" text NOT NULL,
	"imagem" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agendamentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"categoria_id" integer,
	"catalogo_id" integer,
	"prestador_id" integer,
	"cliente_nome" text NOT NULL,
	"cliente_telefone" text,
	"servico_nome" text NOT NULL,
	"prestador_nome" text,
	"data_hora" timestamp NOT NULL,
	"status" text DEFAULT 'agendado' NOT NULL,
	"valor" real,
	"valor_pago" numeric(10, 2),
	"pago_em" timestamp,
	"metodo_pagamento" text,
	"comissao_gotaxi" numeric(10, 2),
	"observacoes" text,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categorias_servicos" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"nome" text NOT NULL,
	"icone" text,
	"cor" text
);
--> statement-breakpoint
CREATE TABLE "servicos_catalogo" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"prestador_id" integer,
	"categoria_id" integer,
	"nome" text NOT NULL,
	"descricao" text,
	"duracao_minutos" integer DEFAULT 60 NOT NULL,
	"preco" numeric(10, 2) NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "servicos_prestadores" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"nome" text NOT NULL,
	"especialidade" text,
	"telefone" text,
	"email" text,
	"bio" text,
	"avatar_url" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"bloqueado" boolean DEFAULT false NOT NULL,
	"motivo_bloqueio" text,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservas" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"rota_id" integer NOT NULL,
	"passageiro_nome" text NOT NULL,
	"passageiro_documento" text,
	"passageiro_telefone" text,
	"assento" text,
	"status" text DEFAULT 'pendente' NOT NULL,
	"total" real NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rotas" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"origem" text NOT NULL,
	"destino" text NOT NULL,
	"horario_partida" text NOT NULL,
	"horario_chegada" text NOT NULL,
	"preco" real NOT NULL,
	"assentos_disponiveis" integer NOT NULL,
	"total_assentos" integer NOT NULL,
	"empresa_nome" text,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entregas" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"remetente_nome" text NOT NULL,
	"remetente_telefone" text,
	"destinatario_nome" text NOT NULL,
	"destinatario_telefone" text,
	"endereco_coleta" text NOT NULL,
	"endereco_entrega" text NOT NULL,
	"descricao_pacote" text,
	"status" text DEFAULT 'aguardando' NOT NULL,
	"entregador_nome" text,
	"valor" real NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itens_cardapio" (
	"id" serial PRIMARY KEY NOT NULL,
	"restaurante_id" integer NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"preco" real NOT NULL,
	"categoria" text NOT NULL,
	"imagem" text,
	"disponivel" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurantes" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"categoria" text NOT NULL,
	"tempo_entrega_min" integer DEFAULT 30 NOT NULL,
	"avaliacao_media" real,
	"taxa_entrega" real DEFAULT 0 NOT NULL,
	"aberto" boolean DEFAULT true NOT NULL,
	"imagem" text,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itens_pedido_pdv" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedido_id" integer NOT NULL,
	"produto_nome" text NOT NULL,
	"quantidade" integer DEFAULT 1 NOT NULL,
	"preco_unitario" real NOT NULL,
	"total" real NOT NULL,
	"observacoes" text
);
--> statement-breakpoint
CREATE TABLE "pedidos_pdv" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"modulo" text DEFAULT 'food' NOT NULL,
	"tipo" text DEFAULT 'delivery' NOT NULL,
	"status" text DEFAULT 'novo' NOT NULL,
	"cliente_nome" text NOT NULL,
	"cliente_whatsapp" text,
	"cliente_endereco" text,
	"mesa" text,
	"total" real DEFAULT 0 NOT NULL,
	"observacoes" text,
	"forma_pagamento" text DEFAULT 'pix',
	"taxa_entrega" real DEFAULT 0,
	"distancia_km" real,
	"boy_id" integer,
	"confirmado_em" timestamp,
	"preparando_em" timestamp,
	"pronto_em" timestamp,
	"entregue_em" timestamp,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	"atualizado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corridas" ADD CONSTRAINT "corridas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_categoria_id_categorias_servicos_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_servicos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_catalogo_id_servicos_catalogo_id_fk" FOREIGN KEY ("catalogo_id") REFERENCES "public"."servicos_catalogo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_prestador_id_servicos_prestadores_id_fk" FOREIGN KEY ("prestador_id") REFERENCES "public"."servicos_prestadores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorias_servicos" ADD CONSTRAINT "categorias_servicos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servicos_catalogo" ADD CONSTRAINT "servicos_catalogo_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servicos_catalogo" ADD CONSTRAINT "servicos_catalogo_prestador_id_servicos_prestadores_id_fk" FOREIGN KEY ("prestador_id") REFERENCES "public"."servicos_prestadores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servicos_catalogo" ADD CONSTRAINT "servicos_catalogo_categoria_id_categorias_servicos_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_servicos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servicos_prestadores" ADD CONSTRAINT "servicos_prestadores_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_rota_id_rotas_id_fk" FOREIGN KEY ("rota_id") REFERENCES "public"."rotas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotas" ADD CONSTRAINT "rotas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entregas" ADD CONSTRAINT "entregas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itens_cardapio" ADD CONSTRAINT "itens_cardapio_restaurante_id_restaurantes_id_fk" FOREIGN KEY ("restaurante_id") REFERENCES "public"."restaurantes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurantes" ADD CONSTRAINT "restaurantes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itens_pedido_pdv" ADD CONSTRAINT "itens_pedido_pdv_pedido_id_pedidos_pdv_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos_pdv"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos_pdv" ADD CONSTRAINT "pedidos_pdv_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;