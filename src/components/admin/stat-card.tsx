import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: string;
  accent?: 'blue' | 'green' | 'orange' | 'purple';
}

const accentStyles = {
  blue: {
    bg: 'bg-blue-50',
    icon: 'text-blue-600',
    ring: 'ring-blue-100',
  },
  green: {
    bg: 'bg-emerald-50',
    icon: 'text-emerald-600',
    ring: 'ring-emerald-100',
  },
  orange: {
    bg: 'bg-amber-50',
    icon: 'text-amber-600',
    ring: 'ring-amber-100',
  },
  purple: {
    bg: 'bg-violet-50',
    icon: 'text-violet-600',
    ring: 'ring-violet-100',
  },
};

export function StatCard({ label, value, icon: Icon, trend, subtitle, accent = 'blue' }: StatCardProps) {
  const colors = accentStyles[accent];

  return (
    <div className="group relative bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-300">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white via-white to-slate-50/50 pointer-events-none" />

      <div className="relative flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-500 tracking-wide">{label}</p>
          <p className="text-3xl font-semibold text-slate-900 tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-sm text-slate-400">{subtitle}</p>
          )}
          {trend && (
            <div className={`inline-flex items-center gap-1 text-sm font-medium mt-2 px-2 py-0.5 rounded-full ${
              trend.isPositive
                ? 'text-emerald-700 bg-emerald-50'
                : 'text-red-700 bg-red-50'
            }`}>
              <span>{trend.isPositive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl ${colors.bg} ring-1 ${colors.ring} group-hover:scale-105 transition-transform duration-300`}>
          <Icon className={`w-5 h-5 ${colors.icon}`} />
        </div>
      </div>
    </div>
  );
}
