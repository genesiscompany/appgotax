import { db } from "@workspace/db";
import {
  empresasTable, usuariosTable, restaurantesTable,
  itensCardapioTable, pedidosPdvTable, itensPedidoPdvTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Seeding PDV demo data...");

  let empresa = (await db.select().from(empresasTable).where(eq(empresasTable.codigo, "pizzaria-bella")).limit(1))[0];
  if (!empresa) {
    [empresa] = await db.insert(empresasTable).values({
      nome: "Pizzaria Bella",
      codigo: "pizzaria-bella",
      corPrimaria: "#22C55E",
      plano: "profissional",
      modulosAtivos: ["food", "destaque:on"],
      ativo: true,
    }).returning();
    console.log("Empresa criada:", empresa.nome);
  } else {
    console.log("Empresa ja existe:", empresa.nome);
  }

  const existingUser = (await db.select().from(usuariosTable).where(eq(usuariosTable.email, "bella@pizzaria.com")).limit(1))[0];
  if (!existingUser) {
    await db.insert(usuariosTable).values({
      nome: "Pizzaria Bella",
      email: "bella@pizzaria.com",
      senhaHash: "123456",
      telefone: "(11) 98765-4321",
      papel: "parceiro",
      empresaId: empresa.id,
      ativo: true,
    });
    console.log("Usuario parceiro criado: bella@pizzaria.com / 123456");
  } else {
    console.log("Usuario ja existe:", existingUser.email);
  }

  let restaurante = (await db.select().from(restaurantesTable).where(eq(restaurantesTable.empresaId, empresa.id)).limit(1))[0];
  if (!restaurante) {
    [restaurante] = await db.insert(restaurantesTable).values({
      empresaId: empresa.id,
      nome: "Pizzaria Bella",
      descricao: "As melhores pizzas da regiao",
      categoria: "Pizzaria",
      tempoEntregaMin: 35,
      taxaEntrega: 5.00,
      aberto: true,
    }).returning();
    console.log("Restaurante criado:", restaurante.nome);
  }

  const existingItems = await db.select().from(itensCardapioTable).where(eq(itensCardapioTable.restauranteId, restaurante.id));
  if (existingItems.length === 0) {
    await db.insert(itensCardapioTable).values([
      { restauranteId: restaurante.id, nome: "Pizza Margherita", descricao: "Molho, mussarela, tomate", preco: 45.00, categoria: "Pizzas", disponivel: true },
      { restauranteId: restaurante.id, nome: "Pizza Calabresa", descricao: "Molho, mussarela, calabresa", preco: 42.00, categoria: "Pizzas", disponivel: true },
      { restauranteId: restaurante.id, nome: "Pizza Portuguesa", descricao: "Molho, mussarela, ovo, presunto", preco: 48.00, categoria: "Pizzas", disponivel: true },
      { restauranteId: restaurante.id, nome: "Esfiha de Carne", descricao: "Massa fina com carne moida", preco: 5.50, categoria: "Esfihas", disponivel: true },
      { restauranteId: restaurante.id, nome: "Coca-Cola 350ml", descricao: "Lata gelada", preco: 6.00, categoria: "Bebidas", disponivel: true },
      { restauranteId: restaurante.id, nome: "Batata Frita G", descricao: "Porcao grande crocante", preco: 22.00, categoria: "Porcoes", disponivel: true },
    ]);
    console.log("Cardapio criado com 6 itens");
  }

  const existingPedidos = await db.select().from(pedidosPdvTable).where(eq(pedidosPdvTable.empresaId, empresa.id));
  if (existingPedidos.length === 0) {
    const [p1] = await db.insert(pedidosPdvTable).values({ empresaId: empresa.id, modulo: "food", tipo: "delivery", status: "novo", clienteNome: "Maria Silva", clienteWhatsapp: "(11)97654-3210", clienteEndereco: "Av. Paulista 900, apto 42", total: 52.50, formaPagamento: "pix" }).returning();
    await db.insert(itensPedidoPdvTable).values([{ pedidoId: p1.id, produtoNome: "Pizza Margherita", quantidade: 1, precoUnitario: 45.00, total: 45.00 }]);
    const [p2] = await db.insert(pedidosPdvTable).values({ empresaId: empresa.id, modulo: "food", tipo: "local", status: "preparando", clienteNome: "Carlos Rodrigues", mesa: "5", total: 84.00, formaPagamento: "dinheiro" }).returning();
    await db.insert(itensPedidoPdvTable).values([{ pedidoId: p2.id, produtoNome: "Pizza Calabresa", quantidade: 2, precoUnitario: 42.00, total: 84.00 }]);
    console.log("Pedidos demo criados");
  }

  console.log("Seed PDV concluido!");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
