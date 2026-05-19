import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/appStore";
import { InstallationCard } from "./InstallationCard";

export default function InstallationsToolbar() {
  const { t } = useTranslation();
  const { installations } = useAppStore();

  return (
    <section className="installations-toolbar">
      <div className="installations-list flex md:grid gap-4 md:grid-cols-2">
        {installations.length > 0 ? (
          installations.map((installation) => (
            <InstallationCard
              key={installation.InstallLocation}
              installation={installation}
            />
          ))
        ) : (
          <div className="empty-state text-center py-8">
            <p>{t("installations_none_found")}</p>
          </div>
        )}
      </div>
    </section>
  );
}
