import React, { useEffect, useState } from "react";
import axios from "axios";

interface TableInfo {
  tableId: string;
  rowCount?: number;
  sizeBytes?: number;
  lastModified?: string;
}

interface RowData {
  [col: string]: any;
}

interface TableStats {
  rowCount: number;
  sizeBytes: number;
  lastModified: string;
}

const BigQueryTableViewer: React.FC = () => {
  const datasetId = "crafty-tracker-457215-g6.sample78600";

  // State management
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [filteredTables, setFilteredTables] = useState<TableInfo[]>([]);
  const [error, setError] = useState<string>("");
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [previewColumns, setPreviewColumns] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<RowData[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loadingTables, setLoadingTables] = useState<boolean>(true);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [tableStats, setTableStats] = useState<TableStats | null>(null);

  // Load tables on component mount
  useEffect(() => {
    fetchTables();
  }, []);

  // Filter tables when search query changes
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredTables(tables);
    } else {
      const filtered = tables.filter((table) =>
        table.tableId.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTables(filtered);
    }
  }, [searchQuery, tables]);

  const fetchTables = async () => {
    setLoadingTables(true);
    setError("");
    try {
      // For debugging purposes, log the request URL
      const url = `/api/bigquery/tables?dataset_id=${encodeURIComponent(datasetId)}`;
      console.log("Fetching tables from:", url);
      
      const response = await axios.get<TableInfo[]>(url);
      console.log("Tables response:", response.data);
      
      setTables(response.data);
      setFilteredTables(response.data);
    } catch (err) {
      console.error("Error fetching tables:", err);
      setError("Failed to load table list. Please try again later.");
    } finally {
      setLoadingTables(false);
    }
  };

  const handleTableSelect = async (tableId: string) => {
    setError("");
    setSelectedTableId(tableId);
    setLoadingPreview(true);
    setPreviewRows([]);
    setPreviewColumns([]);
    setCurrentPage(1);
    setTableStats(null);

    try {
      // For debugging purposes, log the request URL
      const url = `/api/bigquery/table-data?dataset_id=${encodeURIComponent(
        datasetId
      )}&table_id=${encodeURIComponent(
        tableId
      )}&page=${currentPage}&limit=${rowsPerPage}`;
      
      console.log("Fetching table data from:", url);
      
      // Fetch data with pagination parameters
      const response = await axios.get(url);
      
      // Log the raw response for debugging
      console.log("Table data response:", response);
      
      // Get the response data - handle both standard response and axios wrapping
      const data = response.data;
      console.log("Extracted data:", data);
      
      // Look for rows in the response structure - check different possible paths
      let rows: any[] = [];
      if (Array.isArray(data)) {
        // If the response is directly an array
        rows = data;
        console.log("Data is directly an array of rows");
      } else if (data && Array.isArray(data.rows)) {
        // If the response has a rows property that is an array
        rows = data.rows;
        console.log("Found rows array in data.rows");
      } else if (data && typeof data === 'object') {
        // Handle case where API responds with first level of data
        // Some APIs might return the rows directly as an object with no wrapper
        if (Object.keys(data).length > 0 && !('rows' in data)) {
          rows = [data];
          console.log("Data appears to be a single row object");
        }
      }
      
      console.log("Extracted rows:", rows);
      setPreviewRows(rows);
      
      // Extract total count - default to rows length if not provided
      const totalCount = data && typeof data.totalRows === 'number' 
        ? data.totalRows 
        : (data && typeof data.total === 'number' ? data.total : rows.length);
      
      setTotalRows(totalCount);
      console.log("Set total rows to:", totalCount);
      
      // Safely extract stats if available
      if (data && data.stats) {
        setTableStats(data.stats);
        console.log("Found and set table stats");
      } else {
        // Create default stats from available data
        const defaultStats = {
          rowCount: totalCount,
          sizeBytes: data?.sizeBytes || data?.size || 0,
          lastModified: data?.lastModified || new Date().toISOString()
        };
        setTableStats(defaultStats);
        console.log("Set default table stats:", defaultStats);
      }
      
      // Set columns based on the first row, if any rows exist
      if (rows && rows.length > 0) {
        const columns = Object.keys(rows[0]);
        console.log("Setting columns from first row:", columns);
        setPreviewColumns(columns);
      } else {
        console.log("No rows to extract columns from");
        setPreviewColumns([]);
      }
    } catch (err) {
      console.error("Error fetching table data:", err);
      setError("Failed to load table data. Please try again later.");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handlePageChange = async (newPage: number) => {
    if (!selectedTableId) return;
    
    setLoadingPreview(true);
    setCurrentPage(newPage);
    
    try {
      const url = `/api/bigquery/table-data?dataset_id=${encodeURIComponent(
        datasetId
      )}&table_id=${encodeURIComponent(
        selectedTableId
      )}&page=${newPage}&limit=${rowsPerPage}`;
      
      console.log("Fetching page data from:", url);
      const response = await axios.get(url);
      console.log("Page data response:", response);
      
      // Get the response data
      const data = response.data;
      
      // Extract rows with fallbacks for different API response structures
      let rows: any[] = [];
      if (Array.isArray(data)) {
        rows = data;
      } else if (data && Array.isArray(data.rows)) {
        rows = data.rows;
      } else if (data && typeof data === 'object' && !('rows' in data)) {
        rows = [data];
      }
      
      setPreviewRows(rows);
      
      // Extract total count
      const totalCount = data && typeof data.totalRows === 'number' 
        ? data.totalRows 
        : (data && typeof data.total === 'number' ? data.total : rows.length);
      
      setTotalRows(totalCount);
      
      // Update columns only if we don't have them yet
      if (rows.length > 0 && previewColumns.length === 0) {
        setPreviewColumns(Object.keys(rows[0]));
      }
    } catch (err) {
      console.error("Error fetching page data:", err);
      setError("Failed to load page data. Please try again later.");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRowsPerPage = parseInt(e.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setCurrentPage(1);
    
    if (selectedTableId) {
      // Refetch with new pagination parameters
      handleTableSelect(selectedTableId);
    }
  };

  const handleSort = (columnName: string) => {
    let direction: "asc" | "desc" = "asc";
    
    if (
      sortConfig &&
      sortConfig.key === columnName &&
      sortConfig.direction === "asc"
    ) {
      direction = "desc";
    }
    
    setSortConfig({ key: columnName, direction });
    
    // Sort the preview rows
    const sortedRows = [...previewRows].sort((a, b) => {
      if (a[columnName] === null) return 1;
      if (b[columnName] === null) return -1;
      
      if (a[columnName] < b[columnName]) {
        return direction === "asc" ? -1 : 1;
      }
      if (a[columnName] > b[columnName]) {
        return direction === "asc" ? 1 : -1;
      }
      return 0;
    });
    
    setPreviewRows(sortedRows);
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "Unknown";
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + " " + date.toLocaleTimeString();
    } catch (e) {
      return dateString;
    }
  };

  const renderPagination = () => {
    const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
    
    return (
      <div className="flex items-center justify-between mt-4 text-sm">
        <div className="flex items-center space-x-2">
          <span>Rows per page:</span>
          <select
            value={rowsPerPage}
            onChange={handleRowsPerPageChange}
            className="border rounded px-2 py-1"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        
        <div className="flex items-center space-x-1">
          <button
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            &laquo;
          </button>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            &lsaquo;
          </button>
          
          <span className="px-2">
            Page {currentPage} of {totalPages || 1}
          </span>
          
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || totalPages === 0}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            &rsaquo;
          </button>
          <button
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages || totalPages === 0}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            &raquo;
          </button>
        </div>
        
        <div className="text-gray-600">
          Showing {previewRows.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0}-
          {Math.min(currentPage * rowsPerPage, totalRows)} of {totalRows} rows
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-800">BigQuery Table Explorer</h1>
        <p className="text-gray-600 mt-1">Dataset: {datasetId}</p>
      </div>
      
      {/* Main content */}
      <div className="flex flex-col lg:flex-row">
        {/* Sidebar with tables list */}
        <div className="lg:w-1/4 border-r border-gray-200">
          <div className="p-4">
            <div className="mb-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search tables..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <svg
                  className="absolute right-3 top-2.5 h-5 w-5 text-gray-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>

            <div className="font-medium text-gray-700 mb-2 flex justify-between items-center">
              <span>Tables</span>
              <span className="text-sm text-gray-500">
                {filteredTables.length} {filteredTables.length === 1 ? "table" : "tables"}
              </span>
            </div>

            {loadingTables ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : error && !selectedTableId ? (
              <div className="bg-red-50 text-red-600 p-3 rounded-md">
                <div className="font-medium">Error</div>
                <div className="text-sm">{error}</div>
                <button
                  onClick={fetchTables}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Try Again
                </button>
              </div>
            ) : filteredTables.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No tables found
                {searchQuery && (
                  <>
                    <br />
                    matching "{searchQuery}"
                  </>
                )}
              </div>
            ) : (
              <div className="overflow-y-auto max-h-96 -mx-4">
                <ul className="divide-y divide-gray-200">
                  {filteredTables.map((table) => (
                    <li
                      key={table.tableId}
                      onClick={() => handleTableSelect(table.tableId)}
                      className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedTableId === table.tableId
                          ? "bg-blue-50 border-l-4 border-blue-500"
                          : ""
                      }`}
                    >
                      <div className="font-medium text-gray-800 truncate">
                        {table.tableId}
                      </div>
                      {table.rowCount && (
                        <div className="text-xs text-gray-500 mt-1">
                          {table.rowCount.toLocaleString()} rows •{" "}
                          {formatBytes(table.sizeBytes || 0)}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        
        {/* Table preview area */}
        <div className="lg:w-3/4 p-6">
          {selectedTableId ? (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-2">
                  {selectedTableId}
                </h2>
                
                {tableStats && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-sm text-gray-500">Rows</div>
                      <div className="text-lg font-semibold">
                        {tableStats.rowCount.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-sm text-gray-500">Size</div>
                      <div className="text-lg font-semibold">
                        {formatBytes(tableStats.sizeBytes)}
                      </div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-sm text-gray-500">Last Modified</div>
                      <div className="text-lg font-semibold">
                        {formatDate(tableStats.lastModified)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {loadingPreview ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
              ) : error ? (
                <div className="bg-red-50 text-red-600 p-4 rounded-md">
                  <div className="font-medium">Error</div>
                  <div>{error}</div>
                  <button
                    onClick={() => handleTableSelect(selectedTableId)}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Try Again
                  </button>
                </div>
              ) : (!previewRows || previewRows.length === 0) ? (
                <div className="text-center py-12 text-gray-500">
                  <p>This table has no data</p>
                  <button 
                    onClick={() => handleTableSelect(selectedTableId)}
                    className="mt-4 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md text-sm font-medium"
                  >
                    Refresh Data
                  </button>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {previewColumns.map((column) => (
                            <th
                              key={column}
                              onClick={() => handleSort(column)}
                              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            >
                              <div className="flex items-center">
                                <span>{column}</span>
                                {sortConfig?.key === column && (
                                  <span className="ml-1">
                                    {sortConfig.direction === "asc" ? "▲" : "▼"}
                                  </span>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {previewRows.map((row, rowIndex) => (
                          <tr
                            key={rowIndex}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            {previewColumns.map((column) => (
                              <td
                                key={`${rowIndex}-${column}`}
                                className="px-4 py-2 whitespace-nowrap text-sm text-gray-700"
                              >
                                {row[column] === null
                                  ? <span className="text-gray-400 italic">null</span>
                                  : String(row[column] ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {renderPagination()}
                </>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <svg
                className="w-16 h-16 text-gray-300 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                ></path>
              </svg>
              <p className="text-lg">Select a table to view its data</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BigQueryTableViewer;