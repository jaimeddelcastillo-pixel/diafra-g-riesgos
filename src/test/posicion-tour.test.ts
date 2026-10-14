import { describe, expect, it } from "vitest";
import { posicionTour } from "@/components/onboarding/posicionTour";

const rect = (left: number, top: number, width: number, height: number) => ({
  left, top, width, height, right: left + width, bottom: top + height,
});

describe("Tour placement", () => {
  it("places the welcome below a wide module section, not off its right edge", () => {
    expect(posicionTour(rect(340, 200, 1440, 380), { width: 320, height: 230 }, { width: 1910, height: 920 }))
      .toEqual({ left: 900, top: 596 });
  });
  it("places sidebar messages to the right", () => {
    expect(posicionTour(rect(16, 220, 280, 44), { width: 320, height: 200 }, { width: 1280, height: 800 }))
      .toEqual({ left: 312, top: 220 });
  });
  it("moves above a wide target when there is no space below", () => {
    expect(posicionTour(rect(340, 350, 900, 380), { width: 320, height: 230 }, { width: 1280, height: 800 }).top)
      .toBe(104);
  });
  it("keeps messages and controls inside small and short screens", () => {
    for (const pantalla of [{ width: 360, height: 635 }, { width: 584, height: 635 }, { width: 320, height: 240 }]) {
      const mensaje = { width: 320, height: 260 };
      const p = posicionTour(rect(20, 180, pantalla.width - 40, 300), mensaje, pantalla);
      expect(p.left).toBeGreaterThanOrEqual(16);
      expect(p.top).toBeGreaterThanOrEqual(16);
      expect(p.left + Math.min(mensaje.width, pantalla.width - 32)).toBeLessThanOrEqual(pantalla.width - 16);
      expect(p.top + Math.min(mensaje.height, pantalla.height - 32)).toBeLessThanOrEqual(pantalla.height - 16);
    }
  });
  it("centers steps without a target using the measured message size", () => {
    expect(posicionTour(null, { width: 320, height: 200 }, { width: 1280, height: 800 }))
      .toEqual({ left: 480, top: 300 });
  });
});