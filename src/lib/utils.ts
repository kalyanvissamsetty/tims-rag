import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(typeof date === "string" ? new Date(date) : date);
}

export function truncate(input: string, max = 140) {
  return input.length > max ? `${input.slice(0, max)}...` : input;
}
