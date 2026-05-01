/**
 * @module useDomainRouterSettings
 * @description React hook that manages CRUD operations for domain-to-notebook routing rules. Loads existing rules and notebooks on mount, and exposes handlers to add, edit, delete, and toggle rules via domainRouterService.
 * @dependencies @/types, @/services/domain-router-service, @/services/notebook-sync-service
 * @public useDomainRouterSettings
 */
import { useCallback, useEffect, useState } from 'react';
import type { DomainRouterRule, NotebookMeta } from '@/types';
import { domainRouterService } from '@/services/domain-router-service';
import { notebookSyncService } from '@/services/notebook-sync-service';

export function useDomainRouterSettings() {
  const [rules, setRules] = useState<DomainRouterRule[]>([]);
  const [notebooks, setNotebooks] = useState<NotebookMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit form state
  const [editingRule, setEditingRule] = useState<DomainRouterRule | null>(null);
  const [pattern, setPattern] = useState('');
  const [patternType, setPatternType] = useState<'domain' | 'glob' | 'regex'>('domain');
  const [selectedNotebookId, setSelectedNotebookId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [loadedRules, loadedNotebooks] = await Promise.all([
        domainRouterService.getRules(),
        notebookSyncService.getAll(),
      ]);
      setRules(loadedRules);
      setNotebooks(loadedNotebooks);
    } catch {
      setError('Failed to load data.');
    } finally {
      setIsLoading(false);
    }
  };

  const startAdding = useCallback(() => {
    setEditingRule(null);
    setPattern('');
    setPatternType('domain');
    setSelectedNotebookId(notebooks[0]?.id ?? '');
    setError(null);
  }, [notebooks]);

  const startEditing = useCallback((rule: DomainRouterRule) => {
    setEditingRule(rule);
    setPattern(rule.pattern);
    setPatternType(rule.patternType);
    setSelectedNotebookId(rule.notebookId);
    setError(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingRule(null);
    setPattern('');
    setError(null);
  }, []);

  const saveRule = useCallback(async () => {
    if (!pattern.trim() || !selectedNotebookId) {
      setError('Pattern and notebook are required.');
      return;
    }

    // Validate regex patterns
    if (patternType === 'regex') {
      try {
        new RegExp(pattern);
      } catch {
        setError('Invalid regular expression.');
        return;
      }
    }

    const notebook = notebooks.find((n) => n.id === selectedNotebookId);
    const rule: DomainRouterRule = {
      id: editingRule?.id ?? crypto.randomUUID(),
      pattern: pattern.trim(),
      patternType,
      notebookId: selectedNotebookId,
      notebookTitle: notebook?.title ?? 'Unknown',
      createdAt: editingRule?.createdAt ?? Date.now(),
      enabled: editingRule?.enabled ?? true,
    };

    await domainRouterService.saveRule(rule);
    setRules(await domainRouterService.getRules());
    setEditingRule(null);
    setPattern('');
    setError(null);
  }, [pattern, patternType, selectedNotebookId, editingRule, notebooks]);

  const deleteRule = useCallback(async (ruleId: string) => {
    await domainRouterService.deleteRule(ruleId);
    setRules(await domainRouterService.getRules());
  }, []);

  const toggleRule = useCallback(async (ruleId: string) => {
    await domainRouterService.toggleRule(ruleId);
    setRules(await domainRouterService.getRules());
  }, []);

  return {
    rules,
    notebooks,
    isLoading,
    editingRule,
    pattern,
    setPattern,
    patternType,
    setPatternType,
    selectedNotebookId,
    setSelectedNotebookId,
    error,
    startAdding,
    startEditing,
    cancelEdit,
    saveRule,
    deleteRule,
    toggleRule,
  };
}
