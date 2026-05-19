import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "classix";
import { X, ChevronDown } from "lucide-react";

export default function Disclaimer() {
    const { t } = useTranslation();
    const [collapsed, setCollapsed] = useState(false);
    return (
        <div className={cx("disclaimer", collapsed && "disclaimer--collapsed")}>
            <div className="disclaimer__header" onClick={() => setCollapsed(!collapsed)} role="button" aria-expanded={!collapsed}>
                <h2>{t("disclaimer")}</h2>
                {collapsed ? <ChevronDown className="size-4" /> : <X className="size-4" />}
            </div>
            <p>{t("disclaimer_text")}</p>
        </div>
    );
}