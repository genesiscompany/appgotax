import { pgTable, serial, text, timestamp, integer, real, boolean, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { empresasTable } from "./empresas";

export const corridasTable = pgTable("corridas", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").references(() => empresasTable.id).notNull(),
  passageiroNome: text("passageiro_nome").notNull(),
  passageiroTelefone: text("passageiro_telefone"),
  origemEndereco: text("origem_endereco").notNull(),
  destinoEndereco: text("destino_endereco").notNull(),
  tipoVeiculo: text("tipo_veiculo").default("economico"),
  formaPagamento: text("forma_pagamento").default("dinheiro"),
  status: text("status").notNull().default("aguardando"),
  valor: real("valor").notNull(),
  distanciaKm: real("distancia_km"),
  latOrigem: real("lat_origem"),
  lngOrigem: real("lng_origem"),
  latDestino: real("lat_destino"),
  lngDestino: real("lng_destino"),
  motoristaNome: text("motorista_nome"),
  motoristaId: integer("motorista_id"),
  motoristaAppId: integer("motorista_app_id"),
  motoristaAppNome: text("motorista_app_nome"),
  avaliacao: real("avaliacao"),
  tempoEsperaMin: integer("tempo_espera_min").default(5),
  observacoes: text("observacoes"),
  canceladoEm: timestamp("cancelado_em"),
  concluidoEm: timestamp("concluido_em"),
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
});

export const insertCorridaSchema = createInsertSchema(corridasTable).omit({ id: true, criadoEm: true });
export type InsertCorrida = z.infer<typeof insertCorridaSchema>;
export type Corrida = typeof corridasTable.$inferSelect;

// ── Motoristas App (passageiro transport drivers) ─────────────────────────────
export const motoristasAppTable = pgTable("motoristas_app", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  cpf: text("cpf"),
  telefone: text("telefone").notNull(),
  email: text("email"),
  senhaPin: text("senha_pin"),
  foto: text("foto"),
  status: text("status").notNull().default("pendente"),
  cidade: text("cidade"),
  estado: text("estado"),
  veiculoMarca: text("veiculo_marca"),
  veiculoModelo: text("veiculo_modelo"),
  veiculoAno: integer("veiculo_ano"),
  veiculoCor: text("veiculo_cor"),
  veiculoPlaca: text("veiculo_placa"),
  tipoVeiculo: text("tipo_veiculo").default("economico"),
  docCnh: text("doc_cnh"),
  docCnhStatus: text("doc_cnh_status").default("pendente"),
  docVeiculo: text("doc_veiculo"),
  docVeiculoStatus: text("doc_veiculo_status").default("pendente"),
  docSelfie: text("doc_selfie"),
  docSelfieStatus: text("doc_selfie_status").default("pendente"),
  ativo: boolean("ativo").default(true),
  percentualRepasse: real("percentual_repasse").default(20),
  saldo: real("saldo").default(0),
  totalGanhos: real("total_ganhos").default(0),
  totalCorridas: integer("total_corridas").default(0),
  avaliacaoMedia: real("avaliacao_media").default(0),
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
  atualizadoEm: timestamp("atualizado_em").notNull().defaultNow(),
  // Extended fields added via SQL
  tipoProfissional: text("tipo_profissional").notNull().default("motorista"),
  docAntecedentes: text("doc_antecedentes"),
  docAntecedentesStatus: text("doc_antecedentes_status").notNull().default("pendente"),
  docRg: text("doc_rg"),
  docRgStatus: text("doc_rg_status").notNull().default("pendente"),
  statusRepasse: text("status_repasse").notNull().default("ok"),
  fcmToken: text("fcm_token"),
  pixTipo: text("pix_tipo").default("cpf"),
  pixChave: text("pix_chave"),
  pixImagemUrl: text("pix_imagem_url"),
  online: boolean("online").notNull().default(false),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  ultimoPing: timestamp("ultimo_ping"),
});

export type MotoristaApp = typeof motoristasAppTable.$inferSelect;
