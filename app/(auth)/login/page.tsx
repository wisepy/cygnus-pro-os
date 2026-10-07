"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" />
          Ingresando…
        </>
      ) : (
        "Ingresar"
      )}
    </Button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useActionState(login, initialState);

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-accent/60 blur-3xl" />
        <div className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-info/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
            <Sparkles className="size-3.5 text-primary" />
            CYGNUS Pro/OS
          </div>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-foreground">Cygnus</h1>
          <p className="text-sm text-muted-foreground">Sistema de gestión · Clínica Cygnus</p>
        </div>

        <div className="rounded-2xl border border-border bg-card/90 p-7 shadow-xl shadow-primary/5 backdrop-blur">
          <form action={formAction} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="tu@clinicacygnus.cl"
                aria-invalid={!!state.fieldErrors?.email}
              />
              {state.fieldErrors?.email && (
                <p className="text-xs text-destructive">{state.fieldErrors.email}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={!!state.fieldErrors?.password}
              />
              {state.fieldErrors?.password && (
                <p className="text-xs text-destructive">{state.fieldErrors.password}</p>
              )}
            </div>

            {state.error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
            )}

            <SubmitButton />
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Clínica Cygnus · Dermoestética · Antofagasta
        </p>
      </motion.div>
    </div>
  );
}
