import { z } from "zod";

export const zonePriceSchema = z.object({
  zoneName: z.string().trim().min(1, "Nombre de zona requerido"),
  price: z.coerce.number().int().min(0, "Precio inválido"),
});

export const serviceSchema = z
  .object({
    id: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional().or(z.literal("")),
    name: z.string().trim().min(2, "Ingresa un nombre"),
    description: z.string().trim().optional().or(z.literal("")),
    durationMinutes: z.coerce.number().int().min(5, "Mínimo 5 minutos").max(480, "Máximo 8 horas"),
    pricingType: z.enum(["fixed", "by_zone"]),
    basePrice: z.coerce.number().int().min(0, "Precio inválido").optional(),
    isPackage: z.boolean(),
    packageSessionsCount: z.coerce.number().int().min(1).optional(),
    zonePrices: z.array(zonePriceSchema).optional(),
    active: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.pricingType === "fixed" && (data.basePrice === undefined || data.basePrice === null)) {
      ctx.addIssue({ code: "custom", path: ["basePrice"], message: "Ingresa un precio" });
    }
    if (data.pricingType === "by_zone" && (!data.zonePrices || data.zonePrices.length === 0)) {
      ctx.addIssue({ code: "custom", path: ["zonePrices"], message: "Agrega al menos una zona" });
    }
    if (data.isPackage && !data.packageSessionsCount) {
      ctx.addIssue({ code: "custom", path: ["packageSessionsCount"], message: "Indica el número de sesiones" });
    }
  });

// z.coerce.number() makes the *input* type `unknown` (anything can be coerced)
// while the *output* type is `number`. react-hook-form needs both: the form
// state uses the input shape (what <input> elements produce), the submit
// handler and the server action use the parsed/coerced output shape.
export type ServiceFormInput = z.input<typeof serviceSchema>;
export type ServiceInput = z.output<typeof serviceSchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Ingresa un nombre"),
});

export type CategoryInput = z.infer<typeof categorySchema>;
