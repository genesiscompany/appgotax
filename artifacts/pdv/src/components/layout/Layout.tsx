import React from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 pl-[220px] flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 pt-3 px-4 pb-4 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
