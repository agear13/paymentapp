const GA_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;

export const getGaMeasurementId = (
  raw: string | undefined = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
): string | null => {
  const measurementId = raw?.trim() ?? '';
  if (!GA_MEASUREMENT_ID_PATTERN.test(measurementId)) {
    return null;
  }
  return measurementId;
};
