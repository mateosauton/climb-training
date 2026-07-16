import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import App from "../../App";
import type { VideoIntelligenceHistory } from "./video-history";

describe("video intelligence history", () => {
  it("shows current analysis progress and recommendations from earlier videos", async () => {
    const history: VideoIntelligenceHistory = {
      status: [{ job_id: "job-1", video_asset_id: "video-2", state: "processing", stage: "vision", progress: 46, updated_at: "2026-07-16T10:00:00Z" }],
      recommendations: [{ id: "rec-1", video_asset_id: "video-1", analysis_id: "analysis-1", priority: 1, title: "Pies silenciosos", body: "Mantén presión sobre la punta derecha.", drill: null, status: "active", created_at: "2026-07-15T10:00:00Z" }],
      themes: [{ id: "theme-1", analysis_id: "analysis-1", themes: [{ label: "tensión de pies" }], coaching_summary: "La tensión de pies mejora entre intentos.", created_at: "2026-07-15T10:01:00Z" }]
    };
    const loadHistory = vi.fn(async () => history);

    render(<App videoIntelligence={{ loadHistory }} />);
    await userEvent.setup().click(screen.getAllByRole("tab", { name: "Video" })[0]);

    expect(await screen.findByText("Análisis en curso")).toBeInTheDocument();
    expect(screen.getByText("Reconocimiento visual · 46%")).toBeInTheDocument();
    expect(screen.getByText("Pies silenciosos")).toBeInTheDocument();
    expect(screen.getByText("Mantén presión sobre la punta derecha.")).toBeInTheDocument();
    expect(screen.getByText("La tensión de pies mejora entre intentos.")).toBeInTheDocument();
    await waitFor(() => expect(loadHistory).toHaveBeenCalledTimes(1));
  });
});
