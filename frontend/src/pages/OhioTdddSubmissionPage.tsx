/**
 * Ohio TDDD License Submission Page
 * 
 * Simple demo-grade submission form for Ohio Terminal Distributor of Dangerous Drugs
 * license verification. Follows the same pattern as CSF Practitioner.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSubmission } from '../submissions/submissionStoreSelector';
import { intakeSubmissionToCase } from '../workflow/submissionIntakeService';
import type { CreateSubmissionInput } from '../submissions/submissionTypes';

interface OhioTdddFormData {
  facilityName: string;
  tdddLicenseNumber: string;
  tdddCategory: string; // I, II, III
  stateLicenseExpiry: string; // YYYY-MM-DD
  responsiblePharmacist: string;
  responsiblePharmacistLicense: string;
  requestedSubstances: string; // comma-separated
  storageSecurityCompliant: boolean;
  attestationAccepted: boolean;
}

const initialForm: OhioTdddFormData = {
  facilityName: '',
  tdddLicenseNumber: '',
  tdddCategory: 'III',
  stateLicenseExpiry: '',
  responsiblePharmacist: '',
  responsiblePharmacistLicense: '',
  requestedSubstances: '',
  storageSecurityCompliant: false,
  attestationAccepted: false,
};

export function OhioTdddSubmissionPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<OhioTdddFormData>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<{
    caseId: string;
    submissionId: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Create submission record
      const submissionInput: CreateSubmissionInput = {
        decisionType: 'ohio_tddd',
        formData: {
          facility_name: form.facilityName,
          tddd_license_number: form.tdddLicenseNumber,
          tddd_category: form.tdddCategory,
          state_license_expiry: form.stateLicenseExpiry,
          responsible_pharmacist: form.responsiblePharmacist,
          responsible_pharmacist_license: form.responsiblePharmacistLicense,
          requested_substances: form.requestedSubstances,
          storage_security_compliant: form.storageSecurityCompliant,
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
      console.error('[OhioTDDD] Submission failed:', err);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Ohio TDDD License Verification
          </h1>
          <p className="text-slate-600">
            Terminal Distributor of Dangerous Drugs license application and renewal
          </p>
        </div>

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
                placeholder="Central Ohio Pharmacy"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  TDDD License Number *
                </label>
                <input
                  type="text"
                  required
                  value={form.tdddLicenseNumber}
                  onChange={(e) => setForm({ ...form, tdddLicenseNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="OH-TDDD-12345"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  TDDD Category *
                </label>
                <select
                  required
                  value={form.tdddCategory}
                  onChange={(e) => setForm({ ...form, tdddCategory: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="I">Category I - Retail Pharmacy</option>
                  <option value="II">Category II - Institutional</option>
                  <option value="III">Category III - Wholesale/Distribution</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                License Expiration Date *
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

          {/* Responsible Pharmacist */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">
              Responsible Pharmacist
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Pharmacist Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.responsiblePharmacist}
                  onChange={(e) => setForm({ ...form, responsiblePharmacist: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Dr. Jane Smith, RPh"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Ohio Pharmacist License *
                </label>
                <input
                  type="text"
                  required
                  value={form.responsiblePharmacistLicense}
                  onChange={(e) => setForm({ ...form, responsiblePharmacistLicense: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="OH-RPH-67890"
                />
              </div>
            </div>
          </div>

          {/* Controlled Substances */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">
              Requested Substances
            </h2>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Controlled Substances (comma-separated)
              </label>
              <textarea
                value={form.requestedSubstances}
                onChange={(e) => setForm({ ...form, requestedSubstances: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                rows={3}
                placeholder="Schedule II opioids, Schedule III benzodiazepines, Schedule IV stimulants"
              />
              <p className="text-xs text-slate-500 mt-1">
                List the controlled substance schedules and categories you intend to handle
              </p>
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
                  checked={form.storageSecurityCompliant}
                  onChange={(e) => setForm({ ...form, storageSecurityCompliant: e.target.checked })}
                  className="mt-1 w-4 h-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500"
                />
                <span className="text-sm text-slate-700">
                  I attest that our facility storage security complies with Ohio Admin. Code 4729:5-3-14
                  (locked cabinets, access controls, and surveillance systems)
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
                  false statements may result in license denial or revocation. *
                </span>
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-slate-200">
            <button
              type="submit"
              disabled={isSubmitting || !form.attestationAccepted}
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
