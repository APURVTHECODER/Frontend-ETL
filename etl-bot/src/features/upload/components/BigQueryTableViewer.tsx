import React, { useEffect, useState, useRef, useCallback } from "react";
import axios, { AxiosError } from "axios";

// --- Keep existing interfaces: TableInfo, RowData, TableStats ---

// --- Add interfaces for Job Handling ---
interface JobSubmitResponse {
  job_id: string;
  state: string;
  location: string;
  message: string;
}

interface JobStatusResponse {
  job_id: string;
  state: 'PENDING' | 'RUNNING' | 'DONE'; // Be more specific with states
  location: string;
  statement_type?: string;
  error_result?: {
    reason?: string;
    location?: string;
    message?: string;
  };
  user_email?: string;
  creation_time?: string; // ISO String
  start_time?: string; // ISO String
  end_time?: string; // ISO String
  total_bytes_processed?: number;
  num_dml_affected_rows?: number;
}

interface JobResultSchemaField {
    name: string;
    type: string;
    mode: string;
}

interface JobResultsResponse {
    rows: RowData[];
    total_rows_in_result_set?: number;
    next_page_token?: string | null;
    schema?: JobResultSchemaField[];
}


const BigQueryTableViewer: React.FC = () => {
  const datasetId = "crafty-tracker-457215-g6.sample78600"; // Make this configurable?

  // --- Table Explorer States (mostly unchanged) ---
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [filteredTables, setFilteredTables] = useState<TableInfo[]>([]);
  const [listTablesError, setListTablesError] = useState<string>(""); // Specific error state
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [previewColumns, setPreviewColumns] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<RowData[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loadingTables, setLoadingTables] = useState<boolean>(true);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string>(""); // Specific error state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10); // Use for preview, results pagination separate
  const [totalRows, setTotalRows] = useState<number>(0); // For table preview
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc"; } | null>(null);
  const [tableStats, setTableStats] = useState<TableStats | null>(null);

  // --- SQL Job States ---
  const [sql, setSql] = useState<string>(`-- Enter your BigQuery SQL here\nSELECT * FROM \`${datasetId}.your_table_name\` LIMIT 10;`);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobLocation, setJobLocation] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatusResponse | null>(null);
  const [isRunningJob, setIsRunningJob] = useState<boolean>(false); // Tracks submission + polling
  const [jobError, setJobError] = useState<string>("");
  const [jobResults, setJobResults] = useState<JobResultsResponse | null>(null);
  const [loadingResults, setLoadingResults] = useState<boolean>(false);
  const [currentResultsPageToken, setCurrentResultsPageToken] = useState<string | null>(null);
  const [resultsError, setResultsError] = useState<string>("");

  // --- Polling Ref ---
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const POLLING_INTERVAL_MS = 3000; // Poll every 3 seconds

  // --- Utility to parse errors ---
  const getErrorMessage = (error: any): string => {
    if (axios.isAxiosError(error)) {
      const errorData = error.response?.data;
      if (errorData && typeof errorData === 'object' && 'detail' in errorData) {
        return String(errorData.detail); // FastAPI default error format
      } else if (typeof errorData === 'string') {
        return errorData;
      } else {
        return error.message; // Fallback
      }
    } else if (error instanceof Error) {
      return error.message;
    }
    return "An unknown error occurred.";
  };

  // --- Stop Polling ---
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log("Polling stopped.");
    }
     // Keep isRunningJob true until results are loaded or definitively failed
  }, []);

  // --- Fetch Job Status ---
  const fetchJobStatus = useCallback(async (currentJobId: string, loc: string) => {
    console.log(`Polling status for job: ${currentJobId} in ${loc}`);
    setJobError(""); // Clear previous status errors
    try {
      const response = await axios.get<JobStatusResponse>(`/api/bigquery/jobs/${currentJobId}?location=${loc}`);
      const statusData = response.data;
      setJobStatus(statusData);
      console.log("Job Status:", statusData.state);

      if (statusData.state === 'DONE') {
        stopPolling();
        setIsRunningJob(false); // Job finished (success or fail)
        if (statusData.error_result) {
          setJobError(`Job failed: ${statusData.error_result.message || statusData.error_result.reason || 'Unknown reason'}`);
          setJobResults(null); // Clear any old results
        } else {
          setJobError(""); // Clear error on success
          // Determine if results should be fetched
          // Simple check: statement type is SELECT or destination table exists (backend provides this implicitly via /results endpoint)
          if (statusData.statement_type === 'SELECT' || statusData.statement_type === undefined /* older BQ might not return type */) {
             console.log("Job done, fetching results...");
             fetchJobResults(currentJobId, loc); // Fetch initial page
          } else {
             console.log(`Job done (Type: ${statusData.statement_type}). No results expected.`);
             setJobResults({ rows: [], total_rows_in_result_set: statusData.num_dml_affected_rows ?? 0, schema: [] }); // Show affected rows if DML
          }
        }
      } else {
        // Still PENDING or RUNNING, continue polling
        setIsRunningJob(true); // Ensure it stays true while polling
      }
    } catch (error: any) {
      console.error("Error fetching job status:", error);
      const message = getErrorMessage(error);
      // Decide if polling should stop on error
      if (error.response?.status === 404) {
         setJobError(`Error fetching status: Job ${currentJobId} not found.`);
         stopPolling();
         setIsRunningJob(false);
      } else {
          setJobError(`Error fetching status: ${message}. Retrying...`);
          // Continue polling for transient errors? Or stop after N failures?
      }
      // Keep isRunningJob potentially true if retrying polling
    }
  }, [stopPolling]); // Add fetchJobResults when defined


  // --- Fetch Job Results (Paginated) ---
   const fetchJobResults = useCallback(async (currentJobId: string, loc: string, pageToken?: string | null) => {
    console.log(`Fetching results for job ${currentJobId}, pageToken: ${pageToken}`);
    setLoadingResults(true);
    setResultsError("");
    try {
        const params = new URLSearchParams();
        params.append('location', loc);
        params.append('max_results', '100'); // Configurable result page size
        if (pageToken) {
            params.append('page_token', pageToken);
        }

        const response = await axios.get<JobResultsResponse>(`/api/bigquery/jobs/${currentJobId}/results?${params.toString()}`);

        // If fetching first page, replace results. If fetching subsequent pages, append (optional, usually replace is simpler UX).
        // For simplicity, we'll replace results on each page fetch.
        setJobResults(response.data);
        setCurrentResultsPageToken(response.data.next_page_token ?? null);

    } catch (error) {
        console.error("Error fetching job results:", error);
        const message = getErrorMessage(error);
        setResultsError(`Failed to fetch results: ${message}`);
        setJobResults(null); // Clear results on error
    } finally {
        setLoadingResults(false);
    }
}, []); // Empty dependency array, uses arguments


  // --- Start Polling Effect ---
  useEffect(() => {
    if (jobId && jobLocation && isRunningJob && !pollingIntervalRef.current) {
       // Immediately fetch status once after submission
       fetchJobStatus(jobId, jobLocation);
       // Then start interval
       pollingIntervalRef.current = setInterval(() => {
        fetchJobStatus(jobId, jobLocation);
      }, POLLING_INTERVAL_MS);
      console.log("Polling started.");
    }

    // Cleanup function to stop polling when component unmounts or jobId changes
    return () => {
      stopPolling();
    };
  }, [jobId, jobLocation, isRunningJob, fetchJobStatus, stopPolling]);


  // --- Submit SQL Job ---
  const submitSqlJob = async () => {
    console.log("Submitting SQL Job:", sql);
    stopPolling(); // Stop any previous polling
    setJobId(null);
    setJobLocation(null);
    setJobStatus(null);
    setJobError("");
    setJobResults(null);
    setResultsError("");
    setIsRunningJob(true); // Set immediately for UX feedback

    try {
      const response = await axios.post<JobSubmitResponse>("/api/bigquery/jobs", { sql });
      const { job_id, location, state } = response.data;
      console.log("Job Submitted:", response.data);
      setJobId(job_id);
      setJobLocation(location);
       // Set initial status (optional, polling will update)
       setJobStatus({ job_id, location, state: state as 'PENDING' | 'RUNNING' | 'DONE' });
       // isRunningJob remains true, effect hook will start polling

    } catch (error: any) {
      console.error("Error submitting job:", error);
      const message = getErrorMessage(error);
      setJobError(`Failed to submit job: ${message}`);
      setIsRunningJob(false); // Submission failed, stop running state
      setJobId(null);
      setJobLocation(null);
    }
  };


  // --- Table Fetching and Handling (similar to previous version) ---
   const fetchTables = async () => {
        setLoadingTables(true);
        setListTablesError("");
        try {
            const url = `http://localhost:8000/api/bigquery/tables?dataset_id=${encodeURIComponent(datasetId)}`;
            const response = await axios.get<TableInfo[]>(url); // Assuming backend returns TableInfo[]
            setTables(response.data);
            setFilteredTables(response.data);
        } catch (err: any) {
            console.error("Error fetching tables:", err);
            const message = getErrorMessage(err);
            setListTablesError(`Failed to load table list: ${message}`);
        } finally {
            setLoadingTables(false);
        }
    };

    const handleTableSelect = async (tableId: string) => {
        // Stop any running SQL job processing when selecting a table
        stopPolling();
        setIsRunningJob(false);
        setJobId(null);
        setJobLocation(null);
        setJobStatus(null);
        setJobError("");
        setJobResults(null);
        setResultsError("");

        // Proceed with loading table preview
        setSelectedTableId(tableId);
        setLoadingPreview(true);
        setPreviewError("");
        setPreviewRows([]);
        setPreviewColumns([]);
        setCurrentPage(1); // Reset preview page
        setTableStats(null);

        // Update SQL editor with a default query for the selected table
        setSql(`SELECT *\nFROM \`${datasetId}.${tableId}\`\nLIMIT 100;`);

        try {
            // Fetch table data (remains synchronous for preview)
             const url = `/api/bigquery/table-data?dataset_id=${encodeURIComponent(
                datasetId
             )}&table_id=${encodeURIComponent(tableId)}&page=${currentPage}&limit=${rowsPerPage}`; // Backend needs to handle this correctly

            const response = await axios.get(url); // Expecting { rows: [], totalRows: number, stats: {...} }

            const data = response.data;
            let rows: RowData[] = data?.rows ?? (Array.isArray(data) ? data : []);
            let totalCount: number = data?.totalRows ?? rows.length;
            let fetchedStats: TableStats | null = data?.stats ?? null;

            setPreviewRows(rows);
            setTotalRows(totalCount);
            setTableStats(fetchedStats);

            if (rows.length > 0) {
                setPreviewColumns(Object.keys(rows[0]));
            } else {
                setPreviewColumns([]);
            }

        } catch (err: any) {
            console.error("Error fetching table data:", err);
            const message = getErrorMessage(err);
            setPreviewError(`Failed to load table data: ${message}`);
        } finally {
            setLoadingPreview(false);
        }
    };

     const handlePageChange = async (newPage: number) => {
       if (!selectedTableId || newPage === currentPage) return;
       // This is for TABLE PREVIEW pagination, not job results pagination
        setLoadingPreview(true);
        setPreviewError("");
        try {
            const url = `/api/bigquery/table-data?dataset_id=${encodeURIComponent(
                datasetId
            )}&table_id=${encodeURIComponent(
                selectedTableId
            )}&page=${newPage}&limit=${rowsPerPage}`;

            const response = await axios.get(url);
            const data = response.data;
            let rows: RowData[] = data?.rows ?? (Array.isArray(data) ? data : []);

            setPreviewRows(rows);
            setCurrentPage(newPage); // Update page number

            if (rows.length > 0 && previewColumns.length === 0) {
                setPreviewColumns(Object.keys(rows[0]));
            }
        } catch (err: any) {
            console.error("Error fetching page data:", err);
             const message = getErrorMessage(err);
            setPreviewError(`Failed to load page data: ${message}`);
        } finally {
            setLoadingPreview(false);
        }
    };

    const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newRowsPerPage = parseInt(e.target.value, 10);
      setRowsPerPage(newRowsPerPage);
      setCurrentPage(1);
      if (selectedTableId) {
         handleTableSelect(selectedTableId); // Refetch preview with new limit
      }
    };

     const handleSort = (columnName: string) => {
       // Sorts the *preview* rows, not job results
        let direction: "asc" | "desc" = "asc";
        if (sortConfig?.key === columnName && sortConfig.direction === "asc") {
            direction = "desc";
        }
        setSortConfig({ key: columnName, direction });

        const sortedRows = [...previewRows].sort((a, b) => {
            // Basic sort, enhance as needed for types
            if (a[columnName] < b[columnName]) return direction === "asc" ? -1 : 1;
            if (a[columnName] > b[columnName]) return direction === "asc" ? 1 : -1;
            return 0;
        });
        setPreviewRows(sortedRows);
    };


  // --- Load initial tables ---
  useEffect(() => {
    fetchTables();
  }, []);

  // --- Filter tables effect ---
  useEffect(() => {
    const lowerQuery = searchQuery.toLowerCase();
    setFilteredTables(
      tables.filter((table) => table.tableId.toLowerCase().includes(lowerQuery))
    );
  }, [searchQuery, tables]);

  // --- Helper functions (formatBytes, formatDate) ---
  const formatBytes = (bytes: number | null | undefined): string => {
    // ... (implementation from previous version is fine)
     if (bytes === null || bytes === undefined || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };
  const formatDate = (dateString: string | null | undefined): string => {
    // ... (implementation from previous version is fine)
     if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleString();
    } catch (e) {
      return dateString; // Fallback
    }
  };

  // --- Render Functions ---

   const renderPagination = () => {
     // Renders pagination for the TABLE PREVIEW
    const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
    // ... (JSX from previous version is mostly fine, adapt if needed)
     return (
      <div className="flex items-center justify-between mt-4 text-sm">
        {/* Rows per page selector */}
        <div className="flex items-center space-x-2">
          <span>Rows per page:</span>
          <select
            value={rowsPerPage}
            onChange={handleRowsPerPageChange}
            className="border rounded px-2 py-1 bg-white"
            disabled={loadingPreview}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        {/* Page navigation */}
        <div className="flex items-center space-x-1">
           <button onClick={() => handlePageChange(1)} disabled={currentPage === 1 || loadingPreview} className="px-2 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed">«</button>
           <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1 || loadingPreview} className="px-2 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed">‹</button>
           <span className="px-2"> Page {currentPage} of {totalPages || 1} </span>
           <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages || loadingPreview} className="px-2 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed">›</button>
           <button onClick={() => handlePageChange(totalPages)} disabled={currentPage >= totalPages || loadingPreview} className="px-2 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed">»</button>
        </div>

         {/* Row count display */}
        <div className="text-gray-600">
           Showing {previewRows.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0}-
          {Math.min(currentPage * rowsPerPage, totalRows)} of {totalRows.toLocaleString()} rows
        </div>
      </div>
    );
  };

  const renderJobStatus = () => {
     if (!jobId && !isRunningJob && !jobError) return null; // No job activity

     return (
       <div className="mb-4 p-3 border rounded-lg bg-gray-50 text-sm shadow-sm">
         <h3 className="font-semibold text-gray-700 mb-2">Job Status</h3>
         {jobId && <p className="text-xs text-gray-500 mb-1 break-all">Job ID: {jobId} ({jobLocation})</p>}

         {isRunningJob && !jobStatus && <p className="text-blue-600">Submitting job...</p>}

         {jobStatus && (
             <div className="space-y-1">
                 <p>State: <span className={`font-medium ${jobStatus.state === 'DONE' ? 'text-green-600' : jobStatus.state === 'RUNNING' ? 'text-blue-600' : 'text-yellow-600'}`}>{jobStatus.state}</span></p>
                 {jobStatus.statement_type && <p>Type: <span className="font-mono text-xs bg-gray-200 px-1 py-0.5 rounded">{jobStatus.statement_type}</span></p>}
                 {jobStatus.start_time && <p>Started: {formatDate(jobStatus.start_time)}</p>}
                 {jobStatus.end_time && <p>Ended: {formatDate(jobStatus.end_time)}</p>}
                 {jobStatus.total_bytes_processed !== null && jobStatus.total_bytes_processed !== undefined && <p>Bytes Processed: {formatBytes(jobStatus.total_bytes_processed)}</p>}
                  {/* Display DML affected rows if available and job is DONE without error */}
                {jobStatus.state === 'DONE' && !jobStatus.error_result && jobStatus.num_dml_affected_rows !== null && jobStatus.num_dml_affected_rows !== undefined && (
                   <p className="text-green-700 font-medium">{jobStatus.num_dml_affected_rows.toLocaleString()} row(s) affected.</p>
                )}
             </div>
         )}

         {jobError && (
            <div className="mt-2 text-red-600 border-t pt-2">
                <p className="font-semibold">Error:</p>
                <p className="text-xs break-words">{jobError}</p>
            </div>
         )}
         {isRunningJob && jobStatus?.state !== 'DONE' && (
             <div className="mt-2 flex items-center text-blue-600">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
                <span>Checking status...</span>
            </div>
         )}
       </div>
     );
  };

  const renderJobResults = () => {
     // Only render if a job finished successfully *and* produced results
     if (!jobResults || jobError || isRunningJob || resultsError) return null;

     const { rows = [], schema = [], total_rows_in_result_set, next_page_token } = jobResults;

     if (!loadingResults && rows.length === 0 && jobStatus?.statement_type === 'SELECT') {
         return <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg">Query completed successfully, but returned no results.</div>;
     }
       // Handle case where job was DML/DDL and we showed affected rows in status
      if (rows.length === 0 && jobStatus?.statement_type !== 'SELECT' && jobStatus?.statement_type !== undefined) {
          return null; // Success message handled in status render
      }


     // Determine columns from schema if available, otherwise from first row
     const columns = schema.length > 0 ? schema.map(f => f.name) : (rows.length > 0 ? Object.keys(rows[0]) : []);

     return (
       <div className="mb-6">
         <h2 className="text-lg font-semibold text-gray-800 mb-2">Query Results</h2>
          {total_rows_in_result_set !== undefined && total_rows_in_result_set !== null && (
              <p className="text-sm text-gray-600 mb-2">Total rows in result set: {total_rows_in_result_set.toLocaleString()}</p>
          )}
          {loadingResults && (
             <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                Loading results...
            </div>
          )}
         {!loadingResults && resultsError && (
             <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                 <strong className="font-bold">Error loading results:</strong>
                 <span className="block sm:inline ml-1">{resultsError}</span>
             </div>
         )}
         {!loadingResults && !resultsError && rows.length > 0 && (
           <>
             <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm mb-4 max-h-[60vh]"> {/* Max height */}
               <table className="min-w-full divide-y divide-gray-200 text-sm">
                 <thead className="bg-gray-100 sticky top-0 z-10">
                   <tr>
                     {columns.map((colName, idx) => (
                       <th key={idx} className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap">
                         {colName}
                         {schema[idx] && <span className="ml-1 text-gray-400 font-normal">({schema[idx].type})</span>}
                       </th>
                     ))}
                   </tr>
                 </thead>
                 <tbody className="bg-white divide-y divide-gray-200">
                   {rows.map((row, rowIndex) => (
                     <tr key={rowIndex} className="hover:bg-gray-50">
                       {columns.map((colName, colIndex) => (
                         <td key={colIndex} className="px-4 py-2 whitespace-nowrap max-w-xs truncate" title={String(row[colName] ?? "")}>
                           {row[colName] === null
                             ? <span className="text-gray-400 italic">null</span>
                             : String(row[colName] ?? "")}
                         </td>
                       ))}
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
              {/* Basic Pagination for Results */}
              {next_page_token && jobId && jobLocation && (
                   <button
                      onClick={() => fetchJobResults(jobId, jobLocation!, next_page_token)}
                      disabled={loadingResults}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                       Load More Results
                   </button>
              )}
           </>
         )}
       </div>
     );
   };

  // --- Main Render ---
  return (
    <div className="bg-white rounded-lg shadow-lg max-h-screen flex flex-col"> {/* Max height */}
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
        <h1 className="text-xl font-semibold text-gray-800">BigQuery Explorer</h1>
        <p className="text-gray-600 mt-1 text-sm">Dataset: {datasetId}</p>
      </div>

      {/* Main content Area */}
      <div className="flex flex-grow min-h-0"> {/* flex-grow and min-h-0 for scrolling */}
        {/* Sidebar */}
        <div className="lg:w-1/4 border-r border-gray-200 flex flex-col flex-shrink-0">
          <div className="p-4 border-b">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search tables..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pl-10"
              />
               <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
            </div>
          </div>
          <div className="p-4 flex-grow overflow-y-auto"> {/* Scrollable table list */}
             <div className="font-medium text-gray-700 mb-2 flex justify-between items-center">
              <span>Tables</span>
              <span className="text-sm text-gray-500">({filteredTables.length})</span>
            </div>
            {/* Table List Content */}
            {loadingTables ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div></div>
            ) : listTablesError ? (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                 <strong className="font-bold">Error!</strong> <span className="block sm:inline">{listTablesError}</span>
                 <button onClick={fetchTables} className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium block">Try Again</button>
              </div>
            ) : filteredTables.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No tables found{searchQuery && ` matching "${searchQuery}"`}.</div>
            ) : (
              <ul className="divide-y divide-gray-200 -mx-4">
                {filteredTables.map((table) => (
                  <li key={table.tableId} onClick={() => handleTableSelect(table.tableId)}
                      className={`px-4 py-2 cursor-pointer hover:bg-gray-100 transition-colors duration-150 ease-in-out truncate ${ selectedTableId === table.tableId ? "bg-blue-50 border-l-4 border-blue-500 font-semibold text-blue-700" : "text-gray-800" }`} >
                    {table.tableId}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right Pane */}
        <div className="lg:w-3/4 flex flex-col overflow-y-auto"> {/* Scrollable right pane */}
          {/* SQL Editor */}
          <div className="p-4 border-b bg-gray-50 flex-shrink-0">
            <h2 className="text-base font-semibold mb-2 text-gray-700">SQL Editor</h2>
            <textarea
              className="w-full p-2 border border-gray-600 rounded font-mono text-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 bg-gray-800 text-gray-100 placeholder-gray-500 caret-white"
              rows={6} // Adjust rows as needed
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              placeholder="-- Enter your BigQuery SQL query or script here..."
              disabled={isRunningJob}
            />
            <div className="mt-2 flex justify-end">
              <button
                className={`px-4 py-2 ${isRunningJob ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded text-sm font-medium transition duration-150 ease-in-out`}
                onClick={submitSqlJob}
                disabled={isRunningJob || !sql.trim()}
              >
                {isRunningJob ? 'Running Job...' : 'Run Query'}
              </button>
            </div>
          </div>

          {/* Status & Results Area */}
          <div className="p-4 flex-grow"> {/* Takes remaining space */}
            {renderJobStatus()}
            {renderJobResults()}

             {/* Show Table Preview only if no active/completed job results are displayed */}
             {!jobId && !jobResults && selectedTableId && (
                 <>
                  <h2 className="text-lg font-semibold text-gray-800 mb-2 mt-4 border-t pt-4">
                    Table Preview: {selectedTableId}
                  </h2>
                   {/* Table Stats */}
                    {tableStats && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-sm">
                            <div className="bg-gray-50 p-3 rounded-lg shadow-sm"><div className="text-gray-500 uppercase text-xs font-semibold tracking-wider">Rows</div><div className="text-lg font-semibold text-gray-800 mt-1">{tableStats.rowCount?.toLocaleString() ?? 'N/A'}</div></div>
                            <div className="bg-gray-50 p-3 rounded-lg shadow-sm"><div className="text-gray-500 uppercase text-xs font-semibold tracking-wider">Size</div><div className="text-lg font-semibold text-gray-800 mt-1">{formatBytes(tableStats.sizeBytes)}</div></div>
                            <div className="bg-gray-50 p-3 rounded-lg shadow-sm"><div className="text-gray-500 uppercase text-xs font-semibold tracking-wider">Last Modified</div><div className="text-lg font-semibold text-gray-800 mt-1">{formatDate(tableStats.lastModified)}</div></div>
                        </div>
                    )}
                   {/* Preview Loading/Error/Data */}
                    {loadingPreview ? (
                        <div className="flex justify-center items-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>Loading Preview...</div>
                    ) : previewError ? (
                         <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert"><strong className="font-bold">Error!</strong><span className="block sm:inline ml-1">{previewError}</span><button onClick={() => handleTableSelect(selectedTableId)} className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium block">Try Again</button></div>
                    ) : previewRows.length === 0 ? (
                         <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">Table preview is empty.</div>
                    ) : (
                        <>
                           <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm max-h-[50vh]"> {/* Max height */}
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                  <thead className="bg-gray-100 sticky top-0 z-10">
                                    <tr>{previewColumns.map(col => <th key={col} onClick={() => handleSort(col)} className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200 whitespace-nowrap"><div className="flex items-center">{col}{sortConfig?.key === col && <span className="ml-1">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>}</div></th>)}</tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">{previewRows.map((row, idx) => <tr key={idx} className="hover:bg-gray-50">{previewColumns.map(col => <td key={col} className="px-4 py-2 whitespace-nowrap max-w-xs truncate" title={String(row[col] ?? "")}>{row[col] === null ? <span className="text-gray-400 italic">null</span> : String(row[col] ?? "")}</td>)}</tr>)}</tbody>
                                </table>
                           </div>
                           {renderPagination()}
                        </>
                    )}
                 </>
             )}

            {/* Initial placeholder */}
            {!jobId && !jobResults && !selectedTableId && (
                 <div className="flex flex-col items-center justify-center h-64 text-gray-500 mt-10">
                     <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                     <p className="text-lg">Enter a query or select a table to begin.</p>
                 </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BigQueryTableViewer;