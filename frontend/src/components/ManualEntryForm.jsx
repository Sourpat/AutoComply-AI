import { useState } from "react";
import { validateLicenseJSON } from "../services/api";

export default function ManualEntryForm({ onResult }) {
  const [formData, setFormData] = useState({
    practitioner_name: "",
    account_number: "",
    license_type: "",
    dea_number: "",
    dea_expiry: "",
    state: "",
    state_permit: "",
    state_expiry: "",
    practice_type: "Standard",
    ship_to_state: "",
    purchase_intent: "",
    quantity: "",
    controlled_substance_form_uploaded: false,
    addendum_reference: ""
  });
  const [errors, setErrors] = useState({});
  const [showAttestationModal, setShowAttestationModal] = useState(false);
  const [attestationConfirmed, setAttestationConfirmed] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
    setAttestationConfirmed(false);
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.account_number) newErrors.account_number = "Account number is required.";
    if (!formData.license_type) {
      newErrors.license_type =
        "License type must indicate Practitioner, Hospital, EMS, Researcher, SurgeryCentre, FloridaPractitioner.";
    } else {
      const allowedLicenseTypes = [
        "Practitioner",
        "Hospital",
        "EMS",
        "Researcher",
        "SurgeryCentre",
        "FloridaPractitioner"
      ];
      const matchesAllowed = allowedLicenseTypes.some((type) =>
        formData.license_type.toLowerCase().includes(type.toLowerCase())
      );
      if (!matchesAllowed) {
        newErrors.license_type =
          "License type must indicate Practitioner, Hospital, EMS, Researcher, SurgeryCentre, FloridaPractitioner.";
      }
    }
    if (!formData.practitioner_name) newErrors.practitioner_name = "Practitioner name is required.";
    if (formData.dea_number && !/^[A-Z]{2}[0-9]{7}$/.test(formData.dea_number)) {
      newErrors.dea_number = "DEA number must be format AA1234567.";
    }
    if (formData.dea_number && !formData.dea_expiry) {
      newErrors.dea_expiry = "DEA expiry date is required if DEA number is provided.";
    }
    if (!formData.state) newErrors.state = "State is required.";
    if (formData.state && !/^[A-Z]{2}$/.test(formData.state)) {
      newErrors.state = "State code must be two letters.";
    }
    if (!formData.state_permit) newErrors.state_permit = "State permit is required.";
    if (!formData.state_expiry) newErrors.state_expiry = "State expiry date is required.";
    if (!formData.purchase_intent) newErrors.purchase_intent = "Purchase intent is required.";
    if (
      formData.purchase_intent === "Testosterone" &&
      (!formData.quantity || Number(formData.quantity) < 10)
    ) {
      newErrors.quantity = "Quantity must be at least 10 for Testosterone per controlled substance rule.";
    }
    if (
      formData.purchase_intent === "WeightLoss" &&
      (!formData.quantity || Number(formData.quantity) < 3000)
    ) {
      newErrors.quantity = "Quantity must be at least 3000 for Weight Loss per controlled substance rule.";
    }

    if (["Testosterone", "WeightLoss"].includes(formData.purchase_intent)) {
      if (!formData.controlled_substance_form_uploaded && !formData.addendum_reference) {
        newErrors.controlled_substance_form_uploaded =
          "Controlled substance form upload or addendum reference is required for restricted products.";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isControlledSubstanceScenario = () => {
    const quantityValue = Number(formData.quantity);
    const restrictedTypes = ["Testosterone", "WeightLoss"];
    const isRestrictedLicense = restrictedTypes.some((type) =>
      formData.license_type.toLowerCase().includes(type.toLowerCase())
    );

    return (
      restrictedTypes.includes(formData.purchase_intent) ||
      (formData.purchase_intent === "Testosterone" && quantityValue >= 10) ||
      (formData.purchase_intent === "WeightLoss" && quantityValue >= 3000) ||
      isRestrictedLicense
    );
  };

  const submitPayload = async () => {
    const payload = {
      practice_type: formData.practice_type,
      practitioner_name: formData.practitioner_name,
      account_number: formData.account_number,
      license_type: formData.license_type,
      dea_number: formData.dea_number || undefined,
      dea_expiry: formData.dea_expiry || undefined,
      state: formData.state,
      state_permit: formData.state_permit,
      state_expiry: formData.state_expiry,
      ship_to_state: formData.ship_to_state || undefined,
      purchase_intent: formData.purchase_intent,
      quantity: formData.quantity ? Number(formData.quantity) : undefined,
      controlled_substance_form_uploaded: formData.controlled_substance_form_uploaded,
      addendum_reference: formData.addendum_reference || undefined
    };

    const res = await validateLicenseJSON(payload);
    onResult(res);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    if (isControlledSubstanceScenario() && !attestationConfirmed) {
      setShowAttestationModal(true);
      return;
    }

    await submitPayload();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 mt-6">
      {/* Practitioner Name */}
      <div>
        <label className="block font-medium text-gray-700">Name *</label>
        <input
          type="text"
          name="practitioner_name"
          value={formData.practitioner_name}
          onChange={handleChange}
          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm"
        />
        {errors.practitioner_name && (
          <p className="text-red-600 mt-1">{errors.practitioner_name}</p>
        )}
      </div>

      {/* Account Number */}
      <div>
        <label className="block font-medium text-gray-700">Account Number *</label>
        <input
          type="text"
          name="account_number"
          value={formData.account_number}
          onChange={handleChange}
          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm"
        />
        {errors.account_number && (
          <p className="text-red-600 mt-1">{errors.account_number}</p>
        )}
      </div>

      {/* License Type */}
      <div>
        <label className="block font-medium text-gray-700">License Type *</label>
        <input
          type="text"
          name="license_type"
          value={formData.license_type}
          onChange={handleChange}
          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm"
        />
        {errors.license_type && (
          <p className="text-red-600 mt-1">{errors.license_type}</p>
        )}
      </div>

      {/* DEA Number & Expiry */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block font-medium text-gray-700">DEA Number</label>
          <input
            type="text"
            name="dea_number"
            value={formData.dea_number}
            onChange={handleChange}
            className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm"
          />
          {errors.dea_number && (
            <p className="text-red-600 mt-1">{errors.dea_number}</p>
          )}
        </div>
        <div>
          <label className="block font-medium text-gray-700">DEA Expiry Date</label>
          <input
            type="date"
            name="dea_expiry"
            value={formData.dea_expiry}
            onChange={handleChange}
            className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm"
          />
          {errors.dea_expiry && (
            <p className="text-red-600 mt-1">{errors.dea_expiry}</p>
          )}
        </div>
      </div>

      {/* State Permit & Expiry */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block font-medium text-gray-700">State</label>
          <input
            type="text"
            name="state"
            value={formData.state}
            onChange={handleChange}
            placeholder="e.g., CA"
            className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm"
          />
          {errors.state && (
            <p className="text-red-600 mt-1">{errors.state}</p>
          )}
        </div>
        <div>
          <label className="block font-medium text-gray-700">State Permit #</label>
          <input
            type="text"
            name="state_permit"
            value={formData.state_permit}
            onChange={handleChange}
            className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm"
          />
          {errors.state_permit && (
            <p className="text-red-600 mt-1">{errors.state_permit}</p>
          )}
        </div>
      </div>
      <div>
        <label className="block font-medium text-gray-700">State Expiry Date</label>
        <input
          type="date"
          name="state_expiry"
          value={formData.state_expiry}
          onChange={handleChange}
          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm"
        />
        {errors.state_expiry && (
          <p className="text-red-600 mt-1">{errors.state_expiry}</p>
        )}
      </div>

      {/* Practice Type */}
      <div>
        <label className="block font-medium text-gray-700">Practice Type *</label>
        <select
          name="practice_type"
          value={formData.practice_type}
          onChange={handleChange}
          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm"
        >
          <option value="Standard">Standard</option>
          <option value="HospitalPharmacy">Hospital Pharmacy</option>
          <option value="EMS">EMS</option>
          <option value="Researcher">Researcher</option>
          <option value="SurgeryCentre">Surgery Centre</option>
          <option value="FloridaPractitioner">Florida Practitioner</option>
        </select>
        {errors.practice_type && (
          <p className="text-red-600 mt-1">{errors.practice_type}</p>
        )}
      </div>

      {/* Ship-To State */}
      <div>
        <label className="block font-medium text-gray-700">Ship-To State</label>
        <input
          type="text"
          name="ship_to_state"
          value={formData.ship_to_state}
          onChange={handleChange}
          placeholder="e.g., AZ"
          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm"
        />
      </div>

      {/* Purchase Intent & Quantity */}
      <div>
        <label className="block font-medium text-gray-700">Purchase Intent *</label>
        <select
          name="purchase_intent"
          value={formData.purchase_intent}
          onChange={handleChange}
          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm"
        >
          <option value="">Select intent</option>
          <option value="GeneralMedicalUse">General Medical Use</option>
          <option value="Testosterone">Testosterone</option>
          <option value="WeightLoss">Weight Loss</option>
          <option value="Research">Research</option>
        </select>
        {errors.purchase_intent && (
          <p className="text-red-600 mt-1">{errors.purchase_intent}</p>
        )}
      </div>
      <div>
        <label className="block font-medium text-gray-700">Quantity (if applicable)</label>
        <input
          type="number"
          name="quantity"
          value={formData.quantity}
          onChange={handleChange}
          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm"
        />
        {errors.quantity && (
          <p className="text-red-600 mt-1">{errors.quantity}</p>
        )}
      </div>

      {/* Controlled Substance Form Uploaded */}
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          name="controlled_substance_form_uploaded"
          checked={formData.controlled_substance_form_uploaded}
          onChange={(e) =>
            {
              setFormData({
                ...formData,
                controlled_substance_form_uploaded: e.target.checked
              });
              setErrors({ ...errors, controlled_substance_form_uploaded: "" });
              setAttestationConfirmed(false);
            }
          }
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label className="font-medium text-gray-700">Controlled substance form uploaded</label>
      </div>
      {errors.controlled_substance_form_uploaded && (
        <p className="text-red-600 mt-1">{errors.controlled_substance_form_uploaded}</p>
      )}

      {/* Addendum Reference */}
      <div>
        <label className="block font-medium text-gray-700">Addendum Reference</label>
        <input
          type="text"
          name="addendum_reference"
          value={formData.addendum_reference}
          onChange={handleChange}
          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm"
          placeholder="Upload ID or reference number"
        />
      </div>

      <button
        type="submit"
        className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
      >
        Run Compliance Check
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
                onClick={() => {
                  setShowAttestationModal(false);
                  setAttestationConfirmed(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                onClick={async () => {
                  setAttestationConfirmed(true);
                  setShowAttestationModal(false);
                  await submitPayload();
                }}
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
