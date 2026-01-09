/**
 * Decision Packet HTML Template
 * 
 * Generates print-friendly HTML for decision packet export
 */

import type { DecisionPacket } from '../types/decisionPacket';

export function generateDecisionPacketHtml(packet: DecisionPacket): string {
  const formattedDate = new Date(packet.generatedAt).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
  
  const statusBadgeColor = {
    approved: '#10b981',
    blocked: '#ef4444',
    needs_review: '#f59e0b',
    submitted: '#3b82f6',
    unknown: '#6b7280'
  }[packet.decision.status];
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Decision Packet - ${packet.decision.submissionId || packet.decision.traceId || 'Export'}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background: #ffffff;
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    
    @media print {
      body {
        padding: 0;
        background: white;
      }
      .no-print {
        display: none !important;
      }
      .page-break {
        page-break-before: always;
      }
    }
    
    header {
      border-bottom: 3px solid #2563eb;
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
    }
    
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }
    
    .logo {
      font-size: 1.75rem;
      font-weight: 700;
      color: #2563eb;
    }
    
    .packet-id {
      font-size: 0.875rem;
      color: #6b7280;
      font-family: 'Courier New', monospace;
    }
    
    .header-meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      font-size: 0.875rem;
    }
    
    .meta-item {
      display: flex;
      flex-direction: column;
    }
    
    .meta-label {
      color: #6b7280;
      font-weight: 600;
      margin-bottom: 0.25rem;
    }
    
    .meta-value {
      color: #1f2937;
    }
    
    section {
      margin-bottom: 2.5rem;
    }
    
    h2 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #e5e7eb;
    }
    
    h3 {
      font-size: 1.125rem;
      font-weight: 600;
      color: #374151;
      margin-bottom: 0.75rem;
    }
    
    .decision-summary {
      background: #f3f4f6;
      border-left: 4px solid ${statusBadgeColor};
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    
    .status-badge {
      display: inline-block;
      padding: 0.375rem 0.75rem;
      border-radius: 0.375rem;
      font-weight: 600;
      font-size: 0.875rem;
      color: white;
      background-color: ${statusBadgeColor};
      margin-bottom: 0.75rem;
    }
    
    .summary-text {
      font-size: 1rem;
      line-height: 1.75;
      color: #374151;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
      margin-top: 1rem;
    }
    
    th {
      background: #f9fafb;
      padding: 0.75rem;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border: 1px solid #e5e7eb;
    }
    
    td {
      padding: 0.75rem;
      border: 1px solid #e5e7eb;
      vertical-align: top;
    }
    
    .severity-block {
      color: #dc2626;
      font-weight: 600;
    }
    
    .severity-review {
      color: #d97706;
      font-weight: 600;
    }
    
    .severity-info {
      color: #2563eb;
      font-weight: 600;
    }
    
    .evidence-list {
      list-style: none;
    }
    
    .evidence-item {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      padding: 1rem;
      margin-bottom: 1rem;
    }
    
    .evidence-title {
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 0.5rem;
    }
    
    .evidence-meta {
      font-size: 0.75rem;
      color: #6b7280;
      margin-bottom: 0.5rem;
    }
    
    .evidence-snippet {
      font-size: 0.875rem;
      color: #374151;
      line-height: 1.6;
      padding: 0.75rem;
      background: white;
      border-left: 3px solid #2563eb;
      margin-top: 0.5rem;
    }
    
    .next-steps {
      list-style: decimal;
      padding-left: 1.5rem;
    }
    
    .next-steps li {
      margin-bottom: 0.75rem;
      color: #374151;
    }
    
    .footer {
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 2px solid #e5e7eb;
      font-size: 0.75rem;
      color: #6b7280;
    }
    
    .print-instructions {
      background: #fef3c7;
      border: 1px solid #fbbf24;
      border-radius: 0.5rem;
      padding: 1rem;
      margin-bottom: 2rem;
      font-size: 0.875rem;
    }
    
    .print-instructions strong {
      color: #92400e;
    }
    
    .entity-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }
    
    .entity-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      padding: 1rem;
    }
    
    .entity-card h4 {
      font-size: 0.875rem;
      font-weight: 600;
      color: #2563eb;
      margin-bottom: 0.75rem;
    }
    
    .entity-field {
      display: flex;
      justify-content: space-between;
      font-size: 0.813rem;
      margin-bottom: 0.5rem;
    }
    
    .entity-label {
      color: #6b7280;
      font-weight: 500;
    }
    
    .entity-value {
      color: #1f2937;
      font-family: 'Courier New', monospace;
    }
  </style>
</head>
<body>
  <div class="print-instructions no-print">
    <strong>💡 Print Instructions:</strong> Use your browser's Print function (Ctrl+P / Cmd+P) and select "Save as PDF" to create a permanent audit record.
  </div>
  
  <header>
    <div class="header-top">
      <div class="logo">⚖️ AutoComply AI</div>
      <div class="packet-id">Packet ID: ${packet.decision.submissionId || packet.decision.traceId || 'N/A'}</div>
    </div>
    <div class="header-meta">
      <div class="meta-item">
        <span class="meta-label">Generated</span>
        <span class="meta-value">${formattedDate}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Tenant</span>
        <span class="meta-value">${packet.tenant || 'N/A'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Environment</span>
        <span class="meta-value">${packet.traceMeta.environment || 'N/A'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Packet Version</span>
        <span class="meta-value">${packet.packetVersion}</span>
      </div>
    </div>
  </header>
  
  <section>
    <h2>Decision Summary</h2>
    <div class="decision-summary">
      <div class="status-badge">${packet.decision.status.toUpperCase().replace('_', ' ')}</div>
      ${packet.decision.risk ? `<div style="margin-bottom: 0.5rem;"><strong>Risk Level:</strong> ${packet.decision.risk}</div>` : ''}
      ${packet.decision.csfType ? `<div style="margin-bottom: 0.5rem;"><strong>CSF Type:</strong> ${packet.decision.csfType}</div>` : ''}
      ${packet.decision.scenarioName ? `<div style="margin-bottom: 0.5rem;"><strong>Scenario:</strong> ${packet.decision.scenarioName}</div>` : ''}
      ${packet.decision.summary ? `<p class="summary-text">${packet.decision.summary}</p>` : ''}
    </div>
  </section>
  
  ${renderEntities(packet)}
  
  ${renderFiredRules(packet)}
  
  ${renderEvidence(packet)}
  
  <section>
    <h2>Next Steps</h2>
    <ol class="next-steps">
      ${packet.nextSteps.map(step => `<li>${step}</li>`).join('')}
    </ol>
  </section>
  
  <footer class="footer">
    <p><strong>Trace Metadata:</strong></p>
    <p>Run ID: ${packet.traceMeta.runId || 'N/A'} | Model: ${packet.traceMeta.modelVersion || 'N/A'} | Evaluator: ${packet.traceMeta.evaluatorVersion || 'N/A'} | Source: ${packet.traceMeta.sourceType || 'N/A'}</p>
    <p style="margin-top: 1rem;">This document is for audit and compliance review purposes. Data shown is from a demo environment and should not be used for production decisions.</p>
  </footer>
</body>
</html>`;
}

function renderEntities(packet: DecisionPacket): string {
  const { entities } = packet;
  
  if (!entities.facility && !entities.practitioner && !entities.pharmacy && (!entities.licenses || entities.licenses.length === 0)) {
    return '';
  }
  
  let html = '<section><h2>Entities</h2><div class="entity-grid">';
  
  if (entities.facility) {
    html += `
      <div class="entity-card">
        <h4>Facility</h4>
        ${entities.facility.name ? `<div class="entity-field"><span class="entity-label">Name:</span><span class="entity-value">${entities.facility.name}</span></div>` : ''}
        ${entities.facility.type ? `<div class="entity-field"><span class="entity-label">Type:</span><span class="entity-value">${entities.facility.type}</span></div>` : ''}
        ${entities.facility.state ? `<div class="entity-field"><span class="entity-label">State:</span><span class="entity-value">${entities.facility.state}</span></div>` : ''}
        ${entities.facility.deaNumber ? `<div class="entity-field"><span class="entity-label">DEA:</span><span class="entity-value">${entities.facility.deaNumber}</span></div>` : ''}
        ${entities.facility.tdddCertificate ? `<div class="entity-field"><span class="entity-label">TDDD Cert:</span><span class="entity-value">${entities.facility.tdddCertificate}</span></div>` : ''}
      </div>
    `;
  }
  
  if (entities.practitioner) {
    html += `
      <div class="entity-card">
        <h4>Practitioner</h4>
        ${entities.practitioner.name ? `<div class="entity-field"><span class="entity-label">Name:</span><span class="entity-value">${entities.practitioner.name}</span></div>` : ''}
        ${entities.practitioner.npi ? `<div class="entity-field"><span class="entity-label">NPI:</span><span class="entity-value">${entities.practitioner.npi}</span></div>` : ''}
        ${entities.practitioner.deaNumber ? `<div class="entity-field"><span class="entity-label">DEA:</span><span class="entity-value">${entities.practitioner.deaNumber}</span></div>` : ''}
        ${entities.practitioner.state ? `<div class="entity-field"><span class="entity-label">State:</span><span class="entity-value">${entities.practitioner.state}</span></div>` : ''}
        ${entities.practitioner.stateLicenseNumber ? `<div class="entity-field"><span class="entity-label">License:</span><span class="entity-value">${entities.practitioner.stateLicenseNumber}</span></div>` : ''}
      </div>
    `;
  }
  
  if (entities.pharmacy) {
    html += `
      <div class="entity-card">
        <h4>Pharmacy</h4>
        ${entities.pharmacy.name ? `<div class="entity-field"><span class="entity-label">Name:</span><span class="entity-value">${entities.pharmacy.name}</span></div>` : ''}
        ${entities.pharmacy.state ? `<div class="entity-field"><span class="entity-label">State:</span><span class="entity-value">${entities.pharmacy.state}</span></div>` : ''}
        ${entities.pharmacy.licenseNumber ? `<div class="entity-field"><span class="entity-label">License:</span><span class="entity-value">${entities.pharmacy.licenseNumber}</span></div>` : ''}
      </div>
    `;
  }
  
  html += '</div></section>';
  return html;
}

function renderFiredRules(packet: DecisionPacket): string {
  if (packet.firedRules.length === 0) {
    return `
      <section>
        <h2>Fired Rules</h2>
        <p style="padding: 1rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0.5rem; color: #6b7280;">
          No regulatory rules were triggered by this submission.
        </p>
      </section>
    `;
  }
  
  return `
    <section class="page-break">
      <h2>Fired Rules (${packet.firedRules.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Rule ID</th>
            <th>Title</th>
            <th>Severity</th>
            <th>Jurisdiction</th>
            <th>Requirement</th>
          </tr>
        </thead>
        <tbody>
          ${packet.firedRules.map(rule => `
            <tr>
              <td><code>${rule.ruleId}</code></td>
              <td>${rule.title}</td>
              <td class="severity-${rule.severity}">${rule.severity.toUpperCase()}</td>
              <td>${rule.jurisdiction || 'N/A'}</td>
              <td>${rule.requirement || rule.rationale || 'N/A'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>
  `;
}

function renderEvidence(packet: DecisionPacket): string {
  if (packet.evidence.length === 0) {
    return `
      <section>
        <h2>Evidence</h2>
        <p style="padding: 1rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0.5rem; color: #6b7280;">
          No evidence documents were referenced in this decision.
        </p>
      </section>
    `;
  }
  
  return `
    <section class="page-break">
      <h2>Evidence (${packet.evidence.length})</h2>
      <ul class="evidence-list">
        ${packet.evidence.map((ev, idx) => `
          <li class="evidence-item">
            <div class="evidence-title">${idx + 1}. ${ev.docTitle}</div>
            <div class="evidence-meta">
              ${ev.jurisdiction ? `Jurisdiction: ${ev.jurisdiction}` : ''}
              ${ev.section ? ` | Section: ${ev.section}` : ''}
              ${ev.score ? ` | Relevance: ${(ev.score * 100).toFixed(0)}%` : ''}
            </div>
            ${ev.snippet ? `<div class="evidence-snippet">${ev.snippet}</div>` : ''}
          </li>
        `).join('')}
      </ul>
    </section>
  `;
}
