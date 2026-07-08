import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function getTagColorClass(tag: string): string {
    const t = (tag || "").trim().toLowerCase();
    
    // Hash string to pick a color palette
    let hash = 0;
    for (let i = 0; i < t.length; i++) {
        hash = t.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % 6;
    
    const palettes = [
        "bg-amber-500/10 text-amber-400 hover:bg-amber-500/15",
        "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15",
        "bg-rose-500/10 text-rose-400 hover:bg-rose-500/15",
        "bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/15",
        "bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500/15",
        "bg-orange-500/10 text-orange-400 hover:bg-orange-500/15"
    ];
    
    return palettes[index];
}
