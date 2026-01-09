/**
 * Request Info Message Generator
 * 
 * Generates copyable message templates for requesting missing information from submitters
 */

import { getFieldDisplayName } from './completenessScorer';
import type { CompletenessScore } from './completenessScorer';

export interface RequestInfoTemplate {
  subject: string;
  message: string;
  missingFieldsCount: number;
}

/**
 * Generate request info message template
 */
export function generateRequestInfoMessage(
  completeness: CompletenessScore,
  submissionId: string | null,
  csfType: string
): RequestInfoTemplate {
  const blockFields = completeness.missing.block;
  const reviewFields = completeness.missing.review;
  const allMissingFields = [...blockFields, ...reviewFields];
  
  if (allMissingFields.length === 0) {
    return {
      subject: `Submission ${submissionId || 'N/A'} - No Missing Information`,
      message: `This submission appears to be complete. No additional information is required at this time.`,
      missingFieldsCount: 0
    };
  }
  
  // Build field list with severity indicators
  const fieldList = [
    ...blockFields.map(field => 
      `  • ${getFieldDisplayName(field)} [REQUIRED]`
    ),
    ...reviewFields.map(field => 
      `  • ${getFieldDisplayName(field)} [RECOMMENDED]`
    )
  ].join('\n');
  
  const blockCount = blockFields.length;
  const reviewCount = reviewFields.length;
  
  const urgencyNote = blockCount > 0 
    ? `\n\n⚠️ IMPORTANT: ${blockCount} required field${blockCount !== 1 ? 's are' : ' is'} missing. This submission cannot be approved until these fields are provided.`
    : '';
  
  const subject = `Action Required: Missing Information for ${csfType} CSF Submission ${submissionId || ''}`;
  
  const message = `Hello,

Thank you for your recent ${csfType} CSF submission${submissionId ? ` (ID: ${submissionId})` : ''}.

Our automated compliance review has identified that additional information is needed to complete the evaluation. Please provide the following:

${fieldList}${urgencyNote}

Please respond with the requested information at your earliest convenience. Once we receive this data, we will re-evaluate your submission.

If you have any questions or need clarification on any of these requirements, please don't hesitate to reach out.

Best regards,
AutoComply AI Compliance Team`;

  return {
    subject,
    message,
    missingFieldsCount: allMissingFields.length
  };
}

/**
 * Generate a shorter, email-friendly version
 */
export function generateEmailTemplate(
  completeness: CompletenessScore,
  submissionId: string | null,
  csfType: string
): RequestInfoTemplate {
  const template = generateRequestInfoMessage(completeness, submissionId, csfType);
  
  // Wrap in email structure
  const emailMessage = `Subject: ${template.subject}

${template.message}`;

  return {
    ...template,
    message: emailMessage
  };
}

/**
 * Generate a compact Slack/Teams message version
 */
export function generateSlackTemplate(
  completeness: CompletenessScore,
  submissionId: string | null,
  csfType: string
): RequestInfoTemplate {
  const blockFields = completeness.missing.block;
  const reviewFields = completeness.missing.review;
  const allMissingFields = [...blockFields, ...reviewFields];
  
  if (allMissingFields.length === 0) {
    return {
      subject: `✅ Submission ${submissionId || 'N/A'} Complete`,
      message: `Submission is complete - no action needed.`,
      missingFieldsCount: 0
    };
  }
  
  const fieldList = [
    ...blockFields.map(field => `• ${getFieldDisplayName(field)} 🔴`),
    ...reviewFields.map(field => `• ${getFieldDisplayName(field)} 🟡`)
  ].join('\n');
  
  const subject = `⚠️ Action Required: ${csfType} CSF ${submissionId || ''}`;
  
  const message = `*Missing Information Detected*

Submission: \`${submissionId || 'N/A'}\`
CSF Type: ${csfType}
Missing Fields: ${allMissingFields.length}

${fieldList}

Legend: 🔴 Required | 🟡 Recommended`;

  return {
    subject,
    message,
    missingFieldsCount: allMissingFields.length
  };
}
