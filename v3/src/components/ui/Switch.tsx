import { Circle, CircleMinus } from "lucide-react";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  id?: string;
}

export default function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  id,
}: SwitchProps) {
  const handleClick = () => {
    onCheckedChange(!checked);
  };

  return (
    <div className="switch group" data-checked={checked ? "" : undefined}>
      {label && (
        <label htmlFor={id} className="switch__label">
          {label}
        </label>
      )}

      {description && <div className="switch__description">{description}</div>}

      <div
        className="switch__track"
        data-checked={checked ? "" : undefined}
        onClick={handleClick}
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        <div className="switch__track-background">
          <CircleMinus className="size-6 fill-none rotate-90" />
        </div>
        <div className="switch__track-background">
          <Circle className="size-6 fill-none" />
        </div>

        <div className="switch__handle">
          <div className="switch__button" />
        </div>
      </div>

      {/* Hidden input for form compatibility */}
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={() => {}} // Controlled by the div click handler
        style={{ display: "none" }}
        tabIndex={-1}
      />
    </div>
  );
}
