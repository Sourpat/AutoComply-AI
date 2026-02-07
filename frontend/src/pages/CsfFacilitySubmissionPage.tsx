/**
 * CSF Facility Submission Page
 * 
 * Simple demo-grade submission form for hospital/facility DEA CSF verification.
 * Follows the same pattern as CSF Practitioner.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSubmission } from '../submissions/submissionStoreSelector';
import { intakeSubmissionToCase } from '../workflow/submissionIntakeService';
import type { CreateSubmissionInput } from '../submissions/submissionTypes';
import { createSubmitterSubmission } from '../api/submitterApi';
import { listSubmissionAttachments, uploadSubmissionAttachment } from '../api/attachmentsApi';

interface CsfFacilityFormData {
  facilityName: string;
  facilityType: string; // hospital, clinic, ambulatory_surgery_center
  facilityDeaNumber: string;
  deaExpiry: string; // YYYY-MM-DD
  stateFacilityLicenseNumber: string;
  stateLicenseExpiry: string;
  responsiblePerson: string;
  responsiblePersonType: string; // pharmacist, physician
  responsiblePersonDea: string;
  storageSecurityCompliant: boolean;
  recordkeepingSystemCompliant: boolean;
  diversionPreventionProgram: boolean;
  attestationAccepted: boolean;
}

const initialForm: CsfFacilityFormData = {
  facilityName: '',
  facilityType: 'hospital',
  facilityDeaNumber: '',
  deaExpiry: '',
  stateFacilityLicenseNumber: '',
  stateLicenseExpiry: '',
  responsiblePerson: '',
  responsiblePersonType: 'pharmacist',
  responsiblePersonDea: '',
  storageSecurityCompliant: false,
  recordkeepingSystemCompliant: false,
  diversionPreventionProgram: false,
  attestationAccepted: false,
};

export function CsfFacilitySubmissionPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<CsfFacilityFormData>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<{
    caseId: string;
    submissionId: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devSubmission, setDevSubmission] = useState<{
    caseId: string;
    submissionId: string;
  } | null>(null);
  const [devBusy, setDevBusy] = useState(false);
  const [devError, setDevError] = useState<string | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentList, setAttachmentList] = useState<any[]>([]);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const isDev = (import.meta as any)?.env?.DEV ?? false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Create submission record
      const submissionInput: CreateSubmissionInput = {
        decisionType: 'csf_facility',
        formData: {
          facility_name: form.facilityName,
          facility_type: form.facilityType,
          facility_dea_number: form.facilityDeaNumber,
          dea_expiry: form.deaExpiry,
          state_facility_license_number: form.stateFacilityLicenseNumber,
          state_license_expiry: form.stateLicenseExpiry,
          responsible_person: form.responsiblePerson,
          responsible_person_type: form.responsiblePersonType,
          responsible_person_dea: form.responsiblePersonDea,
          storage_security_compliant: form.storageSecurityCompliant,
          recordkeeping_system_compliant: form.recordkeepingSystemCompliant,
          diversion_prevention_program: form.diversionPreventionProgram,
          attestation_accepted: form.attestationAccepted,
        },
        rawPayload: form as unknown as Record<string, unknown>,
        evaluatorOutput: {
          status: 'needs_review' as const,
        },
      };

      const submission = await createSubmission(submissionInput);

      // Intake to case with RAG evidence
      const { caseId } = await intakeSubmissionToCase(submission.id);

      setSubmissionSuccess({
        caseId,
        submissionId: submission.id,
      });
    } catch (err) {
      console.error('[CsfFacility] Submission failed:', err);
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenCase = () => {
    if (submissionSuccess?.caseId) {
      navigate(`/console?caseId=${submissionSuccess.caseId}`);
    }
  };

  const handleDevSubmitter = async () => {
    setDevBusy(true);
    setDevError(null);
    try {
      const response = await createSubmitterSubmission({
        client_token: `dev-${Date.now()}`,
        subject: `Demo submission ${new Date().toISOString()}`,
        submitter_name: 'Demo Submitter',
        jurisdiction: 'OH',
        doc_type: 'csf_facility',
        notes: 'Dev-only submitter submission for Phase 5.1',
        attachments: [{ name: 'facility_license.pdf', content_type: 'application/pdf', size_bytes: 12345 }],
      });
      setDevSubmission({
        caseId: response.verifier_case_id,
        submissionId: response.submission_id,
      });
      const attachments = await listSubmissionAttachments(response.submission_id);
      setAttachmentList(attachments);
    } catch (err) {
      setDevError(err instanceof Error ? err.message : 'Submitter submission failed');
    } finally {
      setDevBusy(false);
    }
  };

  const handleUploadAttachment = async () => {
    if (!attachmentFile) return;
    const submissionId = submissionSuccess?.submissionId || devSubmission?.submissionId;
    if (!submissionId) return;
    setAttachmentBusy(true);
    setAttachmentError(null);
    try {
      await uploadSubmissionAttachment(submissionId, attachmentFile);
      const attachments = await listSubmissionAttachments(submissionId);
      setAttachmentList(attachments);
      setAttachmentFile(null);
    } catch (err) {
      setAttachmentError(err instanceof Error ? err.message : 'Attachment upload failed');
    } finally {
      setAttachmentBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            DEA CSF Facility Application
          </h1>
          <p className="text-slate-600">
            Controlled Substance Facilitator verification for hospitals and healthcare facilities
          </p>
        </div>

        {isDev && (
          <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Dev-only: Create submitter submission</h3>
                <p className="text-xs text-slate-500">Creates a linked verifier case for Phase 5.1.</p>
              </div>
              <button
                onClick={handleDevSubmitter}
                disabled={devBusy}
                className="px-3 py-1.5 rounded-md border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {devBusy ? 'Creating…' : 'Create submission'}
              </button>
            </div>
            {devError && <p className="mt-2 text-xs text-red-600">{devError}</p>}
            {devSubmission && (
              <div className="mt-2 text-xs text-slate-600">
                Verifier Case: {devSubmission.caseId} —
                <button
                  className="ml-2 text-xs font-semibold text-sky-600 hover:text-sky-700"
                  onClick={() => navigate(`/console/cases?caseId=${devSubmission.caseId}`)}
                >
                  Open in Verifier Console
                </button>
              </div>
            )}
            {(submissionSuccess?.submissionId || devSubmission?.submissionId) && (
              <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="text-xs font-semibold text-slate-700">Evidence attachments</div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="file"
                    onChange={(event) => setAttachmentFile(event.target.files?.[0] || null)}
                    className="text-xs"
                  />
                  <button
                    onClick={handleUploadAttachment}
                    disabled={attachmentBusy || !attachmentFile}
                    className="px-3 py-1.5 rounded-md border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {attachmentBusy ? 'Uploading…' : 'Upload'}
                  </button>
                </div>
                {attachmentError && <p className="mt-2 text-xs text-red-600">{attachmentError}</p>}
                {attachmentList.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs text-slate-600">
                    {attachmentList.map((item: any) => (
                      <li key={item.attachment_id} className="rounded border border-slate-200 bg-white px-2 py-1">
                        {item.filename} ({item.byte_size} bytes)
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">No attachments uploaded yet.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Success Banner */}
        {submissionSuccess && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-green-900 font-semibold mb-1">
                  ✓ Application Submitted Successfully
                </h3>
                <p className="text-sm text-green-700">
                  Case ID: {submissionSuccess.caseId}
                </p>
              </div>
              <button
                onClick={handleOpenCase}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
              >
                Open Case in Console
              </button>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-6">
          {/* Facility Information */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">
              Facility Information
            </h2>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Facility Name *
              </label>
              <input
                type="text"
                required
                value={form.facilityName}
                onChange={(e) => setForm({ ...form, facilityName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="Memorial Regional Hospital"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Facility Type *
              </label>
              <select
                required
                value={form.facilityType}
                onChange={(e) => setForm({ ...form, facilityType: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="hospital">Hospital</option>
                <option value="clinic">Clinic</option>
                <option value="ambulatory_surgery_center">Ambulatory Surgery Center</option>
                <option value="long_term_care">Long-Term Care Facility</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Facility DEA Registration Number *
                </label>
                <input
                  type="text"
                  required
                  value={form.facilityDeaNumber}
                  onChange={(e) => setForm({ ...form, facilityDeaNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="FM1234567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  DEA Expiration Date *
                </label>
                <input
                  type="date"
                  required
                  value={form.deaExpiry}
                  onChange={(e) => setForm({ ...form, deaExpiry: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  State Facility License Number *
                </label>
                <input
                  type="text"
                  required
                  value={form.stateFacilityLicenseNumber}
                  onChange={(e) => setForm({ ...form, stateFacilityLicenseNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="STATE-HOSP-12345"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  State License Expiration *
                </label>
                <input
                  type="date"
                  required
                  value={form.stateLicenseExpiry}
                  onChange={(e) => setForm({ ...form, stateLicenseExpiry: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Responsible Person */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">
              Designated Responsible Person
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Responsible Person Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.responsiblePerson}
                  onChange={(e) => setForm({ ...form, responsiblePerson: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Dr. Jane Smith"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Person Type *
                </label>
                <select
                  required
                  value={form.responsiblePersonType}
                  onChange={(e) => setForm({ ...form, responsiblePersonType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="pharmacist">Pharmacist</option>
                  <option value="physician">Physician</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Responsible Person DEA Number *
              </label>
              <input
                type="text"
                required
                value={form.responsiblePersonDea}
                onChange={(e) => setForm({ ...form, responsiblePersonDea: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="AS1234567 or BP7654321"
              />
            </div>
          </div>

          {/* Compliance Attestations */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">
              Compliance Attestations
            </h2>

            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={form.storageSecurityCompliant}
                  onChange={(e) => setForm({ ...form, storageSecurityCompliant: e.target.checked })}
                  className="mt-1 w-4 h-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500"
                />
                <span className="text-sm text-slate-700">
                  I attest that storage security complies with DEA requirements (locked cabinets/carts,
                  pharmacy safes, automated dispensing cabinets with access controls) *
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={form.recordkeepingSystemCompliant}
                  onChange={(e) => setForm({ ...form, recordkeepingSystemCompliant: e.target.checked })}
                  className="mt-1 w-4 h-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500"
                />
                <span className="text-sm text-slate-700">
                  I attest that our controlled substance recordkeeping system (EHR/pharmacy system) meets
                  DEA retention requirements (2+ years) *
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={form.diversionPreventionProgram}
                  onChange={(e) => setForm({ ...form, diversionPreventionProgram: e.target.checked })}
                  className="mt-1 w-4 h-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500"
                />
                <span className="text-sm text-slate-700">
                  I attest that our facility has a written diversion prevention program with employee
                  screening, access monitoring, and discrepancy investigation procedures *
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={form.attestationAccepted}
                  onChange={(e) => setForm({ ...form, attestationAccepted: e.target.checked })}
                  className="mt-1 w-4 h-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500"
                />
                <span className="text-sm text-slate-700">
                  I certify that all information provided is accurate and complete. I understand that
                  false statements may result in application denial or regulatory action. *
                </span>
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-slate-200">
            <button
              type="submit"
              disabled={
                isSubmitting ||
                !form.storageSecurityCompliant ||
                !form.recordkeepingSystemCompliant ||
                !form.diversionPreventionProgram ||
                !form.attestationAccepted
              }
              className="w-full px-6 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:bg-slate-300 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {isSubmitting ? 'Submitting Application...' : 'Submit Application'}
            </button>
            <p className="text-xs text-slate-500 text-center mt-2">
              This will create a submission and case for review
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
