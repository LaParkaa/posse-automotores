import { describe, expect, it } from "vitest";
import { hostEsPrivado, urlDescargable } from "./url-segura";

describe("hostEsPrivado", () => {
  it.each([
    "localhost",
    "api.localhost",
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.10",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "[::1]",
    "::1",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "base.internal",
    "impresora.local",
    "servidor",
    "",
  ])("%s es privado", (host) => {
    expect(hostEsPrivado(host)).toBe(true);
  });

  it.each(["example.com", "cdn.autos.com.ar", "93.184.216.34", "172.32.0.1", "8.8.8.8", "images.example.co.uk"])(
    "%s es público",
    (host) => {
      expect(hostEsPrivado(host)).toBe(false);
    },
  );
});

describe("urlDescargable", () => {
  it("acepta una imagen https pública", () => {
    expect(urlDescargable("https://cdn.example.com/llave.jpg")?.hostname).toBe("cdn.example.com");
  });

  it("acepta http público", () => {
    expect(urlDescargable("http://example.com/llave.png")).not.toBeNull();
  });

  it.each([
    "file:///etc/passwd",
    "ftp://example.com/a.jpg",
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "https://user:clave@example.com/a.jpg",
    "http://127.0.0.1/a.jpg",
    "http://localhost:3000/a.jpg",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/a.jpg",
    "https://example.com:8443/a.jpg",
    "http://2130706433/a.jpg", // 127.0.0.1 escrito como número: la URL lo normaliza y se rechaza
    "http://0x7f.1/a.jpg",
    "no es una url",
    "",
  ])("rechaza %s", (url) => {
    expect(urlDescargable(url)).toBeNull();
  });
});
