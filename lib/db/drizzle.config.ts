import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // Only manage tables explicitly defined in the schema.
  // All other tables (created via raw SQL) are left untouched.
  tablesFilter: [
    "empresas",
    "usuarios",
    "corridas",
    "motoristas_app",
    "pedidos",
    "pedidos_pdv",
    "itens_pedido_pdv",
    "produtos",
    "agendamentos",
    "categorias_servicos",
    "servicos_prestadores",
    "servicos_catalogo",
    "reservas",
    "rotas",
    "entregas",
    "itens_cardapio",
    "restaurantes",
    "subcategorias_alimentacao",
  ],
});
