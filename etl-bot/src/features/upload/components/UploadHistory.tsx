import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { HistoryItem } from '../types';

export function UploadHistory() {
  // Simulate history items
  const [historyItems] = useState<HistoryItem[]>([
    {
      id: '1',
      filename: 'sales_report_2024.xlsx',
      processedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      recordsCount: 1245,
      status: 'success'
    },
    {
      id: '2',
      filename: 'employee_data.xlsx',
      processedAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
      recordsCount: 85,
      status: 'success'
    },
    {
      id: '3',
      filename: 'inventory_q2.xlsx',
      processedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      recordsCount: 0,
      status: 'error'
    }
  ]);
  
  const formatTime = (date: Date) => {
    return format(date, 'HH:mm');
  };
  
  const formatDate = (date: Date) => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Today
    if (date.toDateString() === now.toDateString()) {
      return 'Today';
    }
    
    // Yesterday
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    // Other dates
    return format(date, 'MMM d, yyyy');
  };
  
  // Group history items by date
  const groupedHistory = historyItems.reduce<Record<string, HistoryItem[]>>((groups, item) => {
    const dateKey = formatDate(item.processedAt);
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(item);
    return groups;
  }, {});
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          Upload History
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        {Object.keys(groupedHistory).length > 0 ? (
          <div className="space-y-4">
            {Object.entries(groupedHistory).map(([date, items]) => (
              <div key={date}>
                <h4 className="text-sm font-semibold mb-2">{date}</h4>
                <div className="space-y-2">
                  {items.map(item => (
                    <div 
                      key={item.id}
                      className="text-sm p-2 rounded-md bg-muted/40 border flex justify-between items-start"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {item.status === 'success' ? (
                            <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                          )}
                          <span className="font-medium truncate" title={item.filename}>
                            {item.filename}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{formatTime(item.processedAt)}</span>
                          {item.status === 'success' && (
                            <>
                              <span>•</span>
                              <span>{item.recordsCount} records</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No upload history yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}