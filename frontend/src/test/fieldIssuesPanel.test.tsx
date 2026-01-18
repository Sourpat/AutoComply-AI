import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FieldIssuesPanel } from '../features/intelligence/FieldIssuesPanel';
import type { ReactElement } from 'react';

/**
 * Test suite for FieldIssuesPanel component
 * 
 * Tests:
 * 1. Empty state when all checks pass
 * 2. Grouping by severity
 * 3. Correct counts for each severity level
 * 4. Null render when no data available
 */

describe('FieldIssuesPanel', () => {
  it('shows success state when all field checks pass', () => {
    render(
      <FieldIssuesPanel
        fieldIssues={[]}
        fieldChecksTotal={15}
        fieldChecksPassed={15}
      />
    );

    // Should show "All field validations passed"
    expect(screen.getByText(/all field validations passed/i)).toBeInTheDocument();
    
    // Should show passed count
    expect(screen.getByText('15/15 Passed')).toBeInTheDocument();
  });

  it('groups issues by severity correctly', () => {
    const fieldIssues = [
      {
        field: 'npi',
        severity: 'critical' as const,
        check: 'npi_format',
        message: 'Invalid NPI format',
      },
      {
        field: 'email',
        severity: 'medium' as const,
        check: 'email_format',
        message: 'Invalid email format',
      },
      {
        field: 'phone',
        severity: 'medium' as const,
        check: 'phone_format',
        message: 'Invalid phone format',
      },
      {
        field: 'name',
        severity: 'low' as const,
        check: 'placeholder_value',
        message: 'Placeholder value detected',
      },
    ];

    render(
      <FieldIssuesPanel
        fieldIssues={fieldIssues}
        fieldChecksTotal={15}
        fieldChecksPassed={11}
      />
    );

    // Should show correct counts
    expect(screen.getByText('11/15 Passed')).toBeInTheDocument();

    // Should have critical section with count
    expect(screen.getByText(/critical issues \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText('npi')).toBeInTheDocument();
    expect(screen.getByText('Invalid NPI format')).toBeInTheDocument();

    // Should have medium section with count
    expect(screen.getByText(/medium priority \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText('email')).toBeInTheDocument();
    expect(screen.getByText('phone')).toBeInTheDocument();

    // Should have low section with count
    expect(screen.getByText(/low priority \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
  });

  it('shows correct severity counts', () => {
    const fieldIssues = [
      {
        field: 'dea',
        severity: 'critical' as const,
        message: 'Invalid DEA',
      },
      {
        field: 'license',
        severity: 'critical' as const,
        message: 'Expired license',
      },
      {
        field: 'state',
        severity: 'medium' as const,
        message: 'Invalid state code',
      },
    ];

    render(
      <FieldIssuesPanel
        fieldIssues={fieldIssues}
        fieldChecksTotal={10}
        fieldChecksPassed={7}
      />
    );

    // Critical count should be 2
    expect(screen.getByText(/critical issues \(2\)/i)).toBeInTheDocument();
    
    // Medium count should be 1
    expect(screen.getByText(/medium priority \(1\)/i)).toBeInTheDocument();
  });

  it('renders null when no field checks data available', () => {
    const { container } = render(
      <FieldIssuesPanel
        fieldIssues={[]}
        fieldChecksTotal={0}
        fieldChecksPassed={0}
      />
    );

    // Component should not render anything
    expect(container.firstChild).toBeNull();
  });

  it('displays check names when provided', () => {
    const fieldIssues = [
      {
        field: 'email',
        severity: 'medium' as const,
        check: 'email_format',
        message: 'Invalid email address',
      },
    ];

    render(
      <FieldIssuesPanel
        fieldIssues={fieldIssues}
        fieldChecksTotal={5}
        fieldChecksPassed={4}
      />
    );

    // Should show the check name
    expect(screen.getByText(/check: email_format/i)).toBeInTheDocument();
  });

  it('handles missing optional check field gracefully', () => {
    const fieldIssues = [
      {
        field: 'license_number',
        severity: 'critical' as const,
        message: 'Missing required field',
      },
    ];

    render(
      <FieldIssuesPanel
        fieldIssues={fieldIssues}
        fieldChecksTotal={8}
        fieldChecksPassed={7}
      />
    );

    // Should render the issue
    expect(screen.getByText('license_number')).toBeInTheDocument();
    expect(screen.getByText('Missing required field')).toBeInTheDocument();
    
    // Should not show check label since it's not provided
    expect(screen.queryByText(/check:/i)).not.toBeInTheDocument();
  });

  it('shows critical issues with warning icon', () => {
    const fieldIssues = [
      {
        field: 'npi',
        severity: 'critical' as const,
        message: 'Invalid NPI',
      },
    ];

    const { container } = render(
      <FieldIssuesPanel
        fieldIssues={fieldIssues}
        fieldChecksTotal={10}
        fieldChecksPassed={9}
      />
    );

    // Should show critical section header
    expect(screen.getByText(/critical issues \(1\)/i)).toBeInTheDocument();
    
    // Should render the field and message
    expect(screen.getByText('npi')).toBeInTheDocument();
    expect(screen.getByText('Invalid NPI')).toBeInTheDocument();
    
    // Warning icon should be present in the rendered output
    expect(container.textContent).toContain('⚠');
  });

  it('handles large number of issues with show more/less', () => {
    // Create 5 critical issues
    const fieldIssues = Array.from({ length: 5 }, (_, i) => ({
      field: `field_${i}`,
      severity: 'critical' as const,
      message: `Issue ${i}`,
    }));

    render(
      <FieldIssuesPanel
        fieldIssues={fieldIssues}
        fieldChecksTotal={10}
        fieldChecksPassed={5}
      />
    );

    // Should show first 3 issues by default
    expect(screen.getByText('field_0')).toBeInTheDocument();
    expect(screen.getByText('field_1')).toBeInTheDocument();
    expect(screen.getByText('field_2')).toBeInTheDocument();

    // Should have "Show 2 more" button
    expect(screen.getByText(/show 2 more/i)).toBeInTheDocument();
  });
});
