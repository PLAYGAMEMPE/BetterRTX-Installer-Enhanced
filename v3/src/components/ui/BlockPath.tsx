import React from "react";

interface BlockPathProps {
  /** The path or URL to display */
  path?: string;
  /** Optional href for making the path clickable */
  href?: string;
  /** Whether to open links in a new tab (default: true) */
  openInNewTab?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * A component that displays a path or URL using the same styling as preset stub links.
 * Features overflow handling with ellipsis when not hovered and horizontal scroll on hover.
 */
export const BlockPath: React.FC<BlockPathProps> = ({
  path,
  href,
  openInNewTab = true,
  className = "",
}) => {
  return (
    <div className="preset-stub-container select-all selection:bg-minecraft-slate-900 selection:text-minecraft-slate-50 scrollbar min-w-0 w-full">
      {href ? (
        <a
          href={href}
          className={`preset-stub-link ${className}`}
          target={openInNewTab ? "_blank" : undefined}
          rel={openInNewTab ? "noopener noreferrer" : undefined}
        >
          {path ?? href}
        </a>
      ) : (
        <span className={`preset-stub-link ${className} no-underline cursor-default truncate overflow-hidden whitespace-nowrap`}>{path ?? href}</span>
      )}
    </div>
  );
};

export default BlockPath;
