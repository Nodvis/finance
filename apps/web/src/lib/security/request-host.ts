import { isIP } from "node:net";

const DIRECT_PORT = "3990";

function parseHost(host: string): { hostname: string; port: string } | null {
  if (host.startsWith("[")) {
    const closingBracket = host.indexOf("]");
    if (closingBracket < 0 || host.slice(closingBracket + 1, closingBracket + 2) !== ":") {
      return null;
    }
    return {
      hostname: host.slice(1, closingBracket),
      port: host.slice(closingBracket + 2),
    };
  }

  const separator = host.lastIndexOf(":");
  if (separator < 0 || host.indexOf(":") !== separator) {
    return null;
  }
  return { hostname: host.slice(0, separator), port: host.slice(separator + 1) };
}

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split(".").map((part) => Number(part));
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }
  return octets[0] === 127
    || octets[0] === 10
    || (octets[0] === 172 && octets[1]! >= 16 && octets[1]! <= 31)
    || (octets[0] === 192 && octets[1] === 168);
}

function isPrivateIpv6(hostname: string): boolean {
  if (hostname.includes("%")) return false;
  const pieces = hostname.toLowerCase().split("::");
  if (pieces.length > 2) return false;
  const left = pieces[0] ? pieces[0].split(":") : [];
  const right = pieces.length === 2 && pieces[1] ? pieces[1].split(":") : [];
  if ([...left, ...right].some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return false;
  const expanded = pieces.length === 2
    ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right]
    : [...left];
  if (expanded.length !== 8) return false;
  if (expanded[7] === "1" && expanded.slice(0, 7).every((part) => part === "0")) {
    return true;
  }
  const first = Number.parseInt(expanded[0]!, 16);
  return (first & 0xfe00) === 0xfc00;
}

export function isSafeDirectHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const parsed = parseHost(host);
  if (!parsed || parsed.port !== DIRECT_PORT || !parsed.hostname) return false;
  if (parsed.hostname.toLowerCase() === "localhost") return true;
  const family = isIP(parsed.hostname);
  return family === 4 ? isPrivateIpv4(parsed.hostname) : family === 6 && isPrivateIpv6(parsed.hostname);
}
