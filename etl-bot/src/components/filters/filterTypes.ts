export type FilterType = 'categorical' | 'dateRange' | 'numericRange' | 'textSearch';

// Defines the configuration for a filterable column
export interface FilterConfig {
    columnName: string;
    dataType: string; // BQ data type (e.g., 'STRING', 'INTEGER', 'TIMESTAMP')
    filterType: FilterType;
    label: string; // Display label (can be same as columnName)
    options?: string[]; // For categorical filters: list of unique values from the dataset
    min?: number | Date | null; // For range filters (min value observed in the dataset for this column)
    max?: number | Date | null; // For range filters (max value observed in the dataset for this column)
}

// --- Specific shapes for each type of ActiveFilterValue ---

export interface CategoricalFilterValue {
    type: 'categorical';
    selected: string[]; // Array of selected string values for the category
    isInverted?: boolean; // +++ ADDED for "Invert Selection" functionality +++
                        // Optional: if undefined, treated as false (i.e., include selected)
}

export interface DateRangeFilterValue {
    type: 'dateRange';
    start: Date | null; // Date object or null
    end: Date | null;   // Date object or null
}

export interface NumericRangeFilterValue {
    type: 'numericRange';
    min: number | null;
    max: number | null;
}

export interface TextSearchFilterValue {
    type: 'textSearch';
    term: string; // The search term entered by the user
}

// Union type for the value of an active filter
// This remains the same, as CategoricalFilterValue is part of this union.
export type ActiveFilterValue =
  | CategoricalFilterValue
  | DateRangeFilterValue
  | NumericRangeFilterValue
  | TextSearchFilterValue;

// Represents all currently active filters, keyed by column name
export interface ActiveFilters {
    // Value can be one of the specific filter value types, or undefined if no filter is active for that column.
    // Using `undefined` for a key means the filter for that column is not set or has been cleared.
    [columnName: string]: ActiveFilterValue | undefined;
}

// Props for the main FilterControls component
// This remains the same as it defines the contract for FilterControls.
export interface FilterControlsProps {
    availableFilters: FilterConfig[];
    activeFilters: ActiveFilters;
    onFilterChange: (columnName: string, value: ActiveFilterValue | null) => void; // `null` value signifies clearing the filter for that column
    onClearAllFilters: () => void;
    resultsCount: number; // Total rows available before any filtering
    filteredCount: number; // Number of rows displayed after applying active filters
}