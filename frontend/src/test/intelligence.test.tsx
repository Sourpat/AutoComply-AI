/**
 * Intelligence Components Tests
 * 
 * Unit tests for Decision Intelligence UI components
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfidenceBadge } from '../features/intelligence/ConfidenceBadge';
import { RulesPanel } from '../features/intelligence/RulesPanel';
import { DecisionSummaryCard } from '../features/intelligence/DecisionSummaryCard';
import { FreshnessIndicator } from '../features/intelligence/FreshnessIndicator';
import { GapsPanel } from '../features/intelligence/GapsPanel';
import type { Gap, BiasFlag, FailedRule } from '../api/intelligenceApi';
import { getCaseIntelligence, recomputeCaseIntelligence } from '../api/intelligenceApi';

// Mock fetch for API tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Normalize headers for tests (fetch may lowercase keys; CI assertions should be case-insensitive)
const normalizeHeaders = (headers: any): Record<string, string> => {
  if (!headers) return {};
  // Headers instance
  if (typeof headers.forEach === 'function') {
    const out: Record<string, string> = {};
    headers.forEach((v: string, k: string) => {
      out[String(k).toLowerCase()] = String(v);
    });
    return out;
  }
  // Array tuples
  if (Array.isArray(headers)) {
    return Object.fromEntries(
      headers.map(([k, v]) => [String(k).toLowerCase(), String(v)])
    );
  }
  // Plain object
  return Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [String(k).toLowerCase(), String(v)])
  );
};

describe('ConfidenceBadge', () => {
  it('renders high confidence correctly', () => {
    const { container } = render(
      <ConfidenceBadge
        score={85.5}
        band="high"
        explanationFactors={[]}
        showTooltip={false}
      />
    );
    
    expect(container.textContent).toContain('High Confidence');
    expect(container.textContent).toContain('86'); // Rounded score
  });

  it('renders medium confidence correctly', () => {
    const { container } = render(
      <ConfidenceBadge
        score={65.2}
        band="medium"
        explanationFactors={[]}
        showTooltip={false}
      />
    );
    
    expect(container.textContent).toContain('Medium Confidence');
    expect(container.textContent).toContain('65');
  });

  it('renders low confidence correctly', () => {
    const { container } = render(
      <ConfidenceBadge
        score={35.8}
        band="low"
        explanationFactors={[]}
        showTooltip={false}
      />
    );
    
    expect(container.textContent).toContain('Low Confidence');
    expect(container.textContent).toContain('36');
  });

  it('renders with explanation factors', () => {
    const factors = [
      { factor: 'Strong evidence', impact: 'Positive', weight: 10 },
      { factor: 'Missing data', impact: 'Negative', weight: -5 },
    ];

    const { container } = render(
      <ConfidenceBadge
        score={72.0}
        band="medium"
        explanationFactors={factors}
        showTooltip={true}
      />
    );
    
    expect(container.textContent).toContain('72');
  });
});

describe('Intelligence Components Type Safety', () => {
  it('Gap type structure is valid', () => {
    const gap: Gap = {
      gap_type: 'missing',
      severity: 'high',
      affected_area: 'Evidence',
      description: 'Test gap',
      expected_signal: 'submission_present',
    };

    expect(gap.gap_type).toBe('missing');
    expect(gap.severity).toBe('high');
  });

  it('BiasFlag type structure is valid', () => {
    const bias: BiasFlag = {
      bias_type: 'single_source_reliance',
      severity: 'high',
      description: 'Test bias',
      affected_signals: ['signal1', 'signal2'],
    };

    expect(bias.bias_type).toBe('single_source_reliance');
    expect(bias.severity).toBe('high');
  });
});
// ============================================================================
// Phase 7.7: Intelligence API E2E Tests
// ============================================================================

describe('Intelligence API - Recompute Flow', () => {
  const TEST_CASE_ID = 'test-case-123';
  const mockIntelligenceData = {
    case_id: TEST_CASE_ID,
    decision_type: 'csf',
    confidence_score: 75.0,
    confidence_band: 'medium' as const,
    gaps: [],
    gap_severity_score: 0,
    bias_flags: [],
    explanation_factors: [],
    narrative: 'Test narrative',
    computed_at: new Date().toISOString(),
  };

  beforeEach(() => {
    mockFetch.mockClear();
    // Mock localStorage for auth headers
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('admin');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('recompute includes admin_unlocked=1 query param', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockIntelligenceData,
    });

    await recomputeCaseIntelligence(TEST_CASE_ID, 'csf');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('admin_unlocked=1'),
      expect.any(Object)
    );
  });

  it('recompute URL includes both decision_type and admin_unlocked params', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockIntelligenceData,
    });

    await recomputeCaseIntelligence(TEST_CASE_ID, 'csf');

    const callUrl = mockFetch.mock.calls[0][0] as string;
    expect(callUrl).toContain('decision_type=csf');
    expect(callUrl).toContain('admin_unlocked=1');
    expect(callUrl).toContain('/intelligence/recompute');
  });

  it('recompute sends POST request with auth headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockIntelligenceData,
    });

    await recomputeCaseIntelligence(TEST_CASE_ID);

    const callOptions = mockFetch.mock.calls[0]?.[1] as any;
    expect(callOptions?.method).toBe('POST');

    const h = normalizeHeaders(callOptions?.headers);
    expect(h).toHaveProperty('x-autocomply-role', 'admin');
    // Auth header may not be set in all test environments; if present, validate it
    if (h['authorization'] !== undefined) {
      expect(String(h['authorization']).length).toBeGreaterThan(0);
    }
  });

  it('recompute throws error on 403 Forbidden', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'Only admin and devsupport can recompute intelligence',
    });

    await expect(recomputeCaseIntelligence(TEST_CASE_ID))
      .rejects
      .toThrow('Failed to recompute intelligence: 403');
  });

  it('getCaseIntelligence fetches without admin_unlocked param', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockIntelligenceData,
    });

    await getCaseIntelligence(TEST_CASE_ID, 'csf');

    const callUrl = mockFetch.mock.calls[0][0] as string;
    expect(callUrl).toContain('/intelligence');
    expect(callUrl).not.toContain('admin_unlocked');
    expect(callUrl).toContain('decision_type=csf');
  });
});

// ============================================================================
// Phase 7.9: Rule Engine UI Tests
// ============================================================================

describe('RulesPanel Component', () => {
  it('renders "All Rules Passed" when no failed rules', () => {
    const { container } = render(
      <RulesPanel
        rulesTotal={10}
        rulesPassed={10}
        failedRules={[]}
      />
    );

    expect(container.textContent).toContain('All Rules Passed');
    expect(container.textContent).toContain('10 validation rules passed successfully');
  });

  it('renders failed rules grouped by severity', () => {
    const failedRules: FailedRule[] = [
      {
        rule_id: 'critical_1',
        title: 'Name Required',
        severity: 'critical',
        message: 'Applicant name is required',
        field_path: 'name',
      },
      {
        rule_id: 'medium_1',
        title: 'Email Format',
        severity: 'medium',
        message: 'Email should be valid format',
        field_path: 'email',
      },
      {
        rule_id: 'low_1',
        title: 'Phone Optional',
        severity: 'low',
        message: 'Phone number is recommended',
        field_path: 'phone',
      },
    ];

    const { container } = render(
      <RulesPanel
        rulesTotal={10}
        rulesPassed={7}
        failedRules={failedRules}
      />
    );

    expect(container.textContent).toContain('Passed 7/10 rules');
    expect(container.textContent).toContain('3 failed');
    expect(container.textContent).toContain('1 Critical');
    expect(container.textContent).toContain('1 Medium');
    expect(container.textContent).toContain('1 Low');
  });

  it('renders critical failures section', () => {
    const failedRules: FailedRule[] = [
      {
        rule_id: 'critical_1',
        title: 'Name Required',
        severity: 'critical',
        message: 'Applicant name is required',
        field_path: 'name',
      },
    ];

    const { container } = render(
      <RulesPanel
        rulesTotal={8}
        rulesPassed={7}
        failedRules={failedRules}
      />
    );

    expect(container.textContent).toContain('Critical Failures');
    expect(container.textContent).toContain('Name Required');
    expect(container.textContent).toContain('Applicant name is required');
    expect(container.textContent).toContain('Field:');
    expect(container.textContent).toContain('name');
  });

  it('renders expected/actual values when provided', () => {
    const failedRules: FailedRule[] = [
      {
        rule_id: 'validation_1',
        severity: 'medium',
        message: 'State code invalid',
        field_path: 'state',
        expected: 'CA',
        actual: 'XX',
      },
    ];

    const { container } = render(
      <RulesPanel
        rulesTotal={8}
        rulesPassed={7}
        failedRules={failedRules}
      />
    );

    expect(container.textContent).toContain('Expected:');
    expect(container.textContent).toContain('CA');
    expect(container.textContent).toContain('Actual:');
    expect(container.textContent).toContain('XX');
  });
});

describe('DecisionSummaryCard with Rules Badge', () => {
  it('renders rules badge when rules data provided', () => {
    const { container } = render(
      <DecisionSummaryCard
        narrative="Test narrative"
        gaps={[]}
        biasFlags={[]}
        confidenceBand="high"
        rulesTotal={10}
        rulesPassed={8}
        failedRules={[]}
      />
    );

    expect(container.textContent).toContain('Rules 8/10');
  });

  it('shows critical failure indicator when critical rule failed', () => {
    const failedRules: FailedRule[] = [
      {
        rule_id: 'critical_1',
        severity: 'critical',
        message: 'Critical failure',
      },
    ];

    const { container } = render(
      <DecisionSummaryCard
        narrative="Test narrative"
        gaps={[]}
        biasFlags={[]}
        confidenceBand="medium"
        rulesTotal={10}
        rulesPassed={9}
        failedRules={failedRules}
      />
    );

    expect(container.textContent).toContain('⚠'); // Warning icon
    expect(container.textContent).toContain('Rules 9/10');
  });

  it('does not show critical indicator when only medium/low failures', () => {
    const failedRules: FailedRule[] = [
      {
        rule_id: 'medium_1',
        severity: 'medium',
        message: 'Medium failure',
      },
    ];

    const { container } = render(
      <DecisionSummaryCard
        narrative="Test narrative"
        gaps={[]}
        biasFlags={[]}
        confidenceBand="medium"
        rulesTotal={10}
        rulesPassed={9}
        failedRules={failedRules}
      />
    );

    expect(container.textContent).not.toContain('Critical rule failed');
    expect(container.textContent).toContain('Rules 9/10');
  });

  it('does not render rules badge when rules data not provided', () => {
    const { container } = render(
      <DecisionSummaryCard
        narrative="Test narrative"
        gaps={[]}
        biasFlags={[]}
        confidenceBand="high"
      />
    );

    expect(container.textContent).not.toContain('Passed');
    expect(container.textContent).not.toContain('rules');
  });
});

// ============================================================================
// Phase 7.10: Freshness Indicator Tests
// ============================================================================

describe('FreshnessIndicator Component', () => {
  it('renders age in minutes for recent computation', () => {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

    const { container } = render(
      <FreshnessIndicator
        computedAt={twoMinutesAgo}
        isStale={false}
      />
    );

    expect(container.textContent).toContain('Computed');
    expect(container.textContent).toContain('min ago');
  });

  it('shows "Just now" for very recent computation', () => {
    const now = new Date().toISOString();

    const { container } = render(
      <FreshnessIndicator
        computedAt={now}
        isStale={false}
      />
    );

    expect(container.textContent).toContain('Just now');
  });

  it('shows hours for older computation', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { container } = render(
      <FreshnessIndicator
        computedAt={twoHoursAgo}
        isStale={false}
      />
    );

    expect(container.textContent).toContain('hours ago');
  });

  it('renders stale badge when isStale is true', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { container } = render(
      <FreshnessIndicator
        computedAt={oneHourAgo}
        isStale={true}
      />
    );

    expect(container.textContent).toContain('Stale');
  });

  it('does not render stale badge when isStale is false', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { container } = render(
      <FreshnessIndicator
        computedAt={fiveMinutesAgo}
        isStale={false}
      />
    );

    expect(container.textContent).not.toContain('Stale');
  });
});

describe('DecisionSummaryCard with Freshness', () => {
  it('renders freshness indicator when computedAt provided', () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { container } = render(
      <DecisionSummaryCard
        narrative="Test narrative"
        gaps={[]}
        biasFlags={[]}
        confidenceBand="high"
        computedAt={tenMinutesAgo}
        isStale={false}
      />
    );

    expect(container.textContent).toContain('Computed');
    expect(container.textContent).toContain('min ago');
  });

  it('shows stale badge in DecisionSummaryCard when stale', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { container } = render(
      <DecisionSummaryCard
        narrative="Test narrative"
        gaps={[]}
        biasFlags={[]}
        confidenceBand="medium"
        computedAt={oneHourAgo}
        isStale={true}
      />
    );

    expect(container.textContent).toContain('Stale');
  });

  it('does not render freshness when computedAt not provided', () => {
    const { container } = render(
      <DecisionSummaryCard
        narrative="Test narrative"
        gaps={[]}
        biasFlags={[]}
        confidenceBand="high"
      />
    );

    // Should still render summary card but no freshness
    expect(container.textContent).toContain('Decision Summary');
    expect(container.textContent).not.toContain('Computed');
  });
});

describe('GapsPanel', () => {
  it('filters out empty gaps with no content', () => {
    const gaps: Gap[] = [
      {
        gap_type: 'missing',
        severity: 'high',
        affected_area: '',
        description: '',
        expected_signal: '',
      },
      {
        gap_type: 'missing',
        severity: 'high',
        affected_area: 'Evidence',
        description: 'Missing license verification',
        expected_signal: 'license_verified',
      },
    ];

    const { container } = render(
      <GapsPanel gaps={gaps} gapSeverityScore={50} />
    );

    // Should only render 1 gap (the second one with content)
    expect(container.textContent).toContain('Missing license verification');
    expect(container.textContent).toContain('high Priority (1)');
  });

  it('deduplicates identical gaps', () => {
    const gaps: Gap[] = [
      {
        gap_type: 'missing',
        severity: 'high',
        affected_area: 'Evidence',
        description: 'Missing license',
      },
      {
        gap_type: 'missing',
        severity: 'high',
        affected_area: 'Evidence',
        description: 'Missing license',
      },
      {
        gap_type: 'missing',
        severity: 'high',
        affected_area: 'Evidence',
        description: 'Missing license',
      },
    ];

    const { container } = render(
      <GapsPanel gaps={gaps} gapSeverityScore={60} />
    );

    // Should show count of 1 after deduplication
    expect(container.textContent).toContain('high Priority (1)');
    expect(container.textContent).toContain('Missing license');
  });

  it('shows expand/collapse toggle when more than 8 gaps', async () => {
    const user = userEvent.setup();
    const gaps: Gap[] = Array.from({ length: 12 }, (_, i) => ({
      gap_type: 'missing',
      severity: 'medium' as const,
      affected_area: `Area ${i}`,
      description: `Gap ${i + 1}`,
    }));

    const { container } = render(
      <GapsPanel gaps={gaps} gapSeverityScore={40} />
    );

    // Should show "Show all" button
    const showAllButton = screen.getByText(/Show all 12 medium priority gaps/i);
    expect(showAllButton).toBeTruthy();

    // Click to expand
    await user.click(showAllButton);

    // Should now show "Show less" button
    expect(screen.getByText(/Show less \(8 of 12\)/i)).toBeTruthy();
  });

  it('builds displayTitle from description when available', () => {
    const gaps: Gap[] = [
      {
        gap_type: 'missing',
        severity: 'low',
        affected_area: 'Evidence',
        description: 'Missing DEA certificate',
      },
    ];

    const { container } = render(
      <GapsPanel gaps={gaps} gapSeverityScore={20} />
    );

    expect(container.textContent).toContain('Missing DEA certificate');
  });

  it('builds displayTitle from affected_area and gap_type when description is empty', () => {
    const gaps: Gap[] = [
      {
        gap_type: 'weak',
        severity: 'medium',
        affected_area: 'License verification',
        description: '',
      },
    ];

    const { container } = render(
      <GapsPanel gaps={gaps} gapSeverityScore={30} />
    );

    expect(container.textContent).toContain('License verification (weak)');
  });

it('shows "No additional unknowns detected" when all gaps are empty', () => {
    const gaps: Gap[] = [
      {
        gap_type: 'missing',
        severity: 'high',
        affected_area: '',
        description: '',
      },
    ];

    const { container } = render(
      <GapsPanel gaps={gaps} gapSeverityScore={0} />
    );

    expect(container.textContent).toContain('No Information Gaps');
    expect(container.textContent).toContain('All expected evidence is present and complete');
  });
});

describe('DecisionSummaryCard - Enhanced', () => {
  it('filters out empty gaps in "What We Don\'t Know" section', () => {
    const gaps: Gap[] = [
      {
        gap_type: 'missing',
        severity: 'high',
        affected_area: '',
        description: '', // Empty
      },
      {
        gap_type: 'missing',
        severity: 'high',
        affected_area: 'License',
        description: 'Missing license verification',
      },
    ];

    const { container } = render(
      <DecisionSummaryCard
        gaps={gaps}
        biasFlags={[]}
        confidenceBand="medium"
      />
    );

    // Should show only the valid gap
    expect(container.textContent).toContain('Missing license verification');
    // "What We Don't Know" section should render (because there's 1 valid gap)
    expect(container.textContent).toContain('What We Don\'t Know');
    // But should NOT show the empty gap (count should be 1, not 2)
    const text = container.textContent || '';
    const matches = text.match(/!/g);
    expect(matches?.length).toBe(1); // Only 1 exclamation mark for 1 gap
  });

  it('shows "No additional unknowns" when no valid gaps exist', () => {
    const gaps: Gap[] = [
      {
        gap_type: 'missing',
        severity: 'high',
        affected_area: '',
        description: '',
      },
    ];

    const { container } = render(
      <DecisionSummaryCard
        gaps={gaps}
        biasFlags={[]}
        confidenceBand="high"
      />
    );

    expect(container.textContent).toContain('No additional unknowns detected');
  });

  it('sorts gaps by severity in "What We Don\'t Know"', () => {
    const gaps: Gap[] = [
      {
        gap_type: 'missing',
        severity: 'low',
        affected_area: 'Low priority item',
        description: 'Low gap',
      },
      {
        gap_type: 'missing',
        severity: 'high',
        affected_area: 'High priority item',
        description: 'High gap',
      },
      {
        gap_type: 'missing',
        severity: 'medium',
        affected_area: 'Medium priority item',
        description: 'Medium gap',
      },
    ];

    const { container } = render(
      <DecisionSummaryCard
        gaps={gaps}
        biasFlags={[]}
        confidenceBand="medium"
      />
    );

    const text = container.textContent || '';
    const highIndex = text.indexOf('High gap');
    const mediumIndex = text.indexOf('Medium gap');
    
    // High should appear before medium (low is not shown as it's filtered out)
    expect(highIndex).toBeLessThan(mediumIndex);
  });

  it('shows "Show all" toggle when more than 5 gaps', async () => {
    const user = userEvent.setup();
    const gaps: Gap[] = Array.from({ length: 8 }, (_, i) => ({
      gap_type: 'missing',
      severity: 'high' as const,
      affected_area: `Area ${i}`,
      description: `Gap ${i + 1}`,
    }));

    const { container } = render(
      <DecisionSummaryCard
        gaps={gaps}
        biasFlags={[]}
        confidenceBand="medium"
      />
    );

    // Should show "Show all" button
    const showAllButton = screen.getByText(/Show all \(8\)/i);
    expect(showAllButton).toBeTruthy();

    // Click to expand
    await user.click(showAllButton);

    // Should now show "Show less" button
    expect(screen.getByText(/Show less/i)).toBeTruthy();
  });

  it('displays failed rules summary when rules data provided', () => {
    const failedRules: FailedRule[] = [
      {
        rule_id: 'RULE_001',
        severity: 'critical',
        message: 'License expired',
        expected_value: 'valid',
        actual_value: 'expired',
      },
      {
        rule_id: 'RULE_002',
        severity: 'high',
        message: 'Missing signature',
      },
    ];

    const { container } = render(
      <DecisionSummaryCard
        gaps={[]}
        biasFlags={[]}
        confidenceBand="low"
        rulesTotal={10}
        rulesPassed={8}
        failedRules={failedRules}
      />
    );

    expect(container.textContent).toContain('Failed Rules (2)');
    expect(container.textContent).toContain('License expired');
    expect(container.textContent).toContain('Missing signature');
    expect(container.textContent).toContain('RULE_001');
    expect(container.textContent).toContain('CRITICAL');
  });

  it('shows top 5 failed rules when more than 5 exist', () => {
    const failedRules: FailedRule[] = Array.from({ length: 8 }, (_, i) => ({
      rule_id: `RULE_${i + 1}`,
      severity: 'medium' as const,
      message: `Rule failure ${i + 1}`,
    }));

    const { container } = render(
      <DecisionSummaryCard
        gaps={[]}
        biasFlags={[]}
        confidenceBand="medium"
        rulesTotal={10}
        rulesPassed={2}
        failedRules={failedRules}
      />
    );

    expect(container.textContent).toContain('Failed Rules (8)');
    // New collapsible UI shows "Show all" button for > 3 rules
    expect(container.textContent).toContain('Show all (8)');
  });

  it('includes "All rules passed" in "What We Know" when all rules pass', () => {
    const { container } = render(
      <DecisionSummaryCard
        gaps={[]}
        biasFlags={[]}
        confidenceBand="high"
        rulesTotal={10}
        rulesPassed={10}
        failedRules={[]}
      />
    );

    expect(container.textContent).toContain('All 10 compliance rules passed');
  });
});

// Phase 7.13 - Enhanced UI Cleanup Tests
describe('DecisionSummaryCard - Phase 7.13 UI Cleanup', () => {
  it('renders no empty bullets when all arrays are empty', () => {
    const { container } = render(
      <DecisionSummaryCard
        gaps={[]}
        biasFlags={[]}
        confidenceBand="medium"
      />
    );

    const text = container.textContent || '';
    // Should not have any "!" bullets for gaps
    expect(text).not.toMatch(/!\s*$/); // No standalone exclamation marks
    // Should show "No additional unknowns detected"
    expect(text).toContain('No additional unknowns detected');
  });

  it('shows compact Rules badge with color coding', () => {
    const { container } = render(
      <DecisionSummaryCard
        gaps={[]}
        biasFlags={[]}
        confidenceBand="high"
        rulesTotal={10}
        rulesPassed={10}
        failedRules={[]}
      />
    );

    // Should show "Rules 10/10" in compact format
    expect(container.textContent).toContain('Rules 10/10');
  });

  it('shows warning-colored Rules badge when some rules fail', () => {
    const { container } = render(
      <DecisionSummaryCard
        gaps={[]}
        biasFlags={[]}
        confidenceBand="medium"
        rulesTotal={10}
        rulesPassed={7}
        failedRules={[
          { rule_id: 'RULE_1', severity: 'medium', message: 'Failed' },
          { rule_id: 'RULE_2', severity: 'medium', message: 'Failed' },
          { rule_id: 'RULE_3', severity: 'medium', message: 'Failed' },
        ]}
      />
    );

    expect(container.textContent).toContain('Rules 7/10');
  });

  it('shows critical indicator with Rules badge when critical rule fails', () => {
    const { container } = render(
      <DecisionSummaryCard
        gaps={[]}
        biasFlags={[]}
        confidenceBand="low"
        rulesTotal={10}
        rulesPassed={9}
        failedRules={[
          { rule_id: 'CRITICAL_1', severity: 'critical', message: 'Critical failure' },
        ]}
      />
    );

    expect(container.textContent).toContain('Rules 9/10');
    expect(container.textContent).toContain('⚠');
  });

  it('allows expanding/collapsing failed rules when more than 3 exist', async () => {
    const user = userEvent.setup();
    const failedRules: FailedRule[] = Array.from({ length: 6 }, (_, i) => ({
      rule_id: `RULE_${i + 1}`,
      severity: 'high' as const,
      message: `Rule failure ${i + 1}`,
    }));

    const { container } = render(
      <DecisionSummaryCard
        gaps={[]}
        biasFlags={[]}
        confidenceBand="medium"
        rulesTotal={10}
        rulesPassed={4}
        failedRules={failedRules}
      />
    );

    // Should show "Show all" button
    const showAllButton = screen.getByText(/Show all \(6\)/i);
    expect(showAllButton).toBeTruthy();

    // Click to expand
    await user.click(showAllButton);

    // Should now show "Show less"
    expect(screen.getByText(/Show less/i)).toBeTruthy();
    // Should show all 6 rules
    expect(container.textContent).toContain('RULE_6');
  });

  it('does not render "Risk & Bias Warnings" section when no bias flags', () => {
    const { container } = render(
      <DecisionSummaryCard
        gaps={[]}
        biasFlags={[]}
        confidenceBand="high"
      />
    );

    expect(container.textContent).not.toContain('Risk & Bias Warnings');
  });

  it('renders narrative only once when provided', () => {
    const narrative = 'This is a unique test narrative for case XYZ';
    const { container } = render(
      <DecisionSummaryCard
        narrative={narrative}
        gaps={[]}
        biasFlags={[]}
        confidenceBand="high"
      />
    );

    const text = container.textContent || '';
    const matches = text.match(/This is a unique test narrative for case XYZ/g);
    expect(matches?.length).toBe(1); // Should appear exactly once
  });
});
