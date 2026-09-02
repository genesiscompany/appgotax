import { pgTable, serial, text, timestamp, integer, real, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { empresasTable } from "./empresas";

export const restaurantesTable = pgTable("restaurantes", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").references(() => empresasTable.id).notNull(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  categoria: text("categoria").notNull(),
  tempoEntregaMin: integer("tempo_entrega_min").notNull().default(30),
  avaliacaoMedia: real("avaliacao_media"),
  taxaEntrega: real("taxa_entrega").notNull().default(0),
  aberto: boolean("aberto").notNull().default(true),
  imagem: text("imagem"),
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
  // Extended fields added via SQL
  latLoja: numeric("lat_loja", { precision: 10, scale: 8 }),
  lngLoja: numeric("lng_loja", { precision: 11, scale: 8 }),
  raioVisibilidadeKm: numeric("raio_visibilidade_km", { precision: 6, scale: 2 }).default("50"),
  status: text("status").notNull().default("ativo"),
  plano: text("plano").notNull().default("free"),
  taxaComissao: real("taxa_comissao").notNull().default(10),
  telefone: text("telefone"),
  email: text("email"),
  responsavel: text("responsavel"),
  cnpj: text("cnpj"),
  endereco: text("endereco"),
  tipoPessoa: text("tipo_pessoa").notNull().default("empresa"),
  docRg: text("doc_rg"),
  docRgStatus: text("doc_rg_status").notNull().default("pendente"),
  docCnpj: text("doc_cnpj"),
  docCnpjStatus: text("doc_cnpj_status").notNull().default("pendente"),
  docSelfie: text("doc_selfie"),
  docSelfieStatus: text("doc_selfie_status").notNull().default("pendente"),
  subcategoriaId: integer("subcategoria_id"),
});

export const itensCardapioTable = pgTable("itens_cardapio", {
  id: serial("id").primaryKey(),
  restauranteId: integer("restaurante_id").references(() => restaurantesTable.id).notNull(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  preco: real("preco").notNull(),
  categoria: text("categoria").notNull(),
  imagem: text("imagem"),
  disponivel: boolean("disponivel").notNull().default(true),
});

export const insertRestauranteSchema = createInsertSchema(restaurantesTable).omit({ id: true, criadoEm: true });
export const insertItemCardapioSchema = createInsertSchema(itensCardapioTable).omit({ id: true });
export type InsertRestaurante = z.infer<typeof insertRestauranteSchema>;
export type InsertItemCardapio = z.infer<typeof insertItemCardapioSchema>;
export type Restaurante = typeof restaurantesTable.$inferSelect;
export type ItemCardapio = typeof itensCardapioTable.$inferSelect;
