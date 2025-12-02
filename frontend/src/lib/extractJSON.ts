export const extractJSON = (text: string): string => {
  let cleaned = text.replace(/``````\s*/g, "");

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start !== -1 && end !== -1 && end > start) {
    return cleaned.substring(start, end + 1);
  }

  return cleaned.trim();
};
