import React from "react";
import { motion } from "framer-motion";
import { Download, Calendar as CalendarIcon, FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from "recharts";

const monthlyData = [
  { name: "Jan", total: 12400 },
  { name: "Fev", total: 14200 },
  { name: "Mar", total: 13800 },
  { name: "Abr", total: 16500 },
  { name: "Mai", total: 18900 },
  { name: "Jun", total: 21400 },
];

const dayData = [
  { day: "Seg", orders: 45 },
  { day: "Ter", orders: 52 },
  { day: "Qua", orders: 68 },
  { day: "Qui", orders: 85 },
  { day: "Sex", orders: 124 },
  { day: "Sáb", orders: 145 },
  { day: "Dom", orders: 110 },
];

const categoryData = [
  { name: "Pizzas", value: 4500, color: "hsl(var(--chart-1))" },
  { name: "Bebidas", value: 2100, color: "hsl(var(--chart-2))" },
  { name: "Sobremesas", value: 1200, color: "hsl(var(--chart-3))" },
  { name: "Porções", value: 1800, color: "hsl(var(--chart-4))" },
];

export default function Relatorios() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-7xl mx-auto"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Relatórios & Analytics</h1>
          <p className="text-muted-foreground mt-1">Analise o desempenho e métricas da sua loja.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="bg-card">
            <CalendarIcon className="w-4 h-4 mr-2" />
            Este Mês
          </Button>
          <Button variant="outline" className="bg-card text-primary border-primary/30 hover:bg-primary/5">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-border/50">
          <CardHeader>
            <CardTitle>Faturamento Mensal</CardTitle>
            <CardDescription>Receita bruta nos últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(val) => `R$${val/1000}k`} />
                  <Tooltip 
                    cursor={{fill: 'hsl(var(--muted)/0.4)'}}
                    contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: 'var(--shadow-md)' }}
                    formatter={(value) => [`R$ ${value}`, "Faturamento"]}
                  />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50">
          <CardHeader>
            <CardTitle>Pedidos por Dia da Semana</CardTitle>
            <CardDescription>Média de volume de pedidos diários</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip 
                    cursor={{fill: 'hsl(var(--muted)/0.4)'}}
                    contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: 'var(--shadow-md)' }}
                  />
                  <Bar dataKey="orders" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50 lg:col-span-2">
          <CardHeader>
            <CardTitle>Receita por Categoria</CardTitle>
            <CardDescription>Distribuição de faturamento por tipo de produto</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row items-center justify-center gap-12">
            <div className="h-[300px] w-full md:w-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: 'var(--shadow-md)' }}
                    formatter={(value) => [`R$ ${value}`, "Receita"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-x-12 gap-y-6">
              {categoryData.map((cat) => (
                <div key={cat.name} className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }}></div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{cat.name}</p>
                    <p className="text-lg font-bold font-display text-muted-foreground mt-0.5">R$ {cat.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
