import { useState } from "react";
import UploadBox from "../components/UploadBox";
import ManualEntryForm from "../components/ManualEntryForm";
import ComplianceCard from "../components/ComplianceCard";
import AboutAutoComply from "../components/AboutAutoComply";
import ProfileLinksBar from "../components/ProfileLinksBar";
import { validateLicenseJSON } from "../services/api";

export default function Home() {
  const [mode, setMode] = useState("upload");  // "upload" or "manual"
  const [result, setResult] = useState(null);
  const [formValues, setFormValues] = useState({
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
  const [isLoading, setIsLoading] = useState(false);
  const [showAttestationModal, setShowAttestationModal] = useState(false);
  const [attestationConfirmed, setAttestationConfirmed] = useState(false);

  const requiredFields = [
    "practice_type",
    "state",
    "state_permit",
    "state_expiry",
    "purchase_intent",
    "quantity"
  ];

  const handleChange = (e) => {
    const { name, type, value, checked } = e.target;
    const nextValue = type === "checkbox" ? checked : value;

    setFormValues((prev) => ({ ...prev, [name]: nextValue }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    setAttestationConfirmed(false);
  };

  const isControlledSubstanceScenario = () => {
    const quantityValue = Number(formValues.quantity);
    const restrictedTypes = ["Testosterone", "WeightLoss"];
    const isRestrictedLicense = restrictedTypes.some((type) =>
      formValues.license_type.toLowerCase().includes(type.toLowerCase())
    );

    return (
      restrictedTypes.includes(formValues.purchase_intent) ||
      (formValues.purchase_intent === "Testosterone" && quantityValue >= 10) ||
      (formValues.purchase_intent === "WeightLoss" && quantityValue >= 3000) ||
      isRestrictedLicense
    );
  };

  const validateForm = () => {
    const newErrors = {};

    requiredFields.forEach((field) => {
      if (!formValues[field]) {
        newErrors[field] = "This field is required.";
      }
    });

    if (!formValues.account_number) newErrors.account_number = "Account number is required.";

    if (!formValues.license_type) {
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
        formValues.license_type.toLowerCase().includes(type.toLowerCase())
      );
      if (!matchesAllowed) {
        newErrors.license_type =
          "License type must indicate Practitioner, Hospital, EMS, Researcher, SurgeryCentre, FloridaPractitioner.";
      }
    }

    if (!formValues.practitioner_name) newErrors.practitioner_name = "Practitioner name is required.";

    if (formValues.dea_number && !/^[A-Z]{2}[0-9]{7}$/.test(formValues.dea_number)) {
      newErrors.dea_number = "DEA number must be format AA1234567.";
    }
    if (formValues.dea_number && !formValues.dea_expiry) {
      newErrors.dea_expiry = "DEA expiry date is required if DEA number is provided.";
    }

    if (formValues.state && !/^[A-Z]{2}$/.test(formValues.state)) {
      newErrors.state = "State code must be two letters.";
    }

    if (formValues.purchase_intent === "Testosterone" && formValues.quantity && Number(formValues.quantity) < 10) {
      newErrors.quantity = "Quantity must be at least 10 for Testosterone per controlled substance rule.";
    }
    if (formValues.purchase_intent === "WeightLoss" && formValues.quantity && Number(formValues.quantity) < 3000) {
      newErrors.quantity = "Quantity must be at least 3000 for Weight Loss per controlled substance rule.";
    }

    if (["Testosterone", "WeightLoss"].includes(formValues.purchase_intent)) {
      if (!formValues.controlled_substance_form_uploaded && !formValues.addendum_reference) {
        newErrors.controlled_substance_form_uploaded =
          "Controlled substance form upload or addendum reference is required for restricted products.";
      }
    }

    setErrors(newErrors);
    return newErrors;
  };

  const submitPayload = async () => {
    setIsLoading(true);
    const payload = {
      practice_type: formValues.practice_type,
      practitioner_name: formValues.practitioner_name,
      account_number: formValues.account_number,
      license_type: formValues.license_type,
      dea_number: formValues.dea_number || undefined,
      dea_expiry: formValues.dea_expiry || undefined,
      state: formValues.state,
      state_permit: formValues.state_permit,
      state_expiry: formValues.state_expiry,
      ship_to_state: formValues.ship_to_state || undefined,
      purchase_intent: formValues.purchase_intent,
      quantity: formValues.quantity ? Number(formValues.quantity) : undefined,
      controlled_substance_form_uploaded: formValues.controlled_substance_form_uploaded,
      addendum_reference: formValues.addendum_reference || undefined
    };

    try {
      const res = await validateLicenseJSON(payload);
      setResult(res);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) return;

    if (isControlledSubstanceScenario() && !attestationConfirmed) {
      setShowAttestationModal(true);
      return;
    }

    await submitPayload();
  };

  const resetMode = (nextMode) => {
    setMode(nextMode);
    setResult(null);
  };

  const handleAttestationConfirm = async () => {
    setAttestationConfirmed(true);
    setShowAttestationModal(false);
    await submitPayload();
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <ProfileLinksBar />

      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          AutoComply AI – License Compliance Checker
        </h1>
        <p className="mt-2 text-gray-600">
          {mode === "upload"
            ? "Upload a practitioner’s DEA or State license PDF to instantly validate compliance."
            : "Use manual entry to input license information and run the compliance check."}
        </p>
      </div>

      <AboutAutoComply />

      <div className="space-y-4">
        {/* Mode toggle */}
        <div className="flex space-x-4">
          <button
            onClick={() => resetMode("upload")}
            className={`rounded-lg px-4 py-2 ${mode==="upload" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800"}`}
          >
            Upload PDF
          </button>
          <button
            onClick={() => resetMode("manual")}
            className={`rounded-lg px-4 py-2 ${mode==="manual" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800"}`}
          >
            Manual Entry
          </button>
        </div>

        {/* Mode-specific content */}
        {mode === "upload" ? (
          <UploadBox onResult={setResult} />
        ) : (
          <ManualEntryForm
            formValues={formValues}
            onChange={handleChange}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            errors={errors}
            showAttestationModal={showAttestationModal}
            onCancelAttestation={() => {
              setShowAttestationModal(false);
              setAttestationConfirmed(false);
            }}
            onConfirmAttestation={handleAttestationConfirm}
          />
        )}

        {result && (
          <div className="mt-6">
            <ComplianceCard data={result} />
          </div>
        )}
      </div>
    </main>
  );
}
