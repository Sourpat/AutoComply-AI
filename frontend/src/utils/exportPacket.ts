/**
 * Export Packet Utilities
 * 
 * Helper functions to download decision packets as JSON or HTML
 */

import type { DecisionPacket } from '../types/decisionPacket';

/**
 * Generate filename for decision packet export
 */
export function generatePacketFilename(packet: DecisionPacket, extension: 'json' | 'html'): string {
  const tenant = packet.tenant || 'demo';
  const identifier = packet.decision.submissionId || packet.decision.traceId || 'unknown';
  const timestamp = new Date(packet.generatedAt).toISOString()
    .replace(/[:.]/g, '')
    .replace('T', '-')
    .substring(0, 15); // YYYYMMDD-HHMM
  
  return `AutoComply_DecisionPacket_${tenant}_${identifier}_${timestamp}.${extension}`;
}

/**
 * Download decision packet as JSON file
 */
export function downloadJson(packet: DecisionPacket): void {
  const filename = generatePacketFilename(packet, 'json');
  const jsonString = JSON.stringify(packet, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  if (link.parentNode === document.body) {
    document.body.removeChild(link);
  }
  URL.revokeObjectURL(url);
  
  console.log('[Export] Downloaded decision packet:', filename);
}

/**
 * Download decision packet as HTML file
 */
export function downloadHtml(packet: DecisionPacket, htmlString: string): void {
  const filename = generatePacketFilename(packet, 'html');
  const blob = new Blob([htmlString], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  if (link.parentNode === document.body) {
    document.body.removeChild(link);
  }
  URL.revokeObjectURL(url);
  
  console.log('[Export] Downloaded decision packet HTML:', filename);
}

/**
 * Copy decision packet JSON to clipboard
 */
export async function copyPacketToClipboard(packet: DecisionPacket): Promise<void> {
  const jsonString = JSON.stringify(packet, null, 2);
  await navigator.clipboard.writeText(jsonString);
  console.log('[Export] Copied decision packet to clipboard');
}
