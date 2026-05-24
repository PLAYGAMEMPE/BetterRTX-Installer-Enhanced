import cx from "classix";

export default function Button({
  children,
  theme = null,
  size = null,
  disabled = false,
  block = false,
  extra = null,
  ...rest
}: Readonly<{
  children: React.ReactNode;
  theme?: "primary" | "secondary" | "danger" | null;
  size?: "sm" | "md" | "lg" | null;
  disabled?: boolean;
  block?: boolean;
  extra?: string | null;
  [key: string]: any;
}>) {
  return (
    <button
      className={cx(
        "btn",
        theme === "primary" && "btn--primary",
        theme === "secondary" && "btn--secondary",
        theme === "danger" && "btn--danger",
        size === "sm" && "btn--small",
        size === "md" && "btn--md",
        size === "lg" && "btn--lg",
        block && "w-full",
        !disabled && "cursor-pointer",
        extra
      )}
      type="button"
      disabled={disabled}
      {...rest}
    >
      <span className="btn__wrapper">{children}</span>
    </button>
  );
}
