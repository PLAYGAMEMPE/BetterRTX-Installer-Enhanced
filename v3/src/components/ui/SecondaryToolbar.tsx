import React from "react";

interface SecondaryToolbarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

const SecondaryToolbar: React.FC<SecondaryToolbarProps> = ({
  title,
  subtitle,
  actions,
  children,
}) => {
  return (
    <div className="secondary-toolbar">
      <div className="secondary-toolbar__content">
        <div className="toolbar-title">
          <h2 className="text-lg font-semibold">{title}</h2>
          {subtitle && <span className="text-sm opacity-75">{subtitle}</span>}
        </div>
        {actions && <div className="toolbar-actions">{actions}</div>}
      </div>
      {children}
    </div>
  );
};

export default SecondaryToolbar;
