import React, { createContext, useContext, useState } from "react";
import { Alert } from "react-native";

export interface CartProduto {
  id: number;
  nome: string;
  preco: number;
  cor?: string;
  imagem?: string | null;
}

interface CartItem {
  produto: CartProduto;
  qtd: number;
}

interface CartVendor {
  id: number;
  nome: string;
  cor: string;
  modulo: string;
}

interface CartContextType {
  items: CartItem[];
  vendor: CartVendor | null;
  totalQtd: number;
  totalPreco: number;
  addItem: (produto: CartProduto, vendor: CartVendor, onConflictResolved?: () => void) => void;
  removeItem: (produtoId: number) => void;
  updateQtd: (produtoId: number, delta: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [vendor, setVendor] = useState<CartVendor | null>(null);

  const totalQtd = items.reduce((s, c) => s + c.qtd, 0);
  const totalPreco = items.reduce((s, c) => s + c.produto.preco * c.qtd, 0);

  const doAdd = (produto: CartProduto, v: CartVendor) => {
    setVendor(v);
    setItems(prev => {
      const ex = prev.find(c => c.produto.id === produto.id);
      if (ex) return prev.map(c => c.produto.id === produto.id ? { ...c, qtd: c.qtd + 1 } : c);
      return [...prev, { produto, qtd: 1 }];
    });
  };

  const addItem = (produto: CartProduto, v: CartVendor, onConflictResolved?: () => void) => {
    if (vendor !== null && vendor.id !== v.id && items.length > 0) {
      Alert.alert(
        "Trocar de loja?",
        `Você já tem itens de "${vendor.nome}" no carrinho. Deseja limpar e iniciar uma nova compra em "${v.nome}"?`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Trocar",
            style: "destructive",
            onPress: () => {
              setItems([]);
              setVendor(null);
              setTimeout(() => {
                doAdd(produto, v);
                onConflictResolved?.();
              }, 100);
            },
          },
        ]
      );
      return;
    }
    doAdd(produto, v);
  };

  const removeItem = (produtoId: number) => {
    setItems(prev => {
      const next = prev.filter(c => c.produto.id !== produtoId);
      if (next.length === 0) setVendor(null);
      return next;
    });
  };

  const updateQtd = (produtoId: number, delta: number) => {
    setItems(prev => {
      const next = prev.map(c => c.produto.id === produtoId ? { ...c, qtd: c.qtd + delta } : c).filter(c => c.qtd > 0);
      if (next.length === 0) setVendor(null);
      return next;
    });
  };

  const clearCart = () => {
    setItems([]);
    setVendor(null);
  };

  return (
    <CartContext.Provider value={{ items, vendor, totalQtd, totalPreco, addItem, removeItem, updateQtd, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
