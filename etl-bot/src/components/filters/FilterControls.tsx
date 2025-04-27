// frontend/src/components/filters/FilterControls.tsx
import React, { useState, useMemo } from 'react';
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
import { X, ListFilter, Calendar as CalendarIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Basic select
import { Checkbox } from "@/components/ui/checkbox"; // For multi-select simulation
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar"; // Requires react-day-picker
import { format, parseISO, isValid } from 'date-fns'; // Date handling

import { FilterConfig, ActiveFilters, FilterControlsProps, ActiveFilterValue } from './filterTypes';

// Helper to check if a filter type is active
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

// Simple multi-select simulation using Checkboxes in a Popover
const CategoricalFilter: React.FC<{
    config: FilterConfig;
    value: string[];
    onChange: (selected: string[]) => void;
}> = ({ config, value, onChange }) => {
    const options = config.options || [];
    const MAX_OPTIONS_DISPLAY = 10; // Show limited options initially

    const handleCheckboxChange = (option: string, checked: boolean) => {
        const newSelected = checked
            ? [...value, option]
            : value.filter(item => item !== option);
        onChange(newSelected);
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8">
                    {value.length === 0
                        ? `Select ${config.label}...`
                        : value.length === 1
                            ? value[0]
                            : `${value.length} selected`}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <div className='p-2 border-b'>
                     <p className='text-xs font-medium'>{config.label}</p>
                </div>
                <ScrollArea className="h-[200px] w-[200px]">
                    <div className="p-2 space-y-1.5">
                        {options.length === 0 && <p className="text-xs text-muted-foreground p-2 text-center">No options</p>}
                        {options.map((option) => (
                            <div key={option} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`${config.columnName}-${option}`}
                                    checked={value.includes(option)}
                                    onCheckedChange={(checked) => handleCheckboxChange(option, !!checked)}
                                    className='h-3.5 w-3.5'
                                />
                                <Label
                                    htmlFor={`${config.columnName}-${option}`}
                                    className="text-xs font-normal truncate"
                                    title={option}
                                >
                                    {option || <i className='text-muted-foreground'>(empty)</i>}
                                </Label>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                 {value.length > 0 && (
                    <div className="p-1 border-t">
                        <Button variant="ghost" size="xs" className="w-full h-6 text-xs" onClick={() => onChange([])}>
                            Clear Selection
                        </Button>
                    </div>
                 )}
            </PopoverContent>
        </Popover>
    );
};

const DateRangeFilter: React.FC<{
    config: FilterConfig;
    value: { start: Date | null; end: Date | null };
    onChange: (range: { start: Date | null; end: Date | null }) => void;
}> = ({ config, value, onChange }) => {
    const [startDate, setStartDate] = useState<Date | undefined>(value.start ?? undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(value.end ?? undefined);

    const handleApply = () => {
        onChange({ start: startDate ?? null, end: endDate ?? null });
    }

    const handleClear = () => {
        setStartDate(undefined);
        setEndDate(undefined);
        onChange({ start: null, end: null });
    }

    // Try to parse min/max if they exist
    const parseBoundaryDate = (dateVal: string | number | Date | null | undefined): Date | undefined => {
        if (!dateVal) return undefined;
        if (dateVal instanceof Date) return isValid(dateVal) ? dateVal : undefined;
        try {
            const parsed = typeof dateVal === 'string' ? parseISO(dateVal) : new Date(dateVal);
            return isValid(parsed) ? parsed : undefined;
        } catch {
            return undefined;
        }
    };

    const fromDate = parseBoundaryDate(config.min);
    const toDate = parseBoundaryDate(config.max);

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    size="sm"
                    className="w-full justify-start text-left font-normal h-8 text-xs"
                >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {value.start && value.end
                        ? `${format(value.start, "LLL dd, y")} - ${format(value.end, "LLL dd, y")}`
                        : value.start
                            ? `From ${format(value.start, "LLL dd, y")}`
                            : value.end
                                ? `Until ${format(value.end, "LLL dd, y")}`
                                : <span>Pick a date range</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="range"
                    selected={{ from: startDate, to: endDate }}
                    onSelect={(range) => {
                        setStartDate(range?.from);
                        setEndDate(range?.to);
                    }}
                    initialFocus
                    numberOfMonths={2}
                    fromDate={fromDate}
                    toDate={toDate}
                    disabled={!fromDate && !toDate ? undefined : (date) => // Disable dates outside the data range
                         (fromDate && date < fromDate) || (toDate && date > toDate)
                    }
                />
                <div className="p-2 border-t flex justify-between items-center">
                    <Button variant="ghost" size="xs" onClick={handleClear} disabled={!value.start && !value.end}>Clear</Button>
                    <Button size="xs" onClick={handleApply}>Apply</Button>
                </div>
            </PopoverContent>
        </Popover>
    );
};

const NumericRangeFilter: React.FC<{
    config: FilterConfig;
    value: { min: number | null; max: number | null };
    onChange: (range: { min: number | null; max: number | null }) => void;
}> = ({ config, value, onChange }) => {
    const [minVal, setMinVal] = useState<string>(value.min?.toString() ?? '');
    const [maxVal, setMaxVal] = useState<string>(value.max?.toString() ?? '');

    const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setMinVal(e.target.value);
        const num = e.target.value === '' ? null : parseFloat(e.target.value);
        if (num === null || !isNaN(num)) {
            onChange({ ...value, min: num });
        }
    };

    const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setMaxVal(e.target.value);
        const num = e.target.value === '' ? null : parseFloat(e.target.value);
        if (num === null || !isNaN(num)) {
            onChange({ ...value, max: num });
        }
    };

    return (
        <div className="flex items-center gap-1.5">
             <Input
                type="number"
                placeholder={`Min (${config.min?.toLocaleString() ?? 'any'})`}
                value={minVal}
                onChange={handleMinChange}
                className="h-8 text-xs"
                min={config.min ?? undefined}
                max={config.max ?? undefined}
                step="any" // Allow decimals
             />
             <span className='text-muted-foreground text-xs'>-</span>
            <Input
                type="number"
                placeholder={`Max (${config.max?.toLocaleString() ?? 'any'})`}
                value={maxVal}
                onChange={handleMaxChange}
                className="h-8 text-xs"
                min={config.min ?? undefined}
                max={config.max ?? undefined}
                step="any"
            />
        </div>
    );
};

const TextSearchFilter: React.FC<{
    config: FilterConfig;
    value: string;
    onChange: (term: string) => void;
}> = ({ config, value, onChange }) => {
    return (
        <Input
            type="text"
            placeholder={`Search ${config.label}...`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 text-xs"
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

    const handleValueChange = (columnName: string, filterType: FilterType, newValue: any) => {
        let activeValue: ActiveFilterValue | null = null;

        switch (filterType) {
            case 'categorical':
                activeValue = newValue.length > 0 ? { type: 'categorical', selected: newValue } : null;
                break;
            case 'dateRange':
                activeValue = (newValue.start || newValue.end) ? { type: 'dateRange', start: newValue.start, end: newValue.end } : null;
                break;
            case 'numericRange':
                 activeValue = (newValue.min !== null || newValue.max !== null) ? { type: 'numericRange', min: newValue.min, max: newValue.max } : null;
                 break;
            case 'textSearch':
                activeValue = newValue.trim() !== '' ? { type: 'textSearch', term: newValue } : null;
                break;
        }
        onFilterChange(columnName, activeValue);
    };

    const renderFilterControl = (config: FilterConfig) => {
        const currentValue = activeFilters[config.columnName];

        switch (config.filterType) {
            case 'categorical':
                return (
                    <CategoricalFilter
                        config={config}
                        value={(currentValue as any)?.selected ?? []}
                        onChange={(val) => handleValueChange(config.columnName, 'categorical', val)}
                    />
                );
            case 'dateRange':
                return (
                    <DateRangeFilter
                        config={config}
                        value={(currentValue as any) ?? { start: null, end: null }}
                        onChange={(val) => handleValueChange(config.columnName, 'dateRange', val)}
                    />
                );
            case 'numericRange':
                return (
                     <NumericRangeFilter
                        config={config}
                         value={(currentValue as any) ?? { min: null, max: null }}
                         onChange={(val) => handleValueChange(config.columnName, 'numericRange', val)}
                    />
                );
            case 'textSearch':
                return (
                    <TextSearchFilter
                        config={config}
                        value={(currentValue as any)?.term ?? ''}
                        onChange={(val) => handleValueChange(config.columnName, 'textSearch', val)}
                    />
                );
            default:
                return <p className='text-xs text-red-500'>Unsupported filter type</p>;
        }
    };

    if (availableFilters.length === 0) {
        return null; // Don't render anything if no filters can be generated
    }

    return (
        <div className="p-2 border-b bg-muted/50 flex-shrink-0">
            <Accordion type="single" collapsible className="w-full" defaultValue='filters'>
                <AccordionItem value="filters" className="border-b-0">
                    <AccordionTrigger className="text-sm font-medium py-1 hover:no-underline [&[data-state=open]>div>svg]:rotate-180">
                       <div className='flex items-center justify-between w-full pr-2'>
                            <div className='flex items-center gap-1.5'>
                               <ListFilter className="h-4 w-4" />
                                Filters
                               {activeFilterCount > 0 && <Badge variant="secondary" className='ml-1'>{activeFilterCount}</Badge>}
                            </div>
                            <div className='text-xs text-muted-foreground'>
                                {activeFilterCount > 0 ? `${filteredCount.toLocaleString()} / ${resultsCount.toLocaleString()} rows` : `${resultsCount.toLocaleString()} rows`}
                            </div>
                       </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2.5 mb-2 px-1">
                            {availableFilters.map((config) => (
                                <div key={config.columnName}>
                                    <Label className="text-xs font-medium mb-1 block" htmlFor={config.columnName}>
                                        {config.label}
                                        {isFilterActive(config.columnName, activeFilters) && <span className='text-primary ml-1'>*</span>}
                                    </Label>
                                    {renderFilterControl(config)}
                                </div>
                            ))}
                        </div>
                         {activeFilterCount > 0 && (
                            <div className='flex justify-end px-1 mt-1'>
                                <Button variant="ghost" size="sm" onClick={onClearAllFilters} className='text-xs h-7'>
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