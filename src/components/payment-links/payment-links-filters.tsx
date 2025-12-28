/**
 * Payment Links Filters Component
 * Filter controls for payment links list
 */

'use client';

import * as React from 'react';
import { Search, X, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CurrencySelect } from './currency-select';
import { cn } from '@/lib/utils';

export interface PaymentLinksFiltersProps {
  filters: {
    status?: string;
    currency?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    amountMin?: number;
    amountMax?: number;
  };
  onFiltersChange: (filters: any) => void;
  onReset: () => void;
}

export const PaymentLinksFilters: React.FC<PaymentLinksFiltersProps> = ({
  filters,
  onFiltersChange,
  onReset,
}) => {
  const handleStatusChange = (status: string) => {
    onFiltersChange({
      ...filters,
      status: status === 'all' ? undefined : status,
    });
  };

  const handleCurrencyChange = (currency: string) => {
    onFiltersChange({
      ...filters,
      currency: currency === 'all' ? undefined : currency,
    });
  };

  const handleSearchChange = (search: string) => {
    onFiltersChange({
      ...filters,
      search: search || undefined,
    });
  };

  const handleDateFromChange = (date: Date | undefined) => {
    onFiltersChange({
      ...filters,
      dateFrom: date ? date.toISOString() : undefined,
    });
  };

  const handleDateToChange = (date: Date | undefined) => {
    onFiltersChange({
      ...filters,
      dateTo: date ? date.toISOString() : undefined,
    });
  };

  const handleAmountMinChange = (value: string) => {
    const num = parseFloat(value);
    onFiltersChange({
      ...filters,
      amountMin: !isNaN(num) && num > 0 ? num : undefined,
    });
  };

  const handleAmountMaxChange = (value: string) => {
    const num = parseFloat(value);
    onFiltersChange({
      ...filters,
      amountMax: !isNaN(num) && num > 0 ? num : undefined,
    });
  };

  const hasActiveFilters = 
    filters.status || 
    filters.currency || 
    filters.search || 
    filters.dateFrom || 
    filters.dateTo || 
    filters.amountMin !== undefined || 
    filters.amountMax !== undefined;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Row 1: Search, Status, Currency */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {/* Search */}
            <div className="relative md:col-span-2">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by description or invoice ref..."
                value={filters.search || ''}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-8"
              />
            </div>

            {/* Status Filter */}
            <Select
              value={filters.status || 'all'}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="EXPIRED">Expired</SelectItem>
                <SelectItem value="CANCELED">Canceled</SelectItem>
              </SelectContent>
            </Select>

            {/* Currency Filter */}
            <Select
              value={filters.currency || 'all'}
              onValueChange={handleCurrencyChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="All currencies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Currencies</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
                <SelectItem value="AUD">AUD</SelectItem>
                <SelectItem value="CAD">CAD</SelectItem>
                <SelectItem value="IDR">IDR</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Row 2: Date Range and Amount Range */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {/* Date From */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'justify-start text-left font-normal',
                    !filters.dateFrom && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateFrom ? (
                    format(new Date(filters.dateFrom), 'MMM d, yyyy')
                  ) : (
                    <span>From date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateFrom ? new Date(filters.dateFrom) : undefined}
                  onSelect={handleDateFromChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Date To */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'justify-start text-left font-normal',
                    !filters.dateTo && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateTo ? (
                    format(new Date(filters.dateTo), 'MMM d, yyyy')
                  ) : (
                    <span>To date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateTo ? new Date(filters.dateTo) : undefined}
                  onSelect={handleDateToChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Amount Min */}
            <Input
              type="number"
              placeholder="Min amount"
              value={filters.amountMin ?? ''}
              onChange={(e) => handleAmountMinChange(e.target.value)}
              min="0"
              step="0.01"
            />

            {/* Amount Max */}
            <Input
              type="number"
              placeholder="Max amount"
              value={filters.amountMax ?? ''}
              onChange={(e) => handleAmountMaxChange(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {Object.keys(filters).filter((k) => filters[k as keyof typeof filters]).length}{' '}
              filter(s) active
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-8 px-2 lg:px-3"
            >
              <X className="mr-2 h-4 w-4" />
              Reset Filters
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

