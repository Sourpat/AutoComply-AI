import React, { createContext, useContext, useState, ReactNode } from "react";

interface TraceSelectionContextValue {
  selectedTraceId: string | null;
  setSelectedTraceId: (traceId: string | null) => void;
}

const TraceSelectionContext = createContext<TraceSelectionContextValue | undefined>(
  undefined,
);

export const TraceSelectionProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);

  return (
    <TraceSelectionContext.Provider
      value={{ selectedTraceId, setSelectedTraceId }}
    >
      {children}
    </TraceSelectionContext.Provider>
  );
};

export const useTraceSelection = (): TraceSelectionContextValue => {
  const ctx = useContext(TraceSelectionContext);
  if (!ctx) {
    throw new Error(
      "useTraceSelection must be used within a TraceSelectionProvider",
    );
  }
  return ctx;
};
