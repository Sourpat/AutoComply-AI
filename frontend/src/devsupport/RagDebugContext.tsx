import React from "react";

type RagDebugContextValue = {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
};

const RagDebugContext = React.createContext<RagDebugContextValue | undefined>(
  undefined
);

export function RagDebugProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [enabled, setEnabled] = React.useState(false);

  const value = React.useMemo(
    () => ({ enabled, setEnabled }),
    [enabled]
  );

  return (
    <RagDebugContext.Provider value={value}>
      {children}
    </RagDebugContext.Provider>
  );
}

export function useRagDebug(): RagDebugContextValue {
  const ctx = React.useContext(RagDebugContext);
  if (!ctx) {
    // Safe fallback if used outside the provider – keeps UI from crashing.
    return {
      enabled: false,
      setEnabled: () => {},
    };
  }
  return ctx;
}
