import { pgTable, serial, text, timestamp, integer, real, boolean, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { empresasTable } from "./empresas";

export const produtosTable = pgTable("produtos", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").references(() => empresasTable.id).notNull(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  preco: real("preco").notNull(),
  precoPromocional: real("preco_promocional"),
  estoque: integer("estoque").notNull().default(0),
  categoria: text("categoria").notNull(),
  imagem: text("imagem"),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
});

export const pedidosTable = pgTable("pedidos", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").references(() => empresasTable.id).notNull(),
  clienteNome: text("cliente_nome").notNull(),
  clienteTelefone: text("cliente_telefone"),
  itens: json("itens").$type<Array<{ produtoId: number; produtoNome: string; quantidade: number; precoUnitario: number }>>().notNull().default([]),
  total: real("total").notNull(),
  status: text("status").notNull().default("pendente"),
  enderecoEntrega: text("endereco_entrega"),
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
});

export const insertProdutoSchema = createInsertSchema(produtosTable).omit({ id: true, criadoEm: true });
export const insertPedidoSchema = createInsertSchema(pedidosTable).omit({ id: true, criadoEm: true });
export type InsertProduto = z.infer<typeof insertProdutoSchema>;
export type InsertPedido = z.infer<typeof insertPedidoSchema>;
export type Produto = typeof produtosTable.$inferSelect;
export type Pedido = typeof pedidosTable.$inferSelect;
