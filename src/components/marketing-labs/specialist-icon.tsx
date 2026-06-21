import type { SpecialistIconName } from '@/lib/marketing-jobs/creative-team';
import {
  BadgeCheck,
  Brain,
  Clock,
  FileSearch,
  FileText,
  LayoutGrid,
  PackageCheck,
  Palette,
  PenTool,
  Search,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

const SPECIALIST_ICONS: Record<SpecialistIconName, LucideIcon> = {
  clock: Clock,
  brain: Brain,
  search: Search,
  'layout-grid': LayoutGrid,
  'file-text': FileText,
  'file-search': FileSearch,
  palette: Palette,
  'pen-tool': PenTool,
  'shield-check': ShieldCheck,
  'badge-check': BadgeCheck,
  'package-check': PackageCheck,
};

export function getSpecialistIcon(name: SpecialistIconName): LucideIcon {
  return SPECIALIST_ICONS[name] ?? Clock;
}
