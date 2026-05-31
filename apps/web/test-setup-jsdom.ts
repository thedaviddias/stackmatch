import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";
import * as matchers from "vitest-axe/matchers";

// Register vitest-axe matchers (toHaveNoViolations)
expect.extend(matchers);

if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = () => null;
}

// Automatically unmount and clean up after each test
afterEach(() => {
  cleanup();
});
