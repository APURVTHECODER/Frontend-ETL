import React, { useEffect, useState, useRef, useCallback, useMemo } from "react"; // Added useMemo
import Joyride, { Step, CallBackProps, STATUS, EVENTS } from 'react-joyride'; // +++ Joyride Import +++
import { Button, buttonVariants } from "@/components/ui/button";
import Editor from '@monaco-editor/react'
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import axiosInstance from '@/lib/axios-instance';
import { ChatbotWindow } from "@/components/chatbot/ChatbotWindow";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Loader2, Terminal, Search, Database, BrainCircuit, ListTree, Bookmark,
    Code, Table2, RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft,
    ChevronsRight, SortAsc, SortDesc, ArrowUpDown, Info,
    BarChart4,
    LineChart as LineChartIcon, PieChart as PieChartIcon, Dot , Trash2 ,History,Copy,
    ListFilter, // Added Filter icon
    MessageSquare,X,
    FileSpreadsheet, Clock ,Sparkles , LightbulbIcon , AlertCircle , Play ,Settings2,Check,ChevronsUpDown,CheckCheck,    // ... existing icons ...
} from "lucide-react";
// import { useAuth } from '@/contexts/AuthContext';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
  } from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
  } from "@/components/ui/popover";
import { cn } from "@/lib/utils"; 
import * as htmlToImage from 'html-to-image';
import { useToast } from "@/hooks/use-toast"
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, ScatterChart, Scatter,
    XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from "@/components/ui/tooltip";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { saveAs } from 'file-saver';
// --- Import Filter Components and Types ---
import { FilterConfig, ActiveFilters, ActiveFilterValue, FilterType } from '@/components/filters/filterTypes';
import { parseISO, isValid } from 'date-fns'; // Import date-fns for parsing
import { FilterControls } from "@/components/filters/FilterControls";
// import { ThemeToggle } from "./ThemeToggle";
// --- Interfaces (Keep existing ones) ---

interface BackendChartConfig {
    type: string;
    x_axis: string;
    y_axes: string[];
    rationale?: string;
}
interface AISummaryRequest {
    schema: JobResultSchemaField[];
    query_sql: string;
    original_prompt?: string | null;
    result_sample: RowData[];
}
interface AISummaryResponse {
    summary_text?: string | null;
    error?: string | null;
}
interface DatasetListItem {
    datasetId: string;
    location: string;
  }
  interface DatasetListApiResponse {
    datasets: DatasetListItem[];
  }

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
interface QueryHistoryItem {
    id: string;
    sql: string;
    timestamp: string;
    success: boolean;
    rowCount?: number;
    durationMs?: number;      // NEW: Store duration in milliseconds
    bytesProcessed?: number;  // NEW: Store bytes processed
}
interface VizSuggestion {
    chart_type: 'bar' | 'line' | 'pie' | 'scatter';
    x_axis_column: string;
    y_axis_columns: string[];
    rationale: string;
}
// interface ActiveVisualizationConfig extends VizSuggestion {
//     // You might add specific display settings here later
// }
type ActiveVisualizationConfig = {
    chart_type: string;
    x_axis_column: string;
    y_axis_columns: string[];
    rationale?: string;
  };
const BigQueryTableViewer: React.FC = () => {
        // +++ Joyride State for BigQueryTableViewer Tour +++
    const [runViewerTour, setRunViewerTour] = useState<boolean>(false);
    const VIEWER_TOUR_VERSION = 'bigQueryTableViewerTour_v2'; // Increment if you change the tour significantly
    //   const { userProfile,  } = useAuth();
    //   const isAdmin = userProfile?.role === 'admin';
    const getErrorMessage = useCallback((error: any): string => { 
        {
            const d=error.response?.data; if(d && typeof d==='object' && 'detail' in d)return String(d.detail);
             if(typeof d==='string')
                return d; return error.message;
            } 
            if(error instanceof Error)
                return error.message; 
            return"An unknown error occurred."; 
        }, []);
    // SecondTeam
    // process.env.NEXT_PUBLIC_GCP_PROJECT_ID || 
    const projectId = "crafty-tracker-457215-g6";
    const [availableDatasets, setAvailableDatasets] = useState<DatasetListItem[]>([]);
    const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
    const [loadingDatasets, setLoadingDatasets] = useState<boolean>(true);
    const [datasetError, setDatasetError] = useState<string | null>(null);
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const fullDatasetId = useMemo(() => {
        if (!projectId || !selectedDatasetId) return "";
        return `${projectId}.${selectedDatasetId}`;
    }, [projectId, selectedDatasetId]);
    const { toast } = useToast(); // Initialize toast
    // --- State Variables (Keep existing ones) ---
    const [tables, setTables] = useState<TableInfo[]>([]);
        // +++ MODIFICATION START: Add userRole state +++
        // +++ MODIFICATION END +++
    // +++ MODIFICATION START: State for AI Mode and Selections +++
    const [aiMode, setAiMode] = useState<'AUTO' | 'SEMI_AUTO'>('AUTO');
    const [selectedAiTables, setSelectedAiTables] = useState<Set<string>>(new Set());
    const [selectedAiColumns, setSelectedAiColumns] = useState<Set<string>>(new Set());
    const [isTablePopoverOpen, setIsTablePopoverOpen] = useState(false);
    const [isColumnPopoverOpen, setIsColumnPopoverOpen] = useState(false);
// +++ MODIFICATION END +++
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
    const [nlPrompt, setNlPrompt] = useState<string>(""); // NL Prompt state
    const [jobResults, setJobResults] = useState<JobResultsResponse | null>(null); // Keep this for original data
    const [loadingResults, setLoadingResults] = useState<boolean>(false);
    const [, setCurrentResultsPageToken] = useState<string | null>(null);
    const [resultsError, setResultsError] = useState<string>("");
    const [schemaData, setSchemaData] = useState<SchemaResponse | null>(null);
    const [loadingSchema, setLoadingSchema] = useState<boolean>(false);
    const [schemaError, setSchemaError] = useState<string>("");
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
    const [isDownloadingExcel, setIsDownloadingExcel] = useState<boolean>(false);
    // --- State for Filters ---
    const [availableFilters, setAvailableFilters] = useState<FilterConfig[]>([]);
    const [activeFilters, setActiveFilters] = useState<ActiveFilters>({});
    const [promptSuggestions, setPromptSuggestions] = useState<string[]>([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState<boolean>(false);
    const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
    const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null); // For debouncing
    const suggestionContainerRef = useRef<HTMLDivElement>(null); // Ref for the suggestions dropdown
    const promptInputRef = useRef<HTMLInputElement>(null); // Ref for the prompt input

    // --- Refs ---
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const editorPaneRef = useRef<HTMLDivElement>(null);
    const resizeHandleRef = useRef<HTMLDivElement>(null);
    const POLLING_INTERVAL_MS = 3000;


    // +++ State for AI Summary +++
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [loadingAiSummary, setLoadingAiSummary] = useState<boolean>(false);
    const [aiSummaryError, setAiSummaryError] = useState<string | null>(null);
    const [lastUserPrompt, setLastUserPrompt] = useState<string | null>(null); // Store the prompt used for the current results
    // +++ END State for AI Summary +++


    // --- Utility Functions (Keep existing ones) ---
    // const extractTableNames = useCallback((sql: string): string[] => {
    //     // Regex to find fully qualified tables (project.dataset.table) after FROM or JOIN
    //     // Handles optional backticks around the full name or individual parts
    //     const regex = /(?:FROM|JOIN)\s+`?((?:`?[a-zA-Z0-9_.-]+`?\.)+(?:`?[a-zA-Z0-9_-]+`?))`?/gi;
    //     const matches = sql.matchAll(regex);
    //     const tables = new Set<string>();
    //     for (const match of matches) {
    //         if (match[1]) {
    //             // Remove all backticks and normalize
    //             const tableName = match[1].replace(/`/g, '').toLowerCase();
    //             // Basic validation for structure
    //             if (tableName.split('.').length >= 3) {
    //                  tables.add(tableName);
    //             }
    //         }
    //     }
    //     console.log("Extracted source tables for export:", Array.from(tables));
    //     return Array.from(tables);
    // }, []);
// Inside BigQueryTableViewer component
    // Effect to start the tour on first visit & when data is loaded
    useEffect(() => {
        const hasSeenViewerTour = localStorage.getItem(VIEWER_TOUR_VERSION);
        console.log(`[ViewerTour Effect] loadingDatasets: ${loadingDatasets}, hasSeenViewerTour: ${hasSeenViewerTour}, selectedDatasetId: ${selectedDatasetId}`);

        // Tour starts if:
        // 1. Not seen before.
        // 2. Initial datasets have loaded (or failed to load, indicating page is somewhat ready).
        // 3. A dataset is selected (many UI elements depend on this).
        if (!hasSeenViewerTour && !loadingDatasets && selectedDatasetId) {
            // Polling for critical elements to ensure they are in the DOM
            let attempts = 0;
            const maxAttempts = 15; // Try for ~7.5 seconds
            const intervalId = setInterval(() => {
                attempts++;
                const workspaceSelectEl = document.getElementById('tour-viewer-workspace-select-trigger'); // Specific trigger
                const tablesTabEl = document.getElementById('tour-sidebar-tab-tables');
                const aiPromptEl = document.getElementById('tour-nl-prompt-input');

                console.log(`[ViewerTour Polling Attempt ${attempts}] Workspace: ${!!workspaceSelectEl}, TablesTab: ${!!tablesTabEl}, AIPrompt: ${!!aiPromptEl}`);

                if (workspaceSelectEl && tablesTabEl && aiPromptEl) {
                    console.log('[ViewerTour Polling] Critical initial elements found! Starting tour.');
                    // Short delay for styling/rendering completion
                    setTimeout(() => setRunViewerTour(true), 700);
                    clearInterval(intervalId); // Stop polling
                    // No need to return clearTimeout from here as interval is cleared
                } else if (attempts >= maxAttempts) {
                    console.warn('[ViewerTour Polling] Max attempts reached. Key elements for tour not found.');
                    clearInterval(intervalId);
                }
            }, 500);
            return () => {
                console.log('[ViewerTour Effect Cleanup] Clearing polling interval if active.');
                clearInterval(intervalId);
            }
        } else {
             if (hasSeenViewerTour) console.log('[ViewerTour Effect] Tour already seen.');
             if (loadingDatasets) console.log('[ViewerTour Effect] Datasets still loading.');
             if (!selectedDatasetId) console.log('[ViewerTour Effect] No dataset selected yet.');
        }
    }, [loadingDatasets, selectedDatasetId, VIEWER_TOUR_VERSION]); // Dependencies

    const viewerTourSteps: Step[] = [
        {
            target: '#tour-viewer-workspace-select-trigger', // Target the SelectTrigger
            content: (
                <div>
                    <h4>Welcome to the Data Explorer!</h4>
                    <p>This is where you interact with your data. First, ensure you have the correct <strong>Workspace (Dataset)</strong> selected here.</p>
                </div>
            ),
            placement: 'bottom-start',
            disableBeacon: true,
        },
        {
            target: '#tour-sidebar-tab-tables', // ID on the Tables TabTrigger
            content: <p>Explore your available <strong>Tables</strong> in the selected workspace here. Click a table to see its preview.</p>,
            placement: 'right',
        },
        {
            target: '#tour-sidebar-tab-history', // ID on the History TabTrigger
            content: <p>Revisit your <strong>Past Executed Queries</strong> in the History tab. Click one to load it into the editor.</p>,
            placement: 'right',
            // action to switch tab if needed by Joyride (advanced)
            // before: () => setCurrentSidebarTab('history'),
        },
        {
            target: '#tour-nl-prompt-input', // ID on the Natural Language Prompt Input
            content: <p>Want the AI to write SQL for you? Type your data question here in plain language (e.g., "show total sales per product").</p>,
            placement: 'bottom',
        },
        {
            target: '#tour-generate-sql-button', // ID on the "Generate SQL" button
            content: <p>Then, click <strong>Generate SQL</strong>. The AI will create a query based on your prompt and selected tables (if any).</p>,
            placement: 'bottom',
        },
        {
            target: '#tour-sql-editor-wrapper', // ID on the div wrapping the Monaco Editor
            content: <p>The generated SQL (or your manually written query) will appear in this <strong>SQL Editor</strong>. You can modify it as needed.</p>,
            placement: 'bottom',
        },
        {
            target: '#tour-run-query-button', // ID on the "Run Query" button
            content: <p>Once you're ready, click <strong>Run Query</strong> to execute the SQL against your BigQuery workspace.</p>,
            placement: 'bottom',
        },
        {
            target: '#tour-output-tabs-list', // ID for the TabsList in output pane
            content: <p>After running a query, your results will appear below. You can switch between <strong>Data Preview</strong> (for selected tables), <strong>Query Results</strong>, <strong>Visualizations</strong>, and <strong>AI Summaries</strong> using these tabs.</p>,
            placement: 'top',
        },
        {
            target: '#tour-output-tab-results', // ID on the "Results" TabTrigger
            content: <p>The <strong>Results</strong> tab shows the data returned by your query. You can filter and sort this data.</p>,
            placement: 'top',
            // before: () => setCurrentOutputTab('results'), // If tour needs to force tab switch
        },
        {
            target: '#tour-output-tab-visualize', // ID on the "Visualize" TabTrigger
            content: <p>If your query results are suitable, the <strong>Visualize</strong> tab will offer chart suggestions. Click one to see a chart!</p>,
            placement: 'top',
            // before: () => jobResults && suggestedCharts.length > 0 && setCurrentOutputTab('visualize'),
        },
        {
            target: '#tour-excel-download-button-results', // ID on the Excel download button in Results tab
            content: <p>You can download your query results (and an active chart if on the Visualize tab) as an <strong>Excel Report</strong> here.</p>,
            placement: 'top-start',
        },
        {
            target: '#tour-chatbot-toggle', // Assuming you add an ID to the chatbot toggle button
            content: <p>Need more help or have quick questions? Open our <strong>AI Chat Assistant</strong> anytime!</p>,
            placement: 'top-end',
        }
    ];


        const handleViewerJoyrideCallback = (data: CallBackProps) => {
        const { status, type, action, index, step } = data;
        const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

        console.log('[ViewerTour Callback]', { status, type, action, index, step: step?.target });

        if (type === EVENTS.TARGET_NOT_FOUND) {
            console.error(`[ViewerTour Error] Target not found for step ${index}: ${step.target}`);
            // Decide if to skip or stop. For now, let's try to continue if possible.
            // You might want to setRunViewerTour(false) to stop.
        }

        if (action === 'close' || finishedStatuses.includes(status) || type === 'tour:end') {
            console.log('[ViewerTour Callback] Tour ending or closing.');
            setRunViewerTour(false);
            if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
                console.log('[ViewerTour Callback] Marking viewer tour as seen.');
                localStorage.setItem(VIEWER_TOUR_VERSION, 'true');
            }
        }
        // Logic to automatically switch tabs if a step requires it
        // This can get complex. Simpler is to guide the user to click.
        // Example for advanced handling:
        // if (type === EVENTS.STEP_BEFORE) {
        //   if (step.target === '#tour-sidebar-tab-history') {
        //     setCurrentSidebarTab('history');
        //   } else if (step.target === '#tour-output-tab-results' && currentOutputTab !== 'results') {
        //     setCurrentOutputTab('results');
        //   } else if (step.target === '#tour-output-tab-visualize' && currentOutputTab !== 'visualize' && jobResults && suggestedCharts.length > 0) {
        //      setCurrentOutputTab('visualize');
        //   }
        // }
    };
// ... other functions like fetchTables, submitSqlJob etc ...
// +++ MODIFICATION START: Derive available columns for SEMI_AUTO mode +++
// --- START: Added useMemo Hook ---

interface AvailableColumnOption {
    value: string;
    label: string;
    tableName: string;
  }


const availableColumnsForSelection = useMemo(() => {
    if (aiMode !== 'SEMI_AUTO' || selectedAiTables.size === 0 || !schemaData) {
        return [];
    }
    const columns: AvailableColumnOption[] = [];
    schemaData.tables.forEach(table => {
        if (selectedAiTables.has(table.table_id)) {
            table.columns.forEach(col => {
                columns.push({
                    value: col.name,
                    label: `${table.table_id}.${col.name}`,
                    tableName: table.table_id,
                });
            });
        }
    });
    return columns.sort((a, b) => a.label.localeCompare(b.label));
}, [aiMode, selectedAiTables, schemaData]);
// --- END: Added useMemo Hook ---
 // +++ MODIFICATION END +++
// +++ Function to Fetch Prompt Suggestions +++
const fetchPromptSuggestions = useCallback(async (currentPrompt: string) => {
    if (currentPrompt.trim().length < 3) { // Minimum length to trigger suggestions
        setPromptSuggestions([]);
        setShowSuggestions(false);
        setIsLoadingSuggestions(false);
        return;
    }

    // console.log("Fetching suggestions for:", currentPrompt);
    setIsLoadingSuggestions(true);
    // Keep suggestions visible while loading new ones, maybe show loader inside
    // setShowSuggestions(false); // Optionally hide immediately

    try {
        const response = await axiosInstance.post<{ suggestions: string[], error?: string }>('/api/bigquery/suggest-prompt', {
            current_prompt: currentPrompt,
        });

        if (response.data.error) {
            console.warn("Prompt suggestion error:", response.data.error);
            setPromptSuggestions([]);
            setShowSuggestions(false);
        } else {
            setPromptSuggestions(response.data.suggestions || []);
            setShowSuggestions((response.data.suggestions || []).length > 0); // Show only if suggestions exist
        }

    } catch (error: any) {
        console.error("Failed to fetch prompt suggestions:", error);
        setPromptSuggestions([]); // Clear suggestions on error
        setShowSuggestions(false);
    } finally {
        setIsLoadingSuggestions(false);
    }
}, []); // Dependency array is empty as it uses state setters and useCallback
const fetchSchema = useCallback(async () => {
    // +++ Refined Guard Clause (Similar to fetchTables) +++
    if (!fullDatasetId || !fullDatasetId.includes('.')) {
        // console.warn(`Skipping fetchSchema: Invalid or empty fullDatasetId ('${fullDatasetId}')`);
        setSchemaData(null);
        setLoadingSchema(false);
        setSchemaError(""); // Clear schema error if skipping
        return; // Exit early
    }
    // +++ End Refined Guard Clause +++

    // console.log(`Fetching schema for dataset: ${fullDatasetId}`);
    setLoadingSchema(true);
    setSchemaError("");
    setSchemaData(null);
    try {
        const url = `/api/bigquery/schema?dataset_id=${encodeURIComponent(fullDatasetId)}`;
        // console.log(`Calling Schema API: ${url}`); // Log the exact URL
        const r = await axiosInstance.get<SchemaResponse>(url);
        setSchemaData(r.data);
    } catch(e){
        console.error("Error fetching schema:", e);
        const errorMessage = getErrorMessage(e);
        console.error(`Full error message received in fetchSchema: ${errorMessage}`); // Log the specific error
        setSchemaError(`Load schema failed: ${errorMessage}`);
    } finally {
        setLoadingSchema(false);
    }
 // Dependencies: Correctly includes fullDatasetId
}, [fullDatasetId, getErrorMessage]);

// +++ Handle Prompt Input Change with Debouncing +++
const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newPrompt = e.target.value;
    setNlPrompt(newPrompt);
    setNlError(""); // Clear NL error on type

    // Clear existing debounce timeout
    if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current);
    }

    // Hide suggestions while typing and set new timeout
    setShowSuggestions(false);
    setIsLoadingSuggestions(false); // Reset loading if user types again quickly
    setPromptSuggestions([]); // Clear old suggestions immediately


    if (newPrompt.trim().length >= 3) { // Only set timeout if prompt is long enough
        suggestionTimeoutRef.current = setTimeout(() => {
            fetchPromptSuggestions(newPrompt);
        }, 500); // 500ms debounce delay
    }

}, [fetchPromptSuggestions]); // Depends on fetchPromptSuggestions

// +++ Handle Suggestion Selection +++
const handleSuggestionClick = useCallback((suggestion: string) => {
    setNlPrompt(suggestion); // Update prompt input
    setShowSuggestions(false); // Hide suggestions
    setPromptSuggestions([]); // Clear suggestions
    if (suggestionTimeoutRef.current) { // Clear any pending fetch
        clearTimeout(suggestionTimeoutRef.current);
    }
    promptInputRef.current?.focus(); // Optional: refocus the input
}, []);


const handleDeleteTable = useCallback(async (datasetIdToDeleteFrom: string, tableIdToDelete: string) => {
    if (!datasetIdToDeleteFrom) {
         toast({ title: "Error", description: "Dataset ID missing for deletion.", variant: "destructive" });
         return;
    }
     // Use AlertDialog for confirmation (preferred) or window.confirm
     // const confirmed = window.confirm(`Are you sure you want to permanently delete the table "${tableIdToDelete}" from workspace "${datasetIdToDeleteFrom}"? This action cannot be undone.`);
     // if (!confirmed) {
     //     return;
     // }

    // console.log(`Attempting to delete table: ${tableIdToDelete} from dataset: ${datasetIdToDeleteFrom}`);
    // Consider adding a loading state for the specific table being deleted
    try {
        await axiosInstance.delete(`/api/bigquery/datasets/${encodeURIComponent(datasetIdToDeleteFrom)}/tables/${encodeURIComponent(tableIdToDelete)}`);

        toast({
            title: "Table Deleted",
            description: `Table "${tableIdToDelete}" has been successfully deleted.`,
            variant: "default", // Use success variant if available
        });

        // Update UI state
        setTables(prev => prev.filter(t => t.tableId !== tableIdToDelete));
        setFilteredTables(prev => prev.filter(t => t.tableId !== tableIdToDelete));
        if (selectedTableId === tableIdToDelete) {
            // Reset selection if the deleted table was selected
            setSelectedTableId(null);
            setPreviewRows([]);
            setPreviewColumns([]);
            setPreviewTotalRows(0);
            setPreviewError("");
            setTableStats(null);
            setSql(`-- Table ${tableIdToDelete} deleted. Select another table or use AI ✨`);
            setCurrentOutputTab('data'); // Switch back to data/preview tab
        }
        // Refresh schema data as well? Optional, depends on how often schema is used elsewhere.
        fetchSchema(); // Refresh schema after deletion might be good

    } catch (error: any) {
        console.error(`Failed to delete table ${tableIdToDelete}:`, error);
        const errorMessage = getErrorMessage(error);
        toast({
            title: "Deletion Failed",
            description: `Could not delete table "${tableIdToDelete}": ${errorMessage}`,
            variant: "destructive",
        });
    } finally {
        // Reset loading state if implemented
    }
}, [selectedTableId, toast, getErrorMessage, fetchSchema]); // Add dependencies if needed


// +++ Handle Clicking Outside to Hide Suggestions +++
useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        // Check if click is outside the suggestions container AND outside the prompt input
        if (
            suggestionContainerRef.current &&
            !suggestionContainerRef.current.contains(event.target as Node) &&
            promptInputRef.current &&
            !promptInputRef.current.contains(event.target as Node)
        ) {
            setShowSuggestions(false);
        }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        // Clear timeout on unmount
        if (suggestionTimeoutRef.current) {
            clearTimeout(suggestionTimeoutRef.current);
        }
    };
}, []); // Empty dependency array, runs once


// ... rest of the component ...

    const formatBytes = useCallback((bytes: number | null | undefined): string => { if(bytes==null||bytes===undefined||bytes===0)return"0 Bytes"; const k=1024,s=["Bytes","KB","MB","GB","TB"],i=Math.floor(Math.log(bytes)/Math.log(k)); return parseFloat((bytes/Math.pow(k,i)).toFixed(2))+" "+s[i]; }, []);
    const formatDate = useCallback((dateString: string | null | undefined): string => { if(!dateString)return"N/A"; try{return new Date(dateString).toLocaleString();}catch(e){return dateString;} }, []);
    const copyToClipboard = useCallback((text: string, _message: string = "Copied!"): void => { navigator.clipboard.writeText(text).then(()=>{
        
        
        // console.log(message); 
        
        
        /* TODO: Add toast */}).catch(err=>{console.error("Copy failed:",err);}); }, []);
    const toggleFavorite = useCallback((tableId: string): void => setFavoriteTables(prev => prev.includes(tableId)?prev.filter(id=>id!==tableId):[...prev,tableId]), []);
    const addToHistory = useCallback((newItem: Omit<QueryHistoryItem, 'id' | 'timestamp'>): void => {
        const ts = new Date().toISOString();
        // Added randomness to ID to better handle quick successive identical queries if needed
        const id = `q-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        setQueryHistory(prev => [{ ...newItem, id, timestamp: ts }, ...prev.slice(0, 49)]); // Limit history size
    }, []);

    // --- API Callbacks (Keep existing ones) ---
    const stopPolling = useCallback(() => { if(pollingIntervalRef.current){clearInterval(pollingIntervalRef.current); pollingIntervalRef.current=null; console.log("Polling stopped.");} }, []);
    // fetchJobResults: Modified to set original results in jobResults
    
    

    const fetchJobResults = useCallback(async (currentJobId: string, loc: string, pageToken?: string | null) => {
        // console.log(`Fetching results job ${currentJobId}, page: ${pageToken ? 'next' : 'first'}`);
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

        // console.log("Applying filters:", activeFilters);
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
        // console.log("Filtered data count:", data.length);
        return data;
    }, [jobResults?.rows, activeFilters]);
    
    

    // fetchJobStatus: Mostly unchanged, triggers fetchJobResults
    const fetchJobStatus = useCallback(async (currentJobId: string, loc: string) => { 
        
        // console.log(`Polling job: ${currentJobId}`);
        
        setJobError(""); try { const r=await axiosInstance.get<JobStatusResponse>(`/api/bigquery/jobs/${currentJobId}?location=${loc}`); const d=r.data; setJobStatus(d); if(d.state==='DONE'){ stopPolling(); setIsRunningJob(false); if(d.error_result){ const errMsg=`Job failed: ${d.error_result.message||d.error_result.reason||'Unknown'}`; setJobError(errMsg); setJobResults(null); addToHistory({sql,success:false}); } else { setJobError(""); setCurrentOutputTab("results"); // Switch to results tab on SUCCESSFUL completion
                 if(d.statement_type==='SELECT'||d.statement_type===undefined){ await fetchJobResults(currentJobId,loc); // Fetch first page
                } else { setJobResults({rows:[],total_rows_in_result_set:d.num_dml_affected_rows??0,schema:[]}); addToHistory({sql,success:true,rowCount:d.num_dml_affected_rows}); } } } else { setIsRunningJob(true); } } catch (e:any){ console.error("Error fetching status:",e); const m=getErrorMessage(e); if(e.response?.status===404){ setJobError(`Job ${currentJobId} not found.`); stopPolling(); setIsRunningJob(false); addToHistory({sql,success:false}); } else { setJobError(`Fetch status failed: ${m}`); } } }, [stopPolling, fetchJobResults, sql, addToHistory, getErrorMessage]); // Added setCurrentOutputTab dependency indirectly via fetchJobResults



// Assuming this is inside your BigQueryTableViewer.tsx component
// and all necessary states (jobId, sql, jobLocation, activeVisualization, chartContainerRef, 
// currentOutputTab, filteredData, setIsDownloadingExcel) and imports 
// (useCallback, toast, getErrorMessage, htmlToImage, saveAs, axiosInstance, 
// ActiveVisualizationConfig, BackendChartConfig, RowData) are correctly defined.

const handleExcelDownload = useCallback(async () => {
    // console.log("[DEBUG] handleExcelDownload: Entry point");

    if (!jobId || !sql || !jobLocation) {
        console.error("[DEBUG] handleExcelDownload: Missing Job ID, SQL, or Location for download.");
        toast({ variant: "destructive", title: "Download Error", description: "Cannot download report: Missing required job info." });
        return;
    }

    setIsDownloadingExcel(true);
    toast({ title: "Preparing Report...", description: "Generating Excel report with data and chart (if active)...", duration: 3000 });

    let chartImageBase64: string | null = null;
    let backendChartConfigPayload: BackendChartConfig | null = null;
    let chartDataForPayload: RowData[] | null = null;
    let dataUrl: string | null = null; 

    // --- Log states BEFORE the chart capture condition ---
    // console.log("[DEBUG] handleExcelDownload: Before chart capture check:");
    // console.log(`[DEBUG]   activeVisualization:`, activeVisualization ? JSON.stringify(activeVisualization) : 'null');
    // console.log(`[DEBUG]   chartContainerRef.current exists:`, !!chartContainerRef.current);
    // console.log(`[DEBUG]   currentOutputTab:`, currentOutputTab);
    // console.log(`[DEBUG]   filteredData.length:`, filteredData.length);

    // --- Capture chart image if a visualization is active and rendered ON THE VISUALIZE TAB ---
    if (activeVisualization && chartContainerRef.current && currentOutputTab === 'visualize' && filteredData.length > 0) {
        // console.log("[DEBUG] handleExcelDownload: ALL conditions for chart capture MET. Attempting image capture...");
        try {
            // console.log("[DEBUG] htmlToImage: About to call toPng on ref:", chartContainerRef.current);
            dataUrl = await htmlToImage.toPng(chartContainerRef.current, { 
                quality: 0.95, 
                pixelRatio: 1.5,
                // You might add a filter here if specific elements (like Monaco editor if it's somehow included)
                // are causing issues, though it shouldn't be if chartContainerRef only wraps the chart.
                // filter: (node) => { ... } 
            });
            // console.log("[DEBUG] htmlToImage: toPng call completed. dataUrl (first 100 chars):", dataUrl ? dataUrl.substring(0, 100) : "null or undefined");

            if (dataUrl && dataUrl.includes(',')) {
                chartImageBase64 = dataUrl.split(',')[1];
                // console.log("[DEBUG] htmlToImage: Split successful. chartImageBase64 is SET (length:", chartImageBase64?.length, ").");
            } else {
                // console.warn("[DEBUG] htmlToImage: dataUrl was null, undefined, or did not contain ','. dataUrl:", dataUrl);
            }
            
            // Map frontend ActiveVisualizationConfig to BackendChartConfig
            // This ensures the keys sent to the backend match its Pydantic model
            if (activeVisualization) { // Redundant check but safe
                backendChartConfigPayload = {
                    type: activeVisualization.chart_type,
                    x_axis: activeVisualization.x_axis_column,
                    y_axes: activeVisualization.y_axis_columns,
                    rationale: activeVisualization.rationale,
                };
            }
            chartDataForPayload = filteredData; // Send the data that powered the captured chart

        } catch (imgError: any) {
            console.error("[DEBUG] handleExcelDownload: FAILED to capture chart image (htmlToImage.toPng threw an error):", imgError);
            // console.log("[DEBUG] htmlToImage: Value of dataUrl in catch block:", dataUrl); // Log dataUrl state in catch
            if (imgError && imgError.message) {
                console.error("[DEBUG]   Error message:", imgError.message);
            }
            if (imgError && imgError.stack) {
                console.error("[DEBUG]   Error stack:", imgError.stack);
            }
            toast({ title: "Chart Capture Failed", description: `Could not generate chart image: ${imgError.message || 'Unknown error'}. Proceeding with data export.`, variant: "default", duration: 5000 });
            // chartImageBase64, backendChartConfigPayload, chartDataForPayload will remain null or their initial values
        }
    } else {
        // console.warn("[DEBUG] handleExcelDownload: ONE OR MORE conditions for chart capture NOT MET (activeViz, ref, currentTab, or data).");
        if (!activeVisualization) console.warn("[DEBUG]   Reason: activeVisualization is falsy.");
        if (!chartContainerRef.current) console.warn("[DEBUG]   Reason: chartContainerRef.current is falsy/null (Chart component might not be mounted/visible if not on Visualize tab).");
        if (currentOutputTab !== 'visualize') console.warn(`[DEBUG]   Reason: currentOutputTab is '${currentOutputTab}', not 'visualize'.`);
        if (filteredData.length === 0) console.warn("[DEBUG]   Reason: filteredData is empty.");
    }

    try {
        const payload = {
            job_id: jobId,
            sql: sql,
            location: jobLocation,
            chart_image_base64: chartImageBase64,
            chart_config: backendChartConfigPayload,
            chart_data: chartDataForPayload,
        };
        
        // console.log("[DEBUG] FINAL PAYLOAD CHECK: chart_image_base64 is " + (chartImageBase64 ? `PRESENT (length: ${chartImageBase64.length})` : "NULL or EMPTY"));
        // console.log("[DEBUG] FINAL PAYLOAD CHECK: chart_config is " + (backendChartConfigPayload ? JSON.stringify(backendChartConfigPayload) : "NULL"));
        
        // console.log("[DEBUG] Requesting Excel export with payload (actual values):", payload );

        const response = await axiosInstance.post('/api/export/query-to-excel', payload, {
            responseType: 'blob',
        });

        let filename = `query_report_${jobId.substring(0, 8)}.xlsx`;
        const contentDisposition = response.headers['content-disposition'];
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1];
            }
        }
        saveAs(response.data, filename);
        toast({ title: "Download Started", description: `Report "${filename}" should begin downloading.`, variant: "default" });

    } catch (error: any) {
        console.error("[DEBUG] handleExcelDownload: Excel download API call failed:", error);
        const errorMessage = getErrorMessage(error);
        toast({ variant: "destructive", title: "Download Failed", description: errorMessage });
    } finally {
        setIsDownloadingExcel(false);
        // console.log("[DEBUG] handleExcelDownload: Exiting function.");
    }
}, [
    jobId, sql, jobLocation, toast, getErrorMessage, setIsDownloadingExcel,
    activeVisualization, chartContainerRef, currentOutputTab, filteredData,
]);
    




    const submitSqlJob = useCallback(async () => {
        // Initial checks for dataset selection remain the same
        if (!fullDatasetId) {
            toast({ title: "Dataset Required", description: "Please select a workspace first.", variant: "destructive" });
            return;
        }
         if (!selectedDatasetId) {
             toast({ title: "Dataset Selection Issue", description: "Selected dataset ID is missing.", variant: "destructive" });
             return;
        }

        // console.log(`Submitting SQL for dataset ${fullDatasetId}:`, sql);
        stopPolling();
        setJobId(null);
        setJobLocation(null);
        setJobStatus(null);
        setJobError("");
        setJobResults(null);
        setResultsError("");
        setActiveFilters({});
        setActiveVisualization(null);
        setSuggestedCharts([]);
        setIsRunningJob(true);
        setAiSummary(null);
        setAiSummaryError(null);
        setLoadingAiSummary(false);
        setLastUserPrompt(null);
        setCurrentOutputTab("results");

        try {
            // Find the selected dataset's metadata using the selectedDatasetId (short ID)
            const selectedDatasetMetadata = availableDatasets.find(ds => ds.datasetId === selectedDatasetId);

            if (!selectedDatasetMetadata) {
                console.error("Could not find metadata in availableDatasets for:", selectedDatasetId);
                console.error("Available datasets:", availableDatasets);
                setJobError("Internal Error: Could not find selected dataset's metadata. Please refresh or re-select.");
                setIsRunningJob(false);
                return;
            }

            // +++ MODIFICATION START: Revert to fullDatasetId for default_dataset +++
            const payload = {
              sql,
              priority: "BATCH",
              use_legacy_sql: false,
              // Send the FULLY QUALIFIED ID as required by the error message
              default_dataset: fullDatasetId,
              location: selectedDatasetMetadata.location,
            };
            // +++ MODIFICATION END +++
            // console.log("Job Payload:", payload);

            // Fire the request
            const r = await axiosInstance.post<JobSubmitResponse>("/api/bigquery/jobs", payload);
            const { job_id, location: jobLoc, state } = r.data;
            // console.log("Job Submitted:", r.data);
            setJobId(job_id);
            setJobLocation(jobLoc || selectedDatasetMetadata.location);
            setJobStatus({ job_id, location: jobLoc || selectedDatasetMetadata.location, state: state as any });

        } catch (e: any) {
            console.error("Error submitting job:", e);
            const errMsg = `Submit failed: ${getErrorMessage(e)}`;
            setJobError(errMsg);
            setIsRunningJob(false);
            setJobId(null);
            setJobLocation(null);
            addToHistory({ sql, success: false });
        }
         // Dependencies are correct, no change needed here from previous step
    }, [
        sql,
        stopPolling,
        addToHistory,
        getErrorMessage,
        fullDatasetId,
        selectedDatasetId,
        availableDatasets,
        toast
    ]);
    interface TableDataApiResponse {
        rows: RowData[]; // Assuming RowData is defined
        totalRows?: number;
        stats?: TableStats; // Assuming TableStats is defined
    }

    // fetchTables, handleTableSelect, etc remain unchanged for now
    const fetchTables = useCallback(async () => {
        // +++ Refined Guard Clause +++
        // Ensure fullDatasetId is not empty AND contains a dot (basic check for project.dataset format)
        // This prevents calls when selectedDatasetId is set but projectId isn't ready, or vice versa.
        if (!fullDatasetId || !fullDatasetId.includes('.')) {
            // console.warn(`Skipping fetchTables: Invalid or empty fullDatasetId ('${fullDatasetId}')`);
            setTables([]);
            setFilteredTables([]);
            setLoadingTables(false);
            // Clear error state if skipping due to invalid ID, it's not a fetch failure yet.
            setListTablesError("");
            return; // Exit the function early
        }
        // +++ End Refined Guard Clause +++

        // console.log(`Fetching tables for dataset: ${fullDatasetId}`); // Log the ID being used
        setLoadingTables(true);
        setListTablesError("");
        setTables([]); // Clear previous tables
        setFilteredTables([]);
        try {
            const url = `/api/bigquery/tables?dataset_id=${encodeURIComponent(fullDatasetId)}`;
            // console.log(`Calling Table API: ${url}`); // Log the exact URL
            const r = await axiosInstance.get<TableInfo[]>(url);
            setTables(r.data);
            setFilteredTables(r.data);
            // Optional: Toast only if needed, can be noisy on dataset switch
            // toast({ title: "Tables Loaded Successfully", variant: "default" });
        }
        catch (e:any){
            console.error("Error fetching tables:", e);
            const errorMessage = getErrorMessage(e);
            console.error(`Full error message received in fetchTables: ${errorMessage}`); // Log the specific error
            setListTablesError(`Load tables failed: ${errorMessage}`);
        } finally {
            setLoadingTables(false);
        }
    // Dependencies: Correctly includes fullDatasetId
    }, [fullDatasetId, getErrorMessage, toast]);
    
    
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
        const defaultSql = `SELECT *\nFROM \`${fullDatasetId}.${tableId}\`\nLIMIT 100;`;
        setSql(defaultSql);
        setCurrentOutputTab("data"); // Switch to PREVIEW tab
        try {
            const url = `/api/bigquery/table-data?dataset_id=${encodeURIComponent(fullDatasetId)}&table_id=${encodeURIComponent(tableId)}&page=1&limit=${previewRowsPerPage}`;
            const r = await axiosInstance.get<TableDataApiResponse>(url); // Type the response
            const d = r.data; // Now d is known to be TableDataApiResponse | undefined
            setPreviewRows(d?.rows ?? []); // This should now type-check better
            setPreviewTotalRows(d?.totalRows ?? d?.rows?.length ?? 0);
            setTableStats(d?.stats ?? null);
            if (d?.rows && d.rows.length > 0) { // Check d.rows exists before accessing index
                 setPreviewColumns(Object.keys(d.rows[0]));
            } else {
                 setPreviewColumns([]);
            }
        } catch (e: any) {
            console.error("Error fetching table data:", e);
            setPreviewError(`Load preview failed: ${getErrorMessage(e)}`);
        } finally {
            setLoadingPreview(false);
        }
     }, [fullDatasetId, previewRowsPerPage, stopPolling, getErrorMessage]); // Dependencies remain the same


     const fetchAiSummary = useCallback(async () => {
        if (!jobResults?.schema || jobResults.rows.length === 0 || !sql) {
            console.warn("Cannot fetch AI summary: Missing results, schema, or SQL.");
            return;
        }
        setLoadingAiSummary(true);
        setAiSummary(null);
        setAiSummaryError(null);

        try {
            const requestPayload: AISummaryRequest = {
                schema: jobResults.schema,
                query_sql: sql,
                original_prompt: lastUserPrompt, // Send the stored prompt
                result_sample: jobResults.rows.slice(0, 10) // Send first 10 rows as sample
            };

            const response = await axiosInstance.post<AISummaryResponse>(
                '/api/bigquery/summarize-results',
                requestPayload
            );

            if (response.data.error) {
                setAiSummaryError(`AI Summary Error: ${response.data.error}`);
            } else if (response.data.summary_text) {
                setAiSummary(response.data.summary_text);
            } else {
                 setAiSummaryError("AI did not return a summary.");

            }

        } catch (error) {
            console.error("Error fetching AI summary:", error);
            const errorMsg = `Failed to get AI summary: ${getErrorMessage(error)}`;
            setAiSummaryError(errorMsg);
        } finally {
            setLoadingAiSummary(false);
        }
    }, [jobResults, sql, lastUserPrompt, getErrorMessage]); // Dependencies
    // +++ END Function to Fetch AI Summary +++

    type TableDataResponse = {
        rows: Record<string, any>[];
      };
      const handlePreviewPageChange = useCallback(async (newPage: number) => {
        if (!selectedTableId || newPage === previewCurrentPage) return;

        setLoadingPreview(true);
        setPreviewError("");

        try {
          const url = `/api/bigquery/table-data?dataset_id=${encodeURIComponent(fullDatasetId)}&table_id=${encodeURIComponent(selectedTableId)}&page=${newPage}&limit=${previewRowsPerPage}`;
          const r = await axiosInstance.get<TableDataResponse>(url);
          const d = r.data;

          setPreviewRows(d?.rows ?? []);
          setPreviewCurrentPage(newPage);

          if ((d?.rows?.length > 0) && previewColumns.length === 0) {
            setPreviewColumns(Object.keys(d.rows[0]));
          }
        } catch (e: any) {
          console.error("Error fetching page data:", e);
          setPreviewError(`Load page ${newPage} failed: ${getErrorMessage(e)}`);
        } finally {
          setLoadingPreview(false);
        }
      }, [selectedTableId, previewCurrentPage, previewRowsPerPage, fullDatasetId, previewColumns.length, getErrorMessage]);
    const handlePreviewRowsPerPageChange = useCallback((value: string) => { const n=parseInt(value,10); setPreviewRowsPerPage(n); setPreviewCurrentPage(1); if(selectedTableId)handleTableSelect(selectedTableId);}, [selectedTableId, handleTableSelect]);
    const handlePreviewSort = useCallback((columnName: string) => { let d:"asc"|"desc"="asc"; if(previewSortConfig?.key===columnName&&previewSortConfig.direction==="asc")d="desc"; setPreviewSortConfig({key:columnName,direction:d}); const s=[...previewRows].sort((a,b)=>{ const valA=a[columnName], valB=b[columnName]; if(valA==null)return 1; if(valB==null)return -1; if(valA<valB)return d==="asc"?-1:1; if(valA>valB)return d==="asc"?1:-1; return 0; }); setPreviewRows(s);}, [previewSortConfig, previewRows]);
    
    

// +++ MODIFICATION START: Add effect for clearing columns +++
// Effect to clear selected columns when selected tables change
useEffect(() => {
    setSelectedAiColumns(new Set());
}, [selectedAiTables]);
 // +++ MODIFICATION END +++

// Modify the dataset change effect
useEffect(() => {
    if (selectedDatasetId) {
        // ... (reset other state like tables, schema, jobs, etc.) ...

         // +++ MODIFICATION START: Reset AI selections on dataset change +++
         setAiMode('AUTO');
         setSelectedAiTables(new Set());
         setSelectedAiColumns(new Set());
         // +++ MODIFICATION END +++

        fetchTables();
        fetchSchema();
    }
}, [selectedDatasetId, fetchTables, fetchSchema]); // Dependencies unchanged
    
    // --- MODIFIED handleGenerateSql callback ---
// --- START: Refactored handleGenerateSql Callback ---
const handleGenerateSql = useCallback(async () => {
    const currentPrompt = nlPrompt.trim();
    if (!currentPrompt) { setNlError("Please enter a query description."); return; }
    if (!selectedDatasetId) { setNlError("Please select a workspace first."); return; }

    // SEMI_AUTO Mode Validation
    if (aiMode === 'SEMI_AUTO' && selectedAiTables.size === 0) {
        setNlError("SEMI-AUTO mode requires at least one table selection.");
        return;
    }

    setGeneratingSql(true); setNlError(""); setJobError("");
    setJobId(null); setJobLocation(null); setJobStatus(null); setJobResults(null);
    setActiveFilters({}); setActiveVisualization(null); setSuggestedCharts([]);
    setAiSummary(null); setAiSummaryError(null); setLoadingAiSummary(false);
    setLastUserPrompt(currentPrompt);

    try {
        const payload: any = {
            prompt: currentPrompt,
            dataset_id: fullDatasetId,
            ai_mode: aiMode,
        };

        if (aiMode === 'SEMI_AUTO') {
            payload.selected_tables = Array.from(selectedAiTables);
            if (selectedAiColumns.size > 0) {
                payload.selected_columns = Array.from(selectedAiColumns);
            }
            // console.log("Sending SEMI_AUTO payload:", payload);
        } else {
            //  console.log("Sending AUTO payload:", payload);
        }

        const r = await axiosInstance.post<NLQueryResponse>('/api/bigquery/nl2sql', payload);

        if (r.data.error) {
            setNlError(r.data.error);
            setSql(`-- AI Error: ${r.data.error}\n-- Your prompt: ${currentPrompt}`);
        } else if (r.data.generated_sql) {
            setSql(r.data.generated_sql);
             toast({ title: "SQL Generated", description: "Review the query and click 'Run Query'.", variant: "default" });
        } else {
            setNlError("AI did not return valid SQL.");
             setSql(`-- AI returned no SQL.\n-- Your prompt: ${currentPrompt}`);
        }
    } catch (e: any) {
        const errorMsg = `Generate SQL failed: ${getErrorMessage(e)}`;
        setNlError(errorMsg);
         setSql(`-- Failed to generate SQL: ${errorMsg}\n-- Your prompt: ${currentPrompt}`);
    } finally {
        setGeneratingSql(false);
    }
}, [
    nlPrompt, fullDatasetId, selectedDatasetId, getErrorMessage, stopPolling, toast,
    aiMode, selectedAiTables, selectedAiColumns // New dependencies
]);
// --- END: Refactored handleGenerateSql Callback ---


// Add this useEffect for initial dataset loading
useEffect(() => {
    const fetchInitialDatasets = async () => {
        // console.log("Fetching initial list of datasets...");
        setLoadingDatasets(true);
        setDatasetError(null);
        setAvailableDatasets([]);
        setSelectedDatasetId("");
        try {
            const resp = await axiosInstance.get<DatasetListApiResponse>('/api/bigquery/datasets');
            const datasets = resp.data.datasets.sort((a, b) =>
                a.datasetId.localeCompare(b.datasetId)
            );
            setAvailableDatasets(datasets);

            if (datasets.length > 0) {
                setSelectedDatasetId(datasets[0].datasetId);
                toast({ title: `Selected initial dataset: ${datasets[0].datasetId}`, variant: "default", duration: 2000});
            } else {
                setDatasetError("Create a workspace.");
                setTables([]);
                setFilteredTables([]);
                setSchemaData(null);
            }
        } catch (error: any) {
            console.error("Error fetching datasets:", error);
            const message = getErrorMessage(error);
            setDatasetError(`Failed to load datasets: ${message}`);
            setTables([]);
            setFilteredTables([]);
            setSchemaData(null);
        } finally {
            setLoadingDatasets(false);
        }
    };
    fetchInitialDatasets();
}, [getErrorMessage, toast]);
const handleDatasetChange = (newDatasetId: string) => {
    if (newDatasetId && newDatasetId !== selectedDatasetId) {
        // console.log(`Dataset selection changed to: ${newDatasetId}`);
        toast({title: `Switching to dataset: ${newDatasetId}`, duration: 1500});
        setSelectedDatasetId(newDatasetId);
    }
};
useEffect(() => {
    if (selectedDatasetId) {
        // Reset table/schema related state *before* fetching new data
        setTables([]);
        setFilteredTables([]);
        setSchemaData(null);
        setListTablesError("");
        setSchemaError("");
        setSelectedTableId(null);
        setPreviewRows([]);
        setPreviewColumns([]);
        setPreviewTotalRows(0);
        setPreviewCurrentPage(1);
        setTableStats(null);
        setPreviewError("");
        setJobId(null);
        setJobLocation(null);
        setJobStatus(null);
        setJobError("");
        setJobResults(null);
        setResultsError("");
        setActiveFilters({});
        setActiveVisualization(null);
        setSuggestedCharts([]);
        setAiSummary(null);
        setAiSummaryError(null);

        // Trigger fetches for the new dataset
        fetchTables();
        fetchSchema();
    }
}, [selectedDatasetId, fetchTables, fetchSchema]);
    // --- Filter Generation Effect ---
    useEffect(() => {
        if (jobResults?.rows && jobResults.rows.length > 0 && jobResults.schema) {
            const schema = jobResults.schema;
            const rows = jobResults.rows;
            const generatedFilters: FilterConfig[] = [];
            const MAX_CATEGORICAL_OPTIONS = 100; // Limit unique values for performance

            // console.log("Generating filters from results...");

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

            // console.log("Available filters generated:", generatedFilters);
            setAvailableFilters(generatedFilters);
            setActiveFilters({}); // Reset active filters when results/schema change

        } else {
            // Clear filters if no results/rows/schema
            setAvailableFilters([]);
            setActiveFilters({});
        }
    }, [jobResults?.schema, jobResults?.rows]); // Rerun when schema or rows change


    // --- Filter Handlers ---
    const handleFilterChange = useCallback((columnName: string, value: ActiveFilterValue | null) => {
        // console.log(`Filter change: ${columnName}`, value);
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
        // console.log("Clearing all filters");
        setActiveFilters({});
        // Visualization validity check will happen in the useEffect hook.
    }, []);

    // --- Existing Effects ---
    useEffect(() => { if(jobId&&jobLocation&&isRunningJob&&!pollingIntervalRef.current){ fetchJobStatus(jobId,jobLocation); pollingIntervalRef.current=setInterval(()=>{fetchJobStatus(jobId,jobLocation);},POLLING_INTERVAL_MS); 
    
    
    // console.log("Polling started."); 

} return()=>{stopPolling();}; }, [jobId,jobLocation,isRunningJob,fetchJobStatus,stopPolling]);
    useEffect(() => { fetchTables(); fetchSchema(); }, [fetchTables, fetchSchema]);
    useEffect(() => { const lq=tableSearchQuery.toLowerCase(); setFilteredTables(tables.filter(t=>t.tableId.toLowerCase().includes(lq))); }, [tableSearchQuery, tables]);
    // Modify history effect to use original row count if available
// NEW useEffect for successful history
useEffect(() => {
    // Add history item when a job finishes successfully
    // Check jobStatus directly for the 'DONE' state without error
    if (jobId && jobStatus?.state === 'DONE' && !jobStatus.error_result && !isRunningJob) {
        // console.log("Attempting to add successful query to history:", jobId, jobStatus); // Debug log

        let durationMs: number | undefined = undefined;
        if (jobStatus.end_time && jobStatus.start_time) {
            try {
                const end = new Date(jobStatus.end_time).getTime();
                const start = new Date(jobStatus.start_time).getTime();
                if (!isNaN(end) && !isNaN(start)) {
                    durationMs = end - start;
                } else {
                    console.warn("History duration calc: Invalid dates", jobStatus.start_time, jobStatus.end_time);
                }
            } catch (e) {
                console.warn("Could not parse history duration:", e);
            }
        }

        // Determine row count based on statement type
        let finalRowCount: number | undefined = undefined;
        if (jobStatus.statement_type === 'SELECT') {
            // Use jobResults if available, otherwise fallback if needed (though it should be fetched)
            finalRowCount = jobResults?.total_rows_in_result_set ?? jobResults?.rows?.length;
        } else {
            // Use num_dml_affected_rows for non-SELECT statements if available
            finalRowCount = jobStatus.num_dml_affected_rows;
        }

        addToHistory({
            sql, // Assumes 'sql' state holds the executed query
            success: true,
            rowCount: finalRowCount,
            durationMs: durationMs,
            bytesProcessed: jobStatus.total_bytes_processed
        });
    }
    // Dependencies: run when jobStatus changes, or when isRunningJob flips to false
    // Need jobId and sql as context. addToHistory is stable. jobResults needed for row count.
}, [jobStatus, isRunningJob, jobId, sql, addToHistory, jobResults]); // Added jobResults dependency back for rowCount


    // --- Modified Effect for Visualization Suggestions & Validity Check ---
    useEffect(() => {
        // --- Trigger AI Features when results are available and job is done ---
        if (jobResults?.schema && jobResults.rows.length > 0 && !isRunningJob && jobStatus?.state === 'DONE' && !jobStatus.error_result) {
            // console.log("Results available, triggering AI features (suggestions & summary)...");

            // --- Fetch AI Suggestions (Visualization) ---
            const fetchAiSuggestions = async () => {
                // ... (suggestion fetching logic - unchanged) ...
                if (!jobResults?.schema) return [];
                setLoadingAiSuggestions(true); setAiSuggestionError("");
                try {
                    const response = await axiosInstance.post<{suggestions: VizSuggestion[], error?: string}>( '/api/bigquery/suggest-visualization', { schema: jobResults.schema, query_sql: sql, result_sample: filteredData.slice(0, 5) });
                    if (response.data.error) { setAiSuggestionError(`AI Viz Error: ${response.data.error}`); return []; }
                    // console.log("AI Suggestions Received:", response.data.suggestions); 
                    return response.data.suggestions || [];
                } catch (error) { console.error("Error fetching AI suggestions:", error); setAiSuggestionError(`Failed to get AI suggestions: ${getErrorMessage(error)}`); return []; }
                finally { setLoadingAiSuggestions(false); }
            };

             // --- Combine rule-based and AI suggestions ---
             // Rules can be generated immediately
             const schema = jobResults.schema; const rows = jobResults.rows; const ruleBasedSuggestions: VizSuggestion[] = [];
             const isNumeric = (type: string) => ['INTEGER', 'INT64', 'FLOAT', 'FLOAT64', 'NUMERIC', 'BIGNUMERIC'].includes(type); const isString = (type: string) => type === 'STRING'; const isDate = (type: string) => ['DATE', 'DATETIME', 'TIMESTAMP'].includes(type); const numericCols = schema.filter(f => isNumeric(f.type)).map(f => f.name); const stringCols = schema.filter(f => isString(f.type)).map(f => f.name); const dateCols = schema.filter(f => isDate(f.type)).map(f => f.name);
             if (stringCols.length === 1 && numericCols.length >= 1) { ruleBasedSuggestions.push({ chart_type: 'bar', x_axis_column: stringCols[0], y_axis_columns: numericCols, rationale: `Compare ${numericCols.join(', ')} across '${stringCols[0]}'.` }); }
             if (dateCols.length === 1 && numericCols.length >= 1) { const dateColumnName = dateCols[0]; const looksLikeValidDate = rows.slice(0, 10).every(row => !row[dateColumnName] || !isNaN(Date.parse(row[dateColumnName]))); if (looksLikeValidDate) { ruleBasedSuggestions.push({ chart_type: 'line', x_axis_column: dateColumnName, y_axis_columns: numericCols, rationale: `Track ${numericCols.join(', ')} over time ('${dateColumnName}').` }); } }
             if (numericCols.length >= 2) { ruleBasedSuggestions.push({ chart_type: 'scatter', x_axis_column: numericCols[0], y_axis_columns: [numericCols[1]], rationale: `Relationship between '${numericCols[0]}' and '${numericCols[1]}'.` }); }
             if (stringCols.length === 1 && numericCols.length === 1) { const categoryCol = stringCols[0]; const valueCol = numericCols[0]; const uniqueCategories = new Set(rows.map(r => r[categoryCol])); if (uniqueCategories.size > 1 && uniqueCategories.size <= 12) { ruleBasedSuggestions.push({ chart_type: 'pie', x_axis_column: categoryCol, y_axis_columns: [valueCol], rationale: `Proportion of '${valueCol}' for each '${categoryCol}'.` }); } }

             fetchAiSuggestions().then(aiSuggestions => {
                 const combined = [...ruleBasedSuggestions];
                 aiSuggestions.forEach(aiSugg => { if (!combined.some(rbSugg => rbSugg.chart_type === aiSugg.chart_type && rbSugg.x_axis_column === aiSugg.x_axis_column && rbSugg.y_axis_columns[0] === aiSugg.y_axis_columns[0])) { combined.push({...aiSugg, rationale: aiSugg.rationale ?? `AI suggested ${aiSugg.chart_type} chart.` }); } });
                //  console.log("Final combined suggestions:", combined);
                 setSuggestedCharts(combined);
             });

             // --- Fetch AI Summary ---
             // Trigger summary fetch here as results are ready
             fetchAiSummary();

        } else if (!isRunningJob && (jobStatus?.state !== 'DONE' || jobStatus?.error_result)) {
             // Clear suggestions and summary if the job didn't finish successfully or had an error
             setSuggestedCharts([]);
             setAiSummary(null);
             // Don't clear errors here, they might be displayed elsewhere
        }

        // --- Visualization Validity Check (runs when filters change too) ---
        if (activeVisualization) {
            const { x_axis_column, y_axis_columns } = activeVisualization;
            const currentFilteredData = filteredData; // Check against the currently filtered data
            const isInvalid = currentFilteredData.length === 0 ||
                (currentFilteredData.length > 0 && (
                    !currentFilteredData[0]?.hasOwnProperty(x_axis_column) || // Optional chaining for safety
                    !y_axis_columns.every(col => currentFilteredData[0]?.hasOwnProperty(col))
                ));

            if (isInvalid) {
                console.warn("Active visualization might be invalid due to filtering. Clearing.");
                // toast.warning("Current visualization cleared due to data filtering.", { duration: 3000 });
                setActiveVisualization(null);
                if (currentOutputTab === 'visualize') {
                    setCurrentOutputTab('results'); // Switch back if the active viz tab is open and becomes invalid
                }
            }
        }

    // Dependencies: Include fetchAiSummary, isRunningJob, jobStatus.state, jobStatus.error_result
    // Also keep existing dependencies for viz check
    }, [
        jobResults, sql, getErrorMessage, filteredData, activeVisualization,
        currentOutputTab, fetchAiSummary, isRunningJob, jobStatus?.state, jobStatus?.error_result // Added new deps
    ]);


    // Editor resizing logic (remains unchanged)
    const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => { setIsResizingEditor(true); mouseDownEvent.preventDefault(); }, []);
    useEffect(() => { const handleMouseMove=(e: MouseEvent)=>{if(!isResizingEditor||!editorPaneRef.current)return; const top=editorPaneRef.current.getBoundingClientRect().top; const newH=e.clientY-top; setEditorPaneHeight(Math.max(100,Math.min(newH,window.innerHeight*0.7)));}; const handleMouseUp=()=>setIsResizingEditor(false); if(isResizingEditor){window.addEventListener('mousemove',handleMouseMove); window.addEventListener('mouseup',handleMouseUp);} return()=>{window.removeEventListener('mousemove',handleMouseMove); window.removeEventListener('mouseup',handleMouseUp);}; }, [isResizingEditor]);

    // --- Render Functions ---

    // renderSidebarContent, renderTablesList, renderFavoritesList, renderQueryHistory, renderSchemaViewer, renderTablePreview, renderEditorPane
    // remain IDENTICAL to the previous version.

     const renderSidebarContent = () => { /* ... NO CHANGES ... */
        return (
             <div className="p-3 flex flex-col h-full text-sm">
                            <div className="mb-3 border-b pb-3 flex-shrink-0">
                <label htmlFor="dataset-select" className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Select Workspace
                </label>
                {loadingDatasets && (
                    <div className="flex items-center text-xs text-muted-foreground h-8">
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Loading...
                    </div>
                )}
                {datasetError && !loadingDatasets && (
                    <Alert variant="destructive" className="text-xs p-2">
                        <Terminal className="h-3 w-3" />
                        <AlertTitle className="text-xs font-medium">No Workspace Found</AlertTitle>
                        <AlertDescription className="text-xs">{datasetError}</AlertDescription>
                    </Alert>
                )}
                {!loadingDatasets && !datasetError && (
                    <Select
                        value={selectedDatasetId}
                        onValueChange={handleDatasetChange}
                        disabled={loadingTables || loadingSchema || isRunningJob || availableDatasets.length === 0}
                    >
                        <SelectTrigger id="tour-viewer-workspace-select-trigger" className="w-full h-8 text-xs">
                            <SelectValue placeholder="Select a workspace..." />
                        </SelectTrigger>
                        <SelectContent>
                            {availableDatasets.length === 0 && !loadingDatasets ? (
                                <SelectItem value="no-datasets" disabled className="text-xs">
                                    No datasets found
                                </SelectItem>
                            ) : (
                                availableDatasets.map(ds => (
                                    <SelectItem key={ds.datasetId} value={ds.datasetId} className="text-xs">
                                        {ds.datasetId} 
                                    </SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                )}
            </div>
                <h2 className="font-semibold text-base mb-2 flex items-center text-foreground flex-shrink-0">
                    <Database className="mr-2 h-4 w-4 text-primary" />
                    Workspace Explorer
                </h2>
                <p className="text-xs text-muted-foreground mb-3 truncate flex-shrink-0" title={fullDatasetId}>
                    {selectedDatasetId.toLocaleUpperCase()}
                </p>
                <Tabs value={currentSidebarTab} onValueChange={setCurrentSidebarTab} className="flex-grow flex flex-col overflow-hidden">
                    <TabsList id="tour-sidebar-tabs-list" className="grid grid-cols-4 mb-3 h-8 bg-muted flex-shrink-0">
                         {/* Tabs use default theme styles */}
                        <TabsTrigger  id="tour-sidebar-tab-tables" value="tables" className="text-xs h-7"><Database className="mr-1 h-3 w-3"/>Tables</TabsTrigger>
                        <TabsTrigger  value="favorites" className="text-xs h-7"><Bookmark className="mr-1 h-3 w-3"/>Favorites</TabsTrigger>
                        <TabsTrigger  id="tour-sidebar-tab-history" value="history" className="text-xs h-7"><History className="mr-1 h-3 w-3"/>History</TabsTrigger>
                        <TabsTrigger value="schema" className="text-xs h-7"><ListTree className="mr-1 h-3 w-3"/>Schema</TabsTrigger>
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
        if (!selectedDatasetId) return (<div className="text-center py-8 text-muted-foreground text-sm">Select a workspace first.</div>);
        if(loadingTables){return(<div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>);}
        if(listTablesError){return(<Alert variant="destructive" className="mt-2 text-xs"><Terminal className="h-4 w-4"/><AlertTitle>Error</AlertTitle><AlertDescription>{listTablesError}</AlertDescription><Button onClick={fetchTables} variant="link" size="sm" className="mt-2 h-auto p-0 text-xs">Try Again</Button></Alert>);}
        const displayTables = filteredTables.filter(t => t.tableId.toLowerCase().includes(tableSearchQuery.toLowerCase()));
        if(displayTables.length===0){return(<div className="text-center py-8 text-muted-foreground text-sm">No tables found{tableSearchQuery&&` matching "${tableSearchQuery}"`}.</div>);}
        return(
<ScrollArea className="h-full pb-4">
  <ul className="space-y-0.5 pr-2">
    {displayTables.map((t) => {
      const isFav = favoriteTables.includes(t.tableId);
      return (
        <li key={t.tableId} className="flex items-center group">
          {/* Table name button */}
            <AlertDialog>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="
                        h-[calc(1.5rem+3px)] w-7 p-1 opacity-0 group-hover:opacity-100
                        focus-visible:opacity-100 transition-opacity rounded-r-md
                        text-destructive/80 hover:text-destructive hover:bg-destructive/10
                      "
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">Delete Table</TooltipContent>
              </Tooltip>

              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to permanently delete the table
                    <strong className="mx-1">{t.tableId}</strong>
                    from the workspace
                    <strong className="mx-1">{selectedDatasetId}</strong>?
                    <br />
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTable(selectedDatasetId, t.tableId);
                    }}
                    className={cn(buttonVariants({ variant: 'default' }))}
                  >
                    Delete Table
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>


                    <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(t.tableId);
            }}
            className={`
              ml-1 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity
              ${isFav
                ? 'text-yellow-500 dark:text-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-300'
                : 'text-muted-foreground hover:text-foreground'}
            `}
          >
            <Bookmark
              className="h-3 w-3"
              fill={isFav ? 'currentColor' : 'none'}
            />
          </button>
          <button
            onClick={() => handleTableSelect(t.tableId)}
            className={`
              flex-grow px-2 py-1.5 rounded-md text-left truncate text-xs
              transition-colors duration-150 ease-in-out
              ${selectedTableId === t.tableId
                ? 'bg-primary text-primary-foreground font-medium'
                : 'text-foreground hover:bg-muted'}
            `}
          >
            <div className="flex items-center gap-1.5">
              <Database
                className="h-3 w-3 flex-shrink-0 text-muted-foreground group-hover:text-foreground"
              />
              <span className="truncate">{t.tableId}</span>
            </div>
          </button>

          {/* Favorite toggle */}


          {/* Delete button, only for admins */}

        </li>
      );
    })}
  </ul>
</ScrollArea>

        );
    };
    const renderFavoritesList = () => { /* ... NO CHANGES ... */
        const favsInCurrentDataset = tables.filter(t => favoriteTables.includes(t.tableId));
    if(favsInCurrentDataset.length === 0) return (<div className="text-center py-8 text-muted-foreground text-sm">No favorites{selectedDatasetId ? ` in ${selectedDatasetId}` : ''}.</div>);
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



    const renderQueryHistory = () => {
        const displayHistory = queryHistory.filter(item =>
            item.sql.toLowerCase().includes(historySearchQuery.toLowerCase())
        );

        if (displayHistory.length === 0) {
            return (
                <div className="text-center py-8 text-muted-foreground text-sm">
                    No history{historySearchQuery && ` matching "${historySearchQuery}"`}.
                </div>
            );
        }

        return (
            <ScrollArea className="h-full pb-4">
                <div className="space-y-1.5 pr-2">
                    {displayHistory.map((item) => (
                        <div
                            key={item.id}
                            className="rounded-md border bg-card p-2 text-card-foreground transition-all hover:shadow-sm cursor-pointer hover:bg-muted/50"
                            onClick={() => setSql(item.sql)}
                        >
                            <div className="flex justify-between items-center mb-1">
                                <Badge variant={item.success ? "default" : "destructive"} className="text-xs px-1.5 py-0 h-5">
                                    {item.success ? 'Success' : 'Failed'}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <TooltipProvider delayDuration={500}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="text-xs font-mono bg-muted p-1.5 rounded max-h-16 overflow-hidden text-ellipsis whitespace-pre text-muted-foreground">
                                            {item.sql}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" align="start">
                                        <pre className="text-xs max-w-md bg-popover text-popover-foreground p-2 rounded border">
                                            {item.sql}
                                        </pre>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            {/* Display Row Count */}
                            {item.rowCount !== undefined && (
                                <div className="text-xs text-muted-foreground mt-1.5">
                                    {item.rowCount.toLocaleString()} rows
                                </div>
                            )}
                            {/* --- NEW: Display Duration and Bytes --- */}
                            <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground gap-2 flex-wrap">
                                {item.durationMs !== undefined && item.durationMs >= 0 && ( // Check duration exists and is non-negative
                                    <span className="flex items-center gap-0.5" title="Query Duration">
                                        <Clock className="h-2.5 w-2.5 flex-shrink-0" />
                                        {(item.durationMs / 1000).toFixed(2)}s
                                    </span>
                                )}
                                {item.bytesProcessed !== undefined && item.bytesProcessed >= 0 && ( // Check bytes exist and are non-negative
                                    <span className="flex items-center gap-0.5" title="Bytes Processed">
                                        <Database className="h-2.5 w-2.5 flex-shrink-0" />
                                        {formatBytes(item.bytesProcessed)}
                                    </span>
                                )}
                            </div>
                            {/* --- END NEW --- */}
                        </div>
                    ))}
                </div>
            </ScrollArea>
        );
    };



    const renderSchemaViewer = () => { /* ... NO CHANGES ... */
        if (!selectedDatasetId) return (<div className="text-center py-8 text-muted-foreground text-sm">Select a workspace first.</div>);
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
                                <div className="text-xs"><div className="border bg-background rounded-sm overflow-hidden text-[11px]"><table className="w-full"><thead><tr className="bg-muted border-b"><th className="px-2 py-1 text-left font-medium text-muted-foreground">Column</th><th className="px-2 py-1 text-left font-medium text-muted-foreground">Type</th><th className="px-2 py-1 text-left font-medium text-muted-foreground">Mode</th></tr></thead><tbody>{t.columns.map((c,i)=>(<tr key={c.name} className={i%2===0?'bg-card':'bg-muted/50'}><td className="px-2 py-0.5 font-mono text-foreground truncate max-w-20">{c.name}</td><td className="px-2 py-0.5 text-foreground">{c.type}</td><td className="px-2 py-0.5"><Badge variant={c.mode==='REQUIRED'?'default':'outline'} className="text-[10px] px-1 py-0 h-4">{c.mode}</Badge></td></tr>))}</tbody></table></div><div className="mt-1.5 flex justify-end"><Button variant="ghost" size="sm" className="text-xs h-6 text-muted-foreground hover:text-primary" onClick={()=>{const s=`SELECT ${t.columns.slice(0,5).map(c=>c.name).join(', ')}\nFROM \`${fullDatasetId}.${t.table_id}\`\nLIMIT 100;`;setSql(s);}}><Code className="mr-1 h-3 w-3"/>Query</Button></div></div>
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
        if (!selectedDatasetId) return (<div className="flex items-center justify-center h-full text-muted-foreground p-6"><div className="text-center"><Database className="h-12 w-12 mx-auto mb-4 opacity-20"/><h3 className="text-lg font-medium mb-2">No Dataset Selected</h3><p className="text-sm">Select a workspace from the sidebar.</p></div></div>);
        // ... rest of the existing function
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
                        <Button variant="ghost" size="sm" onClick={()=>toggleFavorite(selectedTableId)} className={`h-7 ${favoriteTables.includes(selectedTableId)?"text-yellow-500 dark:text-yellow-400":""}`}><Bookmark className="mr-1 h-3 w-3" fill={favoriteTables.includes(selectedTableId)?"currentColor":"none"}/>Fav</Button>
                        <Button variant="ghost" size="sm" onClick={()=>copyToClipboard(`\`${fullDatasetId}.${selectedTableId}\``,"Table name copied!")} className="h-7"><Copy className="mr-1 h-3 w-3"/>Copy</Button>
                    </div>
                </div>
                {statsDisp}
                {pageControls}
<div className="flex-grow overflow-hidden border rounded-md mt-1 bg-card">

    <div className="h-full overflow-y-auto">

        <div className="overflow-x-auto">

            <table className="w-full text-xs" style={{ tableLayout: 'auto' }}>

                <thead className="sticky top-0 bg-muted z-10">

                    <tr>

                        {previewColumns.map(c=>(

                            <th key={c} className="px-2 py-1.5 text-left font-medium text-muted-foreground border-b border-r last:border-r-0 whitespace-nowrap">

                                <div className="flex items-center cursor-pointer group" onClick={()=>handlePreviewSort(c)}>

                                    <span>{c}</span>

                                    <div className="ml-1 text-muted-foreground/50 group-hover:text-muted-foreground">

                                        {previewSortConfig?.key===c ? 

                                            (previewSortConfig.direction==='asc' ? 

                                                <SortAsc className="h-3 w-3"/> : 

                                                <SortDesc className="h-3 w-3"/>

                                            ) : 

                                            <ArrowUpDown className="h-3 w-3"/>

                                        }

                                    </div>

                                </div>

                            </th>

                        ))}

                    </tr>

                </thead>

                <tbody className="font-mono divide-y divide-border text-foreground">

                    {previewRows.map((r,i)=>(

                        <tr key={i} className="hover:bg-muted/50">

                            {previewColumns.map(c=>(

                                <td key={c} className="px-2 py-1 border-r last:border-r-0 whitespace-nowrap" title={String(r[c]??null)}>

                                    {r[c]!=null ? String(r[c]) : <span className="italic text-muted-foreground">null</span>}

                                </td>

                            ))}

                        </tr>

                    ))}

                </tbody>

            </table>

        </div>

    </div>

</div>
            </div>
        );
    };

// Inside BigQueryTableViewer component -> renderEditorPane function

const renderEditorPane = () => {
    // Helper to render the multi-select popover for Tables
    const renderTableSelector = () => (
        <Popover open={isTablePopoverOpen} onOpenChange={setIsTablePopoverOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isTablePopoverOpen}
                    className="w-[250px] justify-between text-xs h-8 transition-all duration-200 hover:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    disabled={!tables || tables.length === 0}
                >
                    <span className="truncate font-medium">
                        {selectedAiTables.size > 0
                            ? `${selectedAiTables.size} table(s) selected`
                            : "Select tables..."}
                    </span>
                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0 shadow-lg border-primary/10">
                <Command className="rounded-md">
                    <CommandInput placeholder="Search tables..." className="h-9 text-xs font-medium" />
                    <CommandList className="max-h-[200px]">
                        <CommandEmpty>No tables found.</CommandEmpty>
                        <CommandGroup>
                            {tables.map((table) => (
                                <CommandItem
                                    key={table.tableId}
                                    value={table.tableId}
                                    onSelect={(currentValue) => {
                                        setSelectedAiTables(prev => {
                                            const next = new Set(prev);
                                            if (next.has(currentValue)) {
                                                next.delete(currentValue);
                                            } else {
                                                next.add(currentValue);
                                            }
                                            return next;
                                        });
                                    }}
                                    className="text-xs py-2 hover:bg-primary/5 focus:bg-primary/10 cursor-pointer"
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-3.5 w-3.5 text-primary",
                                            selectedAiTables.has(table.tableId) ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <span className="font-medium truncate">{table.tableId}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        {selectedAiTables.size > 0 && (
                            <>
                                <CommandSeparator className="my-1" />
                                <CommandGroup>
                                    <CommandItem
                                        onSelect={() => {
                                            setSelectedAiTables(new Set());
                                        }}
                                        className="text-xs text-destructive justify-center py-2 hover:bg-destructive/5"
                                    >
                                        <X className="h-3.5 w-3.5 mr-2" />
                                        Clear selection
                                    </CommandItem>
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );

    // Helper to render the multi-select popover for Columns
    const renderColumnSelector = () => (
        <Popover open={isColumnPopoverOpen} onOpenChange={setIsColumnPopoverOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isColumnPopoverOpen}
                    className="w-[250px] justify-between text-xs h-8 transition-all duration-200 hover:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    disabled={availableColumnsForSelection.length === 0}
                >
                    <span className="truncate font-medium">
                        {selectedAiColumns.size > 0
                            ? `${selectedAiColumns.size} column(s) selected`
                            : "Select columns (optional)..."}
                    </span>
                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0 shadow-lg border-primary/10">
                <Command className="rounded-md">
                    <CommandInput placeholder="Search columns..." className="h-9 text-xs font-medium" />
                    <CommandList className="max-h-[200px]">
                        <CommandEmpty>No columns available.</CommandEmpty>
                        <CommandGroup>
                            {availableColumnsForSelection.map((col) => (
                                <CommandItem
                                    key={col.label}
                                    value={col.value}
                                    onSelect={(currentValue) => {
                                        setSelectedAiColumns(prev => {
                                            const next = new Set(prev);
                                            if (next.has(currentValue)) {
                                                next.delete(currentValue);
                                            } else {
                                                next.add(currentValue);
                                            }
                                            return next;
                                        });
                                    }}
                                    className="text-xs py-2 hover:bg-primary/5 focus:bg-primary/10 cursor-pointer"
                                    title={col.label}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-3.5 w-3.5 text-primary",
                                            selectedAiColumns.has(col.value) ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <span className="truncate font-medium">{col.label}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        {selectedAiColumns.size > 0 && (
                            <>
                                <CommandSeparator className="my-1" />
                                <CommandGroup>
                                    <CommandItem
                                        onSelect={() => {
                                            setSelectedAiColumns(new Set());
                                        }}
                                        className="text-xs text-destructive justify-center py-2 hover:bg-destructive/5"
                                    >
                                        <X className="h-3.5 w-3.5 mr-2" />
                                        Clear column selection
                                    </CommandItem>
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );

    return (
        <div 
            ref={editorPaneRef} 
            className="flex flex-col border border-border rounded-lg shadow-md overflow-hidden bg-muted/10" 
            style={{ height: `${editorPaneHeight}px` }}
        >
            {/* Top bar: SQL Editor title, AI Assist toggle, Run Query button */}
            <div className="px-4 py-2.5 bg-background border-b border-border flex justify-between items-center h-12 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <span className="font-semibold text-sm flex items-center gap-2 text-foreground">
                        <Code className="h-4 w-4 text-primary"/> 
                        <span>SQL Editor</span>
                    </span>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button 
                                    variant={showNlSection ? "secondary" : "ghost"} 
                                    size="sm" 
                                    className={cn(
                                        "h-8 px-3 transition-all duration-300",
                                        showNlSection ? "bg-primary/15 text-primary hover:bg-primary/20" : "hover:bg-muted"
                                    )}
                                    onClick={() => setShowNlSection(!showNlSection)}
                                >
                                    <BrainCircuit className="h-4 w-4 mr-2"/> 
                                    <span className="font-medium">AI Assist</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs bg-popover shadow-lg">Toggle AI Query Builder</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    {/* <ThemeToggle /> */}
                </div>
                <Button 
                    onClick={submitSqlJob} 
                    disabled={isRunningJob || !sql.trim()} 
                    size="sm" 
                    className={cn(
                        "h-8 px-4 font-medium transition-all duration-300",
                        !isRunningJob && sql.trim() ? "bg-primary hover:bg-primary/90" : ""
                    )}
                >
                    {isRunningJob ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin"/> 
                    ) : (
                        <Play className="mr-2 h-4 w-4" />
                    )}
                    Run Query
                </Button>
            </div>

            {/* AI Assist Section */}
            {showNlSection && (
                <div className="p-4 bg-background/80 border-b border-border flex-shrink-0 relative transition-all duration-300"> 
                    <div className="flex gap-3 items-center">
                        <Select
                            value={aiMode}
                            onValueChange={(value: 'AUTO' | 'SEMI_AUTO') => {
                                setAiMode(value);
                                if (value === 'AUTO') {
                                    setSelectedAiTables(new Set());
                                    setSelectedAiColumns(new Set());
                                }
                                // console.log("AI Mode changed to:", value);
                            }}
                            disabled={generatingSql || !selectedDatasetId}
                        >
                            <SelectTrigger className="w-[140px] h-9 text-xs flex-shrink-0 font-medium bg-background/80 transition-all duration-200 focus:ring-2 focus:ring-primary/20">
                                <SelectValue placeholder="AI Mode" />
                            </SelectTrigger>
                            <SelectContent className="shadow-lg border-primary/10">
                                {/* SelectItem AUTO */}
                                <SelectItem value="AUTO" className="text-xs py-2 focus:bg-primary/10">
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-2">
                                            <CheckCheck className="h-3.5 w-3.5 text-primary"/> 
                                            <span className="font-medium">AUTO</span>
                                        </div>
                                        <TooltipProvider delayDuration={100}>
                                            <Tooltip>
                                                <TooltipTrigger onClick={(e) => e.stopPropagation()}>
                                                    <Info className="h-3.5 w-3.5 opacity-50 hover:opacity-100 cursor-help"/>
                                                </TooltipTrigger>
                                                <TooltipContent side="right" className="text-xs max-w-xs bg-popover shadow-lg">
                                                    AI considers all tables in the workspace.
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                </SelectItem>
                                {/* SelectItem SEMI-AUTO */}
                                <SelectItem value="SEMI_AUTO" className="text-xs py-2 focus:bg-primary/10">
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-2">
                                            <Settings2 className="h-3.5 w-3.5 text-primary"/> 
                                            <span className="font-medium">SEMI-AUTO</span>
                                        </div>
                                        <TooltipProvider delayDuration={100}>
                                            <Tooltip>
                                                <TooltipTrigger onClick={(e) => e.stopPropagation()}>
                                                    <Info className="h-3.5 w-3.5 opacity-50 hover:opacity-100 cursor-help"/>
                                                </TooltipTrigger>
                                                <TooltipContent side="right" className="text-xs max-w-xs bg-popover shadow-lg">
                                                    Manually select tables/columns for AI focus.
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="relative flex-grow">
                            <Input
                             id="tour-nl-prompt-input"
                                ref={promptInputRef}
                                placeholder={selectedTableId ? "Describe query in plain language..." : "Select table for AI assistance..."}
                                value={nlPrompt}
                                onChange={handlePromptChange}
                                onFocus={() => {
                                    if (promptSuggestions.length > 0) {
                                        setShowSuggestions(true);
                                    }
                                }}
                                className="flex-grow text-xs h-9 pl-9 pr-3 focus:ring-2 focus:ring-primary/20 font-medium transition-all duration-200 bg-background"
                                disabled={generatingSql || !selectedTableId}
                                title={!selectedTableId ? "Select table first." : ""}
                                autoComplete="off"
                            />
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                        <Button 
                        id="tour-generate-sql-button"
                            onClick={handleGenerateSql} 
                            disabled={!nlPrompt.trim() || generatingSql || !selectedTableId} 
                            size="sm" 
                            variant="secondary" 
                            className={cn(
                                "text-xs h-9 px-4 whitespace-nowrap transition-all duration-300 font-medium",
                                nlPrompt.trim() && !generatingSql && selectedTableId ? 
                                "hover:bg-primary hover:text-primary-foreground" : ""
                            )}
                        >
                            {generatingSql ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                            ) : (
                                <BrainCircuit className="mr-2 h-4 w-4"/>
                            )} 
                            Generate SQL
                        </Button>
                    </div>
                    
                    {aiMode === 'SEMI_AUTO' && (
                        <div className="flex gap-3 items-center pt-3 mt-1 border-t border-border/40">
                            {/* Table Selector */}
                            {renderTableSelector()}
                            {/* Column Selector */}
                            {renderColumnSelector()}
                            {/* Optional hint text */}
                            <span className="text-xs text-muted-foreground italic ml-2">
                                Select tables and columns to focus your query
                            </span>
                        </div>
                    )}
                    
                    {nlError && (
                        <div className="mt-3 p-2 bg-destructive/10 border border-destructive/20 rounded-md">
                            <p className="text-xs text-destructive flex items-center">
                                <AlertCircle className="h-3.5 w-3.5 mr-2 flex-shrink-0" /> {nlError}
                            </p>
                        </div>
                    )}

                    {/* Suggestions Dropdown */}
                    {showSuggestions && (
                        <div
                            ref={suggestionContainerRef}
                            className="absolute top-full left-4 right-4 mt-1 z-50 bg-popover border border-border rounded-md shadow-lg max-h-56 overflow-y-auto"
                        >
                            {isLoadingSuggestions ? (
                                <div className="p-4 text-xs text-muted-foreground flex items-center justify-center">
                                    <Loader2 className="h-4 w-4 animate-spin mr-3" /> Loading suggestions...
                                </div>
                            ) : promptSuggestions.length > 0 ? (
                                <ul className="py-1">
                                    {promptSuggestions.map((suggestion, index) => (
                                        <li key={index}>
                                            <button
                                                onClick={() => handleSuggestionClick(suggestion)}
                                                className="w-full text-left px-4 py-2.5 text-xs text-popover-foreground hover:bg-primary/5 transition-colors flex items-center font-medium"
                                            >
                                                <LightbulbIcon className="h-3.5 w-3.5 mr-2.5 text-primary" />
                                                {suggestion}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                !isLoadingSuggestions && (
                                    <div className="p-4 text-xs text-muted-foreground text-center">
                                        <span className="italic">No suggestions found.</span>
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Monaco Editor Area */}
            <div id="tour-sql-editor-wrapper" className="flex-grow relative bg-background">
                <Editor
                    language="sql"
                    value={sql}
                    onChange={(value) => setSql(value || '')}
                    theme="vs-dark"
                    options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        wordWrap: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        padding: { top: 12, bottom: 12 },
                        lineHeight: 1.6,
                        fontFamily: "'JetBrains Mono', Menlo, Monaco, Consolas, monospace",
                        fontLigatures: true,
                        cursorBlinking: 'smooth',
                        cursorSmoothCaretAnimation: 'on',
                        renderLineHighlight: 'all',
                        smoothScrolling: true,
                        readOnly: !selectedTableId
                    }}
                    className={!selectedTableId ? 'opacity-70' : ''}
                    loading={
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            <div className="bg-background/80 p-4 rounded-lg shadow flex items-center">
                                <Loader2 className="h-5 w-5 animate-spin mr-3"/>
                                <span className="font-medium">Loading Editor...</span>
                            </div>
                        </div>
                    }
                />
                {!selectedTableId && (
                    <div className="absolute inset-0 bg-background/20 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                        <div className="bg-background p-4 rounded-lg shadow-md border border-border">
                            <p className="text-sm text-muted-foreground flex items-center">
                                <Database className="h-4 w-4 mr-2 text-primary/70" />
                                Select a table to start editing
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Resize Handle */}
            <div 
                ref={resizeHandleRef} 
                onMouseDown={startResizing} 
                className="h-5 bg-background hover:bg-primary/10 cursor-ns-resize flex-shrink-0 flex items-center justify-center sticky bottom-0 z-10 border-t border-border"
            >
                <div className="w-20 h-1.5 bg-border/80 rounded-full hover:bg-primary/80 transition-colors" />
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-b from-transparent to-background/50 pointer-events-none"></div>
            </div>
        </div>
    );
};

    // --- MODIFIED renderEditorPane function ---
    // const renderEditorPane = () => {
    //     return (
    //         <div ref={editorPaneRef} className="flex flex-col border-b overflow-hidden bg-muted/30" style={{ height: `${editorPaneHeight}px` }}>
    //             {/* ... (Top bar: SQL Editor title, AI Assist toggle, Run Query button - remain unchanged) ... */}
    //             <div className="p-1.5 pl-3 bg-background border-b flex justify-between items-center h-9 flex-shrink-0">
    //                  <div className="flex items-center gap-2"> <span className="font-medium text-sm flex items-center gap-1.5 text-foreground"><Code className="h-4 w-4 text-primary"/> SQL Editor</span> <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant={showNlSection ? "secondary" : "ghost"} size="sm" className="h-6 px-2" onClick={() => setShowNlSection(!showNlSection)}><BrainCircuit className="h-3.5 w-3.5 mr-1"/> AI Assist</Button></TooltipTrigger><TooltipContent>Toggle AI Query Builder</TooltipContent></Tooltip></TooltipProvider> </div>
    //                  <Button onClick={submitSqlJob} disabled={isRunningJob || !sql.trim()} size="sm" className="h-7">{isRunningJob ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin"/> : null} Run Query</Button>
    //             </div>

    //             {/* AI Assist Section (remains unchanged from previous step) */}
    //             {showNlSection && (
    //                 <div className="p-2 bg-background border-b flex-shrink-0">
    //                      <div className="flex gap-2 items-center">
    //                         <Input placeholder={selectedTableId ? "Describe query..." : "Select table for AI..."} value={nlPrompt} onChange={(e)=>setNlPrompt(e.target.value)} className="flex-grow text-xs h-7" disabled={generatingSql || !selectedTableId} title={!selectedTableId ? "Select table first." : ""} />
    //                         <Button onClick={handleGenerateSql} disabled={!nlPrompt.trim() || generatingSql || !selectedTableId} size="sm" variant="secondary" className="text-xs h-7">{generatingSql?<Loader2 className="mr-1.5 h-3 w-3 animate-spin"/>:<BrainCircuit className="mr-1.5 h-3 w-3"/>} Generate</Button>
    //                      </div>
    //                      {nlError && <p className="text-xs text-destructive mt-1 px-1">{nlError}</p>}
    //                 </div>
    //             )}

    //              {/* Monaco Editor Area */}
                //  <div className="flex-grow relative bg-background">
                //      {/* --- START specific modification --- */}
                //      <Editor
                //         language="sql"
                //         value={sql}
                //         onChange={(value) => setSql(value || '')}
                //         theme="vs-dark" // Consider theme options
                //         options={{
                //             minimap: { enabled: false },
                //             fontSize: 13,
                //             wordWrap: 'on',
                //             scrollBeyondLastLine: false,
                //             automaticLayout: true,
                //             padding: { top: 8, bottom: 8 },
                //             readOnly: !selectedTableId // <-- ADDED: Make read-only if no table selected
                //         }}
                //         // Add a visual cue when disabled (optional, but good UX)
                //         // You might need to adjust wrapper styles if editor doesn't dim itself
                //         // Example: className={!selectedTableId ? 'opacity-60 cursor-not-allowed' : ''}
                //         loading={<div className="flex items-center justify-center h-full text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2"/>Loading Editor...</div>}
                //     />
                //     {/* --- END specific modification --- */}
                //  </div>

    //              {/* Resize Handle (remains unchanged) */}
    //             <div ref={resizeHandleRef} onMouseDown={startResizing} className="h-1.5 bg-border hover:bg-primary cursor-ns-resize flex-shrink-0 flex items-center justify-center transition-colors">
    //                 <GripVertical className="h-2.5 w-2.5 text-muted-foreground" />
    //              </div>
    //         </div>
    //     );
    // };



    const renderAiSummaryContent = () => {
        // Check initial conditions
        if (!jobResults || jobResults.rows.length === 0) {
            return (
                <div className="flex items-center justify-center h-full text-muted-foreground p-6">
                    <div className="text-center">
                        <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-20"/>
                        <h3 className="text-lg font-medium mb-2 text-foreground">No Results for Summary</h3>
                        <p className="text-sm">Run a query that returns results to generate an AI summary.</p>
                    </div>
                </div>
            );
        }

        if (loadingAiSummary) {
            return (
                <div className="flex justify-center items-center h-full p-4">
                    <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary"/>
                        <p className="text-sm text-muted-foreground">Generating AI summary...</p>
                    </div>
                </div>
            );
        }

        if (aiSummaryError) {
             return (
                <div className="p-4">
                    <Alert variant="destructive">
                        <Terminal className="h-4 w-4"/>
                        <AlertTitle>AI Summary Error</AlertTitle>
                        <AlertDescription>
                            <p>{aiSummaryError}</p>
                            <Button
                                variant="secondary" size="sm"
                                onClick={fetchAiSummary} // Allow retry
                                className="mt-3 text-xs h-7"
                                disabled={loadingAiSummary} // Disable while loading
                            >
                                <RefreshCw className="mr-1.5 h-3 w-3"/> Retry
                            </Button>
                        </AlertDescription>
                    </Alert>
                 </div>
             );
        }

        if (!aiSummary) {
            // This state might occur briefly before loading starts or if the fetch failed silently
            return (
                 <div className="flex items-center justify-center h-full text-muted-foreground p-6">
                     <div className="text-center">
                         <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-20"/>
                         <h3 className="text-lg font-medium mb-2 text-foreground">Generate AI Summary</h3>
                         <p className="text-sm mb-4">Click the button to get an AI-powered summary of the results.</p>
                         <Button onClick={fetchAiSummary} size="sm" disabled={loadingAiSummary}>
                              <Sparkles className="mr-2 h-4 w-4" /> Generate Summary
                         </Button>
                     </div>
                 </div>
            );
        }

        // Display the summary
        return (
            <div className="h-full flex flex-col">
                {/* Optional: Add Filter controls here too if desired */}
                {/* {availableFilters.length > 0 && ( <FilterControls ... /> )} */}
                <div className="flex-grow flex flex-col p-3 overflow-hidden">
                     <div className="flex justify-between items-center mb-2 flex-shrink-0">
                         <h3 className="text-base font-semibold flex items-center gap-2">
                             <Sparkles className="h-4 w-4 text-primary"/> AI Generated Summary
                         </h3>
                         <Button
                             variant="outline" size="sm"
                             onClick={fetchAiSummary}
                             className="h-7"
                             disabled={loadingAiSummary}
                         >
                            <RefreshCw className="mr-1 h-3 w-3"/> Regenerate
                         </Button>
                     </div>
                     {/* Display the summary text - using prose for better readability */}
                     <ScrollArea className="flex-grow mt-1">
                         <div className="prose prose-sm dark:prose-invert max-w-none p-3 border rounded-md bg-background text-foreground whitespace-pre-wrap">
                            {aiSummary}
                         </div>
                     </ScrollArea>
                 </div>
            </div>
        );
    };

    const renderOutputPane = () => {
        const canVisualize = suggestedCharts.length > 0 || activeVisualization !== null;
        const hasResultsToShow = jobResults?.rows && jobResults.rows.length > 0; // Need actual rows for Summary/Viz
        const hasJobCompletedSuccessfully = jobStatus?.state === 'DONE' && !jobStatus.error_result;

        return (
            <div className="flex-grow overflow-hidden flex flex-col bg-background">
                {/* Status Bar (unchanged) */}
                {jobId && !isRunningJob && !jobError && jobStatus?.state === 'DONE' && ( // Show only on successful completion
                     <div className="px-3 py-1 text-xs border-b text-muted-foreground flex items-center gap-2">
                         <span className="text-green-600 dark:text-green-400">✓</span>
                         <span>Job {jobId?.substring(0, 8)}... completed successfully.</span>
                         {jobStatus?.total_bytes_processed !== undefined && (
                             <Badge variant="secondary" className="text-[10px] px-1 h-4">~{formatBytes(jobStatus.total_bytes_processed)} processed</Badge>
                         )}
                         {jobStatus?.end_time && jobStatus.start_time && (
                            <Badge variant="secondary" className="text-[10px] px-1 h-4">
                                {((new Date(jobStatus.end_time).getTime() - new Date(jobStatus.start_time).getTime()) / 1000).toFixed(2)}s
                            </Badge>
                         )}
                     </div>
                 )}
                 {jobId && jobError && (
                     <div className="px-3 py-1 text-xs border-b text-destructive-foreground bg-destructive flex items-center gap-2">
                         <span className="text-white">✗</span> {/* Use X or similar */}
                         <span>Job {jobId?.substring(0, 8)}... failed.</span>
                     </div>
                 )}

                <Tabs value={currentOutputTab} onValueChange={setCurrentOutputTab} className="flex-grow flex flex-col overflow-hidden">
                    <TabsList id="tour-output-tabs-list" className="mx-3 mt-2 mb-1 h-8 justify-start bg-muted p-0.5 rounded-md flex-shrink-0">
                        <TabsTrigger id="tour-output-tab-data" value="data" className="text-xs h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-sm"><Table2 className="mr-1.5 h-3.5 w-3.5"/>Preview</TabsTrigger>
                        <TabsTrigger id="tour-output-tab-results" value="results" className="text-xs h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-sm" disabled={!jobId && !jobResults}><ListTree className="mr-1.5 h-3.5 w-3.5"/>Results</TabsTrigger>
                        <TabsTrigger
                        id="tour-output-tab-visualize"
                             value="visualize"
                             className="text-xs h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-sm"
                             disabled={!hasResultsToShow || !canVisualize || filteredData.length === 0} // Disable if no results or no suggestions/active viz or filtered data is empty
                         >
                           <BarChart4 className="mr-1.5 h-3.5 w-3.5"/>Visualize
                        </TabsTrigger>
                         {/* +++ Add AI Summary Tab Trigger +++ */}
                         <TabsTrigger
                             value="ai-summary"
                             className="text-xs h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-sm"
                             disabled={!hasResultsToShow || !hasJobCompletedSuccessfully || loadingAiSummary} // Disable if no results, job not done, or loading
                         >
                           <Sparkles className="mr-1.5 h-3.5 w-3.5"/>AI Summary
                           {loadingAiSummary && <Loader2 className="ml-1.5 h-3 w-3 animate-spin" />}
                        </TabsTrigger>
                        {/* +++ END AI Summary Tab Trigger +++ */}
                     </TabsList>
                    {/* Content areas */}
                     <TabsContent value="data" className="flex-grow mt-0 overflow-hidden">
                        {renderTablePreview()}
                     </TabsContent>
                    <TabsContent value="results" className="flex-grow mt-0 overflow-hidden">
                         {renderResultsContent()}
                    </TabsContent>
                    <TabsContent value="visualize" className="flex-grow mt-0 overflow-hidden bg-card">
                        {renderChartVisualization()}
                    </TabsContent>
                    {/* +++ Add AI Summary Tab Content +++ */}
                    <TabsContent value="ai-summary" className="flex-grow mt-0 overflow-hidden">
                        {renderAiSummaryContent()}
                    </TabsContent>
                    {/* +++ END AI Summary Tab Content +++ */}
                </Tabs>
            </div>
        );
    };
    // +++ END Modified renderOutputPane +++


    // --- MODIFIED: renderResultsContent (Includes FilterControls) ---
    const renderResultsContent = () => {
        // --- Initial checks (Loading, Error, No Original Results) ---
        if (isRunningJob && jobId) return ( <div className="flex justify-center items-center h-full p-4"><div className="text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary"/><p className="text-lg font-medium mb-1 text-foreground">Running Query...</p><p className="text-sm text-muted-foreground">Job ID: {jobId}</p></div></div> );
        if (jobError) return ( <Alert variant="destructive" className="m-4"><Terminal className="h-4 w-4"/><AlertTitle>Query Error</AlertTitle><AlertDescription><p>{jobError}</p><Button  id="tour-run-query-button"  onClick={submitSqlJob} variant="outline" size="sm" className="mt-3 text-xs h-7"><RefreshCw className="mr-1.5 h-3 w-3"/>Try Again</Button></AlertDescription></Alert> );
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

            // This is the container for the results table
            return (
                <div className="flex-grow overflow-hidden border rounded-md bg-card mt-2"> {/* Parent container, overflow-hidden is fine */}
                    <div className="h-full overflow-y-auto"> {/* Explicitly for VERTICAL scroll */}
                        <div className="overflow-x-auto"> {/* Explicitly for HORIZONTAL scroll */}
                            <table className="w-full text-xs" style={{ tableLayout: 'auto' }}> {/* Let table define its width */}
                                <thead className="sticky top-0 bg-muted z-10">
                                    <tr>{cols.map(c => (
                                        <th key={c} className="px-2 py-1.5 text-left font-medium text-muted-foreground border-b border-r last:border-r-0 whitespace-nowrap">
                                            <div className="flex items-center" title={c}>
                                                <span>{c}</span> {/* Removed truncate to allow full header to be seen on scroll */}
                                                {jobResults.schema && (
                                                    <TooltipProvider delayDuration={300}>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Info className="ml-1 h-3 w-3 text-muted-foreground/50 hover:text-muted-foreground"/>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="text-xs">
                                                                Type: {jobResults.schema.find(f => f.name === c)?.type ?? '?'}<br/>
                                                                Mode: {jobResults.schema.find(f => f.name === c)?.mode ?? '?'}
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
                                            </div>
                                        </th>
                                    ))}</tr>
                                </thead>
                                <tbody className="font-mono divide-y divide-border text-foreground">
                                    {dataToRender.map((r, i) => (
                                        <tr key={i} className="hover:bg-muted/50">
                                            {cols.map(c => (
                                                <td key={c} className="px-2 py-1 border-r last:border-r-0 whitespace-nowrap" title={String(r[c] ?? null)}>
                                                    {r[c] != null ? String(r[c]) : <span className="italic text-muted-foreground">null</span>}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
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
                            <Button variant="outline" size="sm" onClick={submitSqlJob} className="h-7"><RefreshCw className="mr-1 h-3 w-3"/>Run Again</Button>
                            {/* Replace previous Download button or add new one */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                     <Button
                                         id="tour-excel-download-button-results"
                                         variant="outline"
                                         size="sm"
                                         onClick={handleExcelDownload}
                                         disabled={!jobId || isDownloadingExcel || isRunningJob || !!jobError} // Disable if no job, downloading, running, or error
                                         className="h-7"
                                     >
                                         {isDownloadingExcel ? (
                                             <Loader2 className="mr-1 h-3 w-3 animate-spin"/>
                                         ) : (
                                             <FileSpreadsheet className="mr-1 h-3 w-3"/> // Excel icon
                                         )}
                                         Report
                                     </Button>
                                </TooltipTrigger>
                                <TooltipContent>Download Results & Source Data (Excel)</TooltipContent>
                             </Tooltip>
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
                                        variant="outline" size="sm" className="h-6 text-xs"
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
        const tooltipContentStyle = { // Renamed for clarity to avoid clash with itemStyle/labelStyle
            background: 'hsl(var(--popover))',
            color: 'hsl(var(--popover-foreground))', // This should ideally set the text color
            border: '1px solid hsl(var(--border))',
            borderRadius: 'var(--radius)',
            fontSize: '12px',
            padding: '8px 12px', // Added some padding for better looks
        };

        // Styles for the text items within the tooltip
        const tooltipItemStyle = {
            color: 'hsl(var(--popover-foreground))', // Explicitly set text color for items
        };
        const tooltipLabelStyle = {
            color: 'hsl(var(--popover-foreground))', // Explicitly set text color for the label (if any)
            fontWeight: 'bold', // Optional: make label bold
            marginBottom: '4px', // Optional: space below label
        };
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
                                <RechartsTooltip cursor={{ fill: 'hsla(var(--muted), 0.5)' }}                                     contentStyle={tooltipContentStyle}
                                    itemStyle={tooltipItemStyle} 
                                    labelStyle={tooltipLabelStyle} />
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
                                <RechartsTooltip labelFormatter={(unixTime) => new Date(unixTime).toLocaleString()}                                     contentStyle={tooltipContentStyle}
                                    itemStyle={tooltipItemStyle} 
                                    labelStyle={tooltipLabelStyle} />
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
                                     {formattedDataPie.map((_, index) => ( <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} /> ))}
                                 </Pie>
                                 <RechartsTooltip                                     contentStyle={tooltipContentStyle}
                                    itemStyle={tooltipItemStyle} 
                                    labelStyle={tooltipLabelStyle} />
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
                                 <RechartsTooltip cursor={{ strokeDasharray: '3 3' }}                                     contentStyle={tooltipContentStyle}
                                    itemStyle={tooltipItemStyle} 
                                    labelStyle={tooltipLabelStyle} />
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
                    <div className="flex-shrink-0 p-3 border-t"> {/* Or some other appropriate placement */}
    <Button
        onClick={handleExcelDownload} // Reuse the existing function
        disabled={isDownloadingExcel || !activeVisualization || filteredData.length === 0}
        size="sm"
    >
        {isDownloadingExcel ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin"/> : <FileSpreadsheet className="mr-1.5 h-4 w-4"/>}
        Download Report with this Chart
    </Button>
</div>
<div ref={chartContainerRef} className="flex-grow border rounded-md overflow-hidden bg-background">
                        {renderChart()}
                    </div>
                </div>
            </div>
        );
    };


    // --- Main Component Return ---
    return (
        <TooltipProvider>
                        <Joyride
                steps={viewerTourSteps}
                run={runViewerTour}
                continuous
                scrollToFirstStep
                showProgress
                showSkipButton
                callback={handleViewerJoyrideCallback}
                // debug // Useful during development
                styles={{
                    options: {
                        zIndex: 10000,
                        arrowColor: 'hsl(var(--popover))',
                        backgroundColor: 'hsl(var(--popover))',
                        primaryColor: 'hsl(var(--primary))',
                        textColor: 'hsl(var(--popover-foreground))',
                    },
                    tooltipContainer: { textAlign: "left", },
                    buttonNext: { backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", borderRadius: "var(--radius)" },
                    buttonBack: { marginRight: 10, color: "hsl(var(--primary))" },
                    buttonSkip: { color: "hsl(var(--muted-foreground))" }
                }}
                locale={{ last: 'Finish Tour', skip: 'Skip', next: 'Next', back: 'Back' }}
            />
            <div className="flex h-full bg-background text-foreground overflow-hidden text-sm">
                {/* Sidebar uses card background */}
                <div id="tour-sidebar-wrapper"  className={`border-r border-border bg-card flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out ${ sidebarCollapsed ? 'w-12' : 'w-64 md:w-72' }`} >
                    {/* Sidebar Top Section (Collapse Button) */}
                    <div className={`p-2 border-b border-border flex ${sidebarCollapsed?'justify-center':'justify-end'} flex-shrink-0`}>
                         <Tooltip> <TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={()=>setSidebarCollapsed(!sidebarCollapsed)}>{sidebarCollapsed?<ChevronRight className="h-4 w-4"/>:<ChevronLeft className="h-4 w-4"/>}</Button></TooltipTrigger><TooltipContent side="right">{sidebarCollapsed?'Expand':'Collapse'}</TooltipContent></Tooltip>
                    </div>
                    {/* Sidebar Main Content (Icons or Full View) */}
                    <div className="flex-grow overflow-hidden">
                        {sidebarCollapsed ? (
                             <div className="flex flex-col items-center pt-3 gap-3">
                                {/* Collapsed Icons... */}
                                <Tooltip><TooltipTrigger asChild><Button
                                id="tour-chatbot-toggle"
                                variant={currentSidebarTab==='tables'?'secondary':'ghost'} size="icon" className="h-7 w-7" onClick={()=>{setCurrentSidebarTab('tables'); setSidebarCollapsed(false);}}><Database className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent side="right">Tables</TooltipContent></Tooltip>
                                <Tooltip><TooltipTrigger asChild><Button variant={currentSidebarTab==='favorites'?'secondary':'ghost'} size="icon" className="h-7 w-7" onClick={()=>{setCurrentSidebarTab('favorites'); setSidebarCollapsed(false);}}><Bookmark className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent side="right">Favorites</TooltipContent></Tooltip>
                                <Tooltip><TooltipTrigger asChild><Button variant={currentSidebarTab==='history'?'secondary':'ghost'} size="icon" className="h-7 w-7" onClick={()=>{setCurrentSidebarTab('history'); setSidebarCollapsed(false);}}><History className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent side="right">History</TooltipContent></Tooltip>
                                <Tooltip><TooltipTrigger asChild><Button variant={currentSidebarTab==='schema'?'secondary':'ghost'} size="icon" className="h-7 w-7" onClick={()=>{setCurrentSidebarTab('schema'); setSidebarCollapsed(false);}}><ListTree className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent side="right">Schema</TooltipContent></Tooltip>
                            </div>
                        ) : (
                            <div className="flex-grow flex flex-col overflow-hidden">
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