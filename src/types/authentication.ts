import { z } from "zod";
import { envBooleanSchema } from "./util";

export const SocialAuthenticationProviderSchema = z.enum(["microsoft"]);

export type SocialAuthenticationProvider = z.infer<
  typeof SocialAuthenticationProviderSchema
>;

export const MicrosoftConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  tenantId: z.string().default("common"),
  disableSignUp: z.boolean().optional(),
  prompt: z.literal("select_account").optional(),
});

export const SocialAuthenticationConfigSchema = z.object({
  microsoft: MicrosoftConfigSchema.optional(),
});

export const AuthConfigSchema = z.object({
  emailAndPasswordEnabled: envBooleanSchema.default(true),
  signUpEnabled: envBooleanSchema.default(true),
  socialAuthenticationProviders: SocialAuthenticationConfigSchema,
});

export type MicrosoftConfig = z.infer<typeof MicrosoftConfigSchema>;
export type SocialAuthenticationConfig = z.infer<
  typeof SocialAuthenticationConfigSchema
>;

export type AuthConfig = z.infer<typeof AuthConfigSchema>;
