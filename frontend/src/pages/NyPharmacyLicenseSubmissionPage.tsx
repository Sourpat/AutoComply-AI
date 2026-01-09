/**
 * NY Pharmacy License Submission Page
 * 
 * Simple demo-grade submission form for New York pharmacy license verification.
 * Follows the same pattern as CSF Practitioner.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSubmission } from '../submissions/submissionStoreSelector';
import { intakeSubmissionToCase } from '../workflow/submissionIntakeService';
import type { CreateSubmissionInput } from '../submissions/submissionTypes';

interface NyPharmacyLicenseFormData {
  pharmacyName: string;
  nyPharmacyLicenseNumber: string;
  licenseExpiry: string; // YYYY-MM-DD (triennial)
  pharmacistInCharge: string;
  picLicenseNumber: string;
  nysdohRegistrationNumber: string;
  bneRegistrationNumber: string;
  facilityType: string; // retail, hospital, clinic, compounding
  performsCompounding: boolean;
  istopCompliant: boolean;
  attestationAccepted: boolean;
}

const initialForm: NyPharmacyLicenseFormData = {
  pharmacyName: '',
  nyPharmacyLicenseNumber: '',
  licenseExpiry: '',
  pharmacistInCharge: '',
  picLicenseNumber: '',
  nysdohRegistrationNumber: '',
  bneRegistrationNumber: '',
  facilityType: 'retail',
  performsCompounding: false,
  istopCompliant: false,
  attestationAccepted: false,
};

export function NyPharmacyLicenseSubmissionPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<NyPharmacyLicenseFormData>(initialForm);
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
        decisionType: 'ny_pharmacy_license',
        formData: {
          pharmacy_name: form.pharmacyName,
          ny_pharmacy_license_number: form.nyPharmacyLicenseNumber,
          license_expiry: form.licenseExpiry,
          pharmacist_in_charge: form.pharmacistInCharge,
          pic_license_number: form.picLicenseNumber,
          nysdoh_registration_number: form.nysdohRegistrationNumber,
          bne_registration_number: form.bneRegistrationNumber,
          facility_type: form.facilityType,
          performs_compounding: form.performsCompounding,
          istop_compliant: form.istopCompliant,
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
      console.error('[NYPharmacy] Submission failed:', err);
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
            NY Pharmacy License Verification
          </h1>
          <p className="text-slate-600">
            New York pharmacy license application and triennial renewal
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
          {/* Pharmacy Information */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">
              Pharmacy Information
            </h2>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Pharmacy Name *
              </label>
              <input
                type="text"
                required
                value={form.pharmacyName}
                onChange={(e) => setForm({ ...form, pharmacyName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="Manhattan Community Pharmacy"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  NY Pharmacy License Number *
                </label>
                <input
                  type="text"
                  required
                  value={form.nyPharmacyLicenseNumber}
                  onChange={(e) => setForm({ ...form, nyPharmacyLicenseNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="NY-PH-123456"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  License Expiration Date *
                </label>
                <input
                  type="date"
                  required
                  value={form.licenseExpiry}
                  onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
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
                <option value="retail">Retail Pharmacy</option>
                <option value="hospital">Hospital Pharmacy</option>
                <option value="clinic">Clinic Pharmacy</option>
                <option value="compounding">Compounding Pharmacy</option>
              </select>
            </div>
          </div>

          {/* Pharmacist-in-Charge */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">
              Pharmacist-in-Charge (PIC)
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  PIC Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.pharmacistInCharge}
                  onChange={(e) => setForm({ ...form, pharmacistInCharge: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Dr. John Doe, PharmD"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  PIC License Number *
                </label>
                <input
                  type="text"
                  required
                  value={form.picLicenseNumber}
                  onChange={(e) => setForm({ ...form, picLicenseNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="NY-RPH-78901"
                />
              </div>
            </div>
          </div>

          {/* Registrations */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">
              Required Registrations
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  NYSDOH Registration Number *
                </label>
                <input
                  type="text"
                  required
                  value={form.nysdohRegistrationNumber}
                  onChange={(e) => setForm({ ...form, nysdohRegistrationNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="NYSDOH-456789"
                />
                <p className="text-xs text-slate-500 mt-1">NY State Dept of Health registration</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  BNE Registration Number *
                </label>
                <input
                  type="text"
                  required
                  value={form.bneRegistrationNumber}
                  onChange={(e) => setForm({ ...form, bneRegistrationNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="BNE-98765"
                />
                <p className="text-xs text-slate-500 mt-1">Bureau of Narcotic Enforcement</p>
              </div>
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
                  checked={form.performsCompounding}
                  onChange={(e) => setForm({ ...form, performsCompounding: e.target.checked })}
                  className="mt-1 w-4 h-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500"
                />
                <span className="text-sm text-slate-700">
                  This pharmacy performs compounding (requires additional registration under 8 NYCRR Part 63)
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={form.istopCompliant}
                  onChange={(e) => setForm({ ...form, istopCompliant: e.target.checked })}
                  className="mt-1 w-4 h-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500"
                />
                <span className="text-sm text-slate-700">
                  I attest that this pharmacy is compliant with NY I-STOP (Internet System for Tracking
                  Over-Prescribing) PDMP reporting requirements *
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
                  I certify that all information provided is accurate and complete under NY Education Law
                  §6808 and 8 NYCRR §63.6. I understand that false statements may result in license
                  denial or revocation. *
                </span>
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-slate-200">
            <button
              type="submit"
              disabled={isSubmitting || !form.attestationAccepted || !form.istopCompliant}
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
