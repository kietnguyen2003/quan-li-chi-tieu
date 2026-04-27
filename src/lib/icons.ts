import {
  Car,
  Gamepad2,
  MoreHorizontal,
  ShoppingBag,
  Utensils,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { IconName } from './types.ts';

export const IconMap: Record<IconName, LucideIcon> = {
  Utensils,
  Car,
  ShoppingBag,
  Gamepad2,
  Wallet,
  MoreHorizontal,
};

export const getIconByName = (iconName?: IconName): LucideIcon => {
  return IconMap[iconName ?? 'MoreHorizontal'];
};
