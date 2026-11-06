import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Standard dynamic Tailwind-v4 class merger
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
