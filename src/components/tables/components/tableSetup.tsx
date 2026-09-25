'use client';
import { useState, useCallback, useMemo, useEffect } from 'react';
import {
    Plus,
    MoreHorizontal,
    Edit,
    Trash2,
    Copy,
    Eye,
    EyeOff,
    ChevronDown,
    Filter,
    Search,
    Check,
    X,
    GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Pagination,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
    PaginationEllipsis,
    PaginationContent,
} from '@/components/ui/pagination';
import { useTableStore, type TableColumn, type TableRow as DataRow } from '@/store/table-store';
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead, TableFooter } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { headerConfig, propertyConfig, formulaTypes } from '@/config/table';
import { closestCenter, DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import {
    arrayMove,
    horizontalListSortingStrategy,
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableRow, SortableColumnHeader } from '@/components/sortable/sortableItem';
import { CrmColumnHeader } from '@/components/tables/crm/column-header';
import { CrmSelectionBar } from '@/components/tables/crm/selection-bar';
import {
    rowMatchesSearch,
    sortRows,
    type ColumnSort,
    type SortDirection,
} from '@/components/tables/crm/table-utils';
import { CrmToolbar } from '@/components/tables/crm/toolbar';
import './index.scss';

// Sample data

const TableHeaderComponent = ({
    id,
    column,
    handleNewColumnName,
}: {
    id: string;
    column: TableColumn;
    handleNewColumnName: (value: string, key: string) => void;
}) => {
    const [editField, setEditField] = useState<boolean>(false);
    const [open, setOpen] = useState<boolean>(false);
    const [property, setProperty] = useState<string>('');

    const { addColumnRight, addColumnLeft, currentTableId, updateColumnProperty } = useTableStore();

    console.log(column, 'column123');
    const RenderEditField = () => {
        const [newColumnName, setNewColumnName] = useState<string>(column.label);
        const handleSave = () => {
            const propertyType = {
                label: newColumnName,
                type: column.type,
            };
            updateColumnProperty(currentTableId as string, id, propertyType);
            setEditField(false);
            setOpen(false);
        };
        return (
            <div className='flex flex-col gap-2'>
                <div>
                    <label className='text-sm font-medium text-gray-700'>Field Name</label>
                    <Input
                        placeholder='Edit field'
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                    />
                </div>
                <div>
                    <label className='text-sm font-medium text-gray-700'>Field Description</label>
                    <Input placeholder='Edit description' />
                </div>
                <Button
                    variant='outline'
                    size='sm'
                    onClick={handleSave}>
                    Save
                </Button>
            </div>
        );
    };

    const RenderFormula = () => {
        const [columnName, setColumnName] = useState<string>('');
        const [formulaType, setFormulaType] = useState<string>(column.property ?? '');

        return (
            <div className='flex flex-col gap-3'>
                <div>
                    <label className='text-sm font-medium text-gray-700'> Column Name</label>
                    <Input
                        placeholder='Edit column name'
                        onChange={(e) => setColumnName(e.target.value)}
                    />
                </div>
                <div className='flex flex-col gap-2'>
                    <label className='text-sm font-medium text-gray-700'>Formula Type</label>
                    <Select
                        value={formulaType}
                        onValueChange={(value) => setFormulaType(value ?? '')}>
                        <SelectTrigger className='w-full'>
                            <SelectValue placeholder='Choose formula type' />
                        </SelectTrigger>
                        <SelectContent>
                            {formulaTypes.map((type) => (
                                <SelectItem
                                    key={type.value}
                                    value={type.value}>
                                    {type.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className='flex justify-end'>
                    <Button
                        onClick={() => {
                            const propertyType = {
                                label: columnName,
                                type: formulaType,
                            };
                            updateColumnProperty(currentTableId as string, id, propertyType);
                            setOpen(false);
                            setColumnName('');
                            setFormulaType('');
                        }}
                        variant='outline'
                        size='sm'>
                        <Plus className='h-4 w-4' />
                        Apply
                    </Button>
                </div>
            </div>
        );
    };

    const RenderProperty = () => {
        const [selectedProperty, setSelectedProperty] = useState<string>(column.property ?? column.type);
        return (
            <div className='flex flex-col gap-2'>
                <div>
                    <label className='text-sm font-medium text-gray-700'>Property</label>
                </div>
                <Select
                    value={selectedProperty}
                    onValueChange={(value) => {
                        const nextValue = value ?? column.type;
                        const propertyType = {
                            label: column.label,
                            type: nextValue,
                        };
                        setSelectedProperty(nextValue);
                        updateColumnProperty(currentTableId as string, id, propertyType);
                    }}>
                    <SelectTrigger className='w-full'>
                        <SelectValue placeholder='Select property' />
                    </SelectTrigger>
                    <SelectContent className='w-full'>
                        {propertyConfig.map((item) => (
                            <SelectItem
                                key={item.name}
                                value={item.name}>
                                {item.icon}
                                <span className='text-[14px]'>{item.label}</span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {selectedProperty === 'formula' && <RenderFormula />}
            </div>
        );
    };

    const renderFieldConfig = useMemo(() => {
        if (editField && open) {
            return <RenderEditField />;
        }

        if (property === 'property') {
            return <RenderProperty />;
        }

        return (
            <div className='flex flex-col gap-2'>
                {headerConfig.map((item) => {
                    if (item.name === 'property') {
                        return (
                            <div className='flex w-full gap-2'>
                                <Button
                                    onClick={() => handleClickCallback(item.name)}
                                    variant='ghost'
                                    className='cursor-pointer w-full justify-start'
                                    size='sm'>
                                    {item.icon}
                                    <span className='text-[14px]'>{item.label}</span>
                                </Button>
                            </div>
                        );
                    }
                    if (item.name === 'delete') {
                        return (
                            <div className='flex w-full gap-2 border-t border-gray-200 mt-2 pt-1'>
                                <Button
                                    variant='ghost'
                                    className='cursor-pointer w-full justify-start text-red-500'
                                    size='sm'>
                                    {item.icon}
                                    {item.label}
                                </Button>
                            </div>
                        );
                    }
                    return (
                        <div className='flex w-full text-sm gap-2'>
                            <Button
                                onClick={() => handleClickCallback(item.name)}
                                variant='ghost'
                                className='cursor-pointer w-full justify-start'
                                size='sm'>
                                {item.icon}
                                <span className='text-[14px]'>{item.label}</span>
                            </Button>
                        </div>
                    );
                })}
            </div>
        );
    }, [editField, open, property]);

    const handleClickCallback = useCallback(
        (name: string) => {
            if (name === 'edit') {
                setEditField(!editField);
            } else if (name === 'property') {
                setProperty('property');
            } else if (name === 'add-right') {
                addColumnRight(currentTableId as string, column.key);
            } else if (name === 'add-left') {
                addColumnLeft(currentTableId as string, column.key);
            }
        },
        [editField, currentTableId],
    );

    const handleOpenChange = useCallback((isOpen: boolean) => {
        setOpen(isOpen);
        setProperty('');
        // Reset all states when popover closes
        if (!isOpen) {
            setEditField(false);
        }
    }, []);

    return (
        <Popover
            onOpenChange={handleOpenChange}
            open={open}>
            <PopoverTrigger className='w-full flex min-h-[30px] items-center'>{column.label}</PopoverTrigger>
            <PopoverContent className='w-[200px] p-2'>{renderFieldConfig}</PopoverContent>
        </Popover>
    );
};

const TableCellComponent = ({
    id,
    column,
    cell,
    isTotalRow,
    handleNewCellValue,
    renderCellNode,
    row,
}: {
    id: string;
    column: TableColumn;
    cell: unknown;
    isTotalRow: number;
    handleNewCellValue: (value: string, rowId: number, columnKey: string) => void;
    renderCellNode?: (row: DataRow, column: TableColumn, cell: unknown) => React.ReactNode;
    row: DataRow;
}) => {
    const [isEditing, setIsEditing] = useState(false);

    const renderCellContent = useMemo(() => {
        // If column has a custom renderCell function, use it
        if (renderCellNode) {
            return (
                <div className={`${!isEditing ? 'whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis' : ''}`}>
                    {renderCellNode(row, column, cell)}
                </div>
            );
        }

        // Default rendering based on column type

        // Default text rendering
        return (
            <div
                className={`text-sm text-gray-700 ${
                    !isEditing ? 'whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis' : ''
                }`}>
                {String(cell ?? '')}
            </div>
        );
    }, [column, row, isEditing, renderCellNode, cell]);

    const renderTableCell = useMemo(() => {
        // Check if this column should be editable
        const isEditable = column.type === 'text';

        // if (isTotalRow === row.id) {
        //     return <div className='text-md font-bold text-gray-700'>Sum:</div>;
        // }

        return (
            <TableCell
                key={id}
                className='px-3 py-2 border-r border-gray-100 last:border-r-0 max-w-[200px] whitespace-nowrap overflow-hidden text-ellipsis'
                style={{
                    width: column.width,
                }}>
                {renderCellContent}
            </TableCell>
        );
    }, [column, row, isEditing]);

    return renderTableCell;
};

const AddColumnComponent = () => {
    const [newColumnName, setNewColumnName] = useState('');
    const [editField, setEditField] = useState<boolean>(false);
    const [open, setOpen] = useState<boolean>(false);
    const { addColumn, currentTableId } = useTableStore();

    const handleClickCallback = useCallback(
        (name: string) => {
            setNewColumnName(name);
            if (name === 'edit') {
                setEditField(!editField);
            }
        },
        [editField],
    );

    const RenderFormula = () => {
        const { getCurrentTable, currentTableId, addRow, setTableData, addColumn } = useTableStore();
        const [selectedColumn, setSelectedColumn] = useState<string>('');
        const [formulaType, setFormulaType] = useState<string>('');

        const currentTable = getCurrentTable();

        const formulaTypes = [
            { value: 'sum', label: 'Sum' },
            { value: 'average', label: 'Average' },
            { value: 'count', label: 'Count' },
            { value: 'min', label: 'Min' },
            { value: 'max', label: 'Max' },
        ];

        return (
            <div className='flex flex-col gap-3'>
                <div>
                    <label className='text-sm font-medium text-gray-700'> Column Name</label>
                    <Input
                        placeholder='Edit column name'
                        onChange={(e) => setSelectedColumn(e.target.value)}
                    />
                </div>
                <div className='flex flex-col gap-2'>
                    <label className='text-sm font-medium text-gray-700'>Formula Type</label>
                    <Select
                        value={formulaType}
                        onValueChange={(value) => setFormulaType(value ?? '')}>
                        <SelectTrigger className='w-full'>
                            <SelectValue placeholder='Choose formula type' />
                        </SelectTrigger>
                        <SelectContent>
                            {formulaTypes.map((type) => (
                                <SelectItem
                                    key={type.value}
                                    value={type.value}>
                                    {type.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className='flex justify-end'>
                    <Button
                        onClick={() => {
                            addColumn(currentTableId as string, selectedColumn, formulaType);
                        }}
                        variant='outline'
                        size='sm'>
                        <Plus className='h-4 w-4' />
                        Add Column
                    </Button>
                </div>
            </div>
        );
    };

    const RenderField = () => {
        const [searchQuery, setSearchQuery] = useState('');

        const filteredProperties = useMemo(() => {
            if (!searchQuery.trim()) {
                return propertyConfig;
            }
            const query = searchQuery.toLowerCase();
            return propertyConfig.filter(
                (item) => item.label.toLowerCase().includes(query) || item.name.toLowerCase().includes(query),
            );
        }, [searchQuery]);
        if (editField) {
            return (
                <div className='flex flex-col gap-2'>
                    <div>
                        <label className='text-sm font-medium text-gray-700'>Field Name</label>
                        <Input placeholder='Edit field' />
                    </div>
                    <div>
                        <label className='text-sm font-medium text-gray-700'>Field Description</label>
                        <Input placeholder='Edit description' />
                    </div>
                </div>
            );
        }

        return (
            <div className='flex flex-col gap-3'>
                {/* Search Bar */}
                <div className='relative'>
                    <Search className='absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                    <Input
                        type='text'
                        placeholder='Search properties...'
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className='pl-8 border-none focus:ring-0 focus:ring-offset-0 outline-none focus:border-none'
                    />
                </div>

                {/* Properties Grid */}
                {filteredProperties.length > 0 ? (
                    <div className='grid grid-cols-2 gap-2'>
                        {filteredProperties.map((item) => (
                            <div
                                key={item.name}
                                className='flex w-full gap-2'>
                                <Button
                                    onClick={() => handleClickCallback(item.name)}
                                    variant='ghost'
                                    className='cursor-pointer w-full justify-start'
                                    size='sm'>
                                    {item.icon}
                                    {item.label}
                                </Button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className='text-center text-sm text-muted-foreground py-4'>
                        No properties found matching "{searchQuery}"
                    </div>
                )}
            </div>
        );
    };

    const handleOpenChange = useCallback((isOpen: boolean) => {
        setOpen(isOpen);
        // Reset all states when popover closes
        if (!isOpen) {
            setEditField(false);
        }
    }, []);

    return (
        // <Button
        //     onClick={() => addColumn(currentTableId as string)}
        //     variant='ghost'
        //     size='sm'>
        //     <Plus className='h-4 w-4 text-gray-500' />
        // </Button>
        <Popover onOpenChange={handleOpenChange}>
            <PopoverTrigger>
                <Button
                    onClick={() => {
                        setOpen(true);
                        setNewColumnName('');
                    }}
                    variant='ghost'
                    size='sm'>
                    <Plus className='h-4 w-4 text-gray-500' />
                </Button>
            </PopoverTrigger>
            <PopoverContent className='w-fit min-w-[300px]'>
                {newColumnName === 'formula' ? <RenderFormula /> : <RenderField />}
            </PopoverContent>
        </Popover>
    );
};

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

export default function TableSetup({
    tableData,
    tableColumns,
    renderCell,
    pageProps,
    dataCallback,
    searchEnabled = false,
    variant = 'crm',
    embedded = false,
    toolbarActions = true,
    emptyLabel = 'leads',
    renderColumnLabel,
    onInsertRow,
    onInsertColumn,
}: {
    tableData: DataRow[];
    tableColumns: TableColumn[];
    renderCell: (row: DataRow, column: TableColumn, cell: unknown) => React.ReactNode;
    pageProps: {
        page: number;
        limit: number;
    };
    dataCallback: (data: DataRow[]) => void;
    searchEnabled?: boolean;
    variant?: 'default' | 'crm';
    /** Drop the full-page shell (height, padding, background) when placed inside another page. */
    embedded?: boolean;
    /** Show the CRM toolbar's lead actions (filter, import, add lead…) next to search. */
    toolbarActions?: boolean;
    /** Plural noun for the empty state, e.g. "No leads found". */
    emptyLabel?: string;
    /** CRM variant: custom header label (e.g. an inline editor); sort arrows stay. */
    renderColumnLabel?: (column: TableColumn) => React.ReactNode;
    /** CRM variant: show Airtable-style "+" to insert a row above/below a row, and an "Add row" bar. */
    onInsertRow?: (anchorRowId: DataRow['id'] | null, position: 'above' | 'below') => void;
    /** CRM variant: show "+" on a header's edges to insert a column left/right of it. */
    onInsertColumn?: (anchorKey: string, side: 'left' | 'right') => void;
}) {
    const isCrm = variant === 'crm';
    const [data, setData] = useState<DataRow[]>(tableData);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRows, setSelectedRows] = useState<Array<string | number>>([]);
    const [columns, setColumns] = useState<TableColumn[]>(tableColumns);
    const [editingColumn, setEditingColumn] = useState<string | null>(null);
    const [newColumnName, setNewColumnName] = useState('');
    const [currentPage, setCurrentPage] = useState(pageProps.page);
    const [itemsPerPage, setItemsPerPage] = useState(pageProps.limit);
    const [columnSort, setColumnSort] = useState<ColumnSort | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // Reduced distance for better responsiveness
            },
        }),
    );

    const handleAddColumn = () => {
        setColumns((prev) => [
            ...prev,
            {
                key: `column_${Date.now()}`,
                label: 'New Column',
                width: '150px',
                type: 'text',
            },
        ]);
    };

    useEffect(() => {
        setColumns(tableColumns);
    }, [tableColumns]);

    useEffect(() => {
        setData(tableData);
    }, [tableData]);

    useEffect(() => {
        setItemsPerPage(pageProps.limit);
    }, [pageProps.limit]);

    const handleSaveNewColumn = () => {
        if (newColumnName.trim()) {
            const newColumn = {
                key: `column_${Date.now()}`,
                label: newColumnName.trim(),
                width: '150px',
                type: 'text',
            };
            setColumns((prev) => [...prev, newColumn]);

            // Add empty data for the new column to all existing rows
            setData((prev) =>
                prev.map((row) => ({
                    ...row,
                    [newColumn.key]: '',
                })),
            );
        }
        setEditingColumn(null);
        setNewColumnName('');
    };

    const handleCancelNewColumn = () => {
        setEditingColumn(null);
        setNewColumnName('');
    };

    const handleSelectRow = (id: string | number) => {
        setSelectedRows((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]));
        // updateCellObjectValue(currentTableId as string, id, column.key, {
        //     selectedRows: selectedRows,
        // });
    };

    const filteredData = useMemo(() => {
        return data.filter((item) => rowMatchesSearch(item, columns, searchTerm));
    }, [data, columns, searchTerm]);

    const sortedData = useMemo(() => {
        return sortRows(filteredData, columns, columnSort);
    }, [filteredData, columns, columnSort]);

    const handleSelectAll = () => {
        const visibleIds = sortedData.map((item) => item.id);
        const allVisibleSelected =
            visibleIds.length > 0 && visibleIds.every((id) => selectedRows.includes(id));

        if (allVisibleSelected) {
            setSelectedRows((prev) => prev.filter((id) => !visibleIds.includes(id)));
        } else {
            setSelectedRows((prev) => [...new Set([...prev, ...visibleIds])]);
        }
    };

    const handleColumnSort = useCallback((columnKey: string, direction: SortDirection) => {
        setColumnSort((current) => {
            if (current?.key === columnKey && current.direction === direction) {
                return null;
            }
            return { key: columnKey, direction };
        });
    }, []);

    // Reset to first page when search term or sort changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, columnSort]);

    const canInsertBetween = !columnSort && !searchTerm.trim();

    // Calculate pagination
    const totalPages = Math.max(1, Math.ceil(sortedData.length / itemsPerPage));
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = sortedData.slice(startIndex, endIndex);
    const allVisibleSelected =
        sortedData.length > 0 && sortedData.every((row) => selectedRows.includes(row.id));

    const handleTableCellChange = (value: string, rowId: number, columnKey: string) => {
        const newValue = value;
        setData((prev) =>
            prev.map((row) =>
                row.id === rowId
                    ? {
                          ...row,
                          [columnKey]: newValue,
                      }
                    : row,
            ),
        );
    };

    const handleNewColumnNameChange = useCallback((value: string, key: string) => {
        setColumns((prev) =>
            prev.map((column) =>
                column.key === key
                    ? {
                          ...column,
                          label: value,
                      }
                    : column,
            ),
        );
    }, []);

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;

            if (over && active.id !== over.id) {
                // Find the actual items in the data array by ID
                const oldIndex = data.findIndex((item) => item.id.toString() === active.id);
                const newIndex = data.findIndex((item) => item.id.toString() === over.id);

                if (oldIndex !== -1 && newIndex !== -1) {
                    const newData = arrayMove(data, oldIndex, newIndex);
                    setData(newData);
                    dataCallback(newData);
                }
            }
        },
        [data, dataCallback],
    );

    const handleColumnDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;

            if (over && active.id !== over.id) {
                const oldIndex = columns.findIndex((column) => column.key === active.id);
                const newIndex = columns.findIndex((column) => column.key === over.id);
                const newColumns = arrayMove(columns, oldIndex, newIndex);

                setColumns(newColumns);
            }
        },
        [columns],
    );

    useEffect(() => {
        const selectedFilter = data.map((item) => {
            if (selectedRows.includes(item.id)) {
                return { ...item, selected: true };
            } else {
                return { ...item, selected: false };
            }
        });
        // if (selectedFilter.length > 0) {
        //     setTableData(currentTableId as string, selectedFilter as any);
        // }
    }, [selectedRows]);

    const renderRowPriorityClass = (priority: unknown) => {
        if (priority === 'high') {
            return 'red-tag';
        }
        return '';
    };

    const getCellValue = (row: DataRow, columnKey: string) => {
        const cell = row[columnKey];
        if (typeof cell === 'object' && cell !== null && 'value' in cell) {
            return (cell as { value?: unknown }).value;
        }
        return cell;
    };

    // Generate page numbers with ellipses
    const getPageNumbers = useCallback(() => {
        const pageNumbers: (number | string)[] = [];
        const maxButtons = 5; // Max visible numbers (excluding first, last, and ellipses)

        if (currentPage >= 1) pageNumbers.push(1); // First page

        if (currentPage > 3) pageNumbers.push('ellipsis'); // Left ellipsis

        // Display middle pages
        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);
        for (let i = start; i <= end; i++) pageNumbers.push(i);

        if (currentPage < totalPages - 2) pageNumbers.push('ellipsis'); // Right ellipsis

        pageNumbers.push(totalPages); // Last page

        return pageNumbers;
    }, [currentPage, totalPages]);

    const renderSumRow = useMemo(() => {
        const sumColumns = columns.filter((col: any) => col.type === 'sum');

        if (sumColumns.length === 0) return null;

        // Helper function to extract numeric value
        const getNumericValue = (cellValue: any): number => {
            if (typeof cellValue === 'object' && cellValue?.value !== undefined) {
                const num = Number(cellValue.value);
                return isNaN(num) ? 0 : num;
            }
            const num = Number(cellValue);
            return isNaN(num) ? 0 : num;
        };

        // Create a map of column key to sum value for quick lookup
        const sumValuesMap = new Map<string, number>();
        sumColumns.forEach((col: any) => {
            const total = data.reduce((sum: number, row: any) => {
                const cellValue = row[col.key];
                const numValue = getNumericValue(cellValue);
                return sum + numValue;
            }, 0);
            sumValuesMap.set(col.key, total);
        });

        return { sumValuesMap };
    }, [columns, data]);

    const crmCheckboxClass =
        'crm-checkbox rounded-[5px] border-[#d4d4d8] data-checked:border-[#f97316] data-checked:bg-[#f97316] data-checked:text-white';

    return (
        <div className={isCrm && !embedded ? 'crm-table-shell' : ''}>
            {isCrm ? (
                <CrmToolbar
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    onAddLead={handleAddColumn}
                    showActions={toolbarActions}
                    resultCount={searchTerm.trim() ? sortedData.length : undefined}
                    className='mb-5'
                />
            ) : null}

            {!isCrm && searchEnabled ? (
                <div className='mb-4 space-y-4'>
                    <div className='flex items-center justify-between'>
                        <div className='relative'>
                            <Search className='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400' />
                            <Input
                                placeholder='Search records...'
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className='w-64 pl-10'
                            />
                        </div>
                        <Button variant='outline' size='sm'>
                            <Filter className='mr-2 h-4 w-4' />
                            Filter
                        </Button>
                    </div>
                </div>
            ) : null}

            <div className={isCrm ? 'overflow-hidden rounded-2xl border border-[#ececef] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)]' : ''}>
            {/* DndContext renders hidden a11y <div>s, so it must wrap the <table>, not sit inside it. */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleColumnDragEnd}>
            <Table className={isCrm ? 'crm-table bg-white' : 'overflow-hidden rounded-md bg-white shadow-md'}>
                    <SortableContext
                        items={columns.map((column) => column.key)}
                        strategy={horizontalListSortingStrategy}>
                        {/* Table Header */}
                        <TableHeader className={isCrm ? 'crm-table-header bg-white' : 'relative border-b border-gray-200 bg-gray-50'}>
                            <TableRow className={isCrm ? 'hover:bg-transparent' : undefined}>
                                <TableHead className={isCrm ? 'crm-checkbox-col w-[52px] max-w-[52px]' : 'w-[60px] max-w-[60px] border-r border-gray-200'}>
                                    <div className='flex items-center justify-center'>
                                        <Checkbox
                                            className={isCrm ? crmCheckboxClass : undefined}
                                            checked={isCrm ? allVisibleSelected : selectedRows.length > 0 && selectedRows.length === data.length}
                                            onCheckedChange={handleSelectAll}
                                        />
                                    </div>
                                </TableHead>
                                {columns.map((column) =>
                                    isCrm ? (
                                        <TableHead key={column.key} className='crm-table-head group/col relative'>
                                            {onInsertColumn
                                                ? (['left', 'right'] as const).map((side) => (
                                                      <button
                                                          key={side}
                                                          type='button'
                                                          aria-label={`Insert column ${side} of ${column.label}`}
                                                          title={`Insert column ${side}`}
                                                          onClick={() => onInsertColumn(column.key, side)}
                                                          className={`absolute top-1/2 z-10 flex size-[18px] -translate-y-1/2 items-center justify-center rounded-full border border-[#fed7aa] bg-white text-[#f97316] opacity-0 shadow-sm transition-[opacity,transform] group-hover/col:opacity-100 hover:scale-110 hover:bg-[#fff7ed] focus-visible:opacity-100 ${side === 'left' ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2'}`}>
                                                          <Plus className='size-3' strokeWidth={2.5} />
                                                      </button>
                                                  ))
                                                : null}
                                            <CrmColumnHeader
                                                label={column.label}
                                                labelContent={renderColumnLabel?.(column)}
                                                activeDirection={
                                                    columnSort?.key === column.key
                                                        ? columnSort.direction
                                                        : null
                                                }
                                                onSort={(direction) =>
                                                    handleColumnSort(column.key, direction)
                                                }
                                            />
                                        </TableHead>
                                    ) : (
                                        <SortableColumnHeader key={column.key} id={column.key}>
                                            <TableHeaderComponent
                                                id={column.key}
                                                column={column}
                                                handleNewColumnName={handleNewColumnNameChange}
                                            />
                                        </SortableColumnHeader>
                                    ),
                                )}

                                {isCrm ? (
                                    <TableHead className='crm-actions-col w-[52px]' />
                                ) : (
                                    <TableHead className='border-r border-gray-200'>
                                        <AddColumnComponent />
                                    </TableHead>
                                )}
                            </TableRow>
                        </TableHeader>

                        {/* Table Body */}
                        <TableBody className={isCrm ? 'crm-table-body divide-y divide-[#f1f1f4]' : 'divide-y divide-gray-100'}>
                            {isCrm
                                ? paginatedData.map((row, rowIndex) => (
                                      <TableRow
                                          key={row.id}
                                          className={`crm-table-row group border-0 ${selectedRows.includes(row.id) ? 'crm-table-row-selected' : ''}`}>
                                          <TableCell className='crm-checkbox-col relative'>
                                              {/* "Insert above/below" only makes sense in the stored order. */}
                                              {onInsertRow && canInsertBetween ? (
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
                                                      className={crmCheckboxClass}
                                                      checked={selectedRows.includes(row.id)}
                                                      onCheckedChange={() => handleSelectRow(row.id)}
                                                  />
                                              </div>
                                          </TableCell>
                                          {columns.map((column) => (
                                              <TableCell key={column.key} className='crm-table-cell py-4'>
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
                                      </TableRow>
                                  ))
                                : null}
                            {isCrm && paginatedData.length === 0 ? (
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
                            {!isCrm ? (
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}>
                                <SortableContext
                                    items={paginatedData.map((row) => row.id.toString())}
                                    strategy={verticalListSortingStrategy}>
                                    {paginatedData.map((row) => (
                                        <SortableRow
                                            key={row.id}
                                            id={row.id.toString()}
                                            className={`group px-4 transition-colors hover:bg-gray-50 ${renderRowPriorityClass(row.priority)}`}>
                                            {(attributes, listeners) => (
                                                <>
                                                    <TableCell className='min-w-[80px]'>
                                                        <div className='relative flex items-center justify-center'>
                                                            <GripVertical
                                                                {...attributes}
                                                                {...listeners}
                                                                className='grip-sort absolute top-0 left-[-5px] h-4 w-4 text-gray-400 outline-none group-hover:text-gray-600'
                                                            />
                                                            <Checkbox
                                                                checked={selectedRows.includes(row.id)}
                                                                onCheckedChange={() => handleSelectRow(row.id)}
                                                            />
                                                        </div>
                                                    </TableCell>
                                                    {columns.map((column) => (
                                                        <TableCellComponent
                                                            key={column.key}
                                                            id={column.key}
                                                            row={row}
                                                            cell={getCellValue(row, column.key)}
                                                            isTotalRow={filteredData.length}
                                                            column={column}
                                                            renderCellNode={renderCell}
                                                            handleNewCellValue={handleTableCellChange}
                                                        />
                                                    ))}
                                                    <TableCell>
                                                        <div></div>
                                                    </TableCell>
                                                </>
                                            )}
                                        </SortableRow>
                                    ))}
                                </SortableContext>
                            </DndContext>
                            ) : null}
                        </TableBody>
                    </SortableContext>

                {/* Empty State */}
                {/* {filteredData.length === 0 && (
                    <div className='text-center py-12'>
                        <div className='text-gray-400 mb-4'>
                            <Search className='h-12 w-12 mx-auto' />
                        </div>
                        <h3 className='text-lg font-medium text-gray-900 mb-2'>No records found</h3>
                        <p className='text-gray-500 mb-4'>Try adjusting your search or filter criteria</p>
                        <Button
                            variant='outline'
                            onClick={() => setSearchTerm('')}>
                            Clear search
                        </Button>
                    </div>
                )} */}
                {renderSumRow && (
                    <TableFooter className='bg-gray-50 p-5'>
                        <TableRow>
                            {/* Checkbox column */}
                            <TableCell className='min-w-[80px] p-5'>
                                <div className='text-xs font-semibold text-gray-600'>Total</div>
                            </TableCell>
                            {/* Data columns - show sum if column type is sum */}
                            {columns.map((column: any) => {
                                const isSumColumn = column.type === 'sum';
                                const sumValue = renderSumRow.sumValuesMap.get(column.key);

                                return (
                                    <TableCell
                                        key={column.key}
                                        className={`px-3 py-2  border-gray-100 border-r-0 ${
                                            isSumColumn ? 'bg-blue-50 font-semibold' : ''
                                        }`}>
                                        {isSumColumn && sumValue !== undefined && (
                                            <div className='text-sm text-gray-900'>{sumValue.toFixed(2)}</div>
                                        )}
                                    </TableCell>
                                );
                            })}
                            {/* Add column button column */}
                            <TableCell className='border-r border-gray-200'></TableCell>
                        </TableRow>
                    </TableFooter>
                )}
            </Table>
            </DndContext>
            {isCrm && onInsertRow ? (
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

            {!isCrm ? (
            <Button variant='ghost' size='sm' className='mt-3'>
                <Plus className='mr-2 h-4 w-4' />
                Add record
            </Button>
            ) : null}

            {isCrm ? (
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
            ) : null}

            {!isCrm && totalPages >= 1 ? (
                <Pagination>
                    <PaginationContent>
                        <PaginationItem>
                            <PaginationPrevious
                                href='#'
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (currentPage > 1) {
                                        setCurrentPage(currentPage - 1);
                                    }
                                }}
                                className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                            />
                        </PaginationItem>
                        {getPageNumbers().map((page, index) => {
                            if (page === 'ellipsis') {
                                return (
                                    <PaginationItem key={`ellipsis-${index}`}>
                                        <PaginationEllipsis />
                                    </PaginationItem>
                                );
                            }
                            return (
                                <PaginationItem key={page}>
                                    <PaginationLink
                                        href='#'
                                        onClick={(e) => {
                                            e.preventDefault();
                                            if (typeof page === 'number') {
                                                setCurrentPage(page);
                                            }
                                        }}
                                        isActive={currentPage === page}
                                        className='cursor-pointer'>
                                        {page}
                                    </PaginationLink>
                                </PaginationItem>
                            );
                        })}
                        <PaginationItem>
                            <PaginationNext
                                href='#'
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (currentPage < totalPages) {
                                        setCurrentPage(currentPage + 1);
                                    }
                                }}
                                className={
                                    currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                                }
                            />
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            ) : null}
            {/* <div className='flex items-center justify-between text-sm text-gray-500'>
                    <div className='flex items-center space-x-4'>
                        <span>
                            {filteredData.length} of {data.length} records
                        </span>
                        {selectedRows.length > 0 && <span>{selectedRows.length} selected</span>}
                    </div>
                    <div className='flex items-center space-x-2'>
                        <Button
                            variant='ghost'
                            size='sm'
                            disabled>
                            Previous
                        </Button>
                        <Button
                            variant='ghost'
                            size='sm'
                            disabled>
                            Next
                        </Button>
                    </div>
                </div> */}
        </div>
    );
}
