import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const subcategoriasAlimentacaoTable = pgTable("subcategorias_alimentacao", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull().unique(),
  slug: text("slug").notNull().unique(),
  emoji: text("emoji"),
  ordem: integer("ordem").notNull().default(0),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
});

export const insertSubcategoriaAlimentacaoSchema = createInsertSchema(subcategoriasAlimentacaoTable).omit({
  id: true,
  criadoEm: true,
});

export type InsertSubcategoriaAlimentacao = z.infer<typeof insertSubcategoriaAlimentacaoSchema>;
export type SubcategoriaAlimentacao = typeof subcategoriasAlimentacaoTable.$inferSelect;
