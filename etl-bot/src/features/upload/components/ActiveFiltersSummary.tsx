// src/features/upload/components/ActiveFiltersSummary.tsx
// Or, if this is actually used in BigQueryTableViewer, it might be:
// src/components/filters/ActiveFiltersSummary.tsx (adjust import paths accordingly)

import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { XCircle, FilterX, Ban } from 'lucide-react'; // +++ Ensure Ban icon is imported +++
import { ActiveFilters, ActiveFilterValue, FilterConfig, CategoricalFilterValue } from '@/components/filters/filterTypes'; // Adjust path if your filterTypes are elsewhere
import { cn } from '@/lib/utils'; // For conditional class names
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"; // For better UX on icons

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
      // For display, we show the selected items. The inversion is indicated separately.
      return filterValue.selected.length > 0 ? filterValue.selected.join(', ') : '(None Selected)'; // Indicate if no selection for inverted
    case 'dateRange':
      const startDate = filterValue.start ? filterValue.start.toLocaleDateString() : 'Any';
      const endDate = filterValue.end ? filterValue.end.toLocaleDateString() : 'Any';
      if (startDate === 'Any' && endDate === 'Any') return ''; // Effectively no date range filter
      return `${startDate} - ${endDate}`;
    case 'numericRange':
      const min = filterValue.min !== null ? filterValue.min : 'Any';
      const max = filterValue.max !== null ? filterValue.max : 'Any';
      if (min === 'Any' && max === 'Any') return ''; // Effectively no numeric range filter
      return `${min} to ${max}`;
    case 'textSearch':
      return filterValue.term ? `"${filterValue.term}"` : '';
    default:
      // This part ensures that if ActiveFilterValue union is extended, TypeScript will complain here if not handled.
      const exhaustiveCheck: never = filterValue;
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
    ([columnName, value]) => { // Added columnName for potential future use in this filter
      if (!value) return false;
      // Check if the filter is actually applying a restriction or is active
      switch (value.type) {
        case 'categorical':
          // Active if items are selected OR if it's inverted (even with no selection, "exclude nothing" is an active state)
          return value.selected.length > 0 || (value.isInverted || false);
        case 'dateRange': return value.start !== null || value.end !== null;
        case 'numericRange': return value.min !== null || value.max !== null;
        case 'textSearch': return value.term.trim() !== '';
        default: return false;
      }
    }
  );

  if (activeFilterEntries.length === 0) {
    return null; // Don't render if no filters are effectively active
  }

  const getFilterLabel = (columnName: string): string => {
    const filterConfig = availableFilters.find(f => f.columnName === columnName);
    return filterConfig?.label || columnName; // Fallback to columnName if label not found
  };

  return (
    <div className="mb-3 p-3 border border-blue-200 dark:border-blue-700/60 bg-blue-50 dark:bg-blue-950/30 rounded-lg shadow-sm text-xs">
      <div className="flex justify-between items-center mb-2">
        <h5 className="font-semibold text-blue-700 dark:text-blue-300 flex items-center">
          <FilterX className="h-4 w-4 mr-1.5 flex-shrink-0" />
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
        {activeFilterEntries.map(([columnName, filterValueUntyped]) => {
          // Type assertion for safety, though Object.entries gives [string, T]
          const filterValue = filterValueUntyped as ActiveFilterValue | undefined;

          if (!filterValue) return null; // Should have been filtered out by activeFilterEntries

          const displayValue = formatFilterDisplayValue(filterValue);
          
          // If displayValue is empty for a non-categorical filter, it means no range/term is set.
          // For categorical, "(None Selected)" is a valid displayValue if inverted is true.
          if (!displayValue && filterValue.type !== 'categorical') return null;


          const isCategorical = filterValue.type === 'categorical';
          // Safely cast to CategoricalFilterValue ONLY if it's categorical
          const categoricalFilter = isCategorical ? (filterValue as CategoricalFilterValue) : undefined;
          const isCategoricalInverted = categoricalFilter?.isInverted || false;

          return (
            <Badge
              key={columnName}
              variant="outline" // Base variant
              className={cn(
                "px-2.5 py-1 h-auto font-normal bg-card text-card-foreground shadow-xs group flex items-center space-x-1", // Base styling
                isCategoricalInverted 
                    ? "border-orange-400 dark:border-orange-600 hover:border-orange-500" 
                    : "border-border hover:border-primary/50" // Default border
              )}
            >
              {/* +++ Icon and Text for Inverted Categorical Filter +++ */}
              {isCategoricalInverted && (
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/* Using 'asChild' with a simple span wrapper if direct icon use is problematic */}
                      <span> 
                        <Ban className="h-3.5 w-3.5 text-orange-500 dark:text-orange-400 flex-shrink-0" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">Excluding selected values</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              <span className="font-medium">{getFilterLabel(columnName)}:</span>

              {isCategoricalInverted && (
                <span className="italic text-orange-600 dark:text-orange-300">
                  Not in
                  {categoricalFilter && categoricalFilter.selected.length > 0 ? ":" : " (showing all except an empty set = showing all)"} 
                  {/* Clarify if selection is empty */}
                </span>
              )}
              
              {/* Display the actual selected values or "(None Selected)" for categorical */}
              <span 
                className="truncate max-w-[120px] sm:max-w-[150px]" 
                title={filterValue.type === 'categorical' ? filterValue.selected.join(', ') : displayValue}
              >
                {displayValue}
              </span>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => onClearFilter(columnName)}
                className="ml-auto h-4 w-4 p-0 text-muted-foreground group-hover:text-destructive opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0"
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