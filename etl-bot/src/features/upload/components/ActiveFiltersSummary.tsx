// src/features/upload/components/ActiveFiltersSummary.tsx
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button"; // For individual clear buttons
import { XCircle, FilterX } from 'lucide-react';
import { ActiveFilters, ActiveFilterValue, FilterConfig } from '@/components/filters/filterTypes'; // Adjust path if your filterTypes are elsewhere

interface ActiveFiltersSummaryProps {
  activeFilters: ActiveFilters;
  availableFilters: FilterConfig[]; // To get pretty labels for columns
  onClearFilter: (columnName: string) => void;
  onClearAllFilters: () => void;
}

// Helper to format individual filter values for display
const formatFilterDisplayValue = (filterValue: ActiveFilterValue): string => {
  switch (filterValue.type) {
    case 'categorical':
      return filterValue.selected.length > 0 ? filterValue.selected.join(', ') : '';
    case 'dateRange':
      const startDate = filterValue.start ? filterValue.start.toLocaleDateString() : 'Any';
      const endDate = filterValue.end ? filterValue.end.toLocaleDateString() : 'Any';
      if (startDate === 'Any' && endDate === 'Any') return '';
      return `${startDate} - ${endDate}`;
    case 'numericRange':
      const min = filterValue.min !== null ? filterValue.min : 'Any';
      const max = filterValue.max !== null ? filterValue.max : 'Any';
      if (min === 'Any' && max === 'Any') return '';
      return `${min} to ${max}`;
    case 'textSearch':
      return filterValue.term ? `"${filterValue.term}"` : '';
    default:
      return '';
  }
};

export const ActiveFiltersSummary: React.FC<ActiveFiltersSummaryProps> = ({
  activeFilters,
  availableFilters,
  onClearFilter,
  onClearAllFilters,
}) => {
  const activeFilterEntries = Object.entries(activeFilters).filter(
    ([, value]) => {
      if (!value) return false;
      // Check if the filter is actually applying a restriction
      switch (value.type) {
        case 'categorical': return value.selected.length > 0;
        case 'dateRange': return value.start !== null || value.end !== null;
        case 'numericRange': return value.min !== null || value.max !== null;
        case 'textSearch': return value.term.trim() !== '';
        default: return false;
      }
    }
  );

  if (activeFilterEntries.length === 0) {
    return null; // Don't render if no filters are active
  }

  const getFilterLabel = (columnName: string): string => {
    const filterConfig = availableFilters.find(f => f.columnName === columnName);
    return filterConfig?.label || columnName; // Fallback to columnName if label not found
  };

  return (
    <div className="mb-3 p-3 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/40 rounded-lg shadow-sm text-xs">
      <div className="flex justify-between items-center mb-2">
        <h5 className="font-semibold text-blue-700 dark:text-blue-300 flex items-center">
          <FilterX className="h-4 w-4 mr-1.5" />
          Active Filters Applied:
        </h5>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAllFilters}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 h-7 px-2 text-xs"
          title="Clear all filters"
        >
          <XCircle className="h-3.5 w-3.5 mr-1" /> Clear All
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {activeFilterEntries.map(([columnName, filterValue]) => {
          if (!filterValue) return null; // Should be filtered by activeFilterEntries already
          const displayValue = formatFilterDisplayValue(filterValue);
          if (!displayValue) return null; // Don't render a badge for an empty filter value

          return (
            <Badge
              key={columnName}
              variant="outline"
              className="px-2.5 py-1 h-auto font-normal border-blue-300 dark:border-blue-700 bg-white dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 shadow-xs"
            >
              <span className="font-medium mr-1">{getFilterLabel(columnName)}:</span>
              <span className="truncate max-w-[180px] mr-1.5" title={displayValue}>{displayValue}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onClearFilter(columnName)}
                className="ml-1 h-4 w-4 p-0 text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 opacity-70 hover:opacity-100"
                title={`Clear filter for ${getFilterLabel(columnName)}`}
              >
                <XCircle className="h-3.5 w-3.5" />
              </Button>
            </Badge>
          );
        })}
      </div>
    </div>
  );
};