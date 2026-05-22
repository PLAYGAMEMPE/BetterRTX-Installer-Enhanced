import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "classix";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function Disclaimer() {
    const { t } = useTranslation();
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className={cx("disclaimer", collapsed && "disclaimer--collapsed")}>
            <button
                className="disclaimer__header w-full"
                onClick={() => setCollapsed((c) => !c)}
                aria-expanded={!collapsed}
                aria-controls="disclaimer-body"
                type="button"
            >
                <h2>{t("disclaimer")}</h2>
                {collapsed
                    ? <ChevronDown className="size-4 text-app-muted shrink-0" />
                    : <ChevronUp className="size-4 text-app-muted shrink-0" />
                }
            </button>

            <div className="disclaimer__body" id="disclaimer-body">
                <div className="disclaimer__body-inner">
                    <p>{t("disclaimer_text")}</p>
                </div>
            </div>
        </div>
    );
}
