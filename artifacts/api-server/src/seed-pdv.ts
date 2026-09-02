import { db } from "@workspace/db";
import { empresasTable, usuariosTable, restaurantesTable, itensCardapioTable, pedidosPdvTable, itensPedidoPdvTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

async function seed() {
  let empresa = (await db.select().from(empresasTable).where(eq(empresasTable.codigo, "pizzaria-bella")).limit(1))[0];
  if (!empresa) {
    [empresa] = await db.insert(empresasTable).values({ nome: "Pizzaria Bella", codigo: "pizzaria-bella", corPrimaria: "#22C55E", plano: "profissional", modulosAtivos: ["food","destaque:on"], ativo: true }).returning();
    console.log("Empresa criada:", empresa.id);
  } else { console.log("Empresa existe:", empresa.id); }

  const existingUser = (await db.select().from(usuariosTable).where(eq(usuariosTable.email, "bella@pizzaria.com")).limit(1))[0];
  if (!existingUser) {
    await db.insert(usuariosTable).values({ nome: "Pizzaria Bella", email: "bella@pizzaria.com", senhaHash: "123456", papel: "parceiro", empresaId: empresa.id, ativo: true });
    console.log("Usuario parceiro criado");
  } else { console.log("Usuario existe"); }

  let rest = (await db.select().from(restaurantesTable).where(eq(restaurantesTable.empresaId, empresa.id)).limit(1))[0];
  if (!rest) {
    [rest] = await db.insert(restaurantesTable).values({ empresaId: empresa.id, nome: "Pizzaria Bella", descricao: "As melhores pizzas", categoria: "Pizzaria", tempoEntregaMin: 35, taxaEntrega: 5.00, aberto: true }).returning();
    console.log("Restaurante criado:", rest.id);
  }

  const items = await db.select().from(itensCardapioTable).where(eq(itensCardapioTable.restauranteId, rest.id));
  if (items.length === 0) {
    await db.insert(itensCardapioTable).values([
      { restauranteId: rest.id, nome: "Pizza Margherita", preco: 45.00, categoria: "Pizzas", disponivel: true },
      { restauranteId: rest.id, nome: "Pizza Calabresa", preco: 42.00, categoria: "Pizzas", disponivel: true },
      { restauranteId: rest.id, nome: "Esfiha de Carne", preco: 5.50, categoria: "Esfihas", disponivel: true },
      { restauranteId: rest.id, nome: "Coca-Cola 350ml", preco: 6.00, categoria: "Bebidas", disponivel: true },
      { restauranteId: rest.id, nome: "Batata Frita G", preco: 22.00, categoria: "Porcoes", disponivel: true },
    ]);
    console.log("Cardapio criado");
  }

  const pedidos = await db.select().from(pedidosPdvTable).where(eq(pedidosPdvTable.empresaId, empresa.id));
  if (pedidos.length === 0) {
    const [p1] = await db.insert(pedidosPdvTable).values({ empresaId: empresa.id, tipo: "delivery", status: "novo", clienteNome: "Maria Silva", clienteWhatsapp: "(11)97654-3210", clienteEndereco: "Av. Paulista 900, apto 42", total: 52.50, formaPagamento: "pix" }).returning();
    await db.insert(itensPedidoPdvTable).values([{ pedidoId: p1.id, produtoNome: "Pizza Margherita", quantidade: 1, precoUnitario: 45.00, total: 45.00 }]);
    const [p2] = await db.insert(pedidosPdvTable).values({ empresaId: empresa.id, tipo: "local", status: "preparando", clienteNome: "Carlos Rodrigues", mesa: "5", total: 84.00, formaPagamento: "dinheiro" }).returning();
    await db.insert(itensPedidoPdvTable).values([{ pedidoId: p2.id, produtoNome: "Pizza Calabresa", quantidade: 2, precoUnitario: 42.00, total: 84.00 }]);
    const [p3] = await db.insert(pedidosPdvTable).values({ empresaId: empresa.id, tipo: "delivery", status: "pronto", clienteNome: "Aderito Dutra Maciel", clienteEndereco: "Rua Faustino Rodrigues 220", total: 135.00, formaPagamento: "cartao" }).returning();
    await db.insert(itensPedidoPdvTable).values([{ pedidoId: p3.id, produtoNome: "Pizza Portuguesa", quantidade: 3, precoUnitario: 48.00, total: 144.00 }]);
    console.log("Pedidos criados");
  }
  console.log("Seed concluido!");
  process.exit(0);
}
seed().catch(e => { console.error(e); process.exit(1); });
