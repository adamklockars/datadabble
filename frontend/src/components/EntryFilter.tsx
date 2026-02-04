import { useState, useEffect, useCallback } from 'react';
import { Field } from '../types';

interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

interface EntryFilterProps {
  fields: Field[];
  onFilterChange: (filterExpression: string) => void;
  initialFilter?: string;
}

const OPERATORS = [
  { value: '=', label: 'equals', types: ['all'] },
  { value: '!=', label: 'not equals', types: ['all'] },
  { value: '>', label: 'greater than', types: ['INT', 'DEC', 'DATE'] },
  { value: '<', label: 'less than', types: ['INT', 'DEC', 'DATE'] },
  { value: '>=', label: 'greater or equal', types: ['INT', 'DEC', 'DATE'] },
  { value: '<=', label: 'less or equal', types: ['INT', 'DEC', 'DATE'] },
  { value: 'contains', label: 'contains', types: ['STR', 'EMAIL', 'URL'] },
  { value: 'startswith', label: 'starts with', types: ['STR', 'EMAIL', 'URL'] },
  { value: 'endswith', label: 'ends with', types: ['STR', 'EMAIL', 'URL'] },
  { value: 'is_null', label: 'is empty', types: ['all'] },
  { value: 'is_not_null', label: 'is not empty', types: ['all'] },
];

function getOperatorsForType(fieldType: string) {
  return OPERATORS.filter(
    (op) => op.types.includes('all') || op.types.includes(fieldType)
  );
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function conditionToExpression(condition: FilterCondition, fields: Field[]): string {
  const field = fields.find((f) => f.name === condition.field);
  if (!condition.field || !condition.operator) return '';

  const fieldName = condition.field;
  const op = condition.operator;

  if (op === 'is_null') {
    return `${fieldName} is empty`;
  }
  if (op === 'is_not_null') {
    return `${fieldName} is not empty`;
  }

  const value = condition.value;
  const needsQuotes = !field || !['INT', 'DEC', 'BOOL'].includes(field.field_type);

  if (field?.field_type === 'BOOL') {
    return `${fieldName} ${op} ${value.toLowerCase() === 'true' ? 'true' : 'false'}`;
  }

  const quotedValue = needsQuotes ? `"${value.replace(/"/g, '\\"')}"` : value;
  return `${fieldName} ${op} ${quotedValue}`;
}

function conditionsToExpression(
  conditions: FilterCondition[],
  logic: 'and' | 'or',
  fields: Field[]
): string {
  const parts = conditions
    .map((c) => conditionToExpression(c, fields))
    .filter((p) => p.length > 0);

  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];

  return parts.join(` ${logic.toUpperCase()} `);
}

export default function EntryFilter({ fields, onFilterChange, initialFilter = '' }: EntryFilterProps) {
  const [mode, setMode] = useState<'visual' | 'expression'>('visual');
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [logic, setLogic] = useState<'and' | 'or'>('and');
  const [expression, setExpression] = useState(initialFilter);
  const [expressionError, setExpressionError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(!!initialFilter);

  // Generate expression from conditions
  const updateExpressionFromConditions = useCallback(() => {
    const expr = conditionsToExpression(conditions, logic, fields);
    setExpression(expr);
    setExpressionError(null);
  }, [conditions, logic, fields]);

  // Update expression when conditions change (in visual mode)
  useEffect(() => {
    if (mode === 'visual') {
      updateExpressionFromConditions();
    }
  }, [mode, updateExpressionFromConditions]);

  const addCondition = () => {
    const newCondition: FilterCondition = {
      id: generateId(),
      field: fields[0]?.name || '',
      operator: '=',
      value: '',
    };
    setConditions([...conditions, newCondition]);
  };

  const removeCondition = (id: string) => {
    setConditions(conditions.filter((c) => c.id !== id));
  };

  const updateCondition = (id: string, updates: Partial<FilterCondition>) => {
    setConditions(
      conditions.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const applyFilter = () => {
    onFilterChange(expression);
  };

  const clearFilter = () => {
    setConditions([]);
    setExpression('');
    setExpressionError(null);
    onFilterChange('');
  };

  const handleExpressionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      applyFilter();
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          <span className="font-medium text-gray-700">Filter Entries</span>
          {expression && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
              Active
            </span>
          )}
        </div>
        {expression && !isExpanded && (
          <span className="text-sm text-gray-500 truncate max-w-md">{expression}</span>
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {/* Mode Toggle */}
          <div className="flex gap-2 my-3">
            <button
              onClick={() => setMode('visual')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                mode === 'visual'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Visual Builder
            </button>
            <button
              onClick={() => setMode('expression')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                mode === 'expression'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Expression
            </button>
          </div>

          {mode === 'visual' ? (
            <div className="space-y-3">
              {/* Logic selector */}
              {conditions.length > 1 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">Match</span>
                  <select
                    value={logic}
                    onChange={(e) => setLogic(e.target.value as 'and' | 'or')}
                    className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="and">all conditions (AND)</option>
                    <option value="or">any condition (OR)</option>
                  </select>
                </div>
              )}

              {/* Conditions */}
              {conditions.map((condition, index) => {
                const field = fields.find((f) => f.name === condition.field);
                const operators = field ? getOperatorsForType(field.field_type) : OPERATORS;
                const needsValue = !['is_null', 'is_not_null'].includes(condition.operator);

                return (
                  <div key={condition.id} className="flex items-center gap-2 flex-wrap">
                    {index > 0 && (
                      <span className="text-xs text-gray-500 uppercase w-10">
                        {logic}
                      </span>
                    )}
                    {index === 0 && conditions.length > 1 && <div className="w-10" />}

                    {/* Field select */}
                    <select
                      value={condition.field}
                      onChange={(e) => {
                        const newField = fields.find((f) => f.name === e.target.value);
                        const newOperators = newField ? getOperatorsForType(newField.field_type) : OPERATORS;
                        const currentOpValid = newOperators.some((op) => op.value === condition.operator);
                        updateCondition(condition.id, {
                          field: e.target.value,
                          operator: currentOpValid ? condition.operator : '=',
                        });
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px]"
                    >
                      <option value="">Select field...</option>
                      {fields.map((f) => (
                        <option key={f.id} value={f.name}>
                          {f.name}
                        </option>
                      ))}
                    </select>

                    {/* Operator select */}
                    <select
                      value={condition.operator}
                      onChange={(e) => updateCondition(condition.id, { operator: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px]"
                    >
                      {operators.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>

                    {/* Value input */}
                    {needsValue && (
                      <>
                        {field?.field_type === 'BOOL' ? (
                          <select
                            value={condition.value}
                            onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[100px]"
                          >
                            <option value="">Select...</option>
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                        ) : field?.field_type === 'DATE' ? (
                          <input
                            type="date"
                            value={condition.value}
                            onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <input
                            type={field?.field_type === 'INT' || field?.field_type === 'DEC' ? 'number' : 'text'}
                            value={condition.value}
                            onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                            placeholder="Value..."
                            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[150px]"
                          />
                        )}
                      </>
                    )}

                    {/* Remove button */}
                    <button
                      onClick={() => removeCondition(condition.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      title="Remove condition"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}

              {/* Add condition button */}
              <button
                onClick={addCondition}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add condition
              </button>

              {/* Generated expression preview */}
              {expression && (
                <div className="mt-3 p-2 bg-gray-50 rounded-md">
                  <div className="text-xs text-gray-500 mb-1">Filter expression:</div>
                  <code className="text-sm text-gray-700 break-all">{expression}</code>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Expression input */}
              <div>
                <textarea
                  value={expression}
                  onChange={(e) => {
                    setExpression(e.target.value);
                    setExpressionError(null);
                  }}
                  onKeyDown={handleExpressionKeyDown}
                  placeholder='e.g., status = "active" AND age > 18'
                  className={`w-full px-3 py-2 border rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    expressionError ? 'border-red-300' : 'border-gray-300'
                  }`}
                  rows={3}
                />
                {expressionError && (
                  <p className="mt-1 text-sm text-red-600">{expressionError}</p>
                )}
              </div>

              {/* Help text */}
              <div className="text-xs text-gray-500 space-y-1">
                <p className="font-medium">Expression syntax:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                  <li>Comparisons: <code>=</code>, <code>!=</code>, <code>&gt;</code>, <code>&lt;</code>, <code>&gt;=</code>, <code>&lt;=</code></li>
                  <li>Text: <code>contains</code>, <code>startswith</code>, <code>endswith</code></li>
                  <li>Null checks: <code>is empty</code>, <code>is not empty</code></li>
                  <li>Logic: <code>AND</code>, <code>OR</code>, parentheses <code>()</code></li>
                  <li>Values: <code>"quoted strings"</code>, numbers, <code>true</code>/<code>false</code></li>
                </ul>
                <p className="mt-2">
                  Example: <code>status = "active" AND (age &gt; 18 OR role = "admin")</code>
                </p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
            <button
              onClick={applyFilter}
              disabled={mode === 'visual' && conditions.length === 0 && !expression}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Apply Filter
            </button>
            <button
              onClick={clearFilter}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
