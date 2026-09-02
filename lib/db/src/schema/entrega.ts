import { pgTable, serial, text, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { empresasTable } from "./empresas";

export const entregasTable = pgTable("entregas", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").references(() => empresasTable.id).notNull(),
  remetenteNome: text("remetente_nome").notNull(),
  remetenteTelefone: text("remetente_telefone"),
  destinatarioNome: text("destinatario_nome").notNull(),
  destinatarioTelefone: text("destinatario_telefone"),
  enderecoColeta: text("endereco_coleta").notNull(),
  enderecoEntrega: text("endereco_entrega").notNull(),
  descricaoPacote: text("descricao_pacote"),
  status: text("status").notNull().default("aguardando"),
  entregadorNome: text("entregador_nome"),
  valor: real("valor").notNull(),
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
});

export const insertEntregaSchema = createInsertSchema(entregasTable).omit({ id: true, criadoEm: true });
export type InsertEntrega = z.infer<typeof insertEntregaSchema>;
export type Entrega = typeof entregasTable.$inferSelect;
