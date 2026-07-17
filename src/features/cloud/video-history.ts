type QueryResult<T> = { data: T[] | null; error: unknown | null };

type OrderedQuery<T> = {
  select(columns: string): {
    order(column: string, options: { ascending: boolean }): PromiseLike<QueryResult<T>>;
  };
};

export type VideoAnalysisStatus = {
  job_id: string;
  video_asset_id: string;
  state: "queued" | "processing" | "completed" | "failed";
  stage: string;
  progress: number;
  analysis_id?: string | null;
  updated_at: string;
};

export type VideoRecommendation = {
  id: string;
  video_asset_id: string;
  analysis_id: string;
  priority: number;
  title: string;
  body: string;
  drill: Record<string, unknown> | null;
  status: "active" | "completed" | "dismissed" | "superseded";
  created_at: string;
};

export type VideoThemeSnapshot = {
  id: string;
  analysis_id: string;
  themes: Array<Record<string, unknown>>;
  coaching_summary: string;
  created_at: string;
};

export type VideoIntelligenceHistory = {
  status: VideoAnalysisStatus[];
  recommendations: VideoRecommendation[];
  themes: VideoThemeSnapshot[];
};

export interface VideoHistoryClient {
  from(table: "video_analysis_status"): OrderedQuery<VideoAnalysisStatus>;
  from(table: "video_recommendations"): OrderedQuery<VideoRecommendation>;
  from(table: "video_theme_snapshots"): OrderedQuery<VideoThemeSnapshot>;
}

export async function loadVideoIntelligenceHistory(client: VideoHistoryClient): Promise<VideoIntelligenceHistory> {
  const [status, recommendations, themes] = await Promise.all([
    client.from("video_analysis_status").select("job_id, video_asset_id, state, stage, progress, analysis_id, updated_at").order("updated_at", { ascending: false }),
    client.from("video_recommendations").select("id, video_asset_id, analysis_id, priority, title, body, drill, status, created_at").order("created_at", { ascending: false }),
    client.from("video_theme_snapshots").select("id, analysis_id, themes, coaching_summary, created_at").order("created_at", { ascending: false })
  ]);
  if (status.error || recommendations.error || themes.error) throw { code: "unavailable" };
  return {
    status: status.data ?? [],
    recommendations: recommendations.data ?? [],
    themes: themes.data ?? []
  };
}
