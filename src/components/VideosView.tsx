import React, { useEffect, useState } from 'react';
import {
  Search,
  Play,
  Bookmark,
  ExternalLink,
  Loader2,
  GitBranch,
  AlertTriangle,
} from 'lucide-react';
import { SkillNode, VideoResult } from '../types/learning';

interface VideosViewProps {
  topic: string;
  activeNode: SkillNode | null;
  videos: VideoResult[];
  selectedVideo: VideoResult | null;
  bookmarkedIds: Record<string, boolean>;
  isSummarizing: boolean;
  onVideosLoaded: (videos: VideoResult[]) => void;
  onSelectVideo: (video: VideoResult) => void;
  onToggleBookmark: (videoId: string) => void;
  onGenerateNotes: (video: VideoResult, transcriptContext: string) => Promise<void>;
}

export const VideosView: React.FC<VideosViewProps> = ({
  topic,
  activeNode,
  videos,
  selectedVideo,
  bookmarkedIds,
  isSummarizing,
  onVideosLoaded,
  onSelectVideo,
  onToggleBookmark,
  onGenerateNotes,
}) => {
  const [query, setQuery] = useState(
    activeNode?.youtubeSearchQuery || `${topic} ${activeNode?.title || ''}`.trim()
  );
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedThumbs, setFailedThumbs] = useState<Record<string, boolean>>({});
  const [notesContext, setNotesContext] = useState('');

  useEffect(() => {
    if (activeNode?.youtubeSearchQuery) {
      setQuery(activeNode.youtubeSearchQuery);
    }
  }, [activeNode?.id, activeNode?.youtubeSearchQuery]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    setError(null);
    try {
      const res = await fetch('/api/videos/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          skillTitle: activeNode?.title || '',
          topic,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load video recommendations.');
      const list = (data.videos || []) as VideoResult[];
      if (list.length === 0) {
        setError('No embeddable videos found for that query. Try a broader term or paste a YouTube URL.');
      } else {
        onVideosLoaded(list);
        onSelectVideo(list[0]);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'We couldn’t load recommendations right now. Your roadmap is still saved—please try again shortly.'
      );
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header + Search */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Recommended for Your Next Step
          </h2>
          <p className="text-sm text-slate-600 dark:text-[#AAB4C8]">
            {activeNode
              ? `Curated lectures aligned with "${activeNode.title}"`
              : `Video tutorials for ${topic}`}
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search topic or paste YouTube URL…"
              aria-label="Search YouTube videos"
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-[#11182B] border border-slate-200 dark:border-[#273554] rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6D5DFB]/50"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="px-4 py-2.5 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] hover:from-[#5B4CF2] hover:to-[#4D8DFF] disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isSearching ? 'Searching…' : 'Find Videos'}
          </button>
        </form>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-[#FBBF24]/10 border border-amber-200 dark:border-[#FBBF24]/30 flex items-start gap-3 text-xs text-amber-800 dark:text-[#FBBF24]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Skeleton Loader */}
      {isSearching && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] rounded-2xl p-4 space-y-3"
            >
              <div className="aspect-video w-full rounded-xl bg-slate-200 dark:bg-[#11182B] animate-pulse" />
              <div className="h-4 w-3/4 bg-slate-200 dark:bg-[#11182B] rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-slate-200 dark:bg-[#11182B] rounded animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Video Recommendations Grid */}
      {!isSearching && videos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {videos.map((v) => {
            const isSelected = selectedVideo?.videoId === v.videoId;
            const isBookmarked = Boolean(bookmarkedIds[v.videoId]);
            const thumbFailed = failedThumbs[v.videoId];
            return (
              <div
                key={v.videoId}
                className={`group bg-white dark:bg-[#17213A] border rounded-2xl overflow-hidden transition-all hover:-translate-y-1 flex flex-col justify-between ${
                  isSelected
                    ? 'border-[#6D5DFB] shadow-[0_0_24px_rgba(109,93,251,0.2)]'
                    : 'border-slate-200 dark:border-[#273554] hover:border-slate-300 dark:hover:border-white/20'
                }`}
              >
                <div>
                  <button
                    type="button"
                    onClick={() => onSelectVideo(v)}
                    className="relative w-full aspect-video bg-slate-900 overflow-hidden block cursor-pointer"
                  >
                    {!thumbFailed ? (
                      <img
                        src={v.thumbnailUrl}
                        alt={v.title}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedThumbs((prev) => ({ ...prev, [v.videoId]: true }))
                        }
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#11182B]">
                        <Play className="w-8 h-8 text-slate-400" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent flex items-center justify-center">
                      <span className="w-11 h-11 rounded-full bg-white/90 text-[#0B1020] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </span>
                    </div>
                    {v.duration && (
                      <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/75 text-white font-mono text-[11px] tabular-nums">
                        {v.duration}
                      </span>
                    )}
                  </button>

                  <div className="p-5 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-[#73809B]">
                      <span className="font-medium text-[#6D5DFB] dark:text-[#A78BFA] truncate">
                        {activeNode?.title || topic}
                      </span>
                      <span className="shrink-0">{v.channelTitle}</span>
                    </div>
                    <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white line-clamp-2 leading-snug">
                      {v.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-[#AAB4C8] line-clamp-2 leading-relaxed">
                      {v.description}
                    </p>
                  </div>
                </div>

                <div className="px-5 pb-4 pt-2 border-t border-slate-100 dark:border-[#273554]/80 flex items-center justify-between gap-2">
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-[#4D8DFF] hover:underline inline-flex items-center gap-1"
                  >
                    <span>Watch on YouTube</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => onToggleBookmark(v.videoId)}
                    aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark video'}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      isBookmarked
                        ? 'text-[#FBBF24] bg-amber-50 dark:bg-[#FBBF24]/10'
                        : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'
                    }`}
                  >
                    <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Embedded Player & Instant Notes/Flowchart Synthesis */}
      {selectedVideo && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] rounded-2xl p-6">
          <div className="lg:col-span-7 space-y-3">
            <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${selectedVideo.videoId}?rel=0`}
                title={selectedVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                {selectedVideo.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#AAB4C8]">
                {selectedVideo.channelTitle}
              </p>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="video-notes-input"
                className="block text-sm font-semibold text-slate-900 dark:text-white"
              >
                Synthesize Real-Time Notes & Flowchart
              </label>
              <p className="text-xs text-slate-500 dark:text-[#AAB4C8]">
                Paste key timestamps, transcript snippets, or questions while watching—or generate straight from this lecture.
              </p>
              <textarea
                id="video-notes-input"
                rows={6}
                value={notesContext}
                onChange={(e) => setNotesContext(e.target.value)}
                placeholder="Optional: paste transcript excerpt or timestamps (e.g. 05:20 return vs print)…"
                className="w-full p-3.5 text-sm bg-slate-50 dark:bg-[#11182B] border border-slate-200 dark:border-[#273554] rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6D5DFB]/50"
              />
            </div>

            <button
              type="button"
              disabled={isSummarizing}
              onClick={() => void onGenerateNotes(selectedVideo, notesContext)}
              className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] hover:from-[#5B4CF2] hover:to-[#4D8DFF] text-white text-sm font-semibold hover:shadow-[0_0_24px_rgba(109,93,251,0.45)] transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSummarizing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating AI Notes & Flowchart…</span>
                </>
              ) : (
                <>
                  <GitBranch className="w-4 h-4" />
                  <span>Generate Notes & Flowchart</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
