import { pgTable, serial, text, timestamp, integer, real, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { empresasTable } from "./empresas";

export const pedidosPdvTable = pgTable("pedidos_pdv", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").references(() => empresasTable.id).notNull(),
  modulo: text("modulo").notNull().default("food"),
  tipo: text("tipo").notNull().default("delivery"),
  status: text("status").notNull().default("novo"),
  clienteNome: text("cliente_nome").notNull(),
  clienteWhatsapp: text("cliente_whatsapp"),
  clienteEndereco: text("cliente_endereco"),
  mesa: text("mesa"),
  total: real("total").notNull().default(0),
  observacoes: text("observacoes"),
  formaPagamento: text("forma_pagamento").default("pix"),
  taxaEntrega: numeric("taxa_entrega", { precision: 10, scale: 2 }).default("0"),
  distanciaKm: numeric("distancia_km", { precision: 10, scale: 2 }),
  boyId: integer("boy_id"),
  confirmadoEm: timestamp("confirmado_em"),
  preparandoEm: timestamp("preparando_em"),
  prontoEm: timestamp("pronto_em"),
  entregueEm: timestamp("entregue_em"),
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
  atualizadoEm: timestamp("atualizado_em").notNull().defaultNow(),
});

export const itensPedidoPdvTable = pgTable("itens_pedido_pdv", {
  id: serial("id").primaryKey(),
  pedidoId: integer("pedido_id").references(() => pedidosPdvTable.id).notNull(),
  produtoNome: text("produto_nome").notNull(),
  quantidade: integer("quantidade").notNull().default(1),
  precoUnitario: real("preco_unitario").notNull(),
  total: real("total").notNull(),
  observacoes: text("observacoes"),
});

export const insertPedidoPdvSchema = createInsertSchema(pedidosPdvTable).omit({ id: true, criadoEm: true, atualizadoEm: true });
export const insertItemPedidoPdvSchema = createInsertSchema(itensPedidoPdvTable).omit({ id: true });
export type InsertPedidoPdv = z.infer<typeof insertPedidoPdvSchema>;
export type InsertItemPedidoPdv = z.infer<typeof insertItemPedidoPdvSchema>;
export type PedidoPdv = typeof pedidosPdvTable.$inferSelect;
export type ItemPedidoPdv = typeof itensPedidoPdvTable.$inferSelect;
