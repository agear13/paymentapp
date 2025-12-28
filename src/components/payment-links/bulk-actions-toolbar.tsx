/**
 * Bulk Actions Toolbar
 * Shows available actions when items are selected
 */

'use client';

import * as React from 'react';
import { X, Download, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export interface BulkActionsToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onExport?: () => void;
  onBulkCancel?: () => void;
  className?: string;
}

export const BulkActionsToolbar: React.FC<BulkActionsToolbarProps> = ({
  selectedCount,
  onClearSelection,
  onExport,
  onBulkCancel,
  className,
}) => {
  if (selectedCount === 0) return null;

  return (
    <Card className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 shadow-lg ${className || ''}`}>
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {selectedCount} {selectedCount === 1 ? 'item' : 'items'} selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="h-7 px-2"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="h-6 w-px bg-border" />

        <div className="flex items-center gap-2">
          {onExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              className="h-8"
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          )}
          
          {onBulkCancel && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onBulkCancel}
              className="h-8"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Cancel Selected
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};













