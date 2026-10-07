"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCLP } from "@/lib/format";
import { adjustStock, closeCashRegister, createProduct, openCashRegister, registerAppointmentPayment, registerSale } from "../actions";

type Pending = { id: string; time: string; patient: string; service: string; suggestedAmount: number };
type Product = { id: string; name: string; price: number; stock: number };
type Payment = { id: string; amount: number; method: string; patient: string; time: string };

const METHODS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "debito", label: "Débito" },
  { value: "credito", label: "Crédito" },
] as const;

type Result = { error?: string; success?: boolean; fieldErrors?: Record<string, string> };

function useRun() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  function run(fn: () => Promise<Result>, ok: string, after?: () => void) {
    startTransition(async () => {
      const result = await fn();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.fieldErrors) {
        toast.error(Object.values(result.fieldErrors)[0]);
        return;
      }
      toast.success(ok);
      after?.();
      router.refresh();
    });
  }
  return { isPending, run };
}

export function CashPanel({
  registerOpen,
  openingAmount,
  expectedCash,
  isAdmin,
  pending,
  products,
  payments,
}: {
  registerOpen: boolean;
  openingAmount: number;
  expectedCash: number;
  isAdmin: boolean;
  pending: Pending[];
  products: Product[];
  payments: Payment[];
}) {
  const { isPending, run } = useRun();
  const [opening, setOpening] = useState("0");
  const [declared, setDeclared] = useState("");

  if (!registerOpen) {
    return (
      <Card className="flex max-w-md flex-col gap-3 p-6">
        <h2 className="font-heading text-lg font-medium text-foreground">Abrir caja</h2>
        <p className="text-sm text-muted-foreground">Registra el efectivo con el que empiezas el día.</p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="opening">Monto inicial (CLP)</Label>
          <Input id="opening" type="number" min={0} value={opening} onChange={(e) => setOpening(e.target.value)} />
        </div>
        <Button disabled={isPending} onClick={() => run(() => openCashRegister(Number(opening)), "Caja abierta")}>
          {isPending && <Loader2 className="animate-spin" />}
          Abrir caja
        </Button>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div className="flex flex-col gap-6 xl:col-span-2">
        <CollectAppointments pending={pending} />
        <SellProducts products={products} />
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="font-heading text-lg font-medium text-foreground">Pagos de hoy</h2>
          {payments.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay pagos en esta caja.</p>}
          <ul className="divide-y divide-border text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span>{p.time} · {p.patient}</span>
                <span className="tabular-nums">{formatCLP(p.amount)} <span className="text-muted-foreground">· {p.method}</span></span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="font-heading text-lg font-medium text-foreground">Cerrar caja</h2>
          <p className="text-sm text-muted-foreground">
            Efectivo esperado: <span className="font-medium text-foreground">{formatCLP(expectedCash)}</span> (inicial {formatCLP(openingAmount)} + ventas en efectivo).
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="declared">Efectivo contado (CLP)</Label>
            <Input id="declared" type="number" min={0} value={declared} onChange={(e) => setDeclared(e.target.value)} />
          </div>
          {declared !== "" && (
            <p className={Number(declared) === expectedCash ? "text-sm text-success" : "text-sm text-destructive"}>
              Diferencia: {formatCLP(Number(declared) - expectedCash)}
            </p>
          )}
          <Button
            variant="outline"
            disabled={isPending || declared === ""}
            onClick={() => run(() => closeCashRegister(Number(declared)), "Caja cerrada", () => setDeclared(""))}
          >
            {isPending && <Loader2 className="animate-spin" />}
            Cerrar caja
          </Button>
        </Card>

        {isAdmin && <ProductsAdmin products={products} />}
      </div>
    </div>
  );
}

function CollectAppointments({ pending }: { pending: Pending[] }) {
  const { isPending, run } = useRun();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [methods, setMethods] = useState<Record<string, string>>({});

  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="font-heading text-lg font-medium text-foreground">Cobrar citas de hoy</h2>
      {pending.length === 0 && <p className="text-sm text-muted-foreground">No hay citas pendientes de cobro.</p>}
      <ul className="flex flex-col gap-2">
        {pending.map((p) => {
          const amount = amounts[p.id] ?? String(p.suggestedAmount || "");
          return (
            <li key={p.id} className="grid grid-cols-1 items-center gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_auto_auto_auto]">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{p.time} · {p.patient}</p>
                <p className="truncate text-xs text-muted-foreground">{p.service}</p>
              </div>
              <Input
                type="number"
                min={0}
                className="w-full sm:w-32"
                aria-label="Monto"
                value={amount}
                onChange={(e) => setAmounts((prev) => ({ ...prev, [p.id]: e.target.value }))}
              />
              <Select value={methods[p.id] ?? "efectivo"} onValueChange={(v) => setMethods((prev) => ({ ...prev, [p.id]: v ?? "efectivo" }))}>
                <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={isPending || !amount || Number(amount) <= 0}
                onClick={() =>
                  run(
                    () => registerAppointmentPayment({ appointmentId: p.id, amount: Number(amount), method: methods[p.id] ?? "efectivo" }),
                    "Pago registrado",
                  )
                }
              >
                Cobrar
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function SellProducts({ products }: { products: Product[] }) {
  const { isPending, run } = useRun();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [method, setMethod] = useState("efectivo");

  const lines = products.filter((p) => (cart[p.id] ?? 0) > 0);
  const total = lines.reduce((sum, p) => sum + p.price * (cart[p.id] ?? 0), 0);
  const change = (id: string, delta: number, max: number) =>
    setCart((prev) => ({ ...prev, [id]: Math.max(0, Math.min(max, (prev[id] ?? 0) + delta)) }));

  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="font-heading text-lg font-medium text-foreground">Venta de productos</h2>
      {products.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay productos. Agrégalos a la derecha.</p>}
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {products.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">{formatCLP(p.price)} · stock {p.stock}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon-sm" onClick={() => change(p.id, -1, p.stock)} aria-label="Quitar"><Minus /></Button>
              <span className="w-6 text-center tabular-nums">{cart[p.id] ?? 0}</span>
              <Button variant="outline" size="icon-sm" disabled={(cart[p.id] ?? 0) >= p.stock} onClick={() => change(p.id, 1, p.stock)} aria-label="Agregar"><Plus /></Button>
            </div>
          </li>
        ))}
      </ul>
      {lines.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <p className="text-sm">Total <span className="font-semibold tabular-nums">{formatCLP(total)}</span></p>
          <div className="flex items-center gap-2">
            <Select value={method} onValueChange={(v) => setMethod(v ?? "efectivo")}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              disabled={isPending}
              onClick={() =>
                run(
                  () => registerSale({ method, items: lines.map((p) => ({ productId: p.id, quantity: cart[p.id] })) }),
                  "Venta registrada",
                  () => setCart({}),
                )
              }
            >
              {isPending && <Loader2 className="animate-spin" />}
              Registrar venta
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function ProductsAdmin({ products }: { products: Product[] }) {
  const { isPending, run } = useRun();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");

  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="font-heading text-lg font-medium text-foreground">Productos y stock</h2>
      <ul className="flex flex-col gap-1.5 text-sm">
        {products.map((p) => (
          <li key={p.id} className="flex items-center justify-between">
            <span>{p.name}</span>
            <span className="flex items-center gap-1">
              <span className="tabular-nums text-muted-foreground">{p.stock} u.</span>
              <Button variant="ghost" size="sm" disabled={isPending} onClick={() => run(() => adjustStock(p.id, 1), "Stock actualizado")}>+1</Button>
            </span>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
        <Input className="col-span-3" placeholder="Nombre del producto" value={name} onChange={(e) => setName(e.target.value)} />
        <Input type="number" placeholder="Precio" value={price} onChange={(e) => setPrice(e.target.value)} />
        <Input type="number" placeholder="Stock" value={stock} onChange={(e) => setStock(e.target.value)} />
        <Button
          disabled={isPending || name.trim().length < 2 || price === ""}
          onClick={() => run(() => createProduct({ name, price: Number(price), stock: Number(stock) }), "Producto agregado", () => { setName(""); setPrice(""); setStock("0"); })}
        >
          Agregar
        </Button>
      </div>
    </Card>
  );
}
