import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import empresasRouter from "./empresas";
import motoristaRouter from "./motorista";
import motoristaAppRouter from "./motorista-app";
import ecommerceRouter from "./ecommerce";
import servicosRouter from "./servicos";
import passagensRouter from "./passagens";
import entregaRouter from "./entrega";
import foodRouter from "./food";
import pdvRouter from "./pdv";
import adminRouter from "./admin";
import publicRouter from "./public";
import empresasAlimentosRouter from "./empresas-alimentos";
import deliveryRouter from "./delivery";
import foodDeliveryRouter from "./food-delivery";
import turViagensRouter from "./tur-viagens";
import clienteRouter from "./cliente";
import encomendasRouter from "./encomendas";
import corporativoRouter from "./corporativo";
import corporativoCadastroRouter from "./corporativo-cadastro";
import afiliadosRouter from "./afiliados";
import configuracoesRouter from "./configuracoes";
import placesRouter from "./places";
import subcategoriasAlimentacaoRouter from "./subcategorias-alimentacao";
import chatRouter from "./chat";
import financeiroRouter from "./financeiro";
import { pdvRouter as suportePdvRouter, adminRouter as suporteAdminRouter } from "./suporte";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/pdv/encomendas", encomendasRouter);
router.use("/pdv/corporativo", corporativoRouter);
router.use("/corporativo-cadastro", corporativoCadastroRouter);
router.use("/pdv", pdvRouter);
router.use("/empresas", empresasRouter);
router.get("/modulos", (_req, res) => {
  res.json([
    { id: "motorista", nome: "Motorista App", descricao: "Gestão de corridas e motoristas", icone: "car", ativo: true, cor: "#FF6B35" },
    { id: "ecommerce", nome: "E-commerce", descricao: "Loja virtual e gestão de produtos", icone: "shopping-bag", ativo: true, cor: "#4ECDC4" },
    { id: "servicos", nome: "Serviços", descricao: "Agendamento de serviços", icone: "tool", ativo: true, cor: "#45B7D1" },
    { id: "passagens", nome: "Passagens", descricao: "Venda de passagens e rotas", icone: "map", ativo: true, cor: "#96CEB4" },
    { id: "entrega", nome: "Entrega", descricao: "Logística e rastreamento", icone: "package", ativo: true, cor: "#F0A500" },
    { id: "food", nome: "Food", descricao: "Delivery de alimentação", icone: "coffee", ativo: true, cor: "#C36EF0" },
    { id: "encomendas", nome: "Encomendas", descricao: "Envio e rastreamento de encomendas", icone: "package", ativo: true, cor: "#F97316" },
  ]);
});
router.get("/usuarios", (_req, res) => res.json([]));
router.use("/motorista", motoristaRouter);
router.use("/motorista-app", motoristaAppRouter);
router.use("/ecommerce", ecommerceRouter);
router.use("/servicos", servicosRouter);
router.use("/passagens", passagensRouter);
router.use("/entrega", entregaRouter);
router.use("/entregas", entregaRouter);
router.use("/food", foodRouter);
router.use("/admin", adminRouter);
router.use("/public", publicRouter);
router.use("/empresas-alimentos", empresasAlimentosRouter);
router.use("/delivery", deliveryRouter);
router.use("/food-delivery", foodDeliveryRouter);
router.use("/tur-viagens", turViagensRouter);
router.use("/cliente", clienteRouter);
router.use("/afiliados", afiliadosRouter);
router.use("/configuracoes", configuracoesRouter);
router.use("/places", placesRouter);
router.use("/subcategorias-alimentacao", subcategoriasAlimentacaoRouter);
router.use("/chat", chatRouter);
router.use("/pdv/financeiro", financeiroRouter);
router.use("/pdv/suporte", suportePdvRouter);
router.use("/admin/suporte", suporteAdminRouter);

export default router;
