import { pgTable, serial, text, boolean, timestamp, json, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const empresasTable = pgTable("empresas", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  codigo: text("codigo").notNull().unique(),
  logo: text("logo"),
  corPrimaria: text("cor_primaria").notNull().default("#007AFF"),
  plano: text("plano").notNull().default("basico"),
  taxaApp: real("taxa_app").default(3),
  modulosAtivos: json("modulos_ativos").$type<string[]>().notNull().default([]),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
  // Extended fields added via SQL
  ecommerceStatus: text("ecommerce_status").notNull().default("ativo"),
  ecommerceTaxaComissao: real("ecommerce_taxa_comissao").notNull().default(3),
  ecommerceCategoria: text("ecommerce_categoria"),
  responsavel: text("responsavel"),
  cnpj: text("cnpj"),
  telefone: text("telefone"),
  email: text("email"),
  endereco: text("endereco"),
  tipoPessoa: text("tipo_pessoa").notNull().default("empresa"),
  docRg: text("doc_rg"),
  docRgStatus: text("doc_rg_status").notNull().default("pendente"),
  docCnpj: text("doc_cnpj"),
  docCnpjStatus: text("doc_cnpj_status").notNull().default("pendente"),
  docSelfie: text("doc_selfie"),
  docSelfieStatus: text("doc_selfie_status").notNull().default("pendente"),
  chavePix: text("chave_pix"),
  tipoChavePix: text("tipo_chave_pix").default("aleatoria"),
  destaque: boolean("destaque").notNull().default(false),
});

export const insertEmpresaSchema = createInsertSchema(empresasTable).omit({ id: true, criadoEm: true });
export type InsertEmpresa = z.infer<typeof insertEmpresaSchema>;
export type Empresa = typeof empresasTable.$inferSelect;
