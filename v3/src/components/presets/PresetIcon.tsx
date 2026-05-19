import { cx } from "classix";
import { useState } from "react";

export default function PresetIcon({
  uuid,
  size,
  extra,
}: {
  uuid: string;
  size?: string;
  extra?: string;
}) {
  const iconSize = size === "lg" ? 64 : 48;
  const [mainImgError, setMainImgError] = useState(false);
  const [bgImgError, setBgImgError] = useState(false);

  return (
    <div className="@container contain-inline-size flex-1 shadow-md">
      <div className={cx("flex group flex-col items-center justify-center border border-white/10 outline @2xs:outline-2 outline-black h-min rounded-md @3xs:rounded-t-lg @3xs:rounded-b-xl relative overflow-hidden w-full",
        extra
      )}>
        {!mainImgError && (
          <img
            className="preset-icon select-none transition-all @3xs:mx-0 mx-2 @3xs:rounded-t-md @3xs:rounded-b-lg object-cover mb-0.5 @3xs:mb-1 @2xs:mb-1.5 w-full h-full border border-white/30 blend-overlay shadow-none outline outline-black/25 relative inset-0 z-20"
            src={`https://cdn.jsdelivr.net/gh/BetterRTX/presets@main/data/${uuid}/icon.png`}
            alt={`${uuid} icon`}
            onError={() => setMainImgError(true)}
            width={iconSize}
            height={iconSize}
          />
        )}
        <div className="absolute select-none transition-opacity opacity-75 group-hover:opacity-100 inset-0 w-full h-full object-cover rounded-md border border-black/15 from-black/25 via-white/75 to-white/30 group-hover:from-white/15 group-hover:via-white/50 group-hover:to-white/50 z-10 bg-radial">
          {!bgImgError && (
            <img
              className="absolute inset-0 -top-2 w-full h-full object-cover rounded-lg blur-sm brightness-75 group-hover:brightness-200 transition-all"
              src={`https://cdn.jsdelivr.net/gh/BetterRTX/presets@main/data/${uuid}/icon.png`}
              alt={`${uuid} icon`}
              onError={() => setBgImgError(true)}
              width={iconSize}
              height={iconSize}
            />
          )}
        </div>
      </div></div>
  );
}
