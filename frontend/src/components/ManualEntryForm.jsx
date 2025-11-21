export default function ManualEntryForm({
  formValues,
  onChange,
  onSubmit,
  isLoading,
  errors,
  showAttestationModal,
  onCancelAttestation,
  onConfirmAttestation
}) {
  const requiredFields = [
    "practice_type",
    "state",
    "state_permit",
    "state_expiry",
    "purchase_intent",
    "quantity"
  ];
  const derivedErrors =
    errors && Object.keys(errors).length
      ? errors
      : errors === undefined
        ? (() => {
            const missing = {};
            requiredFields.forEach((field) => {
              if (!formValues?.[field]) {
                missing[field] = "This field is required.";
              }
            });
            return missing;
          })()
        : {};
  const fieldErrors = derivedErrors;

  return (
    <form onSubmit={onSubmit} className="space-y-6 mt-6">
      {/* Practitioner Name */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="practitioner_name"
          value={formValues.practitioner_name || ""}
          onChange={onChange}
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-blue-500/50"
        />
        <p className="text-[11px] text-gray-500">Licensed practitioner or facility name on the account.</p>
        {fieldErrors.practitioner_name && (
          <p className="text-[11px] text-red-600 mt-0.5">{fieldErrors.practitioner_name}</p>
        )}
      </div>

      {/* Account Number */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          Account number <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="account_number"
          value={formValues.account_number || ""}
          onChange={onChange}
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-blue-500/50"
        />
        <p className="text-[11px] text-gray-500">Internal customer or facility account identifier.</p>
        {fieldErrors.account_number && (
          <p className="text-[11px] text-red-600 mt-0.5">{fieldErrors.account_number}</p>
        )}
      </div>

      {/* License Type */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          License type <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="license_type"
          value={formValues.license_type || ""}
          onChange={onChange}
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-blue-500/50"
        />
        <p className="text-[11px] text-gray-500">Must indicate practitioner, hospital, EMS, researcher, etc.</p>
        {fieldErrors.license_type && (
          <p className="text-[11px] text-red-600 mt-0.5">{fieldErrors.license_type}</p>
        )}
      </div>

      {/* DEA Number & Expiry */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">DEA number</label>
          <input
            type="text"
            name="dea_number"
            value={formValues.dea_number || ""}
            onChange={onChange}
            className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-blue-500/50"
          />
          <p className="text-[11px] text-gray-500">Include only if applicable for controlled substances.</p>
          {fieldErrors.dea_number && (
            <p className="text-[11px] text-red-600 mt-0.5">{fieldErrors.dea_number}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">DEA expiry date</label>
          <input
            type="date"
            name="dea_expiry"
            value={formValues.dea_expiry || ""}
            onChange={onChange}
            className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-blue-500/50"
          />
          <p className="text-[11px] text-gray-500">Required if a DEA number is provided.</p>
          {fieldErrors.dea_expiry && (
            <p className="text-[11px] text-red-600 mt-0.5">{fieldErrors.dea_expiry}</p>
          )}
        </div>
      </div>

      {/* Practice Type */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          Practice type <span className="text-red-500">*</span>
        </label>
        <select
          name="practice_type"
          value={formValues.practice_type || ""}
          onChange={onChange}
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-blue-500/50"
        >
          <option value="">Select practice type</option>
          <option value="Standard">Standard</option>
          <option value="Telemedicine">Telemedicine</option>
          <option value="Hospital">Hospital / Clinic</option>
        </select>
        <p className="text-[11px] text-gray-500">
          Used to determine which controlled substance and telemedicine rules apply.
        </p>
        {fieldErrors.practice_type && (
          <p className="text-[11px] text-red-600 mt-0.5">{fieldErrors.practice_type}</p>
        )}
      </div>

      {/* State */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          Ship-to state <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="state"
          value={formValues.state || ""}
          onChange={onChange}
          placeholder="e.g. CA, NY, TX"
          className="w-full rounded-md border px-3 py-2 text-sm uppercase focus:outline-none focus:ring focus:ring-blue-500/50"
        />
        <p className="text-[11px] text-gray-500">
          Two-letter state code for the ship-to address. State rules and reciprocity are evaluated from this.
        </p>
        {fieldErrors.state && <p className="text-[11px] text-red-600 mt-0.5">{fieldErrors.state}</p>}
      </div>

      {/* State Permit / CSR */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          State permit / CSR number <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="state_permit"
          value={formValues.state_permit || ""}
          onChange={onChange}
          placeholder="State controlled substance registration or permit ID"
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-blue-500/50"
        />
        <p className="text-[11px] text-gray-500">
          State-level controlled substance registration or equivalent permit.
        </p>
        {fieldErrors.state_permit && (
          <p className="text-[11px] text-red-600 mt-0.5">{fieldErrors.state_permit}</p>
        )}
      </div>

      {/* State Expiry */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          State permit expiry date <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          name="state_expiry"
          value={formValues.state_expiry || ""}
          onChange={onChange}
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-blue-500/50"
        />
        <p className="text-[11px] text-gray-500">Used to decide if checkout is allowed, near expiry, or blocked.</p>
        {fieldErrors.state_expiry && (
          <p className="text-[11px] text-red-600 mt-0.5">{fieldErrors.state_expiry}</p>
        )}
      </div>

      {/* Ship-To State (optional) */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">Alternate ship-to state</label>
        <input
          type="text"
          name="ship_to_state"
          value={formValues.ship_to_state || ""}
          onChange={onChange}
          placeholder="Optional secondary ship-to state"
          className="w-full rounded-md border px-3 py-2 text-sm uppercase focus:outline-none focus:ring focus:ring-blue-500/50"
        />
        <p className="text-[11px] text-gray-500">Include if the delivery location differs from the main state.</p>
      </div>

      {/* Purchase intent */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          Intended use / purchase intent <span className="text-red-500">*</span>
        </label>
        <select
          name="purchase_intent"
          value={formValues.purchase_intent || ""}
          onChange={onChange}
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-blue-500/50"
        >
          <option value="">Select intent</option>
          <option value="GeneralMedicalUse">General medical use</option>
          <option value="OfficeStock">Office stock</option>
          <option value="Telemedicine">Telemedicine prescription</option>
        </select>
        <p className="text-[11px] text-gray-500">
          Certain intents (e.g. telemedicine) may require additional attestations.
        </p>
        {fieldErrors.purchase_intent && (
          <p className="text-[11px] text-red-600 mt-0.5">{fieldErrors.purchase_intent}</p>
        )}
      </div>

      {/* Quantity */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          Quantity <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          name="quantity"
          min={1}
          value={formValues.quantity ?? ""}
          onChange={onChange}
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-blue-500/50"
        />
        <p className="text-[11px] text-gray-500">Used to simulate simple volume checks in future versions.</p>
        {fieldErrors.quantity && (
          <p className="text-[11px] text-red-600 mt-0.5">{fieldErrors.quantity}</p>
        )}
      </div>

      {/* Controlled Substance Form Uploaded */}
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          name="controlled_substance_form_uploaded"
          checked={formValues.controlled_substance_form_uploaded || false}
          onChange={onChange}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label className="font-medium text-gray-700 text-sm">Controlled substance form uploaded</label>
      </div>
      {fieldErrors.controlled_substance_form_uploaded && (
        <p className="text-[11px] text-red-600 mt-0.5">{fieldErrors.controlled_substance_form_uploaded}</p>
      )}

      {/* Addendum Reference */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">Addendum reference</label>
        <input
          type="text"
          name="addendum_reference"
          value={formValues.addendum_reference || ""}
          onChange={onChange}
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-blue-500/50"
          placeholder="Upload ID or reference number"
        />
        <p className="text-[11px] text-gray-500">Optional reference if a form upload is not available.</p>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-60"
      >
        {isLoading ? "Running..." : "Run Compliance Check"}
      </button>

      {showAttestationModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Controlled Substance Attestation</h3>
            <p className="text-gray-700 mb-6">
              By clicking I confirm that this controlled substance purchase is compliant with all applicable laws,
              regulations, and organizational policies.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700"
                onClick={onCancelAttestation}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                onClick={onConfirmAttestation}
              >
                Confirm & Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
