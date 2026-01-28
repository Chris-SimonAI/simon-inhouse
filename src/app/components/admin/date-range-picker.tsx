import { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';

type PresetRange = 'today' | 'last7days' | 'last30days' | 'alltime' | 'custom';

interface DateRange {
  startDate: string | null;
  endDate: string | null;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

const PRESETS: { key: PresetRange; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'last7days', label: 'Last 7 days' },
  { key: 'last30days', label: 'Last 30 days' },
  { key: 'alltime', label: 'All time' },
];

function getPresetDates(preset: PresetRange): DateRange {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const endDate = today.toISOString().split('T')[0];

  switch (preset) {
    case 'today': {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return { startDate: start.toISOString().split('T')[0], endDate };
    }
    case 'last7days': {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return { startDate: start.toISOString().split('T')[0], endDate };
    }
    case 'last30days': {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      return { startDate: start.toISOString().split('T')[0], endDate };
    }
    case 'alltime':
      return { startDate: null, endDate: null };
    default:
      return { startDate: null, endDate: null };
  }
}

function determineActivePreset(range: DateRange): PresetRange {
  if (!range.startDate && !range.endDate) return 'alltime';

  const today = new Date().toISOString().split('T')[0];
  const endMatches = range.endDate === today || !range.endDate;

  if (!endMatches) return 'custom';

  if (range.startDate) {
    const start = new Date(range.startDate);
    const now = new Date();
    const daysDiff = Math.round((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff === 0) return 'today';
    if (daysDiff === 7) return 'last7days';
    if (daysDiff === 30) return 'last30days';
  }

  return 'custom';
}

export function DateRangePicker({ value, onChange, className = '' }: DateRangePickerProps) {
  const [activePreset, setActivePreset] = useState<PresetRange>(() => determineActivePreset(value));
  const [showCustom, setShowCustom] = useState(activePreset === 'custom');

  useEffect(() => {
    const preset = determineActivePreset(value);
    setActivePreset(preset);
    setShowCustom(preset === 'custom');
  }, [value]);

  const handlePresetClick = (preset: PresetRange) => {
    if (preset === 'custom') {
      setShowCustom(true);
      setActivePreset('custom');
    } else {
      setShowCustom(false);
      setActivePreset(preset);
      onChange(getPresetDates(preset));
    }
  };

  const handleCustomDateChange = (field: 'startDate' | 'endDate', dateValue: string) => {
    setActivePreset('custom');
    onChange({
      ...value,
      [field]: dateValue || null,
    });
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
        {PRESETS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handlePresetClick(key)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activePreset === key && !showCustom
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => handlePresetClick('custom')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1 ${
            showCustom
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Custom
        </button>
      </div>

      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={value.startDate || ''}
            onChange={(e) => handleCustomDateChange('startDate', e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={value.endDate || ''}
            onChange={(e) => handleCustomDateChange('endDate', e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  );
}
