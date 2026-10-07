"use server";

import { redirect } from "next/navigation";
import { authenticate, startSession } from "@/lib/auth";
import { clearFailures, isLocked, registerFailure } from "@/lib/throttle";
import { loginSchema } from "@/lib/validations/auth";

export type LoginState = {
  error?: string;
  fieldErrors?: Partial<Record<"email" | "password", string>>;
};

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fieldErrors: LoginState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as "email" | "password";
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  // Mismo mensaje en todos los casos para no revelar si el correo existe o está bloqueado.
  const generic = { error: "Correo o contraseña incorrectos, o cuenta temporalmente bloqueada." };
  if (await isLocked(parsed.data.email)) return generic;

  const profile = await authenticate(parsed.data.email, parsed.data.password);
  if (!profile) {
    await registerFailure(parsed.data.email);
    return generic;
  }
  await clearFailures(parsed.data.email);

  await startSession(profile);
  redirect("/dashboard");
}
