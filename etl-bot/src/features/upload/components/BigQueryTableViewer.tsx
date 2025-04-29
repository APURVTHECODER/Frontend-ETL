import React, { useEffect, useState, useRef, useCallback, useMemo } from "react"; // Added useMemo
import axios, { AxiosError } from "axios";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import axiosInstance from '@/lib/axios-instance';
import { ChatbotWindow } from "@/components/chatbot/ChatbotWindow";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Loader2, Terminal, Search, Database, BrainCircuit, ListTree, Bookmark,
    Code, Table2, RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft,
    ChevronsRight, Download, SortAsc, SortDesc, ArrowUpDown, Info,
    BarChart4,
    LineChart as LineChartIcon, PieChart as PieChartIcon, Dot , Trash2 , GripVertical ,History,Copy,
    ListFilter, // Added Filter icon
    MessageSquare,X,
} from "lucide-react";
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, ScatterChart, Scatter,
    XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from "@/components/ui/tooltip";
import {
    Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// --- Import Filter Components and Types ---
import { FilterConfig, ActiveFilters, ActiveFilterValue, FilterType } from '@/components/filters/filterTypes';
import { parseISO, isValid } from 'date-fns'; // Import date-fns for parsing
import { FilterControls } from "@/components/filters/FilterControls";
// --- Interfaces (Keep existing ones) ---
interface TableInfo { tableId: string; }
interface RowData { [col: string]: any; }
interface TableStats { rowCount: number; sizeBytes: number; lastModified: string; }
interface JobSubmitResponse { job_id: string; state: string; location: string; message: string; }
interface JobStatusResponse { job_id: string; state: 'PENDING' | 'RUNNING' | 'DONE'; location: string; statement_type?: string; error_result?: { reason?: string; location?: string; message?: string; }; user_email?: string; creation_time?: string; start_time?: string; end_time?: string; total_bytes_processed?: number; num_dml_affected_rows?: number; }
interface JobResultSchemaField { name: string; type: string; mode: string; }
interface JobResultsResponse { rows: RowData[]; total_rows_in_result_set?: number; next_page_token?: string | null; schema?: JobResultSchemaField[]; }
interface ColumnInfo { name: string; type: string; mode: string; }
interface TableSchema { table_id: string; columns: ColumnInfo[]; }
interface SchemaResponse { dataset_id: string; tables: TableSchema[]; }
interface NLQueryResponse { generated_sql?: string | null; error?: string | null; }
interface QueryHistoryItem { id: string; sql: string; timestamp: string; success: boolean; rowCount?: number; }
interface VizSuggestion {
    chart_type: 'bar' | 'line' | 'pie' | 'scatter';
    x_axis_column: string;
    y_axis_columns: string[];
    rationale: string;
}
interface ActiveVisualizationConfig extends VizSuggestion {
    // You might add specific display settings here later
}

const BigQueryTableViewer: React.FC = () => {
    const datasetId = "crafty-tracker-457215-g6.sample78600";

    // --- State Variables (Keep existing ones) ---
    const [tables, setTables] = useState<TableInfo[]>([]);
    const [filteredTables, setFilteredTables] = useState<TableInfo[]>([]);
    const [listTablesError, setListTablesError] = useState<string>("");
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [previewColumns, setPreviewColumns] = useState<string[]>([]);
    const [previewRows, setPreviewRows] = useState<RowData[]>([]);
    const [loadingTables, setLoadingTables] = useState<boolean>(true);
    const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
    const [previewError, setPreviewError] = useState<string>("");
    const [previewCurrentPage, setPreviewCurrentPage] = useState<number>(1);
    const [previewRowsPerPage, setPreviewRowsPerPage] = useState<number>(10);
    const [previewTotalRows, setPreviewTotalRows] = useState<number>(0);
    const [previewSortConfig, setPreviewSortConfig] = useState<{ key: string; direction: "asc" | "desc"; } | null>(null);
    const [tableStats, setTableStats] = useState<TableStats | null>(null);
    const [sql, setSql] = useState<string>(`-- Welcome! Select a table or use AI ✨\nSELECT 1;`);
    const [jobId, setJobId] = useState<string | null>(null);
    const [jobLocation, setJobLocation] = useState<string | null>(null);
    const [jobStatus, setJobStatus] = useState<JobStatusResponse | null>(null);
    const [isRunningJob, setIsRunningJob] = useState<boolean>(false);
    const [jobError, setJobError] = useState<string>("");
    const [jobResults, setJobResults] = useState<JobResultsResponse | null>(null); // Keep this for original data
    const [loadingResults, setLoadingResults] = useState<boolean>(false);
    const [currentResultsPageToken, setCurrentResultsPageToken] = useState<string | null>(null);
    const [resultsError, setResultsError] = useState<string>("");
    const [schemaData, setSchemaData] = useState<SchemaResponse | null>(null);
    const [loadingSchema, setLoadingSchema] = useState<boolean>(false);
    const [schemaError, setSchemaError] = useState<string>("");
    const [nlPrompt, setNlPrompt] = useState<string>("");
    const [generatingSql, setGeneratingSql] = useState<boolean>(false);
    const [nlError, setNlError] = useState<string>("");
    const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([]);
    const [favoriteTables, setFavoriteTables] = useState<string[]>([]);
    const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
    const [currentSidebarTab, setCurrentSidebarTab] = useState<string>("tables");
    const [currentOutputTab, setCurrentOutputTab] = useState<string>("data");
    const [tableSearchQuery, setTableSearchQuery] = useState<string>("");
    const [schemaSearchQuery, setSchemaSearchQuery] = useState<string>("");
    const [historySearchQuery, setHistorySearchQuery] = useState<string>("");
    const [editorPaneHeight, setEditorPaneHeight] = useState<number>(200);
    const [isResizingEditor, setIsResizingEditor] = useState<boolean>(false);
    const [showNlSection, setShowNlSection] = useState<boolean>(true);
    const [isChatOpen, setIsChatOpen] = useState<boolean>(false); // State for chatbot visibility
    const [suggestedCharts, setSuggestedCharts] = useState<VizSuggestion[]>([]);
    const [activeVisualization, setActiveVisualization] = useState<ActiveVisualizationConfig | null>(null);
    const [loadingAiSuggestions, setLoadingAiSuggestions] = useState<boolean>(false);
    const [aiSuggestionError, setAiSuggestionError] = useState<string>("");

    // --- State for Filters ---
    const [availableFilters, setAvailableFilters] = useState<FilterConfig[]>([]);
    const [activeFilters, setActiveFilters] = useState<ActiveFilters>({});


    // --- Refs ---
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const editorPaneRef = useRef<HTMLDivElement>(null);
    const resizeHandleRef = useRef<HTMLDivElement>(null);
    const POLLING_INTERVAL_MS = 3000;

    // --- Utility Functions (Keep existing ones) ---
    const getErrorMessage = useCallback((error: any): string => { if(axios.isAxiosError(error)){const d=error.response?.data; if(d && typeof d==='object' && 'detail' in d)return String(d.detail); if(typeof d==='string')return d; return error.message;} if(error instanceof Error)return error.message; return"An unknown error occurred."; }, []);
    const formatBytes = useCallback((bytes: number | null | undefined): string => { if(bytes==null||bytes===undefined||bytes===0)return"0 Bytes"; const k=1024,s=["Bytes","KB","MB","GB","TB"],i=Math.floor(Math.log(bytes)/Math.log(k)); return parseFloat((bytes/Math.pow(k,i)).toFixed(2))+" "+s[i]; }, []);
    const formatDate = useCallback((dateString: string | null | undefined): string => { if(!dateString)return"N/A"; try{return new Date(dateString).toLocaleString();}catch(e){return dateString;} }, []);
    const copyToClipboard = useCallback((text: string, message: string = "Copied!"): void => { navigator.clipboard.writeText(text).then(()=>{console.log(message); /* TODO: Add toast */}).catch(err=>{console.error("Copy failed:",err);}); }, []);
    const toggleFavorite = useCallback((tableId: string): void => setFavoriteTables(prev => prev.includes(tableId)?prev.filter(id=>id!==tableId):[...prev,tableId]), []);
    const addToHistory = useCallback((newItem: Omit<QueryHistoryItem, 'id' | 'timestamp'>): void => { const ts=new Date().toISOString(),id=`q-${Date.now()}`; setQueryHistory(prev=>[{...newItem,id,timestamp:ts},...prev.slice(0,49)]);}, []);

    // --- API Callbacks (Keep existing ones) ---
    const stopPolling = useCallback(() => { if(pollingIntervalRef.current){clearInterval(pollingIntervalRef.current); pollingIntervalRef.current=null; console.log("Polling stopped.");} }, []);
    // fetchJobResults: Modified to set original results in jobResults
    const fetchJobResults = useCallback(async (currentJobId: string, loc: string, pageToken?: string | null) => {
        console.log(`Fetching results job ${currentJobId}, page: ${pageToken ? 'next' : 'first'}`);
        setLoadingResults(true);
        setResultsError("");
        try {
            const p = new URLSearchParams({ location: loc, max_results: '100' }); // Consider a larger fetch? Maybe 1000? Depends on performance.
            if (pageToken) p.append('page_token', pageToken);
            const r = await axiosInstance.get<JobResultsResponse>(`/api/bigquery/jobs/${currentJobId}/results?${p.toString()}`);
            const fetchedData = r.data;

            // Append results if paginating, otherwise set new results
            setJobResults(prevResults => {
                if (pageToken && prevResults) {
                    return {
                        ...fetchedData,
                        rows: [...prevResults.rows, ...fetchedData.rows], // Append new rows
                        // Keep the latest next_page_token
                    };
                } else {
                    return fetchedData; // Set fresh results
                }
            });

            // Update the current page token state regardless
            setCurrentResultsPageToken(fetchedData.next_page_token ?? null);

            // Don't automatically switch tab here, let user decide or logic below handle it
            // setCurrentOutputTab("results");

        } catch (e) {
            console.error("Error fetching results:", e);
            setResultsError(`Fetch results failed: ${getErrorMessage(e)}`);
            setJobResults(null); // Clear results on error
        } finally {
            setLoadingResults(false);
        }
    }, [getErrorMessage]); // Removed setCurrentOutputTab dependency

    // fetchJobStatus: Mostly unchanged, triggers fetchJobResults
    const fetchJobStatus = useCallback(async (currentJobId: string, loc: string) => { console.log(`Polling job: ${currentJobId}`); setJobError(""); try { const r=await axiosInstance.get<JobStatusResponse>(`/api/bigquery/jobs/${currentJobId}?location=${loc}`); const d=r.data; setJobStatus(d); if(d.state==='DONE'){ stopPolling(); setIsRunningJob(false); if(d.error_result){ const errMsg=`Job failed: ${d.error_result.message||d.error_result.reason||'Unknown'}`; setJobError(errMsg); setJobResults(null); addToHistory({sql,success:false}); } else { setJobError(""); setCurrentOutputTab("results"); // Switch to results tab on SUCCESSFUL completion
                 if(d.statement_type==='SELECT'||d.statement_type===undefined){ await fetchJobResults(currentJobId,loc); // Fetch first page
                } else { setJobResults({rows:[],total_rows_in_result_set:d.num_dml_affected_rows??0,schema:[]}); addToHistory({sql,success:true,rowCount:d.num_dml_affected_rows}); } } } else { setIsRunningJob(true); } } catch (e:any){ console.error("Error fetching status:",e); const m=getErrorMessage(e); if(e.response?.status===404){ setJobError(`Job ${currentJobId} not found.`); stopPolling(); setIsRunningJob(false); addToHistory({sql,success:false}); } else { setJobError(`Fetch status failed: ${m}`); } } }, [stopPolling, fetchJobResults, sql, addToHistory, getErrorMessage]); // Added setCurrentOutputTab dependency indirectly via fetchJobResults

    // submitSqlJob: Mostly unchanged, clears previous results
    const submitSqlJob = useCallback(async () => {
        console.log("Submitting SQL:", sql);
        stopPolling();
        setJobId(null);
        setJobLocation(null);
        setJobStatus(null);
        setJobError("");
        setJobResults(null); // Clear previous results immediately
        setResultsError("");
        setActiveFilters({}); // Clear filters for new query
        setActiveVisualization(null); // Clear active viz for new query
        setSuggestedCharts([]); // Clear suggestions
        setIsRunningJob(true);
        setCurrentOutputTab("results"); // Switch to results tab immediately
        try {
            const r = await axiosInstance.post<JobSubmitResponse>("/api/bigquery/jobs", { sql });
            const { job_id, location, state } = r.data;
            console.log("Job Submitted:", r.data);
            setJobId(job_id);
            setJobLocation(location);
            setJobStatus({ job_id, location, state: state as any });
        } catch (e: any) {
            console.error("Error submitting job:", e);
            const errMsg = `Submit failed: ${getErrorMessage(e)}`;
            setJobError(errMsg);
            setIsRunningJob(false);
            setJobId(null);
            setJobLocation(null);
            addToHistory({ sql, success: false });
        }
    }, [sql, stopPolling, addToHistory, getErrorMessage]);

    // fetchTables, handleTableSelect, etc remain unchanged for now
    const fetchTables = useCallback(async () => { setLoadingTables(true); setListTablesError(""); try { const r=await axiosInstance.get<TableInfo[]>(`/api/bigquery/tables?dataset_id=${encodeURIComponent(datasetId)}`); setTables(r.data); setFilteredTables(r.data); } catch (e:any){ console.error("Error fetching tables:",e); setListTablesError(`Load tables failed: ${getErrorMessage(e)}`); } finally { setLoadingTables(false); } }, [datasetId, getErrorMessage]);
    const handleTableSelect = useCallback(async (tableId: string) => {
        stopPolling();
        setIsRunningJob(false);
        setJobId(null);
        setJobLocation(null);
        setJobStatus(null);
        setJobError("");
        setJobResults(null); // Clear query results when selecting preview
        setResultsError("");
        setActiveFilters({}); // Clear filters
        setActiveVisualization(null); // Clear viz
        setSuggestedCharts([]); // Clear suggestions
        setSelectedTableId(tableId);
        setLoadingPreview(true);
        setPreviewError("");
        setPreviewRows([]);
        setPreviewColumns([]);
        setPreviewCurrentPage(1);
        setTableStats(null);
        setPreviewSortConfig(null);
        const defaultSql = `SELECT *\nFROM \`${datasetId}.${tableId}\`\nLIMIT 100;`;
        setSql(defaultSql);
        setCurrentOutputTab("data"); // Switch to PREVIEW tab
        try {
            const url = `/api/bigquery/table-data?dataset_id=${encodeURIComponent(datasetId)}&table_id=${encodeURIComponent(tableId)}&page=1&limit=${previewRowsPerPage}`;
            const r = await axiosInstance.get(url);
            const d = r.data;
            setPreviewRows(d?.rows ?? []);
            setPreviewTotalRows(d?.totalRows ?? (d?.rows?.length ?? 0));
            setTableStats(d?.stats ?? null);
            if (d?.rows?.length > 0) setPreviewColumns(Object.keys(d.rows[0]));
            else setPreviewColumns([]);
        } catch (e: any) {
            console.error("Error fetching table data:", e);
            setPreviewError(`Load preview failed: ${getErrorMessage(e)}`);
        } finally {
            setLoadingPreview(false);
        }
     }, [datasetId, previewRowsPerPage, stopPolling, getErrorMessage]); // Dependencies remain the same
    const handlePreviewPageChange = useCallback(async (newPage: number) => { if(!selectedTableId||newPage===previewCurrentPage)return; setLoadingPreview(true); setPreviewError(""); try { const url=`/api/bigquery/table-data?dataset_id=${encodeURIComponent(datasetId)}&table_id=${encodeURIComponent(selectedTableId)}&page=${newPage}&limit=${previewRowsPerPage}`; const r=await axiosInstance.get(url); const d=r.data; setPreviewRows(d?.rows??[]); setPreviewCurrentPage(newPage); if((d?.rows?.length>0)&&previewColumns.length===0)setPreviewColumns(Object.keys(d.rows[0])); } catch (e:any){ console.error("Error fetching page data:",e); setPreviewError(`Load page ${newPage} failed: ${getErrorMessage(e)}`); } finally { setLoadingPreview(false); } }, [selectedTableId, previewCurrentPage, previewRowsPerPage, datasetId, previewColumns.length, getErrorMessage]);
    const handlePreviewRowsPerPageChange = useCallback((value: string) => { const n=parseInt(value,10); setPreviewRowsPerPage(n); setPreviewCurrentPage(1); if(selectedTableId)handleTableSelect(selectedTableId);}, [selectedTableId, handleTableSelect]);
    const handlePreviewSort = useCallback((columnName: string) => { let d:"asc"|"desc"="asc"; if(previewSortConfig?.key===columnName&&previewSortConfig.direction==="asc")d="desc"; setPreviewSortConfig({key:columnName,direction:d}); const s=[...previewRows].sort((a,b)=>{ const valA=a[columnName], valB=b[columnName]; if(valA==null)return 1; if(valB==null)return -1; if(valA<valB)return d==="asc"?-1:1; if(valA>valB)return d==="asc"?1:-1; return 0; }); setPreviewRows(s);}, [previewSortConfig, previewRows]);
    const fetchSchema = useCallback(async () => { setLoadingSchema(true); setSchemaError(""); setSchemaData(null); try { const url=`/api/bigquery/schema?dataset_id=${encodeURIComponent(datasetId)}`; const r=await axiosInstance.get<SchemaResponse>(url); setSchemaData(r.data); } catch(e){ console.error("Error fetching schema:",e); setSchemaError(`Load schema failed: ${getErrorMessage(e)}`); } finally { setLoadingSchema(false); } }, [datasetId, getErrorMessage]);
    const handleGenerateSql = useCallback(async () => { if(!nlPrompt.trim()){setNlError("Please enter a description.");return;} setGeneratingSql(true); setNlError(""); setJobError(""); setJobResults(null); setJobStatus(null); setJobId(null); stopPolling(); setActiveFilters({}); setActiveVisualization(null); setSuggestedCharts([]); try { const r=await axiosInstance.post<NLQueryResponse>('/api/bigquery/nl2sql',{prompt:nlPrompt,dataset_id:datasetId}); if(r.data.error){setNlError(r.data.error);} else if(r.data.generated_sql){setSql(r.data.generated_sql); setNlPrompt("");} else {setNlError("AI did not return valid SQL.");} } catch(e){ console.error("Error generating SQL:",e); setNlError(`Generate SQL failed: ${getErrorMessage(e)}`); } finally { setGeneratingSql(false); } }, [nlPrompt, datasetId, stopPolling, getErrorMessage]);


    // --- Filter Generation Effect ---
    useEffect(() => {
        if (jobResults?.rows && jobResults.rows.length > 0 && jobResults.schema) {
            const schema = jobResults.schema;
            const rows = jobResults.rows;
            const generatedFilters: FilterConfig[] = [];
            const MAX_CATEGORICAL_OPTIONS = 100; // Limit unique values for performance

            console.log("Generating filters from results...");

            schema.forEach(field => {
                let filterType: FilterType | null = null;
                let options: string[] | undefined = undefined;
                let min: number | Date | null = null;
                let max: number | Date | null = null;

                const dataType = field.type.toUpperCase();
                const columnName = field.name;

                // --- Logic to determine filter type and calculate options/min/max ---
                if (['STRING'].includes(dataType)) {
                    const uniqueValues = new Set(rows.map(row => String(row[columnName] ?? ''))); // Coerce to string, handle null
                    if (uniqueValues.size <= MAX_CATEGORICAL_OPTIONS && uniqueValues.size > 1) {
                        filterType = 'categorical';
                        options = Array.from(uniqueValues).sort((a, b) => a.localeCompare(b));
                    } else if (uniqueValues.size > 1) { // Only allow text search if there's some variation
                        filterType = 'textSearch';
                    }
                } else if (['INTEGER', 'INT64', 'FLOAT', 'FLOAT64', 'NUMERIC', 'BIGNUMERIC'].includes(dataType)) {
                    const values = rows.map(row => row[columnName]).filter(v => v !== null && v !== undefined);
                    if (values.length > 0) {
                        try {
                            // Attempt conversion, careful with large numbers/different types
                            const numericValues = values.map(v => Number(v));
                            min = Math.min(...numericValues);
                            max = Math.max(...numericValues);
                            if (!isNaN(min) && !isNaN(max) && min !== max) { // Only add if valid and range exists
                                filterType = 'numericRange';
                            } else {
                                console.warn(`Could not derive valid numeric range for ${columnName}`);
                            }
                        } catch (e) {
                            console.warn(`Error calculating min/max for ${columnName}: ${e}`);
                        }
                    }
                } else if (['DATE', 'DATETIME', 'TIMESTAMP'].includes(dataType)) {
                     const dateValues = rows
                        .map(row => {
                             try {
                                if (row[columnName] === null || row[columnName] === undefined) return null;
                                const dateStr = String(row[columnName]);
                                // Prioritize ISO parsing
                                let parsed = parseISO(dateStr);
                                if (isValid(parsed)) return parsed;
                                // Fallback to Date constructor
                                parsed = new Date(dateStr);
                                if (isValid(parsed)) return parsed;
                                return null;
                             } catch { return null; }
                        })
                        .filter((d): d is Date => d !== null);

                     if (dateValues.length > 0) {
                         const minTime = Math.min(...dateValues.map(d => d.getTime()));
                         const maxTime = Math.max(...dateValues.map(d => d.getTime()));
                         if (minTime !== maxTime) { // Only add if range exists
                             min = new Date(minTime);
                             max = new Date(maxTime);
                             filterType = 'dateRange';
                         }
                     }
                } else if (['BOOLEAN', 'BOOL'].includes(dataType)) {
                    // Example: Boolean as categorical
                    const uniqueValues = new Set(rows.map(row => String(row[columnName] ?? 'null'))); // "true", "false", "null"
                    if (uniqueValues.size > 1) {
                        filterType = 'categorical';
                        options = Array.from(uniqueValues).sort();
                    }
                }

                // Add the filter config if a type was determined
                if (filterType) {
                    generatedFilters.push({
                        columnName: field.name,
                        dataType: field.type,
                        filterType: filterType,
                        label: field.name, // Use column name as label for now
                        options,
                        min,
                        max,
                    });
                }
            });

            console.log("Available filters generated:", generatedFilters);
            setAvailableFilters(generatedFilters);
            setActiveFilters({}); // Reset active filters when results/schema change

        } else {
            // Clear filters if no results/rows/schema
            setAvailableFilters([]);
            setActiveFilters({});
        }
    }, [jobResults?.schema, jobResults?.rows]); // Rerun when schema or rows change


    // --- Calculate Filtered Data ---
    const filteredData = useMemo(() => {
        if (!jobResults?.rows) {
            return []; // No base data
        }
        // Check if any filters are actually active
        const activeFilterKeys = Object.keys(activeFilters).filter(key => {
             const filter = activeFilters[key];
             if (!filter) return false;
             switch (filter.type) {
                 case 'categorical': return filter.selected.length > 0;
                 case 'dateRange': return filter.start !== null || filter.end !== null;
                 case 'numericRange': return filter.min !== null || filter.max !== null;
                 case 'textSearch': return filter.term.trim() !== '';
                 default: return false;
             }
         });

        if (activeFilterKeys.length === 0) {
            return jobResults.rows; // Return original rows if no filters are active
        }

        console.log("Applying filters:", activeFilters);
        let data = [...jobResults.rows];

        Object.entries(activeFilters).forEach(([columnName, filterValue]) => {
             if (!filterValue) return;

            data = data.filter(row => {
                 const rowValue = row[columnName];

                switch (filterValue.type) {
                    case 'categorical':
                        // Handle null/undefined in categorical selection
                        const rowValueString = rowValue === null || rowValue === undefined ? '(empty)' : String(rowValue);
                        return filterValue.selected.includes(rowValueString);

                    case 'numericRange': {
                        if (rowValue === null || rowValue === undefined) return false; // Exclude nulls from range
                        const numValue = Number(rowValue);
                        if (isNaN(numValue)) return false; // Exclude non-numeric values
                        const minOk = filterValue.min === null || numValue >= filterValue.min;
                        const maxOk = filterValue.max === null || numValue <= filterValue.max;
                        return minOk && maxOk;
                    }
                    case 'dateRange': {
                        if (rowValue === null || rowValue === undefined) return false; // Exclude nulls from date range
                        try {
                             let dateValue: Date | null = null;
                             const dateStr = String(rowValue);
                             dateValue = parseISO(dateStr); // Try ISO first
                             if (!isValid(dateValue)) dateValue = new Date(dateStr); // Fallback
                             if (!isValid(dateValue)) return false; // Cannot parse row date

                             const timeValue = dateValue.getTime();

                             // Start date comparison (inclusive)
                             const startOk = !filterValue.start || timeValue >= filterValue.start.getTime();

                             // End date comparison (inclusive of the whole day)
                             let endOfDay = filterValue.end;
                             if (endOfDay) {
                                 endOfDay = new Date(endOfDay);
                                 endOfDay.setHours(23, 59, 59, 999); // Set to end of the selected day
                             }
                             const endOk = !endOfDay || timeValue <= endOfDay.getTime();

                             return startOk && endOk;
                        } catch { return false; }
                     }
                    case 'textSearch':
                         if (rowValue === null || rowValue === undefined) return false; // Exclude nulls from search
                        return String(rowValue).toLowerCase().includes(filterValue.term.toLowerCase());
                    default:
                        return true; // No filter applied for unknown types
                }
            });
        });
        console.log("Filtered data count:", data.length);
        return data;
    }, [jobResults?.rows, activeFilters]);


    // --- Filter Handlers ---
    const handleFilterChange = useCallback((columnName: string, value: ActiveFilterValue | null) => {
        console.log(`Filter change: ${columnName}`, value);
        setActiveFilters(prev => {
            const newState = { ...prev };
            if (value === null ||
                (value.type === 'categorical' && value.selected.length === 0) ||
                (value.type === 'dateRange' && value.start === null && value.end === null) ||
                (value.type === 'numericRange' && value.min === null && value.max === null) ||
                (value.type === 'textSearch' && value.term.trim() === '')
            ) {
                delete newState[columnName]; // Remove filter if value represents "no filter"
            } else {
                newState[columnName] = value;
            }
            return newState;
        });
        // When filters change, check if the active visualization is still valid.
        // The useEffect hook depending on `filteredData` and `activeVisualization` handles this.
    }, []);

    const handleClearAllFilters = useCallback(() => {
        console.log("Clearing all filters");
        setActiveFilters({});
        // Visualization validity check will happen in the useEffect hook.
    }, []);

    // --- Existing Effects ---
    useEffect(() => { if(jobId&&jobLocation&&isRunningJob&&!pollingIntervalRef.current){ fetchJobStatus(jobId,jobLocation); pollingIntervalRef.current=setInterval(()=>{fetchJobStatus(jobId,jobLocation);},POLLING_INTERVAL_MS); console.log("Polling started."); } return()=>{stopPolling();}; }, [jobId,jobLocation,isRunningJob,fetchJobStatus,stopPolling]);
    useEffect(() => { fetchTables(); fetchSchema(); }, [fetchTables, fetchSchema]);
    useEffect(() => { const lq=tableSearchQuery.toLowerCase(); setFilteredTables(tables.filter(t=>t.tableId.toLowerCase().includes(lq))); }, [tableSearchQuery, tables]);
    // Modify history effect to use original row count if available
    useEffect(() => {
        if(jobResults && jobId && !jobError && !isRunningJob && jobStatus?.statement_type === 'SELECT'){
            addToHistory({
                sql,
                success: true,
                // Use total_rows_in_result_set from the original response if available
                rowCount: jobResults.total_rows_in_result_set ?? jobResults.rows.length
            });
        }
     }, [jobResults, jobId, jobError, isRunningJob, sql, addToHistory, jobStatus?.statement_type]);

    // --- Modified Effect for Visualization Suggestions & Validity Check ---
    useEffect(() => {
        // Suggestion generation based on ORIGINAL data
        if (jobResults?.schema && jobResults.rows.length > 0) {
            console.log("Calculating chart suggestions based on original data...");
            const schema = jobResults.schema;
            const rows = jobResults.rows; // Use original rows for rule generation
            const ruleBasedSuggestions: VizSuggestion[] = [];

            // --- Rule generation logic (remains the same as before, using original `rows` and `schema`) ---
            const isNumeric = (type: string) => ['INTEGER', 'INT64', 'FLOAT', 'FLOAT64', 'NUMERIC', 'BIGNUMERIC'].includes(type);
            const isString = (type: string) => type === 'STRING';
            const isDate = (type: string) => ['DATE', 'DATETIME', 'TIMESTAMP'].includes(type);
            const numericCols = schema.filter(f => isNumeric(f.type)).map(f => f.name);
            const stringCols = schema.filter(f => isString(f.type)).map(f => f.name);
            const dateCols = schema.filter(f => isDate(f.type)).map(f => f.name);

            // Rule 1: Bar
            if (stringCols.length === 1 && numericCols.length >= 1) { ruleBasedSuggestions.push({ /* ... */ chart_type: 'bar', x_axis_column: stringCols[0], y_axis_columns: numericCols, rationale: `Compare ${numericCols.join(', ')} across '${stringCols[0]}'.` }); }
            // Rule 2: Line
            if (dateCols.length === 1 && numericCols.length >= 1) {
                const dateColumnName = dateCols[0];
                 // Check using original rows
                const looksLikeValidDate = rows.slice(0, 10).every(row => !row[dateColumnName] || !isNaN(Date.parse(row[dateColumnName])));
                if (looksLikeValidDate) { ruleBasedSuggestions.push({ /* ... */ chart_type: 'line', x_axis_column: dateColumnName, y_axis_columns: numericCols, rationale: `Track ${numericCols.join(', ')} over time ('${dateColumnName}').` }); }
             }
             // Rule 3: Scatter
            if (numericCols.length >= 2) { ruleBasedSuggestions.push({ /* ... */ chart_type: 'scatter', x_axis_column: numericCols[0], y_axis_columns: [numericCols[1]], rationale: `Relationship between '${numericCols[0]}' and '${numericCols[1]}'.` }); }
            // Rule 4: Pie
            if (stringCols.length === 1 && numericCols.length === 1) {
                const categoryCol = stringCols[0];
                const valueCol = numericCols[0];
                 // Check unique categories in original rows
                 const uniqueCategories = new Set(rows.map(r => r[categoryCol]));
                 if (uniqueCategories.size > 1 && uniqueCategories.size <= 12) { ruleBasedSuggestions.push({ chart_type: 'pie', x_axis_column: categoryCol, y_axis_columns: [valueCol], rationale: `Proportion of '${valueCol}' for each '${categoryCol}'.` }); }
            }
            // --- End Rule Generation ---


             // --- Fetch AI Suggestions ---
             const fetchAiSuggestions = async () => {
                if (!jobResults?.schema) return [];
                setLoadingAiSuggestions(true);
                setAiSuggestionError("");
                try {
                    const response = await axiosInstance.post<{suggestions: VizSuggestion[], error?: string}>(
                        '/api/bigquery/suggest-visualization',
                        {
                            schema: jobResults.schema,
                            query_sql: sql,
                            // Send FILTERED sample to AI for potentially better context on current view
                            result_sample: filteredData.slice(0, 5)
                        }
                    );
                    if (response.data.error) {
                        setAiSuggestionError(`AI Error: ${response.data.error}`); return [];
                    }
                    console.log("AI Suggestions Received:", response.data.suggestions);
                    return response.data.suggestions || [];
                } catch (error) {
                    console.error("Error fetching AI suggestions:", error);
                    setAiSuggestionError(`Failed to get AI suggestions: ${getErrorMessage(error)}`); return [];
                } finally { setLoadingAiSuggestions(false); }
             };

            // Combine rule-based and fetch AI ones
             fetchAiSuggestions().then(aiSuggestions => {
                 // De-duplication logic...
                 const combined = [...ruleBasedSuggestions];
                 aiSuggestions.forEach(aiSugg => {
                     if (!combined.some(rbSugg => rbSugg.chart_type === aiSugg.chart_type && rbSugg.x_axis_column === aiSugg.x_axis_column && rbSugg.y_axis_columns[0] === aiSugg.y_axis_columns[0])) {
                         combined.push({...aiSugg, rationale: aiSugg.rationale ?? `AI suggested ${aiSugg.chart_type} chart.` });
                     }
                 });
                 console.log("Final combined suggestions:", combined);
                 setSuggestedCharts(combined);

                 // --- Visualization Validity Check ---
                 if (activeVisualization) {
                     const { x_axis_column, y_axis_columns } = activeVisualization;
                     const currentFilteredData = filteredData; // Check against the currently filtered data

                     // Check if filtered data is empty OR if required columns are missing
                     const isInvalid = currentFilteredData.length === 0 ||
                         (currentFilteredData.length > 0 && (
                             !currentFilteredData[0].hasOwnProperty(x_axis_column) ||
                             !y_axis_columns.every(col => currentFilteredData[0].hasOwnProperty(col))
                         ));

                     if (isInvalid) {
                          console.warn("Active visualization might be invalid due to filtering. Clearing.");
                          setActiveVisualization(null);
                          // Optionally switch back to results tab if visualize was active
                          if (currentOutputTab === 'visualize') {
                              setCurrentOutputTab('results');
                          }
                      }
                  }
                 // --- End Validity Check ---
             });

        } else {
            // Clear suggestions if no original results
            setSuggestedCharts([]);
            setActiveVisualization(null); // Also clear active viz
            if (currentOutputTab === 'visualize') {
                setCurrentOutputTab('results');
            }
        }
    // Dependencies:
    // - jobResults: For generating rules based on original data/schema
    // - filteredData: For sending sample to AI and checking active viz validity
    // - activeVisualization: To know *which* viz to check for validity
    // - sql, getErrorMessage: For AI request context
    // - currentOutputTab: For potentially switching tabs if viz becomes invalid
    }, [jobResults, sql, getErrorMessage, filteredData, activeVisualization, currentOutputTab]);


    // Editor resizing logic (remains unchanged)
    const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => { setIsResizingEditor(true); mouseDownEvent.preventDefault(); }, []);
    useEffect(() => { const handleMouseMove=(e: MouseEvent)=>{if(!isResizingEditor||!editorPaneRef.current)return; const top=editorPaneRef.current.getBoundingClientRect().top; const newH=e.clientY-top; setEditorPaneHeight(Math.max(100,Math.min(newH,window.innerHeight*0.7)));}; const handleMouseUp=()=>setIsResizingEditor(false); if(isResizingEditor){window.addEventListener('mousemove',handleMouseMove); window.addEventListener('mouseup',handleMouseUp);} return()=>{window.removeEventListener('mousemove',handleMouseMove); window.removeEventListener('mouseup',handleMouseUp);}; }, [isResizingEditor]);

    // --- Render Functions ---

    // renderSidebarContent, renderTablesList, renderFavoritesList, renderQueryHistory, renderSchemaViewer, renderTablePreview, renderEditorPane
    // remain IDENTICAL to the previous version.

     const renderSidebarContent = () => { /* ... NO CHANGES ... */
        return (
             <div className="p-3 flex flex-col h-full text-sm">
                <h2 className="font-semibold text-base mb-2 flex items-center text-foreground flex-shrink-0">
                    <Database className="mr-2 h-4 w-4 text-primary" />
                    Dataset Explorer
                </h2>
                <p className="text-xs text-muted-foreground mb-3 truncate flex-shrink-0" title={datasetId}>
                    {datasetId}
                </p>
                <Tabs value={currentSidebarTab} onValueChange={setCurrentSidebarTab} className="flex-grow flex flex-col overflow-hidden">
                    <TabsList className="grid grid-cols-4 mb-3 h-8 bg-muted flex-shrink-0">
                         {/* Tabs use default theme styles */}
                        <TabsTrigger value="tables" className="text-xs h-7"><Database className="mr-1 h-3 w-3"/>Tables</TabsTrigger>
                        {/* <TabsTrigger value="favorites" className="text-xs h-7"><Bookmark className="mr-1 h-3 w-3"/>Favorites</TabsTrigger>
                        <TabsTrigger value="history" className="text-xs h-7"><History className="mr-1 h-3 w-3"/>History</TabsTrigger>
                        <TabsTrigger value="schema" className="text-xs h-7"><ListTree className="mr-1 h-3 w-3"/>Schema</TabsTrigger> */}
                    </TabsList>
                    <div className="flex-grow overflow-hidden">
                        <TabsContent value="tables" className="mt-0 h-full flex flex-col">
                            <div className="mb-2 relative flex-shrink-0">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Filter tables..." value={tableSearchQuery} onChange={(e)=>setTableSearchQuery(e.target.value)} className="pl-9 h-8 text-xs" />
                            </div>
                            <div className="flex-grow overflow-hidden"> {renderTablesList()} </div>
                        </TabsContent>
                        <TabsContent value="favorites" className="mt-0 h-full overflow-hidden"> {renderFavoritesList()} </TabsContent>
                        <TabsContent value="history" className="mt-0 h-full flex flex-col">
                            <div className="mb-2 relative flex-shrink-0">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Filter history..." value={historySearchQuery} onChange={(e)=>setHistorySearchQuery(e.target.value)} className="pl-9 h-8 text-xs" />
                            </div>
                            <div className="flex-grow overflow-hidden"> {renderQueryHistory()} </div>
                            <Button variant="outline" size="sm" className="mt-2 text-xs h-7 flex-shrink-0" onClick={() => setQueryHistory([])} disabled={queryHistory.length === 0}>
                                <Trash2 className="mr-1.5 h-3 w-3"/> Clear History
                            </Button>
                        </TabsContent>
                        <TabsContent value="schema" className="mt-0 h-full flex flex-col">
                            <div className="mb-2 relative flex-shrink-0">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Filter schema..." value={schemaSearchQuery} onChange={(e)=>setSchemaSearchQuery(e.target.value)} className="pl-9 h-8 text-xs" />
                            </div>
                            <div className="flex-grow overflow-hidden"> {renderSchemaViewer()} </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        );
    };
    const renderTablesList = () => { /* ... NO CHANGES ... */
        if(loadingTables){return(<div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>);}
        if(listTablesError){return(<Alert variant="destructive" className="mt-2 text-xs"><Terminal className="h-4 w-4"/><AlertTitle>Error</AlertTitle><AlertDescription>{listTablesError}</AlertDescription><Button onClick={fetchTables} variant="link" size="sm" className="mt-2 h-auto p-0 text-xs">Try Again</Button></Alert>);}
        const displayTables = filteredTables.filter(t => t.tableId.toLowerCase().includes(tableSearchQuery.toLowerCase()));
        if(displayTables.length===0){return(<div className="text-center py-8 text-muted-foreground text-sm">No tables found{tableSearchQuery&&` matching "${tableSearchQuery}"`}.</div>);}
        return(
            <ScrollArea className="h-full pb-4">
                <ul className="space-y-0.5 pr-2">
                    {displayTables.map((t)=>{
                        const isFav=favoriteTables.includes(t.tableId);
                        return(
                            <li key={t.tableId} className="flex items-center group">
                                {/* Apply standard hover/active styles */}
                                <button
                                    onClick={()=>handleTableSelect(t.tableId)}
                                    className={`flex-grow px-2 py-1.5 rounded-md text-left truncate text-xs transition-colors duration-150 ease-in-out ${selectedTableId===t.tableId?'bg-primary text-primary-foreground font-medium':'text-foreground hover:bg-muted'}`}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <Database className="h-3 w-3 flex-shrink-0 text-muted-foreground group-hover:text-foreground"/>
                                        <span className="truncate">{t.tableId}</span>
                                    </div>
                                </button>
                                <button
                                    onClick={(e)=>{e.stopPropagation();toggleFavorite(t.tableId);}}
                                    className={`ml-1 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity ${isFav?'text-yellow-500 dark:text-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-300':'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <Bookmark className="h-3 w-3" fill={isFav?"currentColor":"none"}/>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </ScrollArea>
        );
    };
    const renderFavoritesList = () => { /* ... NO CHANGES ... */
        const favs=tables.filter(t=>favoriteTables.includes(t.tableId));
        if(favs.length===0){return(<div className="text-center py-8 text-muted-foreground text-sm">No favorites.</div>);}
        return(
            <ScrollArea className="h-full pb-4">
                <ul className="space-y-0.5 pr-2">
                    {favs.map((t)=>(
                        <li key={t.tableId} className="flex items-center group">
                            <button
                                onClick={()=>handleTableSelect(t.tableId)}
                                className={`flex-grow px-2 py-1.5 rounded-md text-left truncate text-xs transition-colors duration-150 ease-in-out ${selectedTableId===t.tableId?'bg-primary text-primary-foreground font-medium':'text-foreground hover:bg-muted'}`}
                            >
                                <div className="flex items-center gap-1.5">
                                    <Database className="h-3 w-3 flex-shrink-0 text-muted-foreground group-hover:text-foreground"/>
                                    <span className="truncate">{t.tableId}</span>
                                </div>
                            </button>
                            <button onClick={(e)=>{e.stopPropagation();toggleFavorite(t.tableId);}} className="ml-1 p-1 rounded-md text-yellow-500 dark:text-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-300">
                                <Bookmark className="h-3 w-3" fill="currentColor"/>
                            </button>
                        </li>
                    ))}
                </ul>
            </ScrollArea>
        );
    };
    const renderQueryHistory = () => { /* ... NO CHANGES ... */
        const displayHistory = queryHistory.filter(item => item.sql.toLowerCase().includes(historySearchQuery.toLowerCase()));
        if(displayHistory.length===0){return(<div className="text-center py-8 text-muted-foreground text-sm">No history{historySearchQuery && ` matching "${historySearchQuery}"`}.</div>);}
        return(
            <ScrollArea className="h-full pb-4">
                <div className="space-y-1.5 pr-2">
                    {displayHistory.map((item)=>(
                        <div key={item.id} className="rounded-md border bg-card p-2 text-card-foreground transition-all hover:shadow-sm cursor-pointer hover:bg-muted/50" onClick={()=>setSql(item.sql)}>
                            <div className="flex justify-between items-center mb-1">
                                {/* Badge uses default theme variants */}
                                <Badge variant={item.success?"success":"destructive"} className="text-xs px-1.5 py-0 h-5">{item.success?'Success':'Failed'}</Badge>
                                <span className="text-xs text-muted-foreground">{new Date(item.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
                            </div>
                            <TooltipProvider delayDuration={500}><Tooltip><TooltipTrigger asChild>
                                <div className="text-xs font-mono bg-muted p-1.5 rounded max-h-16 overflow-hidden text-ellipsis whitespace-pre text-muted-foreground">{item.sql}</div>
                            </TooltipTrigger><TooltipContent side="bottom" align="start"><pre className="text-xs max-w-md bg-popover text-popover-foreground p-2 rounded border">{item.sql}</pre></TooltipContent></Tooltip></TooltipProvider>
                            {item.rowCount!==undefined&&(<div className="text-xs text-muted-foreground mt-1">{item.rowCount.toLocaleString()} rows</div>)}
                        </div>
                    ))}
                </div>
            </ScrollArea>
        );
    };
    const renderSchemaViewer = () => { /* ... NO CHANGES ... */
        const displayTables = schemaData?.tables.filter(t => t.table_id.toLowerCase().includes(schemaSearchQuery.toLowerCase())) ?? [];
        return(
            <div className="h-full pb-1 flex flex-col text-sm">
                <div className="flex-grow overflow-hidden">
                    {loadingSchema&&(<div className="flex items-center text-sm text-muted-foreground py-2"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Loading...</div>)}
                    {schemaError&&(<Alert variant="destructive" className="text-xs"><Terminal className="h-4 w-4"/><AlertTitle>Error</AlertTitle><AlertDescription>{schemaError}</AlertDescription></Alert>)}
                    {schemaData&&displayTables.length>0&&(<ScrollArea className="h-full"><Accordion type="multiple" className="w-full pr-2">{displayTables.map((t)=>(
                        <AccordionItem value={t.table_id} key={t.table_id} className="border rounded-md mb-1.5 bg-card shadow-sm">
                            <AccordionTrigger className="text-xs hover:no-underline py-1.5 px-2 font-medium text-card-foreground hover:bg-muted/50 rounded-t-md"><div className="flex items-center gap-2"><Table2 className="h-3.5 w-3.5 text-primary"/><span className="truncate">{t.table_id}</span></div></AccordionTrigger>
                            <AccordionContent className="pt-0 px-2 pb-1.5">
                                <div className="text-xs"><div className="border bg-background rounded-sm overflow-hidden text-[11px]"><table className="w-full"><thead><tr className="bg-muted border-b"><th className="px-2 py-1 text-left font-medium text-muted-foreground">Column</th><th className="px-2 py-1 text-left font-medium text-muted-foreground">Type</th><th className="px-2 py-1 text-left font-medium text-muted-foreground">Mode</th></tr></thead><tbody>{t.columns.map((c,i)=>(<tr key={c.name} className={i%2===0?'bg-card':'bg-muted/50'}><td className="px-2 py-0.5 font-mono text-foreground truncate max-w-20">{c.name}</td><td className="px-2 py-0.5 text-foreground">{c.type}</td><td className="px-2 py-0.5"><Badge variant={c.mode==='REQUIRED'?'default':'outline'} className="text-[10px] px-1 py-0 h-4">{c.mode}</Badge></td></tr>))}</tbody></table></div><div className="mt-1.5 flex justify-end"><Button variant="ghost" size="xs" className="text-xs h-6 text-muted-foreground hover:text-primary" onClick={()=>{const s=`SELECT ${t.columns.slice(0,5).map(c=>c.name).join(', ')}\nFROM \`${datasetId}.${t.table_id}\`\nLIMIT 100;`;setSql(s);}}><Code className="mr-1 h-3 w-3"/>Query</Button></div></div>
                            </AccordionContent>
                        </AccordionItem>))} </Accordion></ScrollArea>)}
                    {(!schemaData||displayTables.length===0)&&!loadingSchema&&!schemaError&&(<div className="text-center py-6 text-muted-foreground text-sm">No schema{schemaSearchQuery&&` matching "${schemaSearchQuery}"`}.</div>)}
                </div>
                <div className="pt-2 flex-shrink-0 pr-2">
                    <Button variant="outline" size="sm" onClick={fetchSchema} disabled={loadingSchema} className="w-full text-xs h-7">{loadingSchema?<Loader2 className="mr-2 h-3 w-3 animate-spin"/>:<RefreshCw className="mr-2 h-3 w-3"/>}Refresh Schema</Button>
                </div>
            </div>
        );
    };
    const renderTablePreview = () => { /* ... NO CHANGES ... */
        if(!selectedTableId)return(<div className="flex items-center justify-center h-full text-muted-foreground"><div className="text-center p-6"><Database className="h-12 w-12 mx-auto mb-4 opacity-20"/><h3 className="text-lg font-medium mb-2">No Table Selected</h3><p className="text-sm">Select a table from the sidebar.</p></div></div>);
        if(loadingPreview)return(<div className="flex justify-center items-center h-full"><div className="text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary"/><p className="text-sm text-muted-foreground">Loading preview...</p></div></div>);
        if(previewError)return(<Alert variant="destructive" className="m-4"><Terminal className="h-4 w-4"/><AlertTitle>Preview Error</AlertTitle><AlertDescription>{previewError}</AlertDescription><Button onClick={()=>handleTableSelect(selectedTableId)} variant="link" size="sm" className="mt-2 h-auto p-0">Try Again</Button></Alert>);
        if(previewRows.length===0)return(<div className="flex items-center justify-center h-full text-muted-foreground"><div className="text-center"><Table2 className="h-12 w-12 mx-auto mb-4 opacity-20"/><h3 className="text-lg font-medium mb-2">Table is Empty</h3><p className="text-sm">No rows to display.</p></div></div>);

        const statsDisp=tableStats&&(<div className="text-xs text-muted-foreground mb-2 border rounded-md p-1.5 bg-muted/30"><div className="flex items-center gap-3 flex-wrap"><div className="flex items-center gap-1"><BarChart4 className="h-3 w-3"/>Rows: {tableStats.rowCount.toLocaleString()}</div><div className="flex items-center gap-1"><Database className="h-3 w-3"/>Size: {formatBytes(tableStats.sizeBytes)}</div><div className="flex items-center gap-1"><RefreshCw className="h-3 w-3"/>Updated: {formatDate(tableStats.lastModified)}</div></div></div>);
        const totalPages=Math.ceil(previewTotalRows/previewRowsPerPage)||1;
        const pageControls=(
            <div className="flex items-center justify-between py-1.5 text-sm flex-shrink-0">
                <div className="flex items-center gap-2">
                    {/* Select uses default theme styles */}
                    <Select value={String(previewRowsPerPage)} onValueChange={handlePreviewRowsPerPageChange}>
                        <SelectTrigger className="w-[90px] h-7 text-xs"><SelectValue/></SelectTrigger>
                        <SelectContent>{[10,25,50,100].map(n=>(<SelectItem key={n} value={String(n)} className="text-xs">{n} rows</SelectItem>))}</SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground">{previewTotalRows>0?`${((previewCurrentPage-1)*previewRowsPerPage)+1}-${Math.min(previewCurrentPage*previewRowsPerPage,previewTotalRows)} of ${previewTotalRows.toLocaleString()}`:'0 rows'}</span>
                </div>
                <div className="flex items-center gap-1">
                    {/* Buttons use default theme variants */}
                    <Button variant="outline" size="icon" className="h-6 w-6" disabled={previewCurrentPage===1} onClick={()=>handlePreviewPageChange(1)}><ChevronsLeft className="h-3.5 w-3.5"/></Button>
                    <Button variant="outline" size="icon" className="h-6 w-6" disabled={previewCurrentPage===1} onClick={()=>handlePreviewPageChange(previewCurrentPage-1)}><ChevronLeft className="h-3.5 w-3.5"/></Button>
                    <span className="px-1 text-xs text-muted-foreground">Page {previewCurrentPage} of {totalPages}</span>
                    <Button variant="outline" size="icon" className="h-6 w-6" disabled={previewCurrentPage===totalPages} onClick={()=>handlePreviewPageChange(previewCurrentPage+1)}><ChevronRight className="h-3.5 w-3.5"/></Button>
                    <Button variant="outline" size="icon" className="h-6 w-6" disabled={previewCurrentPage===totalPages} onClick={()=>handlePreviewPageChange(totalPages)}><ChevronsRight className="h-3.5 w-3.5"/></Button>
                </div>
            </div>
        );
        return(
            <div className="h-full flex flex-col p-3">
                <div className="flex justify-between items-center mb-2 flex-shrink-0">
                    <h2 className="text-base font-semibold truncate flex items-center text-foreground" title={selectedTableId}><Table2 className="mr-2 h-4 w-4 text-primary"/>{selectedTableId}</h2>
                    <div className="flex gap-1">
                        {/* Buttons use default theme variants/colors */}
                        <Button variant="ghost" size="xs" onClick={()=>toggleFavorite(selectedTableId)} className={`h-7 ${favoriteTables.includes(selectedTableId)?"text-yellow-500 dark:text-yellow-400":""}`}><Bookmark className="mr-1 h-3 w-3" fill={favoriteTables.includes(selectedTableId)?"currentColor":"none"}/>Fav</Button>
                        <Button variant="ghost" size="xs" onClick={()=>copyToClipboard(`\`${datasetId}.${selectedTableId}\``,"Table name copied!")} className="h-7"><Copy className="mr-1 h-3 w-3"/>Copy</Button>
                    </div>
                </div>
                {statsDisp}
                {pageControls}
                <div className="flex-grow overflow-hidden border rounded-md mt-1 bg-card">
                    <ScrollArea className="h-full">
                        <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-muted z-10">
                                <tr>{previewColumns.map(c=>(<th key={c} className="px-2 py-1.5 text-left font-medium text-muted-foreground border-b border-r last:border-r-0"><div className="flex items-center cursor-pointer group" onClick={()=>handlePreviewSort(c)}><span className="truncate max-w-32">{c}</span><div className="ml-1 text-muted-foreground/50 group-hover:text-muted-foreground">{previewSortConfig?.key===c?(previewSortConfig.direction==='asc'?<SortAsc className="h-3 w-3"/>:<SortDesc className="h-3 w-3"/>):<ArrowUpDown className="h-3 w-3"/>}</div></div></th>))}</tr>
                            </thead>
                            <tbody className="font-mono divide-y divide-border text-foreground">
                                {previewRows.map((r,i)=>(<tr key={i} className="hover:bg-muted/50">{previewColumns.map(c=>(<td key={c} className="px-2 py-1 max-w-40 truncate border-r last:border-r-0" title={String(r[c]??null)}>{r[c]!=null?String(r[c]):<span className="italic text-muted-foreground">null</span>}</td>))}</tr>))}
                            </tbody>
                        </table>
                    </ScrollArea>
                </div>
            </div>
        );
    };
    const renderEditorPane = () => { /* ... NO CHANGES ... */
        return (
            <div ref={editorPaneRef} className="flex flex-col border-b overflow-hidden bg-muted/30" style={{ height: `${editorPaneHeight}px` }}>
                <div className="p-1.5 pl-3 bg-background border-b flex justify-between items-center h-9 flex-shrink-0">
                     <div className="flex items-center gap-2">
                        <span className="font-medium text-sm flex items-center gap-1.5 text-foreground">
                           <Code className="h-4 w-4 text-primary"/> SQL Editor
                        </span>
                        <TooltipProvider><Tooltip><TooltipTrigger asChild>
                             <Button variant={showNlSection ? "secondary" : "ghost"} size="xs" className="h-6 px-2" onClick={() => setShowNlSection(!showNlSection)}>
                                <BrainCircuit className="h-3.5 w-3.5 mr-1"/> AI Assist
                            </Button>
                        </TooltipTrigger><TooltipContent>Toggle AI Query Builder</TooltipContent></Tooltip></TooltipProvider>
                    </div>
                    {/* Standard primary button */}
                    <Button onClick={submitSqlJob} disabled={isRunningJob || !sql.trim()} size="sm" className="h-7">
                        {isRunningJob ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin"/> : null} Run Query
                    </Button>
                </div>
                {showNlSection && (
                    <div className="p-2 bg-background border-b flex-shrink-0">
                         <div className="flex gap-2 items-center">
                            <Input placeholder="Describe query..." value={nlPrompt} onChange={(e)=>setNlPrompt(e.target.value)} className="flex-grow text-xs h-7" disabled={generatingSql}/>
                            <Button onClick={handleGenerateSql} disabled={!nlPrompt.trim()||generatingSql} size="sm" variant="secondary" className="text-xs h-7">
                                {generatingSql?<Loader2 className="mr-1.5 h-3 w-3 animate-spin"/>:<BrainCircuit className="mr-1.5 h-3 w-3"/>} Generate
                            </Button>
                         </div>
                         {nlError && <p className="text-xs text-destructive mt-1 px-1">{nlError}</p>}
                    </div>
                )}
                 <div className="flex-grow relative">
                     {/* Textarea uses default theme colors */}
                     <Textarea value={sql} onChange={(e)=>setSql(e.target.value)} placeholder="-- Enter SQL query..."
                         className="absolute inset-0 w-full h-full resize-none rounded-none border-0 font-mono text-sm leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0 p-2 bg-background caret-foreground selection:bg-primary/20"
                      />
                </div>
                 {/* Resize Handle uses default theme border */}
                <div ref={resizeHandleRef} onMouseDown={startResizing} className="h-1.5 bg-border hover:bg-primary cursor-ns-resize flex-shrink-0 flex items-center justify-center transition-colors">
                    <GripVertical className="h-2.5 w-2.5 text-muted-foreground" />
                 </div>
            </div>
        );
    };


    // --- MODIFIED: renderOutputPane (Structure remains similar, content functions change) ---
    const renderOutputPane = () => {
        // Determine if visualize tab should be enabled based on original results/suggestions
        const canVisualize = suggestedCharts.length > 0 || activeVisualization !== null;
        // Also check if there are *any* results (original or filtered) to show the tabs meaningfully
        const hasResultsToShow = jobResults?.rows || filteredData.length > 0;

        return (
            <div className="flex-grow overflow-hidden flex flex-col bg-background">
                {/* Status Bar (keep as is) */}
                {jobId && !isRunningJob && !jobError && (
                     <div className="px-3 py-1 text-xs border-b text-muted-foreground flex items-center gap-2">
                         <span>Job {jobId?.substring(0, 8)}... completed successfully.</span>
                         {jobStatus?.total_bytes_processed !== undefined && (
                             <Badge variant="secondary" className="text-[10px] px-1 h-4">~{formatBytes(jobStatus.total_bytes_processed)} processed</Badge>
                         )}
                     </div>
                 )}
                 {jobId && jobError && (
                     <div className="px-3 py-1 text-xs border-b text-destructive-foreground bg-destructive flex items-center gap-2">
                         <span>Job {jobId?.substring(0, 8)}... failed.</span>
                     </div>
                 )}


                <Tabs value={currentOutputTab} onValueChange={setCurrentOutputTab} className="flex-grow flex flex-col overflow-hidden">
                    <TabsList className="mx-3 mt-2 mb-1 h-8 justify-start bg-muted p-0.5 rounded-md flex-shrink-0">
                        <TabsTrigger value="data" className="text-xs h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-sm"><Table2 className="mr-1.5 h-3.5 w-3.5"/>Preview</TabsTrigger>
                        <TabsTrigger value="results" className="text-xs h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-sm" disabled={!jobId && !jobResults}><ListTree className="mr-1.5 h-3.5 w-3.5"/>Results</TabsTrigger>
                        <TabsTrigger
                             value="visualize"
                             className="text-xs h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-sm"
                             // Disable if: No AI suggestions AND no active viz OR no original results OR filters applied resulted in no data
                             disabled={(!canVisualize) || !jobResults || !jobResults.rows || jobResults.rows.length === 0 || filteredData.length === 0}
                         >
                           <BarChart4 className="mr-1.5 h-3.5 w-3.5"/>Visualize
                        </TabsTrigger>
                     </TabsList>
                    {/* Content areas */}
                     <TabsContent value="data" className="flex-grow mt-0 overflow-hidden">
                        {renderTablePreview()}
                     </TabsContent>
                    <TabsContent value="results" className="flex-grow mt-0 overflow-hidden">
                         {/* Renders loading/error states OR FilterControls + Table */}
                         {renderResultsContent()}
                    </TabsContent>
                    <TabsContent value="visualize" className="flex-grow mt-0 overflow-hidden bg-card">
                         {/* Renders FilterControls + Chart OR placeholders */}
                        {renderChartVisualization()}
                    </TabsContent>
                </Tabs>
            </div>
        );
    };


    // --- MODIFIED: renderResultsContent (Includes FilterControls) ---
    const renderResultsContent = () => {
        // --- Initial checks (Loading, Error, No Original Results) ---
        if (isRunningJob && jobId) return ( <div className="flex justify-center items-center h-full p-4"><div className="text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary"/><p className="text-lg font-medium mb-1 text-foreground">Running Query...</p><p className="text-sm text-muted-foreground">Job ID: {jobId}</p></div></div> );
        if (jobError) return ( <Alert variant="destructive" className="m-4"><Terminal className="h-4 w-4"/><AlertTitle>Query Error</AlertTitle><AlertDescription><p>{jobError}</p><Button onClick={submitSqlJob} variant="outline" size="sm" className="mt-3 text-xs h-7"><RefreshCw className="mr-1.5 h-3 w-3"/>Try Again</Button></AlertDescription></Alert> );
        if (loadingResults && !jobResults?.rows) return ( <div className="flex justify-center items-center h-full p-4"><div className="text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary"/><p className="text-sm text-muted-foreground">Loading results...</p></div></div> ); // Show loading only if NO results yet
        if (resultsError) return ( <Alert variant="destructive" className="m-4"><Terminal className="h-4 w-4"/><AlertTitle>Results Error</AlertTitle><AlertDescription>{resultsError}</AlertDescription></Alert> );
        if (!jobResults) return ( <div className="flex items-center justify-center h-full text-muted-foreground p-6"><div className="text-center"><ListTree className="h-12 w-12 mx-auto mb-4 opacity-20"/><h3 className="text-lg font-medium mb-2 text-foreground">No Query Results</h3><p className="text-sm">Run a query using the editor above.</p></div></div> );
        // Handle case where the query genuinely returned 0 rows (before filtering)
        if (jobResults.rows.length === 0 && !loadingResults) return ( <div className="flex items-center justify-center h-full text-muted-foreground p-6"><div className="text-center"><Table2 className="h-12 w-12 mx-auto mb-4 opacity-20"/><h3 className="text-lg font-medium mb-2 text-foreground">Query Returned No Rows</h3>{jobResults.total_rows_in_result_set !== undefined && jobResults.total_rows_in_result_set > 0 && (<p className="text-sm">{jobResults.total_rows_in_result_set.toLocaleString()} row(s) affected (DML)</p>)}</div></div> );
        // --- End Initial Checks ---


        // --- Define renderResultsTable using FILTERED DATA ---
        const renderResultsTable = () => {
            const dataToRender = filteredData;

            // Message if filters result in zero rows
            if (dataToRender.length === 0 && jobResults.rows.length > 0 && Object.keys(activeFilters).length > 0) {
                 return (
                    <div className="flex items-center justify-center h-40 text-muted-foreground p-4 text-center border rounded-md bg-card mt-2">
                        <div>
                            <ListFilter className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No rows match the current filters.</p>
                            <Button variant="link" size="sm" onClick={handleClearAllFilters} className="mt-2 h-auto p-0">Clear Filters</Button>
                        </div>
                     </div>
                 );
            }

            // Check schema exists - should be guaranteed if jobResults.rows exist from check above
            if (!jobResults.schema) {
                 return <p className="p-4 text-orange-500">Result schema is missing.</p>;
            }

            const cols = jobResults.schema.map(f => f.name);

            return (
                <div className="flex-grow overflow-hidden border rounded-md bg-card mt-2">
                    <ScrollArea className="h-full">
                        <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-muted z-10">
                                <tr>{cols.map(c => (<th key={c} className="px-2 py-1.5 text-left font-medium text-muted-foreground border-b border-r last:border-r-0">
                                    <div className="flex items-center" title={c}><span className="truncate max-w-32">{c}</span>
                                         {jobResults.schema && (
                                             <TooltipProvider delayDuration={300}><Tooltip><TooltipTrigger asChild>
                                                 <Info className="ml-1 h-3 w-3 text-muted-foreground/50 hover:text-muted-foreground"/>
                                             </TooltipTrigger><TooltipContent className="text-xs">
                                                    Type: {jobResults.schema.find(f => f.name === c)?.type ?? '?'}<br/>
                                                     Mode: {jobResults.schema.find(f => f.name === c)?.mode ?? '?'}
                                                 </TooltipContent></Tooltip></TooltipProvider>
                                        )}
                                     </div>
                                </th>))}</tr>
                            </thead>
                            <tbody className="font-mono divide-y divide-border text-foreground">
                                {dataToRender.map((r, i) => (
                                    <tr key={i} className="hover:bg-muted/50">
                                        {cols.map(c => (
                                            <td key={c} className="px-2 py-1 max-w-40 truncate border-r last:border-r-0" title={String(r[c] ?? null)}>
                                                {r[c] != null ? String(r[c]) : <span className="italic text-muted-foreground">null</span>}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </ScrollArea>
                </div>
            );
        };
        // --- End of renderResultsTable definition ---


        // --- MAIN RETURN for renderResultsContent ---
        return (
            <div className="h-full flex flex-col"> {/* Container for Filters + Content */}

                 {/* --- Filter Controls Section (Rendered if filters are available) --- */}
                 {availableFilters.length > 0 && (
                    <FilterControls
                        availableFilters={availableFilters}
                        activeFilters={activeFilters}
                        onFilterChange={handleFilterChange}
                        onClearAllFilters={handleClearAllFilters}
                        resultsCount={jobResults.rows.length} // Original count
                        filteredCount={filteredData.length}   // Filtered count
                    />
                 )}

                 {/* Container for the rest (metadata, suggestions, table, pagination) */}
                <div className="flex-grow flex flex-col p-3 overflow-hidden">

                    {/* --- METADATA & BUTTONS --- */}
                    <div className="mb-2 flex justify-between items-center flex-shrink-0 flex-wrap gap-y-1">
                         {/* Metadata Badges - Show filtered/total count */}
                         <div className="flex items-center gap-2 flex-wrap">
                            {jobId && <Badge variant="outline" className="font-mono text-xs" title={jobId}>Job: {jobId.split('-')[0]}...</Badge>}
                            <Badge variant="secondary" className="text-xs">
                                 {Object.keys(activeFilters).length > 0
                                     ? `${filteredData.length.toLocaleString()} / ${jobResults.rows.length.toLocaleString()} rows`
                                    : `${jobResults.rows.length.toLocaleString()} rows`}
                             </Badge>
                            {/* Keep total bytes processed from original job */}
                            {jobStatus?.total_bytes_processed !== undefined && (<Badge variant="secondary" className="text-xs">~{formatBytes(jobStatus.total_bytes_processed)}</Badge>)}
                        </div>
                         {/* Action Buttons */}
                         <div className="flex gap-1">
                            <Button variant="outline" size="xs" onClick={submitSqlJob} className="h-7"><RefreshCw className="mr-1 h-3 w-3"/>Run Again</Button>
                            <Button variant="outline" size="xs" onClick={() => console.warn("Export filtered data not implemented yet")} className="h-7"><Download className="mr-1 h-3 w-3"/>Export</Button>
                         </div>
                    </div>

                    {/* --- SUGGESTIONS SECTION --- */}
                    {/* Render suggestions only if there was original data to generate them */}
                    {jobResults.rows.length > 0 && suggestedCharts.length > 0 && (
                        <div className="pb-2 border-b mb-2 flex-shrink-0">
                            <h4 className="font-semibold mb-1.5 text-xs flex items-center gap-1.5 text-muted-foreground">
                                {loadingAiSuggestions ? <Loader2 className="h-3 w-3 animate-spin"/> : <BrainCircuit className="h-3.5 w-3.5 text-primary/80"/>}
                                Chart Suggestions
                            </h4>
                            {aiSuggestionError && <p className="text-xs text-destructive mb-1">{aiSuggestionError}</p>}
                            <div className="flex flex-wrap gap-1.5">
                                {suggestedCharts.map((suggestion, index) => (
                                    <Button
                                        key={`${suggestion.chart_type}-${index}`}
                                        variant="outline" size="xs" className="h-6 text-xs"
                                        onClick={() => {
                                            // Check if the target viz is valid with current filters *before* switching
                                            const { x_axis_column, y_axis_columns } = suggestion;
                                            const isValidWithFilters = filteredData.length > 0 &&
                                                filteredData[0]?.hasOwnProperty(x_axis_column) &&
                                                y_axis_columns.every(col => filteredData[0]?.hasOwnProperty(col));

                                            if (isValidWithFilters) {
                                                setActiveVisualization(suggestion);
                                                setCurrentOutputTab('visualize');
                                            } else {
                                                // TODO: Show a toast message? "Cannot visualize with current filters"
                                                console.warn("Cannot activate visualization - data invalid with current filters.");
                                            }
                                        }}
                                        title={suggestion.rationale}
                                        // Disable button if suggestion isn't valid with current filtered data
                                        disabled={!(filteredData.length > 0 && filteredData[0]?.hasOwnProperty(suggestion.x_axis_column) && suggestion.y_axis_columns.every(col => filteredData[0]?.hasOwnProperty(col)))}
                                    >
                                        {/* Icons... */}
                                        {suggestion.chart_type === 'bar' && <BarChart4 className="mr-1 h-3 w-3"/>}
                                        {suggestion.chart_type === 'line' && <LineChartIcon className="mr-1 h-3 w-3"/>}
                                        {suggestion.chart_type === 'pie' && <PieChartIcon className="mr-1 h-3 w-3"/>}
                                        {suggestion.chart_type === 'scatter' && <Dot className="mr-1 h-3 w-3"/>}
                                        {suggestion.chart_type.charAt(0).toUpperCase() + suggestion.chart_type.slice(1)}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* --- RESULTS TABLE (Uses filteredData) --- */}
                    {renderResultsTable()}

                    {/* --- LOAD MORE BUTTON --- */}
                    {/* Only show Load More if there's a token AND no filters are active */}
                    {jobResults.next_page_token && Object.keys(activeFilters).length === 0 && (
                         <div className="mt-2 flex justify-center flex-shrink-0">
                             <Button
                                 variant="outline" size="sm" className="text-xs h-7"
                                 onClick={()=>jobId && jobLocation && fetchJobResults(jobId, jobLocation, jobResults.next_page_token)}
                                 disabled={loadingResults}
                             >
                                 {loadingResults ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin"/> : null} Load More Original Results
                             </Button>
                         </div>
                    )}
                    {/* Message if Load More is hidden due to filters */}
                    {jobResults.next_page_token && Object.keys(activeFilters).length > 0 && (
                         <p className="mt-2 text-center text-xs text-muted-foreground">Clear filters to load more original results.</p>
                    )}

                </div> {/* End of content container */}
            </div>
        );
    };


    // --- MODIFIED: renderChartVisualization (Includes FilterControls, uses filteredData) ---
    const renderChartVisualization = () => {

         // Check if we should even be on this tab
         if (!activeVisualization) {
             return (
                 <div className="flex items-center justify-center h-full text-muted-foreground p-6">
                      <div className="text-center">
                         <BarChart4 className="h-12 w-12 mx-auto mb-4 opacity-20"/>
                          <h3 className="text-lg font-medium mb-2">Select a Visualization</h3>
                          <p className="text-sm">Choose a suggested chart from the 'Results' tab or clear filters if the chart became invalid.</p>
                     </div>
                 </div>
             );
         }

         // --- Check if data (original or filtered) is available ---
          if (!jobResults?.rows || filteredData.length === 0) {
             return (
                 <div className="h-full flex flex-col">
                     {/* Show filters even if data is empty due to filtering */}
                     {availableFilters.length > 0 && (
                        <FilterControls
                             availableFilters={availableFilters} activeFilters={activeFilters}
                            onFilterChange={handleFilterChange} onClearAllFilters={handleClearAllFilters}
                            resultsCount={jobResults?.rows?.length ?? 0} filteredCount={0}
                        />
                     )}
                     <div className="flex-grow flex items-center justify-center text-muted-foreground p-6">
                          <div className="text-center">
                             <BarChart4 className="h-12 w-12 mx-auto mb-4 opacity-20"/>
                             <h3 className="text-lg font-medium mb-2">No Data to Visualize</h3>
                             <p className="text-sm">
                                  {jobResults?.rows && jobResults.rows.length > 0 && filteredData.length === 0
                                      ? "The current filters resulted in no data."
                                      : "No results available for visualization."}
                             </p>
                            {jobResults?.rows && jobResults.rows.length > 0 && filteredData.length === 0 && (
                                <Button variant="link" size="sm" onClick={handleClearAllFilters} className="mt-2 h-auto p-0">Clear Filters</Button>
                            )}
                         </div>
                      </div>
                 </div>
              );
         }
        // --- End Data Check ---


        // --- Render the actual chart using filteredData ---
        const { chart_type, x_axis_column, y_axis_columns, rationale } = activeVisualization;
        const data = filteredData; // Crucially use filtered data
        const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82Ca9D'];

        const renderChart = () => {
            // Check if required columns exist in the filtered data (safety check)
             if (data.length === 0) { return <p className="p-4 text-orange-500">No data remaining after filtering.</p>; }
             const validYCols = y_axis_columns.filter(col => data[0]?.hasOwnProperty(col));
             if (!data[0]?.hasOwnProperty(x_axis_column) || validYCols.length === 0) {
                return <p className="text-red-500 p-4">Error: Required columns for this chart ({x_axis_column}, {y_axis_columns.join(', ')}) are not present in the filtered data.</p>;
            }

            switch (chart_type) {
                case 'bar':
                    return ( /* ... BarChart using `data` ... */
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 50 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
                                <XAxis dataKey={x_axis_column} angle={-45} textAnchor="end" height={60} interval={0} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--muted-foreground))"/>
                                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--muted-foreground))"/>
                                <RechartsTooltip cursor={{ fill: 'hsla(var(--muted), 0.5)' }} contentStyle={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)', fontSize: '12px', color: 'hsl(var(--foreground))' }}/>
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                {validYCols.map((yCol, index) => ( <Bar key={yCol} dataKey={yCol} fill={COLORS[index % COLORS.length]} /> ))}
                             </BarChart>
                        </ResponsiveContainer>
                    );
                case 'line': { /* ... LineChart using `data` ... */
                    const parseDate = (d: any) => { /* ... */ try { const date = parseISO(String(d)); return isValid(date) ? date.getTime() : new Date(String(d)).getTime();} catch { return null;}};
                     const formattedDataLine = data .map(row => ({ ...row, [x_axis_column]: parseDate(row[x_axis_column]) })) .filter(row => row[x_axis_column] !== null && !isNaN(row[x_axis_column])) .sort((a, b) => a[x_axis_column] - b[x_axis_column]);
                    if (formattedDataLine.length === 0) { return <p className="p-4 text-orange-500">No valid date data after filtering.</p>; }
                     return (
                         <ResponsiveContainer width="100%" height="100%">
                             <LineChart data={formattedDataLine} margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
                                 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
                                 <XAxis dataKey={x_axis_column} type="number" domain={['dataMin', 'dataMax']} scale="time" tickFormatter={(unixTime) => new Date(unixTime).toLocaleDateString()} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--muted-foreground))"/>
                                 <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--muted-foreground))"/>
                                <RechartsTooltip labelFormatter={(unixTime) => new Date(unixTime).toLocaleString()} contentStyle={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)', fontSize: '12px', color: 'hsl(var(--foreground))' }}/>
                                 <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                 {validYCols.map((yCol, index) => ( <Line key={yCol} type="monotone" dataKey={yCol} stroke={COLORS[index % COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 6 }}/> ))}
                             </LineChart>
                         </ResponsiveContainer>
                     );
                 }
                case 'pie': { /* ... PieChart aggregating `data` ... */
                     const aggregatedPieData: { [key: string]: number } = {};
                     data.forEach(row => { const category = String(row[x_axis_column] ?? 'Unknown'); const value = Number(row[validYCols[0]]); if (!isNaN(value)) { aggregatedPieData[category] = (aggregatedPieData[category] || 0) + value; }});
                     const formattedDataPie = Object.entries(aggregatedPieData).map(([name, value]) => ({ name, value }));
                    if (formattedDataPie.length === 0) { return <p className="p-4 text-orange-500">No valid data for pie chart after filtering.</p>; }
                     return (
                         <ResponsiveContainer width="100%" height="100%">
                             <PieChart>
                                 <Pie data={formattedDataPie} cx="50%" cy="50%" labelLine={false} outerRadius="80%" fill="#8884d8" dataKey="value" nameKey="name" label={{ fontSize: 10, fill: 'hsl(var(--foreground))' }}>
                                     {formattedDataPie.map((entry, index) => ( <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} /> ))}
                                 </Pie>
                                 <RechartsTooltip contentStyle={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)', fontSize: '12px', color: 'hsl(var(--foreground))' }}/>
                                 <Legend wrapperStyle={{ fontSize: '11px' }}/>
                             </PieChart>
                         </ResponsiveContainer>
                    );
                }
                 case 'scatter': { /* ... ScatterChart using `data` ... */
                     const currentSchema = jobResults?.schema; const isString = (type: string) => type === 'STRING'; const labelColumnName = currentSchema?.find(f => isString(f.type))?.name ?? x_axis_column;
                     const formattedDataScatter = data .map(row => ({ x: Number(row[x_axis_column]), y: Number(row[validYCols[0]]), label: row[labelColumnName] })) .filter(point => !isNaN(point.x) && !isNaN(point.y));
                    if (formattedDataScatter.length === 0) { return <p className="p-4 text-orange-500">No valid numeric pairs after filtering.</p>; }
                     const yAxisName = validYCols[0] ?? 'Y-Value';
                     return (
                         <ResponsiveContainer width="100%" height="100%">
                             <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid stroke="hsl(var(--border))"/>
                                 <XAxis type="number" dataKey="x" name={x_axis_column} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--muted-foreground))"/>
                                 <YAxis type="number" dataKey="y" name={yAxisName} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--muted-foreground))"/>
                                 <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)', fontSize: '12px', color: 'hsl(var(--foreground))' }} formatter={(value: any, name: string, props: any) => { const pointLabel = props.payload?.label; const axisName = name === 'x' ? x_axis_column : yAxisName; return [`${axisName}: ${value}`, pointLabel ? `Label: ${pointLabel}`: undefined]; }}/>
                                <Scatter name={yAxisName} data={formattedDataScatter} fill={COLORS[0]}/>
                            </ScatterChart>
                        </ResponsiveContainer>
                    );
                }
                default: return <p>Unsupported chart type: {chart_type}</p>;
            }
        };

        return (
            <div className="h-full flex flex-col"> {/* Container for Filters + Content */}

                 {/* --- Filter Controls Section (Rendered if filters are available) --- */}
                 {availableFilters.length > 0 && (
                    <FilterControls
                        availableFilters={availableFilters}
                        activeFilters={activeFilters}
                        onFilterChange={handleFilterChange}
                        onClearAllFilters={handleClearAllFilters}
                        resultsCount={jobResults?.rows?.length ?? 0} // Original count
                        filteredCount={filteredData.length}       // Filtered count
                    />
                 )}

                {/* Container for the chart content */}
                <div className="flex-grow flex flex-col p-3 overflow-hidden">
                    <div className="flex justify-between items-center mb-2 flex-shrink-0">
                        <h3 className="text-base font-semibold capitalize flex items-center gap-2">
                            {/* Icons... */}
                             {chart_type === 'bar' && <BarChart4 className="h-4 w-4 text-primary"/>}
                             {chart_type === 'line' && <LineChartIcon className="h-4 w-4 text-primary"/>}
                             {chart_type === 'pie' && <PieChartIcon className="h-4 w-4 text-primary"/>}
                             {chart_type === 'scatter' && <Dot className="h-4 w-4 text-primary"/>}
                             {chart_type} Chart
                        </h3>
                        <Button variant="ghost" size="sm" onClick={() => setActiveVisualization(null)} className="text-xs h-7"> Close Chart </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2 flex-shrink-0">{rationale}</p>
                    <div className="flex-grow border rounded-md overflow-hidden bg-background">
                        {renderChart()}
                    </div>
                </div>
            </div>
        );
    };


    // --- Main Component Return ---
    return (
        <TooltipProvider>
            <div className="flex h-full bg-background text-foreground overflow-hidden text-sm">
                {/* Sidebar uses card background */}
                <div className={`border-r border-border bg-card flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out ${ sidebarCollapsed ? 'w-12' : 'w-64 md:w-72' }`} >
                    {/* Sidebar Top Section (Collapse Button) */}
                    <div className={`p-2 border-b border-border flex ${sidebarCollapsed?'justify-center':'justify-end'} flex-shrink-0`}>
                         <Tooltip> <TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={()=>setSidebarCollapsed(!sidebarCollapsed)}>{sidebarCollapsed?<ChevronRight className="h-4 w-4"/>:<ChevronLeft className="h-4 w-4"/>}</Button></TooltipTrigger><TooltipContent side="right">{sidebarCollapsed?'Expand':'Collapse'}</TooltipContent></Tooltip>
                    </div>
                    {/* Sidebar Main Content (Icons or Full View) */}
                    <div className="flex-grow overflow-hidden">
                        {sidebarCollapsed ? (
                             <div className="flex flex-col items-center pt-3 gap-3">
                                {/* Collapsed Icons... */}
                                <Tooltip><TooltipTrigger asChild><Button variant={currentSidebarTab==='tables'?'secondary':'ghost'} size="icon" className="h-7 w-7" onClick={()=>{setCurrentSidebarTab('tables'); setSidebarCollapsed(false);}}><Database className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent side="right">Tables</TooltipContent></Tooltip>
                                <Tooltip><TooltipTrigger asChild><Button variant={currentSidebarTab==='favorites'?'secondary':'ghost'} size="icon" className="h-7 w-7" onClick={()=>{setCurrentSidebarTab('favorites'); setSidebarCollapsed(false);}}><Bookmark className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent side="right">Favorites</TooltipContent></Tooltip>
                                <Tooltip><TooltipTrigger asChild><Button variant={currentSidebarTab==='history'?'secondary':'ghost'} size="icon" className="h-7 w-7" onClick={()=>{setCurrentSidebarTab('history'); setSidebarCollapsed(false);}}><History className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent side="right">History</TooltipContent></Tooltip>
                                <Tooltip><TooltipTrigger asChild><Button variant={currentSidebarTab==='schema'?'secondary':'ghost'} size="icon" className="h-7 w-7" onClick={()=>{setCurrentSidebarTab('schema'); setSidebarCollapsed(false);}}><ListTree className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent side="right">Schema</TooltipContent></Tooltip>
                            </div>
                        ) : (
                           <div className="h-full">
                              {renderSidebarContent()} {/* Render the full sidebar */}
                           </div>
                        )}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-grow flex flex-col overflow-hidden">
                    {renderEditorPane()}
                    {renderOutputPane()} {/* This renders Tabs, which includes FilterControls contextually */}
                </div>
  {/* --- Chatbot Toggle Button --- */}
  <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="secondary" // Or "default" or "outline"
                            size="icon"
                            className="fixed bottom-4 left-4 z-50 rounded-full h-12 w-12 shadow-lg" // Positioned bottom-left
                            onClick={() => setIsChatOpen(prev => !prev)}
                        >
                           {isChatOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                       {isChatOpen ? 'Close Chat' : 'Open Chat Assistant'}
                    </TooltipContent>
                </Tooltip>

                {/* --- Chatbot Window (Conditionally Rendered) --- */}
                <ChatbotWindow
                    isOpen={isChatOpen}
                    onClose={() => setIsChatOpen(false)}
                />

            </div> {/* End main layout div */}
        </TooltipProvider>
    );
};

export default BigQueryTableViewer;