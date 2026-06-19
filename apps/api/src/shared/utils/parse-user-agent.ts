type DeviceType = "DESKTOP" | "MOBILE" | "TABLET" | "UNKNOWN";

export interface ParsedUserAgent {
  browserName: string | null;
  browserVersion: string | null;
  osName: string | null;
  deviceType: DeviceType;
}

function extractBrowser(userAgent: string): { name: string | null; version: string | null } {
  const chromeMatch = userAgent.match(/Chrome\/([\d.]+)/);
  if (chromeMatch && !userAgent.includes("Edg/")) {
    return { name: "Chrome", version: chromeMatch[1] ?? null };
  }

  const firefoxMatch = userAgent.match(/Firefox\/([\d.]+)/);
  if (firefoxMatch) {
    return { name: "Firefox", version: firefoxMatch[1] ?? null };
  }

  const safariMatch = userAgent.match(/Version\/([\d.]+).*Safari/);
  if (safariMatch && userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
    return { name: "Safari", version: safariMatch[1] ?? null };
  }

  const edgeMatch = userAgent.match(/Edg\/([\d.]+)/);
  if (edgeMatch) {
    return { name: "Edge", version: edgeMatch[1] ?? null };
  }

  return { name: null, version: null };
}

function extractOs(userAgent: string): string | null {
  if (userAgent.includes("Windows")) return "Windows";
  if (userAgent.includes("Mac OS X") || userAgent.includes("Macintosh")) return "macOS";
  if (userAgent.includes("Android")) return "Android";
  if (userAgent.includes("iPhone") || userAgent.includes("iPad") || userAgent.includes("iOS")) {
    return "iOS";
  }
  if (userAgent.includes("Linux")) return "Linux";
  return null;
}

function extractDeviceType(userAgent: string): DeviceType {
  if (/iPad|Tablet|PlayBook|Silk/i.test(userAgent)) return "TABLET";
  if (/Mobile|iPhone|Android.*Mobile|webOS|BlackBerry/i.test(userAgent)) return "MOBILE";
  if (userAgent) return "DESKTOP";
  return "UNKNOWN";
}

export function parseUserAgent(userAgent?: string): ParsedUserAgent {
  if (!userAgent) {
    return {
      browserName: null,
      browserVersion: null,
      osName: null,
      deviceType: "UNKNOWN",
    };
  }

  const browser = extractBrowser(userAgent);

  return {
    browserName: browser.name,
    browserVersion: browser.version,
    osName: extractOs(userAgent),
    deviceType: extractDeviceType(userAgent),
  };
}
