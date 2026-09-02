import { pgTable, serial, text, timestamp, integer, real, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { empresasTable } from "./empresas";

export const categoriasServicosTable = pgTable("categorias_servicos", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").references(() => empresasTable.id).notNull(),
  nome: text("nome").notNull(),
  icone: text("icone"),
  cor: text("cor"),
});

export const servicosPrestadoresTable = pgTable("servicos_prestadores", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").references(() => empresasTable.id).notNull(),
  nome: text("nome").notNull(),
  especialidade: text("especialidade"),
  telefone: text("telefone"),
  email: text("email"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  ativo: boolean("ativo").notNull().default(true),
  bloqueado: boolean("bloqueado").notNull().default(false),
  motivoBloqueio: text("motivo_bloqueio"),
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
});

export const servicosCatalogoTable = pgTable("servicos_catalogo", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").references(() => empresasTable.id).notNull(),
  prestadorId: integer("prestador_id").references(() => servicosPrestadoresTable.id),
  categoriaId: integer("categoria_id").references(() => categoriasServicosTable.id),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  duracaoMinutos: integer("duracao_minutos").notNull().default(60),
  preco: numeric("preco", { precision: 10, scale: 2 }).notNull(),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
});

export const agendamentosTable = pgTable("agendamentos", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").references(() => empresasTable.id).notNull(),
  categoriaId: integer("categoria_id").references(() => categoriasServicosTable.id),
  catalogoId: integer("catalogo_id").references(() => servicosCatalogoTable.id),
  prestadorId: integer("prestador_id").references(() => servicosPrestadoresTable.id),
  clienteNome: text("cliente_nome").notNull(),
  clienteTelefone: text("cliente_telefone"),
  servicoNome: text("servico_nome").notNull(),
  prestadorNome: text("prestador_nome"),
  dataHora: timestamp("data_hora").notNull(),
  status: text("status").notNull().default("agendado"),
  valor: real("valor"),
  valorPago: numeric("valor_pago", { precision: 10, scale: 2 }),
  pagoEm: timestamp("pago_em"),
  metodoPagamento: text("metodo_pagamento"),
  comissaoGotaxi: numeric("comissao_gotaxi", { precision: 10, scale: 2 }),
  observacoes: text("observacoes"),
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
});

export const insertCategoriaServicoSchema = createInsertSchema(categoriasServicosTable).omit({ id: true });
export const insertAgendamentoSchema = createInsertSchema(agendamentosTable).omit({ id: true, criadoEm: true });
export const insertServicoPrestadorSchema = createInsertSchema(servicosPrestadoresTable).omit({ id: true, criadoEm: true });
export const insertServicoCatalogoSchema = createInsertSchema(servicosCatalogoTable).omit({ id: true, criadoEm: true });

export type InsertCategoriaServico = z.infer<typeof insertCategoriaServicoSchema>;
export type InsertAgendamento = z.infer<typeof insertAgendamentoSchema>;
export type InsertServicoPrestador = z.infer<typeof insertServicoPrestadorSchema>;
export type InsertServicoCatalogo = z.infer<typeof insertServicoCatalogoSchema>;

export type CategoriaServico = typeof categoriasServicosTable.$inferSelect;
export type Agendamento = typeof agendamentosTable.$inferSelect;
export type ServicoPrestador = typeof servicosPrestadoresTable.$inferSelect;
export type ServicoCatalogo = typeof servicosCatalogoTable.$inferSelect;
