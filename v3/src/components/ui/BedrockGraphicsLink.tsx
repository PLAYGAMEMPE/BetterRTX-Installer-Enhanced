import { ExternalLinkIcon } from "lucide-react";
import Button from "./Button";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";

export default function BedrockGraphicsLink({
    preset
}: {
    preset: string;
}) {
    const { t } = useTranslation();
    return (
        <Button
            theme="secondary"
            block
            extra="bedrock-graphics-link sm:h-12 h-10 w-min mx-auto max-w-full mb-2 truncate overflow-hidden text-xs"
            onClick={async () => {
                const url = `https://bedrock.graphics/presets/${preset}`;
                try {
                    await openUrl(url);
                } catch (e) {
                    console.error("Failed to open URL", e);
                }
            }}
        >
           {t("view_on_bedrock_graphics", "View on bedrock.graphics")}
           <ExternalLinkIcon className="size-4" />
        </Button>
    );
}
