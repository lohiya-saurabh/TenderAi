import React from 'react';

export interface TableContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  bordered?: boolean;
}

export const TableContainer: React.FC<TableContainerProps> = ({
  children,
  bordered = true,
  className = '',
  style,
  ...props
}) => {
  return (
    <div
      className={`table-container ${className}`}
      style={{
        width: '100%',
        overflowX: 'auto',
        backgroundColor: 'var(--color-surface-card)',
        borderRadius: 'var(--radius-lg)',
        border: bordered ? '1px solid var(--color-surface-border)' : 'none',
        boxShadow: 'var(--shadow-xs)',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  striped?: boolean;
  hoverable?: boolean;
  compact?: boolean;
}

export const TableContext = React.createContext<{
  striped?: boolean;
  hoverable?: boolean;
  compact?: boolean;
}>({});

export const Table: React.FC<TableProps> = ({
  children,
  striped = false,
  hoverable = true,
  compact = false,
  className = '',
  style,
  ...props
}) => {
  return (
    <TableContext.Provider value={{ striped, hoverable, compact }}>
      <table
        className={`data-table ${striped ? 'table-striped' : ''} ${hoverable ? 'table-hoverable' : ''} ${compact ? 'table-compact' : ''} ${className}`}
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          textAlign: 'left',
          fontSize: compact ? 'var(--text-xs)' : 'var(--text-sm)',
          ...style,
        }}
        {...props}
      >
        {children}
      </table>
    </TableContext.Provider>
  );
};

export const TableHead: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = '',
  style,
  ...props
}) => {
  return (
    <thead
      className={`table-head ${className}`}
      style={{
        backgroundColor: 'var(--color-surface-card-subtle)',
        borderBottom: '1px solid var(--color-surface-border)',
        ...style,
      }}
      {...props}
    >
      {children}
    </thead>
  );
};

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = '',
  style,
  ...props
}) => {
  return (
    <tbody className={`table-body ${className}`} style={style} {...props}>
      {children}
    </tbody>
  );
};

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  isSelected?: boolean;
}

export const TableRow: React.FC<TableRowProps> = ({
  children,
  isSelected = false,
  className = '',
  style,
  ...props
}) => {
  return (
    <tr
      className={`table-row ${isSelected ? 'table-row-selected' : ''} ${className}`}
      style={{
        borderBottom: '1px solid var(--color-surface-border)',
        backgroundColor: isSelected ? 'rgba(234, 88, 12, 0.06)' : 'transparent',
        transition: 'background-color var(--transition-fast)',
        ...style,
      }}
      {...props}
    >
      {children}
    </tr>
  );
};

export interface TableHeaderProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'center' | 'right';
  width?: string;
}

export const TableHeader: React.FC<TableHeaderProps> = ({
  children,
  align = 'left',
  width,
  className = '',
  style,
  ...props
}) => {
  const { compact } = React.useContext(TableContext);

  return (
    <th
      scope="col"
      className={`table-header ${className}`}
      style={{
        padding: compact ? '0.5rem 0.75rem' : '0.75rem 1rem',
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--font-semibold)' as unknown as number,
        color: 'var(--color-surface-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        textAlign: align,
        width,
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...props}
    >
      {children}
    </th>
  );
};

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'center' | 'right';
}

export const TableCell: React.FC<TableCellProps> = ({
  children,
  align = 'left',
  className = '',
  style,
  ...props
}) => {
  const { compact } = React.useContext(TableContext);

  return (
    <td
      className={`table-cell ${className}`}
      style={{
        padding: compact ? '0.55rem 0.75rem' : '0.85rem 1rem',
        color: 'var(--color-surface-text)',
        textAlign: align,
        verticalAlign: 'middle',
        ...style,
      }}
      {...props}
    >
      {children}
    </td>
  );
};
