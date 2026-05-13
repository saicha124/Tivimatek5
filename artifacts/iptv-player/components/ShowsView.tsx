import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useRef, useMemo, useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { VODItem, useIPTV } from "@/context/IPTVContext";
import { useColors } from "@/hooks/useColors";

const SPECIAL_CATS = ["All shows", "My list", "History"];

interface ShowsViewProps {
  onPlayVOD: (url: string, name: string) => void;
}

// ─── M3U grouping helpers (used for non-Stalker playlists) ────────────────────

interface SeriesGroup {
  name: string;
  logo?: string;
  episodes: VODItem[];
  category: string;
}

function groupIntoSeries(shows: VODItem[]): SeriesGroup[] {
  const map: Record<string, SeriesGroup> = {};
  for (const ep of shows) {
    const base = ep.name
      .replace(/\s*[Ss]\d{1,2}[Ee]\d{1,2}.*$/, "")
      .replace(/\s*[-–]\s*[Ss]\d.*$/, "")
      .replace(/\s*\(\d{4}\)\s*$/, "")
      .trim();
    const key = base || ep.name;
    if (!map[key]) {
      map[key] = { name: key, logo: ep.logo, episodes: [], category: ep.category };
    }
    map[key].episodes.push(ep);
  }
  return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
}

function extractSeasonEp(name: string): { season: number; ep: number } | null {
  const m = name.match(/[Ss](\d{1,2})[Ee](\d{1,2})/);
  if (m) return { season: parseInt(m[1]), ep: parseInt(m[2]) };
  return null;
}

function groupEpisodesBySeasons(episodes: VODItem[]): Record<number, VODItem[]> {
  const map: Record<number, VODItem[]> = {};
  for (const ep of episodes) {
    const info = extractSeasonEp(ep.name);
    const season = info?.season ?? 1;
    if (!map[season]) map[season] = [];
    map[season].push(ep);
  }
  for (const s of Object.keys(map)) {
    map[parseInt(s)].sort((a, b) => {
      const ai = extractSeasonEp(a.name)?.ep ?? 0;
      const bi = extractSeasonEp(b.name)?.ep ?? 0;
      return ai - bi;
    });
  }
  return map;
}

// ─── Stalker series detail (seasons + episodes from portal) ──────────────────

interface StalkerSeason { id: string; name: string }
interface StalkerEpisode { id: string; name: string; episodeNum: number; logo?: string }

function StalkerSeasonRow({
  season,
  seriesId,
  fallbackLogo,
  activePlaylist,
  colors,
  onPlayEpisode,
  seriesName,
}: {
  season: StalkerSeason;
  seriesId: string;
  fallbackLogo?: string;
  activePlaylist: any;
  colors: ReturnType<typeof useColors>;
  onPlayEpisode: (url: string, name: string) => void;
  seriesName: string;
}) {
  const [episodes, setEpisodes] = useState<StalkerEpisode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchEpisodes = async () => {
      if (!activePlaylist?.serverAddress || !activePlaylist?.macAddress) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const domain = process.env.EXPO_PUBLIC_DOMAIN;
        const base = domain ? `https://${domain}/api` : "/api";
        const qs = new URLSearchParams({
          portal: activePlaylist.serverAddress,
          mac: activePlaylist.macAddress,
          token: activePlaylist.stalkerToken || "",
          action: "get_ordered_list",
          type: "episodes",
          series_id: seriesId,
          season_id: season.id,
          sortby: "added",
          p: "1",
          items_num: "200",
        });
        const res = await fetch(`${base}/stalker/proxy?${qs}`);
        const data = await res.json();
        const raw: any[] = data?.js?.data || [];
        if (!cancelled) {
          setEpisodes(raw.map((ep: any, idx: number) => ({
            id: String(ep.id),
            name: ep.name || `Episode ${idx + 1}`,
            episodeNum: idx + 1,
            logo: ep.screenshot_uri || ep.cover || undefined,
          })));
        }
      } catch {
        if (!cancelled) setEpisodes([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchEpisodes();
    return () => { cancelled = true; };
  }, [activePlaylist, seriesId, season.id]);

  return (
    <View style={styles.seasonBlock}>
      <View style={[styles.seasonHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.seasonHeaderTitle, { color: colors.foreground }]}>{season.name}</Text>
        {!loading && episodes.length > 0 && (
          <Text style={[styles.seasonHeaderCount, { color: colors.mutedForeground }]}>
            1 / {episodes.length}
          </Text>
        )}
      </View>
      {loading ? (
        <View style={styles.seasonLoadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : episodes.length === 0 ? (
        <View style={styles.seasonLoadingRow}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" }}>
            No episodes found
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.epRow}
        >
          {episodes.map((ep) => (
            <TouchableOpacity
              key={ep.id}
              onPress={() => {
                Haptics.selectionAsync();
                onPlayEpisode(`stalker-episode:${seriesId}:${ep.episodeNum}`, `${seriesName} E${ep.episodeNum}`);
              }}
              style={styles.epCard}
              activeOpacity={0.8}
            >
              <View style={[styles.epCardThumb, { backgroundColor: colors.secondary }]}>
                {ep.logo || fallbackLogo ? (
                  <Image
                    source={{ uri: ep.logo || fallbackLogo }}
                    style={styles.epCardThumbImg}
                    contentFit="cover"
                  />
                ) : (
                  <Feather name="film" size={18} color={colors.mutedForeground} />
                )}
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.75)"]}
                  style={styles.epCardGradient}
                />
                <Text style={styles.epCardOverlayText} numberOfLines={2}>
                  {ep.name}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function StalkerSeriesDetail({
  item,
  isFav,
  onPlayEpisode,
  onToggleFav,
  onBack,
}: {
  item: VODItem;
  isFav: boolean;
  onPlayEpisode: (url: string, name: string) => void;
  onToggleFav: () => void;
  onBack?: () => void;
}) {
  const colors = useColors();
  const { activePlaylist } = useIPTV();

  const [seasons, setSeasons] = useState<StalkerSeason[]>([]);
  const [loadingSeasons, setLoadingSeasons] = useState(false);

  const seriesId = item.id;

  const fetchSeasons = useCallback(async () => {
    if (!activePlaylist?.serverAddress || !activePlaylist?.macAddress) return;
    setLoadingSeasons(true);
    try {
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const base = domain ? `https://${domain}/api` : "/api";
      const qs = new URLSearchParams({
        portal: activePlaylist.serverAddress,
        mac: activePlaylist.macAddress,
        token: activePlaylist.stalkerToken || "",
        action: "get_ordered_list",
        type: "seasons",
        series_id: seriesId,
        sortby: "added",
        p: "1",
        items_num: "50",
      });
      const res = await fetch(`${base}/stalker/proxy?${qs}`);
      const data = await res.json();
      const raw: any[] = data?.js?.data || [];
      setSeasons(raw.map((s: any) => ({
        id: String(s.id),
        name: s.name || `Saison ${s.id}`,
      })));
    } catch {
      // no seasons available — show metadata fallback
    } finally {
      setLoadingSeasons(false);
    }
  }, [activePlaylist, seriesId]);

  useEffect(() => {
    fetchSeasons();
  }, [fetchSeasons]);

  const yearStr = item.year ? item.year.slice(0, 4) : null;
  const ratingVal = item.rating ? parseFloat(item.rating) : null;
  const hasSeasonsData = seasons.length > 0;

  return (
    <View style={styles.detailRoot}>
      {/* Backdrop banner */}
      <View style={styles.detailBanner}>
        {item.logo ? (
          <Image
            source={{ uri: item.logo }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            blurRadius={Platform.OS === "web" ? 0 : 4}
          />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.secondary }]} />
        )}
        <LinearGradient
          colors={["rgba(0,0,0,0.1)", "rgba(13,13,13,0.97)"]}
          style={StyleSheet.absoluteFillObject}
        />
        {onBack && (
          <TouchableOpacity
            onPress={onBack}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.75}
          >
            <Feather name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>
        )}

        <View style={styles.bannerLayout}>
          {item.logo ? (
            <View style={styles.posterWrap}>
              <Image source={{ uri: item.logo }} style={styles.poster} contentFit="cover" />
            </View>
          ) : (
            <View style={[styles.posterWrap, styles.posterPlaceholder, { backgroundColor: colors.secondary }]}>
              <Feather name="grid" size={28} color={colors.mutedForeground} />
            </View>
          )}

          <View style={styles.bannerInfo}>
            <Text style={styles.bannerTitle} numberOfLines={2}>{item.name}</Text>

            <View style={styles.metaLine}>
              {yearStr && <Text style={[styles.metaLineText, { color: colors.mutedForeground }]}>{yearStr}</Text>}
              {hasSeasonsData && (
                <>
                  <Text style={[styles.metaLineDot, { color: colors.mutedForeground }]}>·</Text>
                  <Text style={[styles.metaLineText, { color: colors.mutedForeground }]}>
                    {seasons.length} {seasons.length === 1 ? "saison" : "saisons"}
                  </Text>
                </>
              )}
              {ratingVal !== null && !isNaN(ratingVal) && (
                <>
                  <Text style={[styles.metaLineDot, { color: colors.mutedForeground }]}>·</Text>
                  <View style={styles.ratingPill}>
                    <Text style={styles.ratingPillText}>{item.rating}</Text>
                  </View>
                </>
              )}
              {item.age && (
                <>
                  <Text style={[styles.metaLineDot, { color: colors.mutedForeground }]}>·</Text>
                  <Text style={[styles.metaLineText, { color: colors.mutedForeground }]}>{item.age}</Text>
                </>
              )}
            </View>

            {item.genres && (
              <Text style={[styles.genresText, { color: colors.mutedForeground }]} numberOfLines={1}>
                {item.genres}
              </Text>
            )}

            {item.actors && item.actors !== "N/A" && (
              <Text style={styles.castLine} numberOfLines={1}>
                <Text style={styles.castLabel}>Acteurs : </Text>
                <Text style={{ color: "rgba(255,255,255,0.75)" }}>{item.actors}</Text>
              </Text>
            )}
            {item.director && item.director !== "N/A" && (
              <Text style={styles.castLine} numberOfLines={1}>
                <Text style={styles.castLabel}>Réalisateur : </Text>
                <Text style={{ color: "rgba(255,255,255,0.75)" }}>{item.director}</Text>
              </Text>
            )}
            {item.description && (
              <Text style={styles.descriptionText} numberOfLines={3}>{item.description}</Text>
            )}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.bannerActions}
            >
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onPlayEpisode(`stalker-episode:${seriesId}:1`, `${item.name} S1 E1`);
                }}
                style={[styles.playBtn, { backgroundColor: colors.foreground }]}
                activeOpacity={0.85}
              >
                <Feather name="play" size={15} color={colors.background} />
                <Text style={[styles.playBtnText, { color: colors.background }]}>
                  {hasSeasonsData ? "Regarder S1 E1" : "Regarder"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); }}
                style={[styles.favBtn, { backgroundColor: "transparent", borderColor: "rgba(255,255,255,0.4)" }]}
                activeOpacity={0.8}
              >
                <Feather name="external-link" size={14} color="rgba(255,255,255,0.85)" />
                <Text style={[styles.favBtnText, { color: "rgba(255,255,255,0.85)" }]}>Lecteur ext.</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); }}
                style={[styles.favBtn, { backgroundColor: "transparent", borderColor: "rgba(255,255,255,0.4)" }]}
                activeOpacity={0.8}
              >
                <Feather name="youtube" size={14} color="rgba(255,255,255,0.85)" />
                <Text style={[styles.favBtnText, { color: "rgba(255,255,255,0.85)" }]}>Bande annonce</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); onToggleFav(); }}
                style={[styles.favBtn, {
                  backgroundColor: isFav ? `${colors.primary}22` : "transparent",
                  borderColor: isFav ? colors.primary : "rgba(255,255,255,0.4)",
                }]}
                activeOpacity={0.8}
              >
                <Feather name="bookmark" size={14} color={isFav ? colors.primary : "rgba(255,255,255,0.85)"} />
                <Text style={[styles.favBtnText, { color: isFav ? colors.primary : "rgba(255,255,255,0.85)" }]}>
                  {isFav ? "Ma liste" : "Ajouter à ma liste"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </View>

      {/* Seasons + Episodes or metadata fallback */}
      {loadingSeasons ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 8 }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" }}>
            Chargement des saisons…
          </Text>
        </View>
      ) : hasSeasonsData ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          {seasons.map((s) => (
            <StalkerSeasonRow
              key={s.id}
              season={s}
              seriesId={seriesId}
              fallbackLogo={item.logo}
              activePlaylist={activePlaylist}
              colors={colors}
              onPlayEpisode={onPlayEpisode}
              seriesName={item.name}
            />
          ))}
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.metaScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 12 }}
        >
          {item.description ? (
            <View style={styles.metaBlock}>
              <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>SYNOPSIS</Text>
              <Text style={[styles.metaValue, { color: colors.foreground }]}>{item.description}</Text>
            </View>
          ) : null}
          {item.director && item.director !== "N/A" && (
            <View style={[styles.metaRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.metaRowLabel, { color: colors.mutedForeground }]}>Director</Text>
              <Text style={[styles.metaRowValue, { color: colors.foreground }]} numberOfLines={2}>{item.director}</Text>
            </View>
          )}
          {item.actors && item.actors !== "N/A" && (
            <View style={[styles.metaRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.metaRowLabel, { color: colors.mutedForeground }]}>Cast</Text>
              <Text style={[styles.metaRowValue, { color: colors.foreground }]} numberOfLines={3}>{item.actors}</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─── M3U series detail (season/episode list) ──────────────────────────────────

function M3USeriesDetail({
  series,
  isFav,
  onPlayEp,
  onToggleFav,
  onBack,
}: {
  series: SeriesGroup;
  isFav: boolean;
  onPlayEp: (ep: VODItem) => void;
  onToggleFav: () => void;
  onBack?: () => void;
}) {
  const colors = useColors();
  const seasonMap = useMemo(() => groupEpisodesBySeasons(series.episodes), [series]);
  const seasons = Object.keys(seasonMap).map(Number).sort((a, b) => a - b);
  const firstEp = seasonMap[seasons[0] ?? 1]?.[0];

  return (
    <View style={styles.detailRoot}>
      <View style={styles.detailBanner}>
        {series.logo ? (
          <Image
            source={{ uri: series.logo }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            blurRadius={Platform.OS === "web" ? 0 : 3}
          />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.secondary }]} />
        )}
        <LinearGradient
          colors={["rgba(0,0,0,0.25)", "rgba(17,17,17,0.98)"]}
          style={StyleSheet.absoluteFillObject}
        />
        {onBack && (
          <TouchableOpacity
            onPress={onBack}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.75}
          >
            <Feather name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>
        )}
        <View style={styles.bannerContent}>
          <Text style={styles.bannerTitle} numberOfLines={2}>{series.name}</Text>
          <View style={styles.badgeRow}>
            <Text style={[styles.badgeText, { color: colors.primary }]}>{series.category}</Text>
            <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>
              · {seasons.length} {seasons.length === 1 ? "Season" : "Seasons"}
            </Text>
            <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>
              · {series.episodes.length} Episodes
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bannerActions}
          >
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                if (firstEp) onPlayEp(firstEp);
              }}
              style={[styles.playBtn, { backgroundColor: colors.foreground }]}
              activeOpacity={0.85}
            >
              <Feather name="play" size={15} color={colors.background} />
              <Text style={[styles.playBtnText, { color: colors.background }]}>Regarder S1 E1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync(); }}
              style={[styles.favBtn, { backgroundColor: "transparent", borderColor: "rgba(255,255,255,0.4)" }]}
              activeOpacity={0.8}
            >
              <Feather name="external-link" size={14} color="rgba(255,255,255,0.85)" />
              <Text style={[styles.favBtnText, { color: "rgba(255,255,255,0.85)" }]}>Lecteur ext.</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync(); }}
              style={[styles.favBtn, { backgroundColor: "transparent", borderColor: "rgba(255,255,255,0.4)" }]}
              activeOpacity={0.8}
            >
              <Feather name="youtube" size={14} color="rgba(255,255,255,0.85)" />
              <Text style={[styles.favBtnText, { color: "rgba(255,255,255,0.85)" }]}>Bande annonce</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync(); onToggleFav(); }}
              style={[styles.favBtn, {
                backgroundColor: isFav ? `${colors.primary}22` : "transparent",
                borderColor: isFav ? colors.primary : "rgba(255,255,255,0.4)",
              }]}
              activeOpacity={0.8}
            >
              <Feather name="bookmark" size={14} color={isFav ? colors.primary : "rgba(255,255,255,0.85)"} />
              <Text style={[styles.favBtnText, { color: isFav ? colors.primary : "rgba(255,255,255,0.85)" }]}>
                {isFav ? "Ma liste" : "Ajouter à ma liste"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {seasons.map((s) => {
          const seasonEps = seasonMap[s] ?? [];
          return (
            <View key={s} style={styles.seasonBlock}>
              <View style={[styles.seasonHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.seasonHeaderTitle, { color: colors.foreground }]}>Saison {s}</Text>
                <Text style={[styles.seasonHeaderCount, { color: colors.mutedForeground }]}>
                  1 / {seasonEps.length}
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.epRow}
              >
                {seasonEps.map((ep, index) => {
                  const info = extractSeasonEp(ep.name);
                  const epNum = info?.ep ?? index + 1;
                  return (
                    <TouchableOpacity
                      key={ep.id}
                      onPress={() => { Haptics.selectionAsync(); onPlayEp(ep); }}
                      style={styles.epCard}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.epCardThumb, { backgroundColor: colors.secondary }]}>
                        {ep.logo || series.logo ? (
                          <Image
                            source={{ uri: ep.logo || series.logo }}
                            style={styles.epCardThumbImg}
                            contentFit="cover"
                          />
                        ) : (
                          <Feather name="film" size={18} color={colors.mutedForeground} />
                        )}
                        <LinearGradient
                          colors={["transparent", "rgba(0,0,0,0.75)"]}
                          style={styles.epCardGradient}
                        />
                        <Text style={styles.epCardOverlayText} numberOfLines={2}>{ep.name}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Series thumbnail card ────────────────────────────────────────────────────

function SeriesCard({
  name,
  logo,
  badge,
  selected,
  onPress,
}: {
  name: string;
  logo?: string;
  badge?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.seriesCard,
        selected && { borderColor: colors.primary, borderWidth: 2 },
      ]}
    >
      {logo ? (
        <Image source={{ uri: logo }} style={styles.seriesImg} contentFit="cover" />
      ) : (
        <View style={[styles.seriesPlaceholder, { backgroundColor: colors.secondary }]}>
          <Feather name="grid" size={28} color={colors.mutedForeground} />
        </View>
      )}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.88)"]}
        style={styles.seriesGradient}
      />
      <Text style={styles.seriesTitle} numberOfLines={2}>{name}</Text>
      {badge && (
        <View style={styles.episodeBadge}>
          <Text style={styles.episodeBadgeText}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main ShowsView ───────────────────────────────────────────────────────────

export function ShowsView({ onPlayVOD }: ShowsViewProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { activePlaylist, favorites, toggleFavorite, watchHistory, addToWatchHistory } = useIPTV();

  const shows = activePlaylist?.shows ?? [];
  const isStalker = activePlaylist?.type === "StalkerPortal";

  const categories = useMemo(() => {
    const cats = Array.from(new Set(shows.map((s) => s.category))).sort();
    return [...SPECIAL_CATS, ...cats];
  }, [shows]);

  const [selectedCat, setSelectedCat] = useState("All shows");
  // For Stalker: selected VODItem id. For M3U: selected SeriesGroup name.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput>(null);
  const [fullScreenShow, setFullScreenShow] = useState(false);

  const { width: screenWidth } = useWindowDimensions();
  const isNarrow = screenWidth < 700;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const filteredShows = useMemo(() => {
    if (selectedCat === "All shows") return shows;
    if (selectedCat === "My list") return shows.filter((s) => favorites.includes(s.id));
    if (selectedCat === "History") {
      const ids = new Set(watchHistory.map((h) => h.channelId));
      return shows.filter((s) => ids.has(s.id));
    }
    return shows.filter((s) => s.category === selectedCat);
  }, [selectedCat, shows, favorites, watchHistory]);

  // Stalker: work directly with VODItems
  const stalkerItems = filteredShows;

  // Search filtering (searches across ALL shows regardless of category)
  const searchActive = query.trim().length > 0;
  const displayStalkerItems = useMemo(() => {
    if (!searchActive) return stalkerItems;
    const q = query.trim().toLowerCase();
    return shows.filter((s) => s.name.toLowerCase().includes(q));
  }, [searchActive, query, stalkerItems, shows]);

  const currentStalkerItem = useMemo(() => {
    if (!isStalker) return null;
    return displayStalkerItems.find((s) => s.id === selectedId) ?? displayStalkerItems[0] ?? null;
  }, [isStalker, displayStalkerItems, selectedId]);

  // M3U: group by name pattern
  const seriesList = useMemo(() => (isStalker ? [] : groupIntoSeries(filteredShows)), [isStalker, filteredShows]);

  const displaySeriesList = useMemo(() => {
    if (!searchActive) return seriesList;
    const q = query.trim().toLowerCase();
    return seriesList.filter((s) => s.name.toLowerCase().includes(q));
  }, [searchActive, query, seriesList]);

  const currentSeries = useMemo(() => {
    if (isStalker) return null;
    return displaySeriesList.find((s) => s.name === selectedId) ?? displaySeriesList[0] ?? null;
  }, [isStalker, displaySeriesList, selectedId]);

  if (fullScreenShow) {
    if (isStalker && currentStalkerItem) {
      return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <StalkerSeriesDetail
            item={currentStalkerItem}
            isFav={favorites.includes(currentStalkerItem.id)}
            onBack={() => setFullScreenShow(false)}
            onPlayEpisode={(url, epName) => {
              addToWatchHistory({
                channelId: currentStalkerItem.id,
                channelName: epName,
                channelGroup: currentStalkerItem.category,
                channelLogo: currentStalkerItem.logo,
                channelUrl: url,
                type: "show",
              });
              onPlayVOD(url, epName);
            }}
            onToggleFav={() => toggleFavorite(currentStalkerItem.id)}
          />
        </View>
      );
    }
    if (!isStalker && currentSeries) {
      return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <M3USeriesDetail
            series={currentSeries}
            isFav={currentSeries.episodes[0] ? favorites.includes(currentSeries.episodes[0].id) : false}
            onBack={() => setFullScreenShow(false)}
            onPlayEp={(ep) => {
              addToWatchHistory({
                channelId: ep.id,
                channelName: ep.name,
                channelGroup: ep.category,
                channelLogo: ep.logo,
                channelUrl: ep.url,
                type: "show",
              });
              onPlayVOD(ep.url, ep.name);
            }}
            onToggleFav={() => {
              if (currentSeries.episodes[0]) toggleFavorite(currentSeries.episodes[0].id);
            }}
          />
        </View>
      );
    }
  }

  if (shows.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.background }]}>
        <Feather name="grid" size={52} color={colors.mutedForeground} style={{ marginBottom: 14 }} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No shows available</Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          Shows and series from your playlist will appear here
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Left category sidebar — hidden on narrow screens */}
      {!isNarrow && (
        <View style={[styles.catSidebar, { backgroundColor: colors.sidebar, borderRightColor: colors.border, paddingTop: topPad + 8 }]}>
          <Text style={[styles.catHeader, { color: colors.mutedForeground }]}>SHOWS</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad + 16 }}>
            {categories.map((cat) => {
              const active = cat === selectedCat;
              const isSpecial = SPECIAL_CATS.includes(cat);
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedCat(cat);
                    setSelectedId(null);
                    setFullScreenShow(false);
                  }}
                  style={[styles.catItem, active && { backgroundColor: colors.highlight }]}
                  activeOpacity={0.7}
                >
                  {isSpecial && (
                    <Feather
                      name={cat === "My list" ? "bookmark" : cat === "History" ? "clock" : "grid"}
                      size={13}
                      color={active ? colors.primary : colors.mutedForeground}
                      style={{ marginRight: 6 }}
                    />
                  )}
                  <Text
                    style={[
                      styles.catLabel,
                      {
                        color: active ? colors.foreground : colors.mutedForeground,
                        fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {cat}
                  </Text>
                  {active && <View style={[styles.catActiveBar, { backgroundColor: colors.primary }]} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Right: detail + strip */}
      <View style={styles.content}>
        {/* Horizontal category strip — shown only on narrow screens */}
        {isNarrow && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.narrowCatStrip, { backgroundColor: colors.sidebar, borderBottomColor: colors.border }]}
            contentContainerStyle={styles.narrowCatStripContent}
          >
            {categories.map((cat) => {
              const active = cat === selectedCat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedCat(cat);
                    setSelectedId(null);
                    setFullScreenShow(false);
                  }}
                  style={[
                    styles.narrowCatItem,
                    active && { backgroundColor: colors.primary },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.narrowCatLabel,
                      { color: active ? "#fff" : colors.mutedForeground },
                    ]}
                    numberOfLines={1}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
        {isStalker ? (
          <>
            {currentStalkerItem && (
              <StalkerSeriesDetail
                item={currentStalkerItem}
                isFav={favorites.includes(currentStalkerItem.id)}
                onPlayEpisode={(url, epName) => {
                  addToWatchHistory({
                    channelId: currentStalkerItem.id,
                    channelName: epName,
                    channelGroup: currentStalkerItem.category,
                    channelLogo: currentStalkerItem.logo,
                    channelUrl: url,
                    type: "show",
                  });
                  onPlayVOD(url, epName);
                }}
                onToggleFav={() => toggleFavorite(currentStalkerItem.id)}
              />
            )}
            <View style={[styles.seriesStrip, { borderTopColor: colors.border }]}>
              {/* Search bar */}
              <View style={[styles.searchBar, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Feather name="search" size={14} color={colors.mutedForeground} />
                <TextInput
                  ref={inputRef}
                  style={[styles.searchInput, { color: colors.foreground }]}
                  placeholder="Search shows…"
                  placeholderTextColor={colors.mutedForeground}
                  value={query}
                  onChangeText={setQuery}
                  returnKeyType="search"
                  clearButtonMode="never"
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {query.length > 0 && (
                  <TouchableOpacity
                    onPress={() => { setQuery(""); inputRef.current?.blur(); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="x" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>

              {displayStalkerItems.length === 0 ? (
                <View style={styles.stripEmpty}>
                  <Text style={[styles.stripEmptyText, { color: colors.mutedForeground }]}>
                    No results for "{query}"
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.stripHeader, { color: colors.mutedForeground }]}>
                    {searchActive
                      ? `${displayStalkerItems.length} ${displayStalkerItems.length === 1 ? "RESULT" : "RESULTS"}`
                      : `${displayStalkerItems.length} SERIES`}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingBottom: bottomPad + 8 }}
                  >
                    {displayStalkerItems.map((item) => (
                      <SeriesCard
                        key={item.id}
                        name={item.name}
                        logo={item.logo}
                        badge={item.year ? item.year.slice(0, 4) : undefined}
                        selected={currentStalkerItem?.id === item.id}
                        onPress={() => { Haptics.selectionAsync(); setSelectedId(item.id); setFullScreenShow(true); }}
                      />
                    ))}
                  </ScrollView>
                </>
              )}
            </View>
          </>
        ) : (
          <>
            {currentSeries && (
              <M3USeriesDetail
                series={currentSeries}
                isFav={currentSeries.episodes[0] ? favorites.includes(currentSeries.episodes[0].id) : false}
                onPlayEp={(ep) => {
                  addToWatchHistory({
                    channelId: ep.id,
                    channelName: ep.name,
                    channelGroup: ep.category,
                    channelLogo: ep.logo,
                    channelUrl: ep.url,
                    type: "show",
                  });
                  onPlayVOD(ep.url, ep.name);
                }}
                onToggleFav={() => {
                  if (currentSeries.episodes[0]) toggleFavorite(currentSeries.episodes[0].id);
                }}
              />
            )}
            <View style={[styles.seriesStrip, { borderTopColor: colors.border }]}>
              {/* Search bar */}
              <View style={[styles.searchBar, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Feather name="search" size={14} color={colors.mutedForeground} />
                <TextInput
                  ref={inputRef}
                  style={[styles.searchInput, { color: colors.foreground }]}
                  placeholder="Search shows…"
                  placeholderTextColor={colors.mutedForeground}
                  value={query}
                  onChangeText={setQuery}
                  returnKeyType="search"
                  clearButtonMode="never"
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {query.length > 0 && (
                  <TouchableOpacity
                    onPress={() => { setQuery(""); inputRef.current?.blur(); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="x" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>

              {displaySeriesList.length === 0 ? (
                <View style={styles.stripEmpty}>
                  <Text style={[styles.stripEmptyText, { color: colors.mutedForeground }]}>
                    No results for "{query}"
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.stripHeader, { color: colors.mutedForeground }]}>
                    {searchActive
                      ? `${displaySeriesList.length} ${displaySeriesList.length === 1 ? "RESULT" : "RESULTS"}`
                      : `${displaySeriesList.length} SERIES`}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingBottom: bottomPad + 8 }}
                  >
                    {displaySeriesList.map((s) => (
                      <SeriesCard
                        key={s.name}
                        name={s.name}
                        logo={s.logo}
                        badge={`${s.episodes.length} ep`}
                        selected={currentSeries?.name === s.name}
                        onPress={() => { Haptics.selectionAsync(); setSelectedId(s.name); setFullScreenShow(true); }}
                      />
                    ))}
                  </ScrollView>
                </>
              )}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const CARD_W = 110;
const CARD_H = 155;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: "row",
  },
  catSidebar: {
    width: 160,
    borderRightWidth: 1,
    paddingHorizontal: 4,
  },
  catHeader: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  catItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 4,
    marginHorizontal: 2,
    position: "relative",
  },
  catLabel: {
    fontSize: 12,
    flex: 1,
  },
  catActiveBar: {
    position: "absolute",
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
  },
  content: {
    flex: 1,
  },
  // ── detail root ──
  detailRoot: {
    flex: 1,
  },
  detailBanner: {
    height: 220,
    position: "relative",
    overflow: "hidden",
  },
  // ── Stalker banner layout ──
  bannerLayout: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 14,
    gap: 14,
  },
  posterWrap: {
    width: 90,
    height: 130,
    borderRadius: 6,
    overflow: "hidden",
    flexShrink: 0,
  },
  posterPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  poster: {
    width: 90,
    height: 130,
  },
  bannerInfo: {
    flex: 1,
    gap: 4,
  },
  bannerTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    alignItems: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  genresText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  bannerActions: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginTop: 4,
  },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  playBtnText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  favBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  favBtnText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  // ── metadata section ──
  metaScroll: {
    flex: 1,
  },
  metaBlock: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  metaLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
    marginBottom: 5,
  },
  metaValue: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  metaRowLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    width: 58,
    flexShrink: 0,
    marginTop: 1,
  },
  metaRowValue: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 17,
  },
  // ── M3U banner (legacy) ──
  bannerContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    paddingTop: 28,
  },
  seasonTabs: {
    height: 40,
    borderBottomWidth: 1,
  },
  seasonTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginVertical: 6,
  },
  seasonTabText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  seasonRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  seasonRowLabel: {
    flex: 1,
    fontSize: 13,
  },
  seasonRowCount: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginRight: 4,
  },
  /* ── New TiviMate-style season block ── */
  seasonBlock: {
    marginTop: 4,
  },
  seasonHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  seasonHeaderTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  seasonHeaderCount: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  seasonLoadingRow: {
    paddingVertical: 16,
    alignItems: "center",
  },
  epCard: {
    width: 160,
  },
  epCardThumb: {
    width: 160,
    height: 90,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
  },
  epCardThumbImg: {
    width: 160,
    height: 90,
  },
  epCardPlayOverlay: {
    position: "absolute",
    inset: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  epCardGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 50,
  },
  epCardOverlayText: {
    position: "absolute",
    bottom: 5,
    left: 6,
    right: 6,
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "#fff",
    lineHeight: 13,
  },
  epCardNum: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  epCardName: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 15,
  },
  epRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  /* ── Detail banner meta line (year · saisons · rating) ── */
  metaLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 2,
  },
  metaLineText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  metaLineDot: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  ratingPill: {
    backgroundColor: "#f5c51830",
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  ratingPillText: {
    color: "#f5c518",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  castLine: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    marginTop: 1,
  },
  castLabel: {
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.5)",
  },
  descriptionText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    lineHeight: 16,
    marginTop: 4,
  },
  epNumBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  epNum: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  epThumb: {
    width: 64,
    height: 40,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  epThumbImg: {
    width: 64,
    height: 40,
  },
  epInfo: {
    flex: 1,
    gap: 2,
  },
  epTitle: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  epPlayBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  // ── Narrow-screen horizontal category strip ──────────────────────────────
  narrowCatStrip: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    maxHeight: 44,
    flexShrink: 0,
  },
  narrowCatStripContent: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
    alignItems: "center",
  },
  narrowCatItem: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  narrowCatLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },

  // ── search bar ──
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 10,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    paddingVertical: 0,
  },
  stripEmpty: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  stripEmptyText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  // ── series strip ──
  seriesStrip: {
    borderTopWidth: 1,
    paddingTop: 10,
  },
  stripHeader: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  seriesCard: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 6,
    overflow: "hidden",
    position: "relative",
  },
  seriesImg: {
    width: CARD_W,
    height: CARD_H,
  },
  seriesPlaceholder: {
    width: CARD_W,
    height: CARD_H,
    justifyContent: "center",
    alignItems: "center",
  },
  seriesGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 70,
  },
  seriesTitle: {
    position: "absolute",
    bottom: 18,
    left: 6,
    right: 6,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  episodeBadge: {
    position: "absolute",
    bottom: 5,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  episodeBadgeText: {
    fontSize: 9,
    color: "#ccc",
    fontFamily: "Inter_500Medium",
  },
  // ── back button (full-screen mode) ──
  backBtn: {
    position: "absolute",
    top: 14,
    left: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  // ── empty state ──
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
