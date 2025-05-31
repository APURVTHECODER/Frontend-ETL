// src/components/filters/FilterControls.tsx
import React, { useState, useMemo, useCallback } from 'react'; // Added useCallback
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X, ListFilter, Calendar as CalendarIcon, ChevronDown, Check } from 'lucide-react'; // Added Check, ChevronDown
import { FilterType, CategoricalFilterValue as ActualCategoricalFilterValue } from './filterTypes'; // Renamed to avoid conflict
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils'; // For conditional class names
import { Switch } from "@/components/ui/switch"; // +++ IMPORTED SWITCH +++

import { FilterConfig, ActiveFilters, ActiveFilterValue } from './filterTypes'; // FilterControlsProps not needed here if defined inline

// Prop types for this component
interface FilterControlsProps {
  availableFilters: FilterConfig[];
  activeFilters: ActiveFilters;
  onFilterChange: (columnName: string, value: ActiveFilterValue | null) => void;
  onClearAllFilters: () => void;
  resultsCount: number;
  filteredCount: number;
}

// Helper to check if a filter type is active (no changes needed here)
const isFilterActive = (columnName: string, activeFilters: ActiveFilters): boolean => {
    const filter = activeFilters[columnName];
    if (!filter) return false;
    switch (filter.type) {
        case 'categorical': return filter.selected.length > 0;
        case 'dateRange': return filter.start !== null || filter.end !== null;
        case 'numericRange': return filter.min !== null || filter.max !== null;
        case 'textSearch': return filter.term.trim() !== '';
        default: return false;
    }
};

// CategoricalFilter Component - Modified to include Inversion Switch
const CategoricalFilter: React.FC<{
    config: FilterConfig;
    currentFilterValue?: ActualCategoricalFilterValue;
    onChange: (newFilterValue: ActualCategoricalFilterValue | null) => void;
}> = ({ config, currentFilterValue, onChange }) => {
    const options = config.options || [];
    const selectedValues = currentFilterValue?.selected || [];
    const isInverted = currentFilterValue?.isInverted || false;

    // --- Add search state for filtering options ---
    const [search, setSearch] = useState<string>("");

    // Filtered options based on search
    const filteredOptions = useMemo(() => {
        if (!search.trim()) return options;
        return options.filter(option =>
            option?.toLowerCase().includes(search.trim().toLowerCase())
        );
    }, [options, search]);

    const handleSelectionChange = (option: string, checked: boolean) => {
        const newSelected = checked
            ? [...selectedValues, option]
            : selectedValues.filter(item => item !== option);

        if (newSelected.length === 0 && !isInverted) {
            onChange(null);
        } else {
            onChange({ type: 'categorical', selected: newSelected, isInverted });
        }
    };

    const handleInversionToggle = () => {
        const newInvertedState = !isInverted;
        if (!newInvertedState && selectedValues.length === 0) {
            onChange(null);
        } else {
            onChange({ type: 'categorical', selected: selectedValues, isInverted: newInvertedState });
        }
    };

    const handleClearSelection = () => {
        onChange(null);
    };

    return (
        <div className="space-y-1.5">
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-between text-left font-normal h-8 text-sm">
                        <span className='truncate pr-1'>
                            {selectedValues.length === 0
                                ? `Any ${config.label}`
                                : selectedValues.length === 1
                                    ? selectedValues[0]
                                    : `${selectedValues.length} selected`}
                        </span>
                        <ChevronDown className="h-3.5 w-3.5 opacity-50 flex-shrink-0" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-0" align="start">
                    <div className='p-2 border-b'>
                        <p className='text-xs font-medium text-muted-foreground'>{config.label}</p>
                    </div>
                    {/* --- Search input for filtering options --- */}
                    <div className="px-2 pt-2 pb-1">
                        <Input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search options..."
                            className="h-7 text-xs"
                        />
                    </div>
                    {/* Make the ScrollArea always a fixed height for scrolling */}
                    <ScrollArea className="h-[180px] max-h-[180px]">
                        <div className="p-2 space-y-1">
                            {filteredOptions.length === 0 && (
                                <p className="text-xs text-muted-foreground p-1 text-center italic">No options found</p>
                            )}
                            {filteredOptions.map((option) => (
                                <div key={option} className="flex items-center space-x-2 hover:bg-muted/50 rounded-sm px-1 py-0.5">
                                    <Checkbox
                                        id={`${config.columnName}-${option}-checkbox`}
                                        checked={selectedValues.includes(option)}
                                        onCheckedChange={(checked) => handleSelectionChange(option, !!checked)}
                                        className='h-3.5 w-3.5'
                                    />
                                    <Label
                                        htmlFor={`${config.columnName}-${option}-checkbox`}
                                        className="text-xs font-normal truncate cursor-pointer flex-grow"
                                        title={option}
                                    >
                                        {option || <i className='text-muted-foreground'>(empty)</i>}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                    {selectedValues.length > 0 && (
                        <div className="p-1.5 border-t">
                            <Button variant="ghost" size="sm" className="w-full h-6 text-xs text-muted-foreground hover:text-destructive" onClick={handleClearSelection}>
                                Clear Selection
                            </Button>
                        </div>
                    )}
                </PopoverContent>
            </Popover>
            {(selectedValues.length > 0 || isInverted) && (
                <div className="mt-1.5 flex items-center justify-end space-x-2 pt-1.5 border-t border-dashed border-border/70">
                    <Label htmlFor={`invert-${config.columnName}`} className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                        Exclude selected
                    </Label>
                    <Switch
                        id={`invert-${config.columnName}`}
                        checked={isInverted}
                        onCheckedChange={handleInversionToggle}
                        className="data-[state=checked]:bg-primary"
                    />
                </div>
            )}
        </div>
    );
};



// DateRangeFilter, NumericRangeFilter, TextSearchFilter components
// (Keep your existing implementations for these, no changes needed for inversion)
interface DateRangeFilterProps {
    config: FilterConfig;
    value: { start: Date | null; end: Date | null };
    onChange: (val: { start: Date | null; end: Date | null }) => void;
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ config, value, onChange }) => {
    // ... Your existing DateRangeFilter code ...
    const [startDate, setStartDate] = useState<Date | undefined>(value.start ?? undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(value.end ?? undefined);
    const handleApply = () => onChange({ start: startDate ?? null, end: endDate ?? null });
    const handleClear = () => { setStartDate(undefined); setEndDate(undefined); onChange({ start: null, end: null }); };
    const parseBoundaryDate = (dateVal: any): Date | undefined => { /* your parsing logic */ return dateVal instanceof Date ? dateVal : undefined; };
    const fromDate = parseBoundaryDate(config.min);
    const toDate = parseBoundaryDate(config.max);
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant={"outline"} size="sm" className="w-full justify-start text-left font-normal h-8 text-sm">
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {value.start && value.end ? `${format(value.start, "LLL dd, y")} - ${format(value.end, "LLL dd, y")}`
                        : value.start ? `From ${format(value.start, "LLL dd, y")}`
                        : value.end ? `Until ${format(value.end, "LLL dd, y")}`
                        : <span>Pick a date range</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="range"
                    selected={{ from: startDate, to: endDate }}
                    onSelect={(range) => { setStartDate(range?.from); setEndDate(range?.to);}}
                    initialFocus
                    numberOfMonths={2}
                    fromDate={fromDate}
                    toDate={toDate}
                    disabled={
                        !fromDate && !toDate
                            ? undefined
                            : (date: Date) => {
                                if (fromDate && date < fromDate) return true;
                                if (toDate && date > toDate) return true;
                                return false;
                            }
                    }
                />
                <div className="p-2 border-t flex justify-between items-center">
                    <Button variant="ghost" size="sm" onClick={handleClear} disabled={!value.start && !value.end}>Clear</Button>
                    <Button size="sm" onClick={handleApply}>Apply</Button>
                </div>
            </PopoverContent>
        </Popover>
    );
};

interface NumericRangeFilterProps {
    config: FilterConfig;
    value: { min: number | null; max: number | null };
    onChange: (val: { min: number | null; max: number | null }) => void;
}

const NumericRangeFilter: React.FC<NumericRangeFilterProps> = ({ config, value, onChange }) => {
    const [minVal, setMinVal] = useState<string>(value.min?.toString() ?? '');
    const [maxVal, setMaxVal] = useState<string>(value.max?.toString() ?? '');
    const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => { setMinVal(e.target.value); const num = e.target.value === '' ? null : parseFloat(e.target.value); if (num === null || !isNaN(num)) onChange({ ...value, min: num });};
    const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => { setMaxVal(e.target.value); const num = e.target.value === '' ? null : parseFloat(e.target.value); if (num === null || !isNaN(num)) onChange({ ...value, max: num });};
    return (
        <div className="flex items-center gap-1.5">
             <Input type="number" placeholder={`Min (${config.min?.toLocaleString() ?? 'any'})`} value={minVal} onChange={handleMinChange} className="h-8 text-sm" min={typeof config.min === 'number' ? config.min : undefined} max={typeof config.max === 'number' ? config.max : undefined} step="any"/>
             <span className='text-muted-foreground text-sm'>-</span>
            <Input type="number" placeholder={`Max (${config.max?.toLocaleString() ?? 'any'})`} value={maxVal} onChange={handleMaxChange} className="h-8 text-sm" min={typeof config.min === 'number' ? config.min : undefined} max={typeof config.max === 'number' ? config.max : undefined} step="any"/>
        </div>
    );
};

interface TextSearchFilterProps {
    config: FilterConfig;
    value: string;
    onChange: (val: string) => void;
}

const TextSearchFilter: React.FC<TextSearchFilterProps> = ({ config, value, onChange }) => {
    return (
        <Input
            type="text"
            placeholder={`Search ${config.label}...`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 text-sm"
        />
    );
};


export const FilterControls: React.FC<FilterControlsProps> = ({
    availableFilters,
    activeFilters,
    onFilterChange,
    onClearAllFilters,
    resultsCount,
    filteredCount
}) => {
    const activeFilterCount = useMemo(() => {
        return Object.keys(activeFilters).filter(key => isFilterActive(key, activeFilters)).length;
    }, [activeFilters]);

    // Modified handleValueChange to correctly pass CategoricalFilterValue structure
    const handleValueChange = useCallback((columnName: string, filterType: FilterType, newValue: any) => {
        let activeValueToSet: ActiveFilterValue | null = null;

        switch (filterType) {
            case 'categorical':
                // newValue here is expected to be ActualCategoricalFilterValue | null from CategoricalFilter component
                if (newValue && ( (newValue as ActualCategoricalFilterValue).selected.length > 0 || (newValue as ActualCategoricalFilterValue).isInverted)) {
                    activeValueToSet = newValue as ActualCategoricalFilterValue;
                } else {
                    activeValueToSet = null; // Clear if no selection and not inverted
                }
                break;
            case 'dateRange':
                activeValueToSet = (newValue.start || newValue.end) ? { type: 'dateRange', start: newValue.start, end: newValue.end } : null;
                break;
            case 'numericRange':
                 activeValueToSet = (newValue.min !== null || newValue.max !== null) ? { type: 'numericRange', min: newValue.min, max: newValue.max } : null;
                 break;
            case 'textSearch':
                activeValueToSet = newValue.trim() !== '' ? { type: 'textSearch', term: newValue } : null;
                break;
        }
        onFilterChange(columnName, activeValueToSet);
    }, [onFilterChange]);

    const renderFilterControl = (config: FilterConfig) => {
        const currentFilterState = activeFilters[config.columnName];

        switch (config.filterType) {
            case 'categorical':
                return (
                    <CategoricalFilter
                        config={config}
                        currentFilterValue={currentFilterState?.type === 'categorical' ? currentFilterState : undefined}
                        onChange={(val) => handleValueChange(config.columnName, 'categorical', val)}
                    />
                );
            case 'dateRange':
                const currentDateRange = currentFilterState?.type === 'dateRange' ? currentFilterState : { start: null, end: null };
                return (
                    <DateRangeFilter
                        config={config}
                        value={currentDateRange}
                        onChange={(val) => handleValueChange(config.columnName, 'dateRange', val)}
                    />
                );
            case 'numericRange':
                const currentNumericRange = currentFilterState?.type === 'numericRange' ? currentFilterState : { min: null, max: null };
                return (
                     <NumericRangeFilter
                        config={config}
                         value={currentNumericRange}
                         onChange={(val) => handleValueChange(config.columnName, 'numericRange', val)}
                    />
                );
            case 'textSearch':
                const currentTextSearch = currentFilterState?.type === 'textSearch' ? currentFilterState.term : '';
                return (
                    <TextSearchFilter
                        config={config}
                        value={currentTextSearch}
                        onChange={(val) => handleValueChange(config.columnName, 'textSearch', val)}
                    />
                );
            default:
                return <p className='text-sm text-red-500'>Unsupported filter type</p>;
        }
    };

    if (availableFilters.length === 0) {
        return null;
    }

    return (
        <div className="p-2 border-b bg-muted/50 flex-shrink-0"> {/* Adjusted padding and background */}
            <Accordion type="single" collapsible className="w-full" defaultValue='filters'>
                <AccordionItem value="filters" className="border-b-0">
                    <AccordionTrigger className="text-sm font-medium py-1.5 hover:no-underline [&[data-state=open]>div>svg.lucide-chevron-down]:rotate-180 group"> {/* Added group for Chevron hover */}
                       <div className='flex items-center justify-between w-full pr-2'>
                            <div className='flex items-center gap-1.5'>
                               <ListFilter className="h-4 w-4 text-primary group-hover:text-primary-focus transition-colors" />
                               <span className="group-hover:text-primary-focus transition-colors">Filters</span>
                               {activeFilterCount > 0 && <Badge variant="secondary" className='ml-1 text-xs'>{activeFilterCount}</Badge>}
                            </div>
                            <div className='text-xs text-muted-foreground flex items-center'>
                                {activeFilterCount > 0 ? `${filteredCount.toLocaleString()} / ${resultsCount.toLocaleString()} rows` : `${resultsCount.toLocaleString()} rows`}
                                <ChevronDown className="h-4 w-4 ml-1 text-muted-foreground transition-transform duration-200" />
                            </div>
                       </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2.5 pb-1.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3 mb-2.5 px-1"> {/* Adjusted gaps and padding */}
                            {availableFilters.map((config) => (
                                <div key={config.columnName} className="bg-background/50 p-2 rounded border border-border/70 shadow-xs"> {/* Added background and border to each filter box */}
                                    <Label className="text-xs font-semibold mb-1 block text-foreground" htmlFor={config.columnName}>
                                        {config.label}
                                        {isFilterActive(config.columnName, activeFilters) && <span className='text-primary ml-0.5'>*</span>}
                                    </Label>
                                    {renderFilterControl(config)}
                                </div>
                            ))}
                        </div>
                         {activeFilterCount > 0 && (
                            <div className='flex justify-end px-1 mt-1.5'>
                                <Button variant="ghost" size="sm" onClick={onClearAllFilters} className='text-xs h-7 text-muted-foreground hover:text-destructive'>
                                    <X className="mr-1 h-3.5 w-3.5" /> Clear All Filters
                                </Button>
                            </div>
                         )}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
};