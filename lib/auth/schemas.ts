import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name (at least 2 characters).").max(60, "Name is too long."),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Please enter a valid email address.")),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password is too long.")
    .regex(/[A-Za-z]/, "Password needs at least one letter.")
    .regex(/[0-9]/, "Password needs at least one number."),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Please enter a valid email address.")),
  password: z.string().min(1, "Please enter your password.").max(128),
});

export type AuthFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "password", string>>;
} | undefined;
