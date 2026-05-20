import { cx } from "classix";
import { FileUp } from "lucide-react";
import { useTranslation } from "react-i18next";

interface DropzoneIndicatorProps {
  isDragging: boolean;
}

export default function DropzoneIndicator({ isDragging }: DropzoneIndicatorProps) {
  const { t } = useTranslation();
  return (
    <div className={cx(
      "dropzone-overlay",
      isDragging ? "dropzone-overlay--active" : "dropzone-overlay--hidden"
    )}>
      <div className="dropzone-overlay__glow">
        <div className="dropzone-overlay__content">
          <FileUp size={64} className="dropzone-overlay__icon" />
          <p className="dropzone-overlay__text">{t("drop_rtpack")}</p>
        </div>
      </div>
    </div>
  );
}
