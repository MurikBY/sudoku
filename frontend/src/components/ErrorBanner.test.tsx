// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ErrorBanner } from "@/components/ErrorBanner";

describe("ErrorBanner", () => {
  it("shows the message", () => {
    render(<ErrorBanner message="Storage failed." />);

    expect(screen.getByText("Storage failed.", { selector: "span" })).toBeInTheDocument();
  });

  it("appends the reconnecting note to the message", () => {
    render(<ErrorBanner message="Storage failed." reconnecting />);

    expect(
      screen.getByText("Storage failed. · reconnecting…", { selector: "span" }),
    ).toBeInTheDocument();
  });
});
