import { z } from "zod";

const optionalString = z
  .preprocess((value) => {
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }, z.string().min(1))
  .optional();

const optionalEmail = z
  .union([z.string().email(), z.literal(""), z.undefined()])
  .transform((value) => {
    if (typeof value === "string" && value.trim().length === 0) {
      return undefined;
    }
    return value;
  });

const optionalNumber = z.preprocess((value) => {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}, z.number().int().positive().optional());

export const storeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  email: optionalEmail,
  phone: optionalString,
  region: optionalString,
  storeType: optionalString,
  managerId: optionalNumber,
});

