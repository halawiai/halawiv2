import { Button } from "../ui/button";
import { SocialAuthenticationProvider } from "app-types/authentication";
import { MicrosoftIcon } from "ui/microsoft-icon";
import { cn } from "lib/utils";

export default function SocialProviders({
  socialAuthenticationProviders,
  onSocialProviderClick,
  className,
}: {
  socialAuthenticationProviders: SocialAuthenticationProvider[];
  onSocialProviderClick: (provider: SocialAuthenticationProvider) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2 w-full", className)}>
      {socialAuthenticationProviders.includes("microsoft") && (
        <Button
          variant="outline"
          onClick={() => onSocialProviderClick("microsoft")}
          className="flex-1 w-full"
          data-testid="microsoft-signup-button"
        >
          <MicrosoftIcon className="size-4 fill-foreground" />
          Microsoft
        </Button>
      )}
    </div>
  );
}
