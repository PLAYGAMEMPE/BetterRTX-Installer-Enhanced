import { useState } from "react"
import { cx } from "classix";
import { Wand } from "lucide-react";

export default function CreatorIcon() {

    const getRandomBackgroundColor = () => {
        const colors = [
            "bg-red-500",
            "bg-blue-500",
            "bg-green-500",
            "bg-yellow-500",
            "bg-purple-500",
            "bg-pink-500",
            "bg-orange-500",
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    };

    const [color] = useState(getRandomBackgroundColor);

    return (
        <div className={cx("creator-icon size-10 ml-0.5 rounded-sm flex items-center justify-center border border-white/50", color)}>
            <span className="text-xs font-semibold text-app-fg">
                <Wand size={16} />
            </span>
        </div>
    );
}