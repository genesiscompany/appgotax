import { pgTable, serial, text, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { empresasTable } from "./empresas";

export const rotasTable = pgTable("rotas", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").references(() => empresasTable.id).notNull(),
  origem: text("origem").notNull(),
  destino: text("destino").notNull(),
  horarioPartida: text("horario_partida").notNull(),
  horarioChegada: text("horario_chegada").notNull(),
  preco: real("preco").notNull(),
  assentosDisponiveis: integer("assentos_disponiveis").notNull(),
  totalAssentos: integer("total_assentos").notNull(),
  empresa: text("empresa_nome"),
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
  // Extended fields added via SQL
  status: text("status").notNull().default("ativo"),
  plano: text("plano").notNull().default("free"),
  taxaComissao: real("taxa_comissao").notNull().default(8),
  tipo: text("tipo").notNull().default("rodoviaria"),
  telefone: text("telefone"),
  email: text("email"),
  responsavel: text("responsavel"),
  cnpj: text("cnpj"),
  cidade: text("cidade"),
  estado: text("estado"),
  docCnpj: text("doc_cnpj"),
  docCnpjStatus: text("doc_cnpj_status").notNull().default("pendente"),
  docCnh: text("doc_cnh"),
  docCnhStatus: text("doc_cnh_status").notNull().default("pendente"),
  docCrlv: text("doc_crlv"),
  docCrlvStatus: text("doc_crlv_status").notNull().default("pendente"),
  docSelfie: text("doc_selfie"),
  docSelfieStatus: text("doc_selfie_status").notNull().default("pendente"),
});

export const reservasTable = pgTable("reservas", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").references(() => empresasTable.id).notNull(),
  rotaId: integer("rota_id").references(() => rotasTable.id).notNull(),
  passageiroNome: text("passageiro_nome").notNull(),
  passageiroDocumento: text("passageiro_documento"),
  passageiroTelefone: text("passageiro_telefone"),
  assento: text("assento"),
  status: text("status").notNull().default("pendente"),
  total: real("total").notNull(),
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
});

export const insertRotaSchema = createInsertSchema(rotasTable).omit({ id: true, criadoEm: true });
export const insertReservaSchema = createInsertSchema(reservasTable).omit({ id: true, criadoEm: true });
export type InsertRota = z.infer<typeof insertRotaSchema>;
export type InsertReserva = z.infer<typeof insertReservaSchema>;
export type Rota = typeof rotasTable.$inferSelect;
export type Reserva = typeof reservasTable.$inferSelect;
