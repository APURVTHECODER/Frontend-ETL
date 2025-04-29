// frontend/src/components/filters/filterTypes.ts

export type FilterType = 'categorical' | 'dateRange' | 'numericRange' | 'textSearch';

// Defines the configuration for a filterable column
export interface FilterConfig {
    columnName: string;
    dataType: string; // BQ data type (e.g., 'STRING', 'INTEGER', 'TIMESTAMP')
    filterType: FilterType;
    label: string; // Display label (can be same as columnName)
    options?: string[]; // For categorical filters
    min?: number | Date | null; // For range filters (min value in the dataset)
    max?: number | Date | null; // For range filters (max value in the dataset)
}

// Represents the value(s) selected for an active filter
export type ActiveFilterValue = {
    type: 'categorical';
    selected: string[];
} | {
    type: 'dateRange';
    start: Date | null;
    end: Date | null;
} | {
    type: 'numericRange';
    min: number | null;
    max: number | null;
} | {
    type: 'textSearch';
    term: string;
};

// Represents all currently active filters, keyed by column name
export interface ActiveFilters {
    [columnName: string]: ActiveFilterValue;
}

// Props for the main FilterControls component
export interface FilterControlsProps {
    availableFilters: FilterConfig[];
    activeFilters: ActiveFilters;
    onFilterChange: (columnName: string, value: ActiveFilterValue | null) => void; // null to clear
    onClearAllFilters: () => void;
    resultsCount: number; // Total rows before filtering
    filteredCount: number; // Rows after filtering
}