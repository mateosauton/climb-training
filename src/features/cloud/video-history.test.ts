import { describe, expect, it, vi } from "vitest";

import { loadVideoIntelligenceHistory } from "./video-history";

function query(data: unknown[]) {
  return { select: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data, error: null }) }) };
}

describe("loadVideoIntelligenceHistory", () => {
  it("loads owned progress, recommendations, and coaching themes", async () => {
    const status = [{ job_id: "job-1", video_asset_id: "video-1", state: "processing", stage: "vision", progress: 46, updated_at: "2026-07-16T10:00:00Z" }];
    const recommendations = [{ id: "rec-1", video_asset_id: "video-1", analysis_id: "analysis-1", priority: 1, title: "Quiet feet", body: "Keep pressure through the right toe.", drill: null, status: "active", created_at: "2026-07-16T09:00:00Z" }];
    const themes = [{ id: "theme-1", analysis_id: "analysis-1", themes: [{ label: "foot tension" }], coaching_summary: "Foot tension is improving.", created_at: "2026-07-16T09:01:00Z" }];
    const tables = {
      video_analysis_status: query(status),
      video_recommendations: query(recommendations),
      video_theme_snapshots: query(themes)
    };
    const client = { from: vi.fn((table: keyof typeof tables) => tables[table]) };

    await expect(loadVideoIntelligenceHistory(client)).resolves.toEqual({ status, recommendations, themes });
    expect(client.from).toHaveBeenCalledTimes(3);
  });

  it("fails closed when any private history query is unavailable", async () => {
    const failed = { select: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: null, error: { message: "denied" } }) }) };
    const client = { from: vi.fn().mockReturnValue(failed) };

    await expect(loadVideoIntelligenceHistory(client)).rejects.toEqual({ code: "unavailable" });
  });
});
