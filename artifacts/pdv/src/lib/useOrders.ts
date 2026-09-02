import { useState, useEffect, useRef, useCallback } from "react";
import { playNewOrderSound } from "./sound";

export interface OrderItem {
  id: number;
  produtoNome: string;
  quantidade: number;
  precoUnitario: number;
  total: number;
  observacoes?: string;
}

export interface Order {
  id: number;
  empresaId: number;
  modulo: string;
  tipo: string;
  status: string;
  clienteNome: string;
  clienteWhatsapp?: string;
  clienteEndereco?: string;
  mesa?: string;
  total: number;
  observacoes?: string;
  formaPagamento: string;
  criadoEm: string;
  atualizadoEm: string;
  itens: OrderItem[];
}

let notifPermissionRequested = false;

async function requestNotifPermission() {
  if (notifPermissionRequested) return;
  notifPermissionRequested = true;
  if ("Notification" in window && Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

function showBrowserNotification(order: Order) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const n = new Notification("🛎️ Novo Pedido!", {
      body: `${order.clienteNome} — R$ ${Number(order.total).toFixed(2)}`,
      icon: "/logo.png",
      tag: `pedido-${order.id}`,
      requireInteraction: true,
    });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* ignore */ }
}

export function useOrders(token: string | null, empresaId: number | null) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const knownIds = useRef<Set<number>>(new Set());
  const sseRef = useRef<EventSource | null>(null);

  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}`, "x-empresa-id": String(empresaId) } : {};

  const fetchOrders = useCallback(async () => {
    if (!token || !empresaId) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/pdv/pedidos", { headers });
      if (res.ok) {
        const data: Order[] = await res.json();
        setOrders(data);
        data.forEach(o => knownIds.current.add(o.id));
      }
    } catch { /* ignore */ }
    setIsLoading(false);
  }, [token, empresaId]);

  useEffect(() => {
    if (token) requestNotifPermission();
  }, [token]);

  // SSE subscription for real-time
  useEffect(() => {
    if (!token || !empresaId) return;

    fetchOrders();

    const url = `/api/pdv/stream?empresaId=${empresaId}`;
    const es = new EventSource(url);
    sseRef.current = es;

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.event === "novo_pedido" && msg.pedido) {
          const pedido: Order = msg.pedido;
          if (!knownIds.current.has(pedido.id)) {
            knownIds.current.add(pedido.id);
            setOrders(prev => [pedido, ...prev]);
            setNewCount(c => c + 1);
            playNewOrderSound();
            showBrowserNotification(pedido);
            window.dispatchEvent(new CustomEvent("gotaxi:novo-pedido", { detail: pedido }));
          }
        }
        if (msg.event === "status_atualizado") {
          setOrders(prev => prev.map(o => o.id === msg.pedidoId ? { ...o, status: msg.status } : o));
        }
      } catch { /* ignore */ }
    };

    es.onerror = () => {
      setTimeout(fetchOrders, 5000);
    };

    return () => { es.close(); sseRef.current = null; };
  }, [token, empresaId]);

  const updateStatus = useCallback(async (id: number, status: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/pdv/pedidos/${id}/status`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
      }
    } catch { /* ignore */ }
  }, [token]);

  const createOrder = useCallback(async (data: Partial<Order> & { itens: { nome: string; quantidade: number; preco: number }[] }) => {
    if (!token) return null;
    try {
      const res = await fetch("/api/pdv/pedidos", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const novo: Order = await res.json();
        setOrders(prev => [novo, ...prev]);
        knownIds.current.add(novo.id);
        setNewCount(c => c + 1);
        playNewOrderSound();
        showBrowserNotification(novo);
        window.dispatchEvent(new CustomEvent("gotaxi:novo-pedido", { detail: novo }));
        return novo;
      }
    } catch { /* ignore */ }
    return null;
  }, [token]);

  const clearNewCount = useCallback(() => setNewCount(0), []);

  return { orders, isLoading, fetchOrders, updateStatus, createOrder, newCount, clearNewCount };
}
