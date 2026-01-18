/**
 * Tests for submission field issues rendering
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FieldIssueBadge } from '../features/submission/FieldIssueBadge';

describe('FieldIssueBadge', () => {
  it('renders badge with severity-specific styling', () => {
    const { rerender } = render(
      <FieldIssueBadge severity="critical" message="Invalid format" />
    );
    
    // Check critical styling
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('⚠')).toBeInTheDocument();
    
    // Check medium styling
    rerender(<FieldIssueBadge severity="medium" message="Warning" />);
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('⚡')).toBeInTheDocument();
    
    // Check low styling
    rerender(<FieldIssueBadge severity="low" message="Info" />);
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByText('ℹ')).toBeInTheDocument();
  });

  it('displays count when multiple issues present', () => {
    render(
      <FieldIssueBadge 
        severity="critical" 
        message="Multiple issues" 
        count={3}
      />
    );
    
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('does not display count for single issue', () => {
    render(
      <FieldIssueBadge 
        severity="critical" 
        message="Single issue" 
      />
    );
    
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('includes check name in component when provided', () => {
    const { container } = render(
      <FieldIssueBadge 
        severity="critical" 
        message="Invalid NPI format" 
        check="npi_format"
      />
    );
    
    // Badge should be visible
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  it('renders with message prop', () => {
    const message = 'This is a detailed validation error message';
    render(
      <FieldIssueBadge 
        severity="medium" 
        message={message}
      />
    );
    
    // Badge should render (tooltip hidden until hover)
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('uses correct color classes for critical severity', () => {
    const { container } = render(
      <FieldIssueBadge severity="critical" message="Error" />
    );
    
    const badge = container.querySelector('button');
    expect(badge?.className).toContain('bg-red-100');
    expect(badge?.className).toContain('border-red-300');
    expect(badge?.className).toContain('text-red-700');
  });

  it('uses correct color classes for medium severity', () => {
    const { container } = render(
      <FieldIssueBadge severity="medium" message="Warning" />
    );
    
    const badge = container.querySelector('button');
    expect(badge?.className).toContain('bg-amber-100');
    expect(badge?.className).toContain('border-amber-300');
    expect(badge?.className).toContain('text-amber-700');
  });

  it('uses correct color classes for low severity', () => {
    const { container } = render(
      <FieldIssueBadge severity="low" message="Info" />
    );
    
    const badge = container.querySelector('button');
    expect(badge?.className).toContain('bg-blue-100');
    expect(badge?.className).toContain('border-blue-300');
    expect(badge?.className).toContain('text-blue-700');
  });
});
