export default function ComplianceCard({ data }) {
  if (!data) return null;

  if (data.error) {
    return (
      <div className="mt-6 p-5 rounded-xl bg-red-50 border border-red-300 shadow">
        <h3 className="text-red-700 font-semibold text-lg">Error</h3>
        <p className="text-red-600 mt-2">{data.error}</p>
      </div>
    );
  }

  const verdict = data.verdict || {};

  return (
    <div className="mt-6 p-6 rounded-xl bg-white border border-gray-300 shadow">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">
        Compliance Verdict
      </h2>

      <div className="space-y-3 text-gray-700">
        {/* VALIDITY */}
        <div>
          <p className="font-semibold">Status:</p>
          <p>
            {verdict.allow_checkout ? (
              <span className="text-green-600 font-medium">CLEARED for Checkout</span>
            ) : (
              <span className="text-red-600 font-medium">BLOCKED</span>
            )}
          </p>
        </div>

        {/* REASON */}
        <div>
          <p className="font-semibold">Reason:</p>
          <p className="text-gray-800">{verdict.reason || "—"}</p>
        </div>

        {/* FORM REQUIRED */}
        <div>
          <p className="font-semibold">Required Form:</p>
          <p>{verdict.form_required || "None"}</p>
        </div>

        {/* ADDENDUM */}
        <div>
          <p className="font-semibold">Addendum:</p>
          {verdict.addendum?.required ? (
            <p className="text-blue-700">
              {verdict.addendum.addendum_type} — {verdict.addendum.reason}
            </p>
          ) : (
            <p>Not required</p>
          )}
        </div>

        {/* METADATA */}
        {verdict.metadata && Object.keys(verdict.metadata).length > 0 && (
          <div>
            <p className="font-semibold">Additional Flags:</p>
            <ul className="list-disc ml-6 text-gray-600">
              {Object.entries(verdict.metadata).map(([key, value]) => (
                <li key={key}>
                  <span className="font-medium">{key}</span>: {String(value)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
