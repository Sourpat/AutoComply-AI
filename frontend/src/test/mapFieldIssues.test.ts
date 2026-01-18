/**
 * Tests for mapFieldIssues utility
 */

import { describe, it, expect } from 'vitest';
import { 
  normalizeFieldKey, 
  buildFieldIssueMap, 
  getFieldIssues, 
  getTopFieldIssue 
} from '../utils/mapFieldIssues';

describe('normalizeFieldKey', () => {
  it('converts to lowercase', () => {
    expect(normalizeFieldKey('NPI Number')).toBe('npi_number');
  });

  it('replaces spaces with underscores', () => {
    expect(normalizeFieldKey('License Type')).toBe('license_type');
  });

  it('removes special characters', () => {
    expect(normalizeFieldKey('DEA# Number')).toBe('dea_number');
  });

  it('trims whitespace', () => {
    expect(normalizeFieldKey('  facility_name  ')).toBe('facility_name');
  });

  it('handles already normalized keys', () => {
    expect(normalizeFieldKey('license_number')).toBe('license_number');
  });
});

describe('buildFieldIssueMap', () => {
  it('builds empty map when no issues provided', () => {
    expect(buildFieldIssueMap(undefined)).toEqual({});
    expect(buildFieldIssueMap([])).toEqual({});
  });

  it('maps single issue to normalized field key', () => {
    const issues = [{
      field: 'NPI Number',
      severity: 'critical' as const,
      message: 'Invalid format',
    }];

    const map = buildFieldIssueMap(issues);
    
    expect(map['npi_number']).toBeDefined();
    expect(map['npi_number'].length).toBe(1);
    expect(map['npi_number'][0].message).toBe('Invalid format');
  });

  it('groups multiple issues for same field', () => {
    const issues = [
      {
        field: 'License Number',
        severity: 'critical' as const,
        message: 'Missing',
      },
      {
        field: 'license_number',
        severity: 'low' as const,
        message: 'Format warning',
      },
    ];

    const map = buildFieldIssueMap(issues);
    
    expect(map['license_number'].length).toBe(2);
  });

  it('sorts issues by severity within each field', () => {
    const issues = [
      {
        field: 'NPI',
        severity: 'low' as const,
        message: 'Minor issue',
      },
      {
        field: 'npi',
        severity: 'critical' as const,
        message: 'Major issue',
      },
      {
        field: 'NPI',
        severity: 'medium' as const,
        message: 'Medium issue',
      },
    ];

    const map = buildFieldIssueMap(issues);
    const npiIssues = map['npi'];
    
    expect(npiIssues[0].severity).toBe('critical');
    expect(npiIssues[1].severity).toBe('medium');
    expect(npiIssues[2].severity).toBe('low');
  });

  it('handles issues with check field', () => {
    const issues = [{
      field: 'NPI',
      severity: 'critical' as const,
      check: 'npi_format',
      message: 'Invalid NPI format',
    }];

    const map = buildFieldIssueMap(issues);
    
    expect(map['npi'][0].check).toBe('npi_format');
  });
});

describe('getFieldIssues', () => {
  const map = buildFieldIssueMap([
    { field: 'NPI Number', severity: 'critical' as const, message: 'Invalid' },
    { field: 'License Type', severity: 'low' as const, message: 'Warning' },
  ]);

  it('returns issues for matching field', () => {
    const issues = getFieldIssues(map, 'npi_number');
    expect(issues.length).toBe(1);
    expect(issues[0].message).toBe('Invalid');
  });

  it('normalizes input field key', () => {
    const issues = getFieldIssues(map, 'NPI Number');
    expect(issues.length).toBe(1);
  });

  it('returns empty array for non-existent field', () => {
    const issues = getFieldIssues(map, 'unknown_field');
    expect(issues).toEqual([]);
  });
});

describe('getTopFieldIssue', () => {
  it('returns most severe issue', () => {
    const map = buildFieldIssueMap([
      { field: 'NPI', severity: 'low' as const, message: 'Low' },
      { field: 'npi', severity: 'critical' as const, message: 'Critical' },
    ]);

    const topIssue = getTopFieldIssue(map, 'NPI');
    
    expect(topIssue?.severity).toBe('critical');
    expect(topIssue?.message).toBe('Critical');
  });

  it('returns undefined for field with no issues', () => {
    const map = buildFieldIssueMap([]);
    const topIssue = getTopFieldIssue(map, 'unknown');
    
    expect(topIssue).toBeUndefined();
  });
});
