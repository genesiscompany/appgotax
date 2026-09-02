import React, { createContext, useContext, useState } from "react";

type ModuleType = "alimentacao" | "ecommerce" | "servicos";
type StoreStatus = "aberta" | "fechada";

interface AppState {
  activeModule: ModuleType;
  setActiveModule: (module: ModuleType) => void;
  storeStatus: StoreStatus;
  setStoreStatus: (status: StoreStatus) => void;
  isFeatured: boolean;
  setIsFeatured: (featured: boolean) => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [activeModule, setActiveModule] = useState<ModuleType>("alimentacao");
  const [storeStatus, setStoreStatus] = useState<StoreStatus>("aberta");
  const [isFeatured, setIsFeatured] = useState<boolean>(true);

  return (
    <AppContext.Provider
      value={{
        activeModule,
        setActiveModule,
        storeStatus,
        setStoreStatus,
        isFeatured,
        setIsFeatured,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppStore must be used within an AppProvider");
  }
  return context;
}
