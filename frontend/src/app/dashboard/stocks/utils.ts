export const formatExpirationDate = (value: string) => {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

export const formatEntityName = (type: string, name: string | null | undefined): string => {
  if (!name) {
    // Si pas de nom, on retourne juste le type
    switch (type) {
      case "NATIONAL":
        return "National";
      case "REGIONAL":
        return "Région";
      case "DISTRICT":
        return "District";
      case "HEALTHCENTER":
        return "Centre de santé";
      default:
        return "Inconnu";
    }
  }
  
  // Si on a un nom, on retourne "Type: Nom"
  switch (type) {
    case "NATIONAL":
      return `National: ${name}`;
    case "REGIONAL":
      return `Région: ${name}`;
    case "DISTRICT":
      return `District: ${name}`;
    case "HEALTHCENTER":
      return `Centre de santé: ${name}`;
    default:
      return name;
  }
};

export const isDateExpired = (value: string) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(value);
  return target < now;
};

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";
