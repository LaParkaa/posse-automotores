import { describe, expect, it } from "vitest";
import { clampPixelCrop } from "./image-crop";

describe("clampPixelCrop", () => {
  it("deja intacto un recorte que ya está dentro de los límites", () => {
    const crop = { x: 10, y: 20, width: 100, height: 50 };
    expect(clampPixelCrop(crop, 400, 300)).toEqual(crop);
  });

  it("recorta el ancho y alto si exceden la imagen", () => {
    const crop = { x: 0, y: 0, width: 500, height: 500 };
    expect(clampPixelCrop(crop, 400, 300)).toEqual({ x: 0, y: 0, width: 400, height: 300 });
  });

  it("desplaza x/y negativos a 0", () => {
    const crop = { x: -20, y: -5, width: 100, height: 50 };
    expect(clampPixelCrop(crop, 400, 300)).toEqual({ x: 0, y: 0, width: 100, height: 50 });
  });

  it("desplaza el origen hacia adentro si el recorte se sale por abajo/derecha", () => {
    const crop = { x: 350, y: 280, width: 100, height: 50 };
    expect(clampPixelCrop(crop, 400, 300)).toEqual({ x: 300, y: 250, width: 100, height: 50 });
  });
});
