import React, { useEffect, useState, useRef, useCallback } from "react";
import axios, { AxiosError } from "axios";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import axiosInstance from '@/lib/axios-instance';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Loader2, Terminal, Search, Database, BrainCircuit, ListTree, Bookmark,
    Code, Table2, RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft,
    ChevronsRight, Download, SortAsc, SortDesc, ArrowUpDown, Info,
    BarChart4,
    LineChart as LineChartIcon, PieChart as PieChartIcon, Dot , Trash2 , GripVertical ,History,Copy 
} from "lucide-react";
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, ScatterChart, Scatter,
    XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell
} from 'recharts'; // <-- Import Recharts

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
interface SchemaResponse { dataset_id: string; tables: TableSchema[]; } // Corrected type
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
    const [jobResults, setJobResults] = useState<JobResultsResponse | null>(null);
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



    const [suggestedCharts, setSuggestedCharts] = useState<VizSuggestion[]>([]);
    const [activeVisualization, setActiveVisualization] = useState<ActiveVisualizationConfig | null>(null);
    const [loadingAiSuggestions, setLoadingAiSuggestions] = useState<boolean>(false);
    const [aiSuggestionError, setAiSuggestionError] = useState<string>("");




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
    const fetchJobResults = useCallback(async (currentJobId: string, loc: string, pageToken?: string | null) => { console.log(`Fetching results job ${currentJobId}, page: ${pageToken?'next':'first'}`); setLoadingResults(true); setResultsError(""); try { const p=new URLSearchParams({location:loc, max_results:'100'}); if(pageToken) p.append('page_token',pageToken); const r=await axiosInstance.get<JobResultsResponse>(`/api/bigquery/jobs/${currentJobId}/results?${p.toString()}`); setJobResults(r.data); setCurrentResultsPageToken(r.data.next_page_token??null); setCurrentOutputTab("results"); } catch (e){ console.error("Error fetching results:",e); setResultsError(`Fetch results failed: ${getErrorMessage(e)}`); setJobResults(null); } finally { setLoadingResults(false); } }, [getErrorMessage]);
    const fetchJobStatus = useCallback(async (currentJobId: string, loc: string) => { console.log(`Polling job: ${currentJobId}`); setJobError(""); try { const r=await axiosInstance.get<JobStatusResponse>(`/api/bigquery/jobs/${currentJobId}?location=${loc}`); const d=r.data; setJobStatus(d); if(d.state==='DONE'){ stopPolling(); setIsRunningJob(false); if(d.error_result){ const errMsg=`Job failed: ${d.error_result.message||d.error_result.reason||'Unknown'}`; setJobError(errMsg); setJobResults(null); addToHistory({sql,success:false}); } else { setJobError(""); if(d.statement_type==='SELECT'||d.statement_type===undefined){ await fetchJobResults(currentJobId,loc); } else { setJobResults({rows:[],total_rows_in_result_set:d.num_dml_affected_rows??0,schema:[]}); addToHistory({sql,success:true,rowCount:d.num_dml_affected_rows}); setCurrentOutputTab("results"); } } } else { setIsRunningJob(true); } } catch (e:any){ console.error("Error fetching status:",e); const m=getErrorMessage(e); if(e.response?.status===404){ setJobError(`Job ${currentJobId} not found.`); stopPolling(); setIsRunningJob(false); addToHistory({sql,success:false}); } else { setJobError(`Fetch status failed: ${m}`); } } }, [stopPolling, fetchJobResults, sql, addToHistory, getErrorMessage]);
    const submitSqlJob = useCallback(async () => { console.log("Submitting SQL:",sql); stopPolling(); setJobId(null); setJobLocation(null); setJobStatus(null); setJobError(""); setJobResults(null); setResultsError(""); setIsRunningJob(true); setCurrentOutputTab("results"); try { const r=await axiosInstance.post<JobSubmitResponse>("/api/bigquery/jobs",{sql}); const{job_id,location,state}=r.data; console.log("Job Submitted:",r.data); setJobId(job_id); setJobLocation(location); setJobStatus({job_id,location,state:state as any}); } catch (e:any){ console.error("Error submitting job:",e); const errMsg=`Submit failed: ${getErrorMessage(e)}`; setJobError(errMsg); setIsRunningJob(false); setJobId(null); setJobLocation(null); addToHistory({sql,success:false}); } }, [sql, stopPolling, addToHistory, getErrorMessage]);
    const fetchTables = useCallback(async () => { setLoadingTables(true); setListTablesError(""); try { const r=await axiosInstance.get<TableInfo[]>(`/api/bigquery/tables?dataset_id=${encodeURIComponent(datasetId)}`); setTables(r.data); setFilteredTables(r.data); } catch (e:any){ console.error("Error fetching tables:",e); setListTablesError(`Load tables failed: ${getErrorMessage(e)}`); } finally { setLoadingTables(false); } }, [datasetId, getErrorMessage]);
    const handleTableSelect = useCallback(async (tableId: string) => { stopPolling(); setIsRunningJob(false); setJobId(null); setJobLocation(null); setJobStatus(null); setJobError(""); setJobResults(null); setResultsError(""); setSelectedTableId(tableId); setLoadingPreview(true); setPreviewError(""); setPreviewRows([]); setPreviewColumns([]); setPreviewCurrentPage(1); setTableStats(null); setPreviewSortConfig(null); const defaultSql = `SELECT *\nFROM \`${datasetId}.${tableId}\`\nLIMIT 100;`; setSql(defaultSql); setCurrentOutputTab("data"); try { const url=`/api/bigquery/table-data?dataset_id=${encodeURIComponent(datasetId)}&table_id=${encodeURIComponent(tableId)}&page=1&limit=${previewRowsPerPage}`; const r=await axiosInstance.get(url); const d=r.data; setPreviewRows(d?.rows??[]); setPreviewTotalRows(d?.totalRows??(d?.rows?.length??0)); setTableStats(d?.stats??null); if(d?.rows?.length>0)setPreviewColumns(Object.keys(d.rows[0])); else setPreviewColumns([]); } catch (e:any){ console.error("Error fetching table data:",e); setPreviewError(`Load preview failed: ${getErrorMessage(e)}`); } finally { setLoadingPreview(false); } }, [datasetId, previewRowsPerPage, stopPolling, getErrorMessage]);
    const handlePreviewPageChange = useCallback(async (newPage: number) => { if(!selectedTableId||newPage===previewCurrentPage)return; setLoadingPreview(true); setPreviewError(""); try { const url=`/api/bigquery/table-data?dataset_id=${encodeURIComponent(datasetId)}&table_id=${encodeURIComponent(selectedTableId)}&page=${newPage}&limit=${previewRowsPerPage}`; const r=await axiosInstance.get(url); const d=r.data; setPreviewRows(d?.rows??[]); setPreviewCurrentPage(newPage); if((d?.rows?.length>0)&&previewColumns.length===0)setPreviewColumns(Object.keys(d.rows[0])); } catch (e:any){ console.error("Error fetching page data:",e); setPreviewError(`Load page ${newPage} failed: ${getErrorMessage(e)}`); } finally { setLoadingPreview(false); } }, [selectedTableId, previewCurrentPage, previewRowsPerPage, datasetId, previewColumns.length, getErrorMessage]);
    const handlePreviewRowsPerPageChange = useCallback((value: string) => { const n=parseInt(value,10); setPreviewRowsPerPage(n); setPreviewCurrentPage(1); if(selectedTableId)handleTableSelect(selectedTableId);}, [selectedTableId, handleTableSelect]);
    const handlePreviewSort = useCallback((columnName: string) => { let d:"asc"|"desc"="asc"; if(previewSortConfig?.key===columnName&&previewSortConfig.direction==="asc")d="desc"; setPreviewSortConfig({key:columnName,direction:d}); const s=[...previewRows].sort((a,b)=>{ const valA=a[columnName], valB=b[columnName]; if(valA==null)return 1; if(valB==null)return -1; if(valA<valB)return d==="asc"?-1:1; if(valA>valB)return d==="asc"?1:-1; return 0; }); setPreviewRows(s);}, [previewSortConfig, previewRows]);
    const fetchSchema = useCallback(async () => { setLoadingSchema(true); setSchemaError(""); setSchemaData(null); try { const url=`/api/bigquery/schema?dataset_id=${encodeURIComponent(datasetId)}`; const r=await axiosInstance.get<SchemaResponse>(url); setSchemaData(r.data); } catch(e){ console.error("Error fetching schema:",e); setSchemaError(`Load schema failed: ${getErrorMessage(e)}`); } finally { setLoadingSchema(false); } }, [datasetId, getErrorMessage]);
    const handleGenerateSql = useCallback(async () => { if(!nlPrompt.trim()){setNlError("Please enter a description.");return;} setGeneratingSql(true); setNlError(""); setJobError(""); setJobResults(null); setJobStatus(null); setJobId(null); stopPolling(); try { const r=await axiosInstance.post<NLQueryResponse>('/api/bigquery/nl2sql',{prompt:nlPrompt,dataset_id:datasetId}); if(r.data.error){setNlError(r.data.error);} else if(r.data.generated_sql){setSql(r.data.generated_sql); setNlPrompt("");} else {setNlError("AI did not return valid SQL.");} } catch(e){ console.error("Error generating SQL:",e); setNlError(`Generate SQL failed: ${getErrorMessage(e)}`); } finally { setGeneratingSql(false); } }, [nlPrompt, datasetId, stopPolling, getErrorMessage]);

    // --- Effects (Keep existing ones) ---
    useEffect(() => { if(jobId&&jobLocation&&isRunningJob&&!pollingIntervalRef.current){ fetchJobStatus(jobId,jobLocation); pollingIntervalRef.current=setInterval(()=>{fetchJobStatus(jobId,jobLocation);},POLLING_INTERVAL_MS); console.log("Polling started."); } return()=>{stopPolling();}; }, [jobId,jobLocation,isRunningJob,fetchJobStatus,stopPolling]);
    useEffect(() => { fetchTables(); fetchSchema(); }, [fetchTables, fetchSchema]);
    useEffect(() => { const lq=tableSearchQuery.toLowerCase(); setFilteredTables(tables.filter(t=>t.tableId.toLowerCase().includes(lq))); }, [tableSearchQuery, tables]);
    useEffect(() => { if(jobResults&&jobId&&!jobError&&!isRunningJob&&jobStatus?.statement_type==='SELECT'){ addToHistory({sql,success:true,rowCount:jobResults.total_rows_in_result_set}); } }, [jobResults, jobId, jobError, isRunningJob, sql, addToHistory, jobStatus?.statement_type]);
    // --- Effects (Keep existing ones and ADD this new one) ---
    // ... other useEffect hooks ...

    // --- NEW Effect for Visualization Suggestions ---
    useEffect(() => {
        if (jobResults?.schema && jobResults.rows.length > 0) {
            console.log("Calculating chart suggestions...");
            const schema = jobResults.schema;
            const rows = jobResults.rows;
            const ruleBasedSuggestions: VizSuggestion[] = [];

            // Helper function to check data types
            const isNumeric = (type: string) => ['INTEGER', 'INT64', 'FLOAT', 'FLOAT64', 'NUMERIC', 'BIGNUMERIC'].includes(type);
            const isString = (type: string) => type === 'STRING';
            const isDate = (type: string) => ['DATE', 'DATETIME', 'TIMESTAMP'].includes(type);

            const numericCols = schema.filter(f => isNumeric(f.type)).map(f => f.name);
            const stringCols = schema.filter(f => isString(f.type)).map(f => f.name);
            const dateCols = schema.filter(f => isDate(f.type)).map(f => f.name);

            // Rule 1: 1 String + 1+ Numeric -> Bar Chart
            if (stringCols.length === 1 && numericCols.length >= 1) {
                ruleBasedSuggestions.push({
                    chart_type: 'bar',
                    x_axis_column: stringCols[0],
                    y_axis_columns: numericCols, // Plot all numeric? Or first one? Let's do all for now
                    rationale: `Bar chart comparing ${numericCols.join(', ')} across '${stringCols[0]}' categories.`
                });
            }

            // Rule 2: 1 Date + 1+ Numeric -> Line Chart
            if (dateCols.length === 1 && numericCols.length >= 1) {
                 // Basic check if date values look parsable (optional refinement)
                 const dateColumnName = dateCols[0];
                 const looksLikeValidDate = rows.slice(0, 10).every(row => !row[dateColumnName] || !isNaN(Date.parse(row[dateColumnName])));

                 if (looksLikeValidDate) {
                    ruleBasedSuggestions.push({
                        chart_type: 'line',
                        x_axis_column: dateColumnName,
                        y_axis_columns: numericCols,
                        rationale: `Line chart tracking ${numericCols.join(', ')} over time ('${dateColumnName}').`
                    });
                 } else {
                    console.warn(`Date column '${dateColumnName}' might contain non-standard date formats. Skipping line chart suggestion.`);
                 }
            }

            // Rule 3: 2+ Numeric -> Scatter Plot
            if (numericCols.length >= 2) {
                ruleBasedSuggestions.push({
                    chart_type: 'scatter',
                    x_axis_column: numericCols[0], // Use first numeric as X
                    y_axis_columns: [numericCols[1]], // Use second numeric as Y
                    rationale: `Scatter plot showing relationship between '${numericCols[0]}' and '${numericCols[1]}'.`
                });
                // Optionally suggest pairs if more numerics exist
            }

            // Rule 4: 1 String + 1 Numeric + Low Cardinality -> Pie Chart
            if (stringCols.length === 1 && numericCols.length === 1) {
                const categoryCol = stringCols[0];
                const valueCol = numericCols[0];
                const uniqueCategories = new Set(rows.map(r => r[categoryCol]));
                if (uniqueCategories.size > 1 && uniqueCategories.size <= 12) { // Threshold for pie chart usability
                    ruleBasedSuggestions.push({
                        chart_type: 'pie',
                        x_axis_column: categoryCol, // For pie, 'x' is the label/name
                        y_axis_columns: [valueCol],   // 'y' is the value
                        rationale: `Pie chart showing the proportion of '${valueCol}' for each '${categoryCol}'.`
                    });
                }
            }

             // --- Fetch AI Suggestions (async) ---
             const fetchAiSuggestions = async () => {
                if (!jobResults?.schema) return []; // No schema, no AI suggestion
                setLoadingAiSuggestions(true);
                setAiSuggestionError("");
                try {
                    const response = await axiosInstance.post<{suggestions: VizSuggestion[], error?: string}>(
                        '/api/bigquery/suggest-visualization', // Ensure this endpoint exists
                        {
                            schema: jobResults.schema,
                            query_sql: sql, // Send the executed SQL
                            result_sample: jobResults.rows.slice(0, 5) // Send a small sample
                        }
                    );
                    if (response.data.error) {
                        setAiSuggestionError(`AI Error: ${response.data.error}`);
                        return [];
                    }
                    // TODO: Maybe filter/validate AI suggestions? Ensure columns exist etc.
                    console.log("AI Suggestions Received:", response.data.suggestions);
                    return response.data.suggestions || [];
                } catch (error) {
                    console.error("Error fetching AI suggestions:", error);
                    setAiSuggestionError(`Failed to get AI suggestions: ${getErrorMessage(error)}`);
                    return [];
                } finally {
                    setLoadingAiSuggestions(false);
                }
             };

            // Combine rule-based and fetch AI ones
             fetchAiSuggestions().then(aiSuggestions => {
                 // Basic de-duplication based on type and primary columns
                 const combined = [...ruleBasedSuggestions];
                 aiSuggestions.forEach(aiSugg => {
                     if (!combined.some(rbSugg =>
                            rbSugg.chart_type === aiSugg.chart_type &&
                            rbSugg.x_axis_column === aiSugg.x_axis_column &&
                            rbSugg.y_axis_columns[0] === aiSugg.y_axis_columns[0] // Simple check
                         )) {
                         combined.push({...aiSugg, rationale: aiSugg.rationale ?? `AI suggested ${aiSugg.chart_type} chart.` }); // Add default rationale if missing
                     }
                 });
                 console.log("Final combined suggestions:", combined);
                 setSuggestedCharts(combined);
                 // Optionally auto-select the first suggestion if none active
                 // if (!activeVisualization && combined.length > 0) {
                 //    setActiveVisualization(combined[0]);
                 //    setCurrentOutputTab('visualize');
                 // }
             });


        } else {
            // Clear suggestions if no results
            setSuggestedCharts([]);
            setActiveVisualization(null);
            // If the visualize tab was active, switch back
            if (currentOutputTab === 'visualize') {
                setCurrentOutputTab('results'); // Or 'data' if preferred fallback
            }
        }
    }, [jobResults, sql, getErrorMessage]); // Add sql dependency for AI context
    // Editor resizing logic
    const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => { setIsResizingEditor(true); mouseDownEvent.preventDefault(); }, []);
    useEffect(() => { const handleMouseMove=(e: MouseEvent)=>{if(!isResizingEditor||!editorPaneRef.current)return; const top=editorPaneRef.current.getBoundingClientRect().top; const newH=e.clientY-top; setEditorPaneHeight(Math.max(100,Math.min(newH,window.innerHeight*0.7)));}; const handleMouseUp=()=>setIsResizingEditor(false); if(isResizingEditor){window.addEventListener('mousemove',handleMouseMove); window.addEventListener('mouseup',handleMouseUp);} return()=>{window.removeEventListener('mousemove',handleMouseMove); window.removeEventListener('mouseup',handleMouseUp);}; }, [isResizingEditor]);

    // --- Render Functions ---

    const renderSidebarContent = () => {
        // Renders the full sidebar content when not collapsed
        // Uses theme variables implicitly via shadcn components and Tailwind base
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
                        <TabsTrigger value="favorites" className="text-xs h-7"><Bookmark className="mr-1 h-3 w-3"/>Favorites</TabsTrigger>
                        <TabsTrigger value="history" className="text-xs h-7"><History className="mr-1 h-3 w-3"/>History</TabsTrigger>
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

    const renderTablesList = () => {
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

    const renderFavoritesList = () => {
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

    const renderSchemaViewer = () => {
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

    const renderTablePreview = () => {
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

    const renderJobResults = () => {
        if(isRunningJob&&jobId)return(<div className="flex justify-center items-center h-full"><div className="text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary"/><p className="text-lg font-medium mb-1 text-foreground">Running Query...</p><p className="text-sm text-muted-foreground">Job ID: {jobId}</p></div></div>);
        if(jobError)return(<Alert variant="destructive" className="m-4"><Terminal className="h-4 w-4"/><AlertTitle>Query Error</AlertTitle><AlertDescription><p>{jobError}</p><Button onClick={submitSqlJob} variant="outline" size="sm" className="mt-3 text-xs h-7"><RefreshCw className="mr-1.5 h-3 w-3"/>Try Again</Button></AlertDescription></Alert>);
        if(loadingResults)return(<div className="flex justify-center items-center h-full"><div className="text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary"/><p className="text-sm text-muted-foreground">Loading results...</p></div></div>);
        if(resultsError)return(<Alert variant="destructive" className="m-4"><Terminal className="h-4 w-4"/><AlertTitle>Results Error</AlertTitle><AlertDescription>{resultsError}</AlertDescription></Alert>);
        if(!jobResults||!jobResults.rows)return(<div className="flex items-center justify-center h-full text-muted-foreground"><div className="text-center p-6"><ListTree className="h-12 w-12 mx-auto mb-4 opacity-20"/><h3 className="text-lg font-medium mb-2 text-foreground">No Query Results</h3><p className="text-sm">Run a query using the editor above.</p></div></div>);
        if(jobResults.rows.length===0)return(<div className="flex items-center justify-center h-full text-muted-foreground"><div className="text-center"><Table2 className="h-12 w-12 mx-auto mb-4 opacity-20"/><h3 className="text-lg font-medium mb-2 text-foreground">Query Returned No Rows</h3>{jobResults.total_rows_in_result_set!==undefined&&jobResults.total_rows_in_result_set>0&&(<p className="text-sm">{jobResults.total_rows_in_result_set.toLocaleString()} row(s) affected</p>)}</div></div>);

        const cols=jobResults.schema?jobResults.schema.map(f=>f.name):Object.keys(jobResults.rows[0]);
        return(
            <div className="h-full flex flex-col p-3">
                <div className="mb-2 flex justify-between items-center flex-shrink-0 flex-wrap gap-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-mono text-xs" title={jobId}>Job: {jobId?.split('-')[0]}...</Badge>
                        {jobResults.total_rows_in_result_set!==undefined&&(<Badge variant="secondary" className="text-xs">{jobResults.total_rows_in_result_set.toLocaleString()} row(s)</Badge>)}
                        {jobStatus?.total_bytes_processed!==undefined&&(<Badge variant="secondary" className="text-xs">~{formatBytes(jobStatus.total_bytes_processed)}</Badge>)}
                    </div>
                    <div className="flex gap-1">
                        <Button variant="outline" size="xs" onClick={submitSqlJob} className="h-7"><RefreshCw className="mr-1 h-3 w-3"/>Run Again</Button>
                        <Button variant="outline" size="xs" onClick={()=>{/* Export Logic */ /* ... */}} className="h-7"><Download className="mr-1 h-3 w-3"/>Export</Button>
                    </div>
                </div>
                <div className="flex-grow overflow-hidden border rounded-md bg-card">
                    <ScrollArea className="h-full">
                        <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-muted z-10">
                                <tr>{cols.map(c=>(<th key={c} className="px-2 py-1.5 text-left font-medium text-muted-foreground border-b border-r last:border-r-0"><div className="flex items-center" title={c}><span className="truncate max-w-32">{c}</span>{jobResults.schema&&(<TooltipProvider delayDuration={300}><Tooltip><TooltipTrigger asChild><Info className="ml-1 h-3 w-3 text-muted-foreground/50 hover:text-muted-foreground"/></TooltipTrigger><TooltipContent className="text-xs">Type: {jobResults.schema.find(f=>f.name===c)?.type??'?'}<br/>Mode: {jobResults.schema.find(f=>f.name===c)?.mode??'?'}</TooltipContent></Tooltip></TooltipProvider>)}</div></th>))}</tr>
                            </thead>
                            <tbody className="font-mono divide-y divide-border text-foreground">
                                {jobResults.rows.map((r,i)=>(<tr key={i} className="hover:bg-muted/50">{cols.map(c=>(<td key={c} className="px-2 py-1 max-w-40 truncate border-r last:border-r-0" title={String(r[c]??null)}>{r[c]!=null?String(r[c]):<span className="italic text-muted-foreground">null</span>}</td>))}</tr>))}
                            </tbody>
                        </table>
                    </ScrollArea>
                </div>
                {jobResults.next_page_token&&(<div className="mt-2 flex justify-center flex-shrink-0"><Button variant="outline" size="sm" onClick={()=>jobId&&jobLocation&&fetchJobResults(jobId,jobLocation,jobResults.next_page_token)} disabled={loadingResults} className="text-xs h-7">{loadingResults?<Loader2 className="mr-1.5 h-3 w-3 animate-spin"/>:<></>}Load More</Button></div>)}
            </div>
        );
    };

    const renderEditorPane = () => {
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

    const renderOutputPane = () => {
        // Determine if visualize tab should be enabled
        const canVisualize = suggestedCharts.length > 0 || activeVisualization !== null;

        return (
            <div className="flex-grow overflow-hidden flex flex-col bg-background">
                 {/* Status Bar (keep as is) */}
                 {jobId && !isRunningJob && (
  <div className="px-4 py-1 text-xs text-muted-foreground">
    Job {jobId} finished successfully.
  </div>
)}

                <Tabs value={currentOutputTab} onValueChange={setCurrentOutputTab} className="flex-grow flex flex-col overflow-hidden">
                    <TabsList className="mx-3 mt-2 mb-1 h-8 justify-start bg-muted p-0.5 rounded-md flex-shrink-0">
                        <TabsTrigger value="data" className="text-xs h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-sm"><Table2 className="mr-1.5 h-3.5 w-3.5"/>Preview</TabsTrigger>
                        <TabsTrigger value="results" className="text-xs h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-sm" disabled={!jobId && !jobResults}><ListTree className="mr-1.5 h-3.5 w-3.5"/>Results</TabsTrigger>
                        {/* --- ADDED VISUALIZE TAB --- */}
                        <TabsTrigger
                             value="visualize"
                             className="text-xs h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-sm"
                             disabled={!canVisualize || !jobResults || jobResults.rows.length === 0} // Disable if no results or suggestions
                         >
                           <BarChart4 className="mr-1.5 h-3.5 w-3.5"/>Visualize {/* Use a generic chart icon */}
                        </TabsTrigger>
                     </TabsList>
                    {/* Content areas */}
                     <TabsContent value="data" className="flex-grow mt-0 overflow-hidden">
                        {renderTablePreview()}
                     </TabsContent>
                    <TabsContent value="results" className="flex-grow mt-0 overflow-hidden">
                        {/* We will move the table rendering logic out slightly */}
                         {renderResultsContent()}
                    </TabsContent>
                     {/* --- ADDED VISUALIZE CONTENT --- */}
                    <TabsContent value="visualize" className="flex-grow mt-0 overflow-hidden bg-card">
                        {renderChartVisualization()}
                    </TabsContent>
                </Tabs>
            </div>
        );
    };

    // --- Refactor renderJobResults slightly ---
    // This will contain the suggestions + table (or message if no results)
    // --- Refactor renderJobResults slightly ---
    // This will contain the suggestions + table (or message if no results)
    const renderResultsContent = () => {
        // Existing initial checks from renderJobResults
        // --- REPLACE PLACEHOLDER COMMENTS WITH ACTUAL JSX ---
        if (isRunningJob && jobId) return ( // <--- Fix potentially missed here
            <div className="flex justify-center items-center h-full p-4">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary"/>
                    <p className="text-lg font-medium mb-1 text-foreground">Running Query...</p>
                    <p className="text-sm text-muted-foreground">Job ID: {jobId}</p>
                </div>
            </div>
        );
        if (jobError) return ( // <--- Fix potentially missed here
            <Alert variant="destructive" className="m-4">
                <Terminal className="h-4 w-4"/>
                <AlertTitle>Query Error</AlertTitle>
                <AlertDescription>
                    <p>{jobError}</p>
                    <Button onClick={submitSqlJob} variant="outline" size="sm" className="mt-3 text-xs h-7">
                        <RefreshCw className="mr-1.5 h-3 w-3"/>Try Again
                    </Button>
                </AlertDescription>
            </Alert>
        );
        if (loadingResults) return ( // <--- Fix potentially missed here
             <div className="flex justify-center items-center h-full p-4">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary"/>
                    <p className="text-sm text-muted-foreground">Loading results...</p>
                 </div>
             </div>
        );
        if (resultsError) return ( // <--- Fix potentially missed here
            <Alert variant="destructive" className="m-4">
                <Terminal className="h-4 w-4"/>
                <AlertTitle>Results Error</AlertTitle>
                <AlertDescription>{resultsError}</AlertDescription>
                 {/* Optionally add a retry button for fetching results? */}
             </Alert>
        );

        // --- Ensure jobResults exists before proceeding ---
        if (!jobResults) return ( // Check if jobResults itself is null/undefined
            <div className="flex items-center justify-center h-full text-muted-foreground p-6">
                <div className="text-center">
                     <ListTree className="h-12 w-12 mx-auto mb-4 opacity-20"/>
                     <h3 className="text-lg font-medium mb-2 text-foreground">No Query Results</h3>
                     <p className="text-sm">Run a query using the editor above, or previous results may have failed to load.</p>
                 </div>
            </div>
        );

        // Render this only if results exist but rows are empty
        if (jobResults.rows.length === 0) return ( // Check if rows array is empty
            <div className="flex items-center justify-center h-full text-muted-foreground p-6">
                <div className="text-center">
                    <Table2 className="h-12 w-12 mx-auto mb-4 opacity-20"/>
                    <h3 className="text-lg font-medium mb-2 text-foreground">Query Returned No Rows</h3>
                     {jobResults.total_rows_in_result_set !== undefined && jobResults.total_rows_in_result_set > 0 && (
                         <p className="text-sm">{jobResults.total_rows_in_result_set.toLocaleString()} row(s) affected (DML)</p>
                    )}
                 </div>
             </div>
        );

        // --- DEFINE renderResultsTable INSIDE renderResultsContent ---
        const renderResultsTable = () => {
            // You need to check jobResults.schema exists *before* accessing it
            const cols = jobResults.schema ? jobResults.schema.map(f => f.name) : (jobResults.rows.length > 0 ? Object.keys(jobResults.rows[0]) : []);

            if (cols.length === 0) {
                // Handle case where schema might be missing AND rows are empty,
                // though the previous check should catch empty rows. Safety check.
                return <p className="p-4 text-orange-500">Could not determine result columns.</p>;
            }

            return (
                <div className="flex-grow overflow-hidden border rounded-md bg-card mt-2"> {/* Added mt-2 */}
                   <ScrollArea className="h-full">
                        <table className="w-full text-xs">
                           <thead className="sticky top-0 bg-muted z-10">
                               {/* Ensure schema exists before trying to add tooltips */}
                               <tr>{cols.map(c => (<th key={c} className="px-2 py-1.5 text-left font-medium text-muted-foreground border-b border-r last:border-r-0">
                                    <div className="flex items-center" title={c}><span className="truncate max-w-32">{c}</span>
                                         {jobResults.schema && ( // Conditionally render tooltip
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
                                 {jobResults.rows.map((r,i)=>(<tr key={i} className="hover:bg-muted/50">{cols.map(c=>(<td key={c} className="px-2 py-1 max-w-40 truncate border-r last:border-r-0" title={String(r[c]??null)}>{r[c]!=null?String(r[c]):<span className="italic text-muted-foreground">null</span>}</td>))}</tr>))}
                             </tbody>
                        </table>
                    </ScrollArea>
                </div>
            );
        };
        // --- End of renderResultsTable definition ---

        // --- MAIN RETURN for renderResultsContent ---
        return (
            <div className="h-full flex flex-col p-3">
                 {/* --- METADATA & BUTTONS --- */}
                 <div className="mb-2 flex justify-between items-center flex-shrink-0 flex-wrap gap-y-1">
                    {/* Metadata Badges... */}
                    <div className="flex items-center gap-2 flex-wrap">
                         {/* Ensure jobId exists */}
                        {jobId && <Badge variant="outline" className="font-mono text-xs" title={jobId}>Job: {jobId.split('-')[0]}...</Badge>}
                         {jobResults.total_rows_in_result_set !== undefined && (<Badge variant="secondary" className="text-xs">{jobResults.total_rows_in_result_set.toLocaleString()} row(s)</Badge>)}
                        {jobStatus?.total_bytes_processed !== undefined && (<Badge variant="secondary" className="text-xs">~{formatBytes(jobStatus.total_bytes_processed)}</Badge>)}
                     </div>
                     {/* Action Buttons... */}
                     <div className="flex gap-1">
                        <Button variant="outline" size="xs" onClick={submitSqlJob} className="h-7"><RefreshCw className="mr-1 h-3 w-3"/>Run Again</Button>
                         <Button variant="outline" size="xs" onClick={() => { console.warn("Export not implemented yet"); }} className="h-7"><Download className="mr-1 h-3 w-3"/>Export</Button>
                     </div>
                </div>

                 {/* --- SUGGESTIONS SECTION --- */}
                {suggestedCharts.length > 0 && (
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
                                    variant="outline"
                                     size="xs"
                                     onClick={() => {
                                        setActiveVisualization(suggestion);
                                         setCurrentOutputTab('visualize');
                                     }}
                                     title={suggestion.rationale}
                                     className="h-6 text-xs"
                                 >
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

                 {/* --- RESULTS TABLE --- */}
                 {renderResultsTable()}


                 {/* --- LOAD MORE BUTTON --- */}
                 {jobResults.next_page_token && (<div className="mt-2 flex justify-center flex-shrink-0">
                     <Button variant="outline" size="sm" onClick={()=>jobId&&jobLocation&&fetchJobResults(jobId,jobLocation,jobResults.next_page_token)} disabled={loadingResults} className="text-xs h-7">{loadingResults?<Loader2 className="mr-1.5 h-3 w-3 animate-spin"/>:<></>}Load More</Button>
                 </div>)}
             </div>
        );
    };
      

    // --- NEW Render Function for Charts ---
    const renderChartVisualization = () => {
        if (!activeVisualization) {
            return (
                <div className="flex items-center justify-center h-full text-muted-foreground p-6">
                     <div className="text-center">
                        <BarChart4 className="h-12 w-12 mx-auto mb-4 opacity-20"/>
                         <h3 className="text-lg font-medium mb-2">Select a Visualization</h3>
                         <p className="text-sm">Choose a suggested chart from the 'Results' tab to visualize the data.</p>
                    </div>
                </div>
            );
        }

        if (!jobResults || jobResults.rows.length === 0) {
             return (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                     <p>No data available to visualize.</p>
                 </div>
            );
        }

        const { chart_type, x_axis_column, y_axis_columns } = activeVisualization;
        const data = jobResults.rows;

        // Define some colors for variety (especially for pie/multi-bar/line)
        const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82Ca9D'];

        const renderChart = () => {
             // Ensure Y-axis columns exist in the data (simple check)
            const validYCols = y_axis_columns.filter(col => data[0]?.hasOwnProperty(col));
            if (validYCols.length === 0) {
                return <p className="text-red-500 p-4">Error: Specified Y-axis column(s) not found in data.</p>;
            }
            // Ensure X-axis column exists
            if (!data[0]?.hasOwnProperty(x_axis_column)) {
                return <p className="text-red-500 p-4">Error: Specified X-axis column '{x_axis_column}' not found in data.</p>;
            }


            switch (chart_type) {
                case 'bar':
                    return (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 50 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
                                <XAxis
                                     dataKey={x_axis_column}
                                     angle={-45} // Angle labels if they might overlap
                                    textAnchor="end"
                                    height={60} // Adjust height for angled labels
                                    interval={0} // Show all labels (can be 'preserveEnd' or number)
                                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                    stroke="hsl(var(--muted-foreground))"
                                 />
                                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--muted-foreground))"/>
                                 <RechartsTooltip
                                     cursor={{ fill: 'hsla(var(--muted), 0.5)' }}
                                     contentStyle={{
                                        background: 'hsl(var(--background))',
                                        borderColor: 'hsl(var(--border))',
                                        borderRadius: 'var(--radius)',
                                         fontSize: '12px',
                                         color: 'hsl(var(--foreground))',
                                    }}
                                 />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                 {/* Create a Bar for each Y column */}
                                {validYCols.map((yCol, index) => (
                                    <Bar
                                        key={yCol}
                                        dataKey={yCol}
                                        fill={COLORS[index % COLORS.length]}
                                         // Convert value to number for the Bar chart
                                        // Assumes the data is already numeric-like; add parsing if needed
                                        // formatter={(value) => Number(value) || 0} // Example formatter
                                     />
                                 ))}
                             </BarChart>
                        </ResponsiveContainer>
                     );
                case 'line':
                    // Attempt to parse date/time for better axis formatting
                    const parseDate = (d: any) => {
                         if (d === null || d === undefined) return null;
                         try {
                            const date = new Date(d);
                             return isNaN(date.getTime()) ? null : date.getTime(); // Return timestamp for Recharts
                        } catch {
                             return null; // Handle potential errors if Date.parse fails
                         }
                     };
                     const formattedDataLine = data
                        .map(row => ({ ...row, [x_axis_column]: parseDate(row[x_axis_column]) }))
                         .filter(row => row[x_axis_column] !== null) // Filter out unparsable dates
                        .sort((a, b) => a[x_axis_column] - b[x_axis_column]); // Sort by parsed date

                    if (formattedDataLine.length === 0) {
                        return <p className="p-4 text-orange-500">Could not parse dates in column '{x_axis_column}' for line chart.</p>;
                     }

                    return (
                         <ResponsiveContainer width="100%" height="100%">
                             <LineChart data={formattedDataLine} margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
                                 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
                                 <XAxis
                                    dataKey={x_axis_column}
                                     type="number" // Because we converted to timestamp
                                    domain={['dataMin', 'dataMax']}
                                    scale="time"
                                     tickFormatter={(unixTime) => new Date(unixTime).toLocaleDateString()} // Format timestamp back to readable date
                                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                    stroke="hsl(var(--muted-foreground))"
                                />
                                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--muted-foreground))"/>
                                <RechartsTooltip
                                    labelFormatter={(unixTime) => new Date(unixTime).toLocaleString()}
                                     contentStyle={{ /* ... tooltip style */ }}
                                />
                                 <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                 {validYCols.map((yCol, index) => (
                                    <Line
                                        key={yCol}
                                        type="monotone"
                                        dataKey={yCol}
                                         stroke={COLORS[index % COLORS.length]}
                                         strokeWidth={2}
                                        dot={false} // Don't show dots for many points
                                         activeDot={{ r: 6 }}
                                         // formatter={(value) => Number(value) || 0} // Optional conversion
                                     />
                                ))}
                            </LineChart>
                         </ResponsiveContainer>
                     );
                 case 'pie':
                    // Needs aggregation if multiple rows have the same category
                    const aggregatedPieData: { [key: string]: number } = {};
                     data.forEach(row => {
                        const category = String(row[x_axis_column] ?? 'Unknown');
                        const value = Number(row[validYCols[0]]); // Assuming first Y col is the value
                        if (!isNaN(value)) {
                             aggregatedPieData[category] = (aggregatedPieData[category] || 0) + value;
                         }
                    });
                     const formattedDataPie = Object.entries(aggregatedPieData).map(([name, value]) => ({ name, value }));

                    if (formattedDataPie.length === 0) {
                         return <p className="p-4 text-orange-500">No valid numeric data for pie chart.</p>;
                    }

                     return (
                         <ResponsiveContainer width="100%" height="100%">
                             <PieChart>
                                 <Pie
                                    data={formattedDataPie}
                                     cx="50%"
                                     cy="50%"
                                     labelLine={false}
                                     // label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} // Example label
                                     outerRadius={Math.min(window.innerWidth, window.innerHeight) * 0.25} // Adjust radius
                                     fill="#8884d8"
                                     dataKey="value"
                                     nameKey="name"
                                     label={{ fontSize: 10, fill: 'hsl(var(--foreground))' }}
                                 >
                                    {formattedDataPie.map((entry, index) => (
                                         <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                     ))}
                                 </Pie>
                                 <RechartsTooltip contentStyle={{ /* ... tooltip style */ }}/>
                                 <Legend wrapperStyle={{ fontSize: '11px' }}/>
                             </PieChart>
                         </ResponsiveContainer>
                    );
                    case 'scatter':
                        // Get the schema safely from jobResults
                        const currentSchema = jobResults?.schema; // Optional chaining
   
                        // Helper function if not already defined in scope (e.g., passed down or defined higher)
                        const isString = (type: string) => type === 'STRING';
   
                        // Prepare data, ensuring both x and y are numbers
                        const formattedDataScatter = data
                            .map(row => {
                                // --- CORRECTED LINE ---
                                // Find the name of the first string column in the current schema
                                const labelColumnName = currentSchema?.find(f => isString(f.type))?.name ?? x_axis_column; // Fallback to x-axis col if no string col found
   
                                return {
                                   x: Number(row[x_axis_column]),
                                    y: Number(row[validYCols[0]]), // Use the first VALID Y column
                                    // Get the actual label value using the determined column name
                                   label: row[labelColumnName]
                                };
                            })
                            .filter(point => !isNaN(point.x) && !isNaN(point.y));
   
   
                       if (formattedDataScatter.length === 0) {
                            return <p className="p-4 text-orange-500">No valid numeric pairs for scatter plot.</p>;
                       }
   
                        // Ensure we have a valid Y column name for the axis label
                        const yAxisName = validYCols.length > 0 ? validYCols[0] : 'Y-Value';
   
                       return (
                            <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                   <CartesianGrid stroke="hsl(var(--border))"/>
                                    <XAxis
                                        type="number"
                                       dataKey="x"
                                        name={x_axis_column} // Set name for tooltip reference
                                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                        stroke="hsl(var(--muted-foreground))"
                                    />
                                    <YAxis
                                        type="number"
                                        dataKey="y"
                                        name={yAxisName} // Set name for tooltip reference
                                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                        stroke="hsl(var(--muted-foreground))"
                                    />
                                    {/* Tooltip content style */}
                                   <RechartsTooltip
                                       cursor={{ strokeDasharray: '3 3' }}
                                       contentStyle={{
                                           background: 'hsl(var(--background))',
                                           borderColor: 'hsl(var(--border))',
                                           borderRadius: 'var(--radius)',
                                            fontSize: '12px',
                                            color: 'hsl(var(--foreground))',
                                       }}
                                       // Use formatter to potentially show label or format values
                                       formatter={(value: any, name: string, props: any) => {
                                           // 'name' will be the dataKey ('x' or 'y')
                                           // 'props.payload' contains the full data point {x, y, label}
                                           const pointLabel = props.payload?.label;
                                           const axisName = name === 'x' ? x_axis_column : yAxisName;
                                            return [`${axisName}: ${value}`, pointLabel ? `Label: ${pointLabel}`: null];
                                       }}
                                    />
                                    {/* Scatter component using the calculated yAxisName */}
                                    <Scatter name={yAxisName} data={formattedDataScatter} fill={COLORS[0]}/>
                               </ScatterChart>
                           </ResponsiveContainer>
                       );
                    // ... other cases ...

                    if (formattedDataScatter.length === 0) {
                         return <p className="p-4 text-orange-500">No valid numeric pairs for scatter plot.</p>;
                    }

                    return (
                         <ResponsiveContainer width="100%" height="100%">
                             <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid stroke="hsl(var(--border))"/>
                                 <XAxis
                                     type="number"
                                     dataKey="x"
                                     name={x_axis_column}
                                     tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                     stroke="hsl(var(--muted-foreground))"
                                 />
                                 <YAxis
                                     type="number"
                                     dataKey="y"
                                     name={validYCols[0]}
                                     tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                     stroke="hsl(var(--muted-foreground))"
                                 />
                                <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ /* ... tooltip style */ }}/>
                                 <Scatter name="Data Points" data={formattedDataScatter} fill={COLORS[0]}>
                                     {/* You can add labeling here if needed */}
                                     {/* <LabelList dataKey="label" position="right" /> */}
                                </Scatter>
                            </ScatterChart>
                        </ResponsiveContainer>
                    );
                 default:
                    return <p>Unsupported chart type: {chart_type}</p>;
             }
        };

        return (
            <div className="h-full flex flex-col p-3">
                <div className="flex justify-between items-center mb-2 flex-shrink-0">
                     <h3 className="text-base font-semibold capitalize flex items-center gap-2">
                        {activeVisualization.chart_type === 'bar' && <BarChart4 className="h-4 w-4 text-primary"/>}
                         {activeVisualization.chart_type === 'line' && <LineChartIcon className="h-4 w-4 text-primary"/>}
                         {activeVisualization.chart_type === 'pie' && <PieChartIcon className="h-4 w-4 text-primary"/>}
                         {activeVisualization.chart_type === 'scatter' && <Dot className="h-4 w-4 text-primary"/>}
                        {activeVisualization.chart_type} Chart
                     </h3>
                     {/* Maybe add buttons here to change chart type or config? */}
                     <Button
                         variant="ghost"
                         size="sm"
                         onClick={() => setActiveVisualization(null)} // Button to clear current viz
                         className="text-xs h-7"
                    >
                        Close Chart
                    </Button>
                 </div>
                 <p className="text-xs text-muted-foreground mb-2 flex-shrink-0">{activeVisualization.rationale}</p>
                 <div className="flex-grow border rounded-md overflow-hidden bg-background">
                    {renderChart()}
                </div>
            </div>
        );
    };


    // --- Main Component Return ---
    return (
        <TooltipProvider>
            {/* Use h-full, standard theme background/text */}
            <div className="flex h-full bg-background text-foreground overflow-hidden text-sm">
                {/* Sidebar uses card background */}
                <div className={`border-r border-border bg-card flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out ${ sidebarCollapsed ? 'w-12' : 'w-64 md:w-72' }`} >
                    <div className={`p-2 border-b border-border flex ${sidebarCollapsed?'justify-center':'justify-end'} flex-shrink-0`}>
                         <Tooltip> <TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={()=>setSidebarCollapsed(!sidebarCollapsed)}>{sidebarCollapsed?<ChevronRight className="h-4 w-4"/>:<ChevronLeft className="h-4 w-4"/>}</Button></TooltipTrigger><TooltipContent side="right">{sidebarCollapsed?'Expand':'Collapse'}</TooltipContent></Tooltip>
                    </div>
                    <div className="flex-grow overflow-hidden">
                        {sidebarCollapsed ? (
                             <div className="flex flex-col items-center pt-3 gap-3">
                                {/* Icons use standard button variants */}
                                <Tooltip><TooltipTrigger asChild><Button variant={currentSidebarTab==='tables'?'secondary':'ghost'} size="icon" className="h-7 w-7" onClick={()=>{setCurrentSidebarTab('tables'); setSidebarCollapsed(false);}}><Database className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent side="right">Tables</TooltipContent></Tooltip>
                                <Tooltip><TooltipTrigger asChild><Button variant={currentSidebarTab==='favorites'?'secondary':'ghost'} size="icon" className="h-7 w-7" onClick={()=>{setCurrentSidebarTab('favorites'); setSidebarCollapsed(false);}}><Bookmark className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent side="right">Favorites</TooltipContent></Tooltip>
                                <Tooltip><TooltipTrigger asChild><Button variant={currentSidebarTab==='history'?'secondary':'ghost'} size="icon" className="h-7 w-7" onClick={()=>{setCurrentSidebarTab('history'); setSidebarCollapsed(false);}}><History className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent side="right">History</TooltipContent></Tooltip>
                                <Tooltip><TooltipTrigger asChild><Button variant={currentSidebarTab==='schema'?'secondary':'ghost'} size="icon" className="h-7 w-7" onClick={()=>{setCurrentSidebarTab('schema'); setSidebarCollapsed(false);}}><ListTree className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent side="right">Schema</TooltipContent></Tooltip>
                            </div>
                        ) : (
                           <div className="h-full">
                              {renderSidebarContent()}
                           </div>
                        )}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-grow flex flex-col overflow-hidden">
                    {renderEditorPane()}
                    {renderOutputPane()}
                </div>
            </div>
        </TooltipProvider>
    );
};

export default BigQueryTableViewer;