'use client';
import { useState, useCallback, useMemo, useEffect, useId, type ReactNode } from 'react';
import {
    ArrowDown,
    ArrowLeftToLine,
    ArrowRightToLine,
    ArrowUp,
    ChevronDown,
    GripVertical,
    MoreHorizontal,
    Plus,
    Trash2,
    X,
} from 'lucide-react';
import {
    closestCenter,
    DndContext,
    PointerSensor,
    useSensor,
    useSensors,
    type CollisionDetection,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    horizontalListSortingStrategy,
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CrmSelectionBar } from '@/components/tables/crm/selection-bar';
import {
    rowMatchesSearch,
    sortRows,
    type ColumnSort,
    type SortDirection,
} from '@/components/tables/crm/table-utils';
import { CrmToolbar } from '@/components/tables/crm/toolbar';
import { cn } from '@/lib/utils';
import type { TableColumn, TableRow as DataRow } from '@/store/table-store';
import './index.scss';

// Rows and columns share one DndContext; prefixes keep their ids apart.
const ROW_PREFIX = 'row:';
const COLUMN_PREFIX = 'col:';

/** Only let a dragged row land on rows, and a dragged column on columns. */
const sameKindCollision: CollisionDetection = (args) => {
    const prefix = String(args.active.id).startsWith(COLUMN_PREFIX) ? COLUMN_PREFIX : ROW_PREFIX;
    return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter((container) =>
            String(container.id).startsWith(prefix),
        ),
    });
};

const checkboxClass =
    'crm-checkbox rounded-[5px] border-[#d4d4d8] data-checked:border-[#f97316] data-checked:bg-[#f97316] data-checked:text-white';

/** Round "+" on a row's top or bottom edge (Airtable-style), shown on row hover. */
function RowInsertButton({ edge, onClick }: { edge: 'top' | 'bottom'; onClick: () => void }) {
    return (
        <button
            type='button'
            aria-label={edge === 'top' ? 'Insert row above' : 'Insert row below'}
            title={edge === 'top' ? 'Insert row above' : 'Insert row below'}
            onClick={onClick}
            className={`absolute left-1/2 z-10 flex size-[18px] -translate-x-1/2 items-center justify-center rounded-full border border-[#fed7aa] bg-white text-[#f97316] opacity-0 shadow-sm transition-[opacity,transform] group-hover:opacity-100 hover:scale-110 hover:bg-[#fff7ed] focus-visible:opacity-100 ${edge === 'top' ? 'top-0 -translate-y-1/2' : 'bottom-0 translate-y-1/2'}`}>
            <Plus className='size-3' strokeWidth={2.5} />
        </button>
    );
}

/**
 * Column header: drag grip, label, active-sort indicator and an Airtable-style
 * dropdown (insert left/right, sort, delete).
 */
function SortableHeader({
    column,
    label,
    sortDirection,
    canDelete,
    onInsert,
    onSort,
    onClearSort,
    onDelete,
}: {
    column: TableColumn;
    label: ReactNode;
    sortDirection: SortDirection | null;
    canDelete: boolean;
    onInsert: (side: 'left' | 'right') => void;
    onSort: (direction: SortDirection) => void;
    onClearSort: () => void;
    onDelete: () => void;
}) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
        useSortable({ id: `${COLUMN_PREFIX}${column.key}` });

    return (
        <TableHead
            ref={setNodeRef}
            style={{ transform: CSS.Translate.toString(transform), transition }}
            className={cn(
                'crm-table-head group/col relative',
                isDragging && 'z-20 bg-white opacity-80 shadow-lg',
            )}>
            <div className='flex items-center gap-1'>
                <button
                    type='button'
                    ref={setActivatorNodeRef}
                    aria-label={`Drag to reorder ${column.label}`}
                    className='-ml-2 flex size-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-[#c4c4cc] opacity-0 transition-opacity group-hover/col:opacity-100 hover:bg-[#f4f4f5] hover:text-[#71717a] focus-visible:opacity-100 active:cursor-grabbing'
                    {...attributes}
                    {...listeners}>
                    <GripVertical className='size-3.5' />
                </button>
                <div className='min-w-0'>{label}</div>
                {sortDirection ? (
                    <span
                        className='shrink-0 text-[#f97316]'
                        aria-label={`Sorted ${sortDirection === 'asc' ? 'ascending' : 'descending'}`}>
                        {sortDirection === 'asc' ? <ArrowUp className='size-3' /> : <ArrowDown className='size-3' />}
                    </span>
                ) : null}
                <DropdownMenu>
                    <DropdownMenuTrigger
                        aria-label={`${column.label} column options`}
                        className='ml-auto flex size-6 shrink-0 items-center justify-center rounded-md text-[#a1a1aa] transition-colors hover:bg-[#f4f4f5] hover:text-[#52525b] data-popup-open:bg-[#f4f4f5] data-popup-open:text-[#27272a]'>
                        <ChevronDown className='size-3.5' />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align='end'
                        sideOffset={6}
                        className='w-52'>
                        <DropdownMenuGroup>
                            <DropdownMenuItem onClick={() => onInsert('left')}>
                                <ArrowLeftToLine />
                                Insert left
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onInsert('right')}>
                                <ArrowRightToLine />
                                Insert right
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuItem onClick={() => onSort('asc')}>
                                <ArrowUp />
                                Sort ascending
                                {sortDirection === 'asc' ? <span className='ml-auto text-xs text-[#f97316]'>On</span> : null}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onSort('desc')}>
                                <ArrowDown />
                                Sort descending
                                {sortDirection === 'desc' ? <span className='ml-auto text-xs text-[#f97316]'>On</span> : null}
                            </DropdownMenuItem>
                            {sortDirection ? (
                                <DropdownMenuItem onClick={onClearSort}>
                                    <X />
                                    Clear sort
                                </DropdownMenuItem>
                            ) : null}
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            variant='destructive'
                            disabled={!canDelete}
                            onClick={onDelete}>
                            <Trash2 />
                            Delete column
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </TableHead>
    );
}

/** A body row that can be dragged by its grip. */
function SortableBodyRow({
    row,
    selected,
    draggable,
    children,
}: {
    row: DataRow;
    selected: boolean;
    draggable: boolean;
    children: (grip: ReactNode) => ReactNode;
}) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
        useSortable({ id: `${ROW_PREFIX}${row.id}`, disabled: !draggable });

    const grip = draggable ? (
        <button
            type='button'
            ref={setActivatorNodeRef}
            aria-label='Drag to reorder row'
            className='absolute left-0.5 top-1/2 flex size-5 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded text-[#c4c4cc] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[#f4f4f5] hover:text-[#71717a] focus-visible:opacity-100 active:cursor-grabbing'
            {...attributes}
            {...listeners}>
            <GripVertical className='size-3.5' />
        </button>
    ) : null;

    return (
        <TableRow
            ref={setNodeRef}
            style={{ transform: CSS.Translate.toString(transform), transition }}
            className={cn(
                'crm-table-row group border-0',
                selected && 'crm-table-row-selected',
                isDragging && 'relative z-20 bg-white shadow-lg',
            )}>
            {children(grip)}
        </TableRow>
    );
}

function getCellValue(row: DataRow, columnKey: string) {
    const cell = row[columnKey];
    if (typeof cell === 'object' && cell !== null && 'value' in cell) {
        return (cell as { value?: unknown }).value;
    }
    return cell;
}

function getNumericValue(cellValue: unknown): number {
    const raw =
        typeof cellValue === 'object' && cellValue !== null && 'value' in cellValue
            ? (cellValue as { value?: unknown }).value
            : cellValue;
    const num = Number(raw);
    return Number.isNaN(num) ? 0 : num;
}

/**
 * Data table: search, drag-to-reorder rows and columns, a column menu
 * (insert left/right, sort, delete), row selection and Airtable-style row
 * insertion. Column/row changes are handled here by default and reported
 * through `dataCallback` / `onColumnsChange`; pass `onInsertColumn` /
 * `onDeleteColumn` to handle them yourself instead.
 */
export default function TableSetup({
    tableData,
    tableColumns,
    renderCell,
    pageProps,
    dataCallback,
    embedded = false,
    toolbarActions = true,
    emptyLabel = 'leads',
    renderColumnLabel,
    onInsertRow,
    onInsertColumn,
    onDeleteColumn,
    onColumnsChange,
}: {
    tableData: DataRow[];
    tableColumns: TableColumn[];
    renderCell: (row: DataRow, column: TableColumn, cell: unknown) => ReactNode;
    pageProps: {
        page: number;
        limit: number;
    };
    /** Called with the rows after a row reorder or delete (and internal column inserts). */
    dataCallback: (data: DataRow[]) => void;
    /** Drop the full-page shell (height, padding, background) when placed inside another page. */
    embedded?: boolean;
    /** Show the toolbar's lead actions (filter, import, add lead…) next to search. */
    toolbarActions?: boolean;
    /** Plural noun for the empty state, e.g. "No leads found". */
    emptyLabel?: string;
    /** Custom header label (e.g. an inline editor). */
    renderColumnLabel?: (column: TableColumn) => ReactNode;
    /** Show Airtable-style "+" to insert a row above/below a row, and an "Add row" bar. */
    onInsertRow?: (anchorRowId: DataRow['id'] | null, position: 'above' | 'below') => void;
    /** Handle "Insert left/right" yourself (otherwise a "New column" is added here). */
    onInsertColumn?: (anchorKey: string, side: 'left' | 'right') => void;
    /** Handle "Delete column" yourself (otherwise it's removed here). */
    onDeleteColumn?: (key: string) => void;
    /** Called with the columns after a reorder, or an internal insert / delete. */
    onColumnsChange?: (columns: TableColumn[]) => void;
}) {
    const [data, setData] = useState<DataRow[]>(tableData);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRows, setSelectedRows] = useState<Array<string | number>>([]);
    const [columns, setColumns] = useState<TableColumn[]>(tableColumns);
    const [currentPage, setCurrentPage] = useState(pageProps.page);
    const [itemsPerPage, setItemsPerPage] = useState(pageProps.limit);
    const [columnSort, setColumnSort] = useState<ColumnSort | null>(null);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
    // Stable id so dnd-kit's a11y ids match between server and client render.
    const dndId = useId();

    useEffect(() => {
        setColumns(tableColumns);
    }, [tableColumns]);

    useEffect(() => {
        setData(tableData);
    }, [tableData]);

    useEffect(() => {
        setItemsPerPage(pageProps.limit);
    }, [pageProps.limit]);

    // A deleted column can't stay sorted.
    useEffect(() => {
        if (columnSort && !columns.some((column) => column.key === columnSort.key)) setColumnSort(null);
    }, [columns, columnSort]);

    const filteredData = useMemo(
        () => data.filter((item) => rowMatchesSearch(item, columns, searchTerm)),
        [data, columns, searchTerm],
    );

    const sortedData = useMemo(() => sortRows(filteredData, columns, columnSort), [filteredData, columns, columnSort]);

    // Reset to first page when search term or sort changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, columnSort]);

    // Dragging rows or inserting "above/below" only makes sense in the stored order.
    const inStoredOrder = !columnSort && !searchTerm.trim();

    const totalPages = Math.max(1, Math.ceil(sortedData.length / itemsPerPage));
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedData = sortedData.slice(startIndex, startIndex + itemsPerPage);
    const allVisibleSelected = sortedData.length > 0 && sortedData.every((row) => selectedRows.includes(row.id));

    const handleSelectRow = (id: string | number) => {
        setSelectedRows((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]));
    };

    const handleSelectAll = () => {
        const visibleIds = sortedData.map((item) => item.id);
        if (allVisibleSelected) {
            setSelectedRows((prev) => prev.filter((id) => !visibleIds.includes(id)));
        } else {
            setSelectedRows((prev) => [...new Set([...prev, ...visibleIds])]);
        }
    };

    const handleSort = useCallback((columnKey: string, direction: SortDirection) => {
        setColumnSort({ key: columnKey, direction });
    }, []);

    const updateColumns = useCallback(
        (next: TableColumn[]) => {
            setColumns(next);
            onColumnsChange?.(next);
        },
        [onColumnsChange],
    );

    const handleInsertColumn = (anchorKey: string, side: 'left' | 'right') => {
        if (onInsertColumn) {
            onInsertColumn(anchorKey, side);
            return;
        }
        const column: TableColumn = {
            key: `column_${crypto.randomUUID()}`,
            label: 'New column',
            width: '150px',
            type: 'text',
        };
        const anchor = columns.findIndex((col) => col.key === anchorKey);
        const index = anchor === -1 ? columns.length : side === 'left' ? anchor : anchor + 1;
        updateColumns([...columns.slice(0, index), column, ...columns.slice(index)]);
        const nextData = data.map((row) => ({ ...row, [column.key]: { value: '' } }));
        setData(nextData);
        dataCallback(nextData);
    };

    const handleDeleteColumn = (key: string) => {
        if (onDeleteColumn) {
            onDeleteColumn(key);
            return;
        }
        updateColumns(columns.filter((column) => column.key !== key));
    };

    const handleDragEnd = useCallback(
        ({ active, over }: DragEndEvent) => {
            if (!over || active.id === over.id) return;
            const activeId = String(active.id);
            const overId = String(over.id);

            if (activeId.startsWith(COLUMN_PREFIX)) {
                const from = columns.findIndex((column) => `${COLUMN_PREFIX}${column.key}` === activeId);
                const to = columns.findIndex((column) => `${COLUMN_PREFIX}${column.key}` === overId);
                if (from !== -1 && to !== -1) updateColumns(arrayMove(columns, from, to));
                return;
            }

            const from = data.findIndex((row) => `${ROW_PREFIX}${row.id}` === activeId);
            const to = data.findIndex((row) => `${ROW_PREFIX}${row.id}` === overId);
            if (from !== -1 && to !== -1) {
                const nextData = arrayMove(data, from, to);
                setData(nextData);
                dataCallback(nextData);
            }
        },
        [columns, data, dataCallback, updateColumns],
    );

    // Generate page numbers with ellipses
    const getPageNumbers = useCallback(() => {
        const pageNumbers: (number | string)[] = [1];
        if (currentPage > 3) pageNumbers.push('ellipsis');
        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);
        for (let i = start; i <= end; i++) pageNumbers.push(i);
        if (currentPage < totalPages - 2) pageNumbers.push('ellipsis');
        if (totalPages > 1) pageNumbers.push(totalPages);
        return pageNumbers;
    }, [currentPage, totalPages]);

    // Totals for columns of type "sum".
    const sumValues = useMemo(() => {
        const sumColumns = columns.filter((col) => col.type === 'sum');
        if (sumColumns.length === 0) return null;
        return new Map(
            sumColumns.map((col) => [col.key, data.reduce((sum, row) => sum + getNumericValue(row[col.key]), 0)]),
        );
    }, [columns, data]);

    return (
        <div className={embedded ? '' : 'crm-table-shell'}>
            <CrmToolbar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onAddLead={() => handleInsertColumn(columns[columns.length - 1]?.key ?? '', 'right')}
                showActions={toolbarActions}
                resultCount={searchTerm.trim() ? sortedData.length : undefined}
                className='mb-5'
            />

            <div className='overflow-hidden rounded-2xl border border-[#ececef] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)]'>
                {/* DndContext renders hidden a11y <div>s, so it must wrap the <table>, not sit inside it. */}
                <DndContext
                    id={dndId}
                    sensors={sensors}
                    collisionDetection={sameKindCollision}
                    onDragEnd={handleDragEnd}>
                    <Table className='crm-table bg-white'>
                        <TableHeader className='crm-table-header bg-white'>
                            <TableRow className='hover:bg-transparent'>
                                <TableHead className='crm-checkbox-col w-[60px] max-w-[60px]'>
                                    <div className='flex items-center justify-center'>
                                        <Checkbox
                                            className={checkboxClass}
                                            checked={allVisibleSelected}
                                            onCheckedChange={handleSelectAll}
                                        />
                                    </div>
                                </TableHead>
                                <SortableContext
                                    items={columns.map((column) => `${COLUMN_PREFIX}${column.key}`)}
                                    strategy={horizontalListSortingStrategy}>
                                    {columns.map((column) => (
                                        <SortableHeader
                                            key={column.key}
                                            column={column}
                                            label={
                                                renderColumnLabel?.(column) ?? (
                                                    <span className='text-[11px] font-semibold tracking-[0.08em] text-[#a1a1aa] uppercase'>
                                                        {column.label}
                                                    </span>
                                                )
                                            }
                                            sortDirection={columnSort?.key === column.key ? columnSort.direction : null}
                                            canDelete={columns.length > 1}
                                            onInsert={(side) => handleInsertColumn(column.key, side)}
                                            onSort={(direction) => handleSort(column.key, direction)}
                                            onClearSort={() => setColumnSort(null)}
                                            onDelete={() => handleDeleteColumn(column.key)}
                                        />
                                    ))}
                                </SortableContext>
                                <TableHead className='crm-actions-col w-[52px]' />
                            </TableRow>
                        </TableHeader>

                        <TableBody className='crm-table-body divide-y divide-[#f1f1f4]'>
                            <SortableContext
                                items={paginatedData.map((row) => `${ROW_PREFIX}${row.id}`)}
                                strategy={verticalListSortingStrategy}>
                                {paginatedData.map((row, rowIndex) => (
                                    <SortableBodyRow
                                        key={row.id}
                                        row={row}
                                        selected={selectedRows.includes(row.id)}
                                        draggable={inStoredOrder}>
                                        {(grip) => (
                                            <>
                                                <TableCell className='crm-checkbox-col relative'>
                                                    {grip}
                                                    {onInsertRow && inStoredOrder ? (
                                                        <>
                                                            {rowIndex === 0 ? (
                                                                <RowInsertButton
                                                                    edge='top'
                                                                    onClick={() => onInsertRow(row.id, 'above')}
                                                                />
                                                            ) : null}
                                                            {rowIndex < paginatedData.length - 1 ? (
                                                                <RowInsertButton
                                                                    edge='bottom'
                                                                    onClick={() => onInsertRow(row.id, 'below')}
                                                                />
                                                            ) : null}
                                                        </>
                                                    ) : null}
                                                    <div className='flex items-center justify-center'>
                                                        <Checkbox
                                                            className={checkboxClass}
                                                            checked={selectedRows.includes(row.id)}
                                                            onCheckedChange={() => handleSelectRow(row.id)}
                                                        />
                                                    </div>
                                                </TableCell>
                                                {columns.map((column) => (
                                                    <TableCell
                                                        key={column.key}
                                                        className='crm-table-cell py-4'>
                                                        {renderCell(row, column, getCellValue(row, column.key))}
                                                    </TableCell>
                                                ))}
                                                <TableCell className='crm-actions-col'>
                                                    <Button
                                                        type='button'
                                                        variant='ghost'
                                                        size='icon-sm'
                                                        className='size-8 rounded-lg text-[#a1a1aa] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[#f4f4f5] hover:text-[#52525b]'>
                                                        <MoreHorizontal className='size-4' />
                                                    </Button>
                                                </TableCell>
                                            </>
                                        )}
                                    </SortableBodyRow>
                                ))}
                            </SortableContext>
                            {paginatedData.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={columns.length + 2}
                                        className='py-16 text-center text-sm text-[#a1a1aa]'>
                                        {searchTerm.trim()
                                            ? `No ${emptyLabel} found for "${searchTerm.trim()}".`
                                            : `No ${emptyLabel} to display.`}
                                    </TableCell>
                                </TableRow>
                            ) : null}
                        </TableBody>

                        {sumValues ? (
                            <TableFooter className='bg-[#fafafa]'>
                                <TableRow>
                                    <TableCell className='crm-checkbox-col text-xs font-semibold text-[#71717a]'>
                                        Total
                                    </TableCell>
                                    {columns.map((column) => {
                                        const sum = sumValues.get(column.key);
                                        return (
                                            <TableCell
                                                key={column.key}
                                                className='crm-table-cell text-sm font-semibold text-[#27272a]'>
                                                {sum !== undefined ? sum.toFixed(2) : null}
                                            </TableCell>
                                        );
                                    })}
                                    <TableCell className='crm-actions-col' />
                                </TableRow>
                            </TableFooter>
                        ) : null}
                    </Table>
                </DndContext>
                {onInsertRow ? (
                    <button
                        type='button'
                        onClick={() => {
                            // A blank row would be hidden by an active search.
                            setSearchTerm('');
                            onInsertRow(null, 'below');
                        }}
                        className='flex w-full items-center gap-2 border-t border-[#f1f1f4] px-5 py-3 text-left text-sm text-[#a1a1aa] transition-colors hover:bg-[#fafafa] hover:text-[#52525b]'>
                        <Plus className='size-4' />
                        Add row
                    </button>
                ) : null}
            </div>

            <CrmSelectionBar
                count={selectedRows.length}
                onDiscard={() => setSelectedRows([])}
                onDelete={() => {
                    const remaining = data.filter((row) => !selectedRows.includes(row.id));
                    setData(remaining);
                    setSelectedRows([]);
                    dataCallback(remaining);
                }}
            />

            {totalPages > 1 ? (
                <Pagination className='mt-4'>
                    <PaginationContent>
                        <PaginationItem>
                            <PaginationPrevious
                                href='#'
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (currentPage > 1) setCurrentPage(currentPage - 1);
                                }}
                                className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                            />
                        </PaginationItem>
                        {getPageNumbers().map((page, index) =>
                            page === 'ellipsis' ? (
                                <PaginationItem key={`ellipsis-${index}`}>
                                    <PaginationEllipsis />
                                </PaginationItem>
                            ) : (
                                <PaginationItem key={page}>
                                    <PaginationLink
                                        href='#'
                                        onClick={(e) => {
                                            e.preventDefault();
                                            if (typeof page === 'number') setCurrentPage(page);
                                        }}
                                        isActive={currentPage === page}
                                        className='cursor-pointer'>
                                        {page}
                                    </PaginationLink>
                                </PaginationItem>
                            ),
                        )}
                        <PaginationItem>
                            <PaginationNext
                                href='#'
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                                }}
                                className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                            />
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            ) : null}
        </div>
    );
}
