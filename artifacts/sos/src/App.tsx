import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { Toaster } from "sonner";
import Publico from "@/pages/Publico";
import Entrar from "@/pages/Entrar";
import Painel from "@/pages/Painel";
import { getToken } from "@/lib/api";

function Protegido() {
  if (!getToken()) return <Redirect to="/entrar" />;
  return <Painel />;
}

export default function App() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <WouterRouter base={base}>
      <Switch>
        <Route path="/" component={Publico} />
        <Route path="/doar" component={Publico} />
        <Route path="/entrar" component={Entrar} />
        <Route path="/painel" component={Protegido} />
        <Route path="/painel/*" component={Protegido} />
        <Route><Redirect to="/" /></Route>
      </Switch>
      <Toaster richColors position="top-center" />
    </WouterRouter>
  );
}
