import { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

interface ChartContainerProps {
  title: string;
  children: ReactNode;
  loading?: boolean;
  onRefresh?: () => void;
  className?: string;
  description?: string;
}

export function ChartContainer({
  title,
  children,
  loading = false,
  onRefresh,
  className = '',
  description
}: ChartContainerProps) {
  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          {description && (
            <p className="text-sm text-gray-500">{description}</p>
          )}
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 rounded-lg hover:bg-gray-100"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400">Loading...</div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
