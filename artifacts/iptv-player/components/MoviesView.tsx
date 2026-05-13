import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useRef, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { VODItem, useIPTV } from "@/context/IPTVContext";
import { useColors } from "@/hooks/useColors";

const SPECIAL_CATS = ["All movies", "My list", "History"];

interface MoviesViewProps {
  onPlayVOD: (url: string, name: string) => void;
}

// ─── Rich movie detail pane ───────────────────────────────────────────────────

function MovieDetailPane({
  item,
  isFav,
  onPlay,
  onToggleFav,
}: {
  item: VODItem;
  isFav: boolean;
  onPlay: () => void;
  onToggleFav: () => void;
}) {
  const colors = useColors();

  const yearStr = item.year ? item.year.slice(0, 4) : null;
  const ratingVal = item.rating ? parseFloat(item.rating) : null;
  const hasRating = ratingVal !== null && !isNaN(ratingVal);

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

        <View style={styles.bannerLayout}>
          {/* Poster thumbnail */}
          {item.logo ? (
            <View style={styles.posterWrap}>
              <Image source={{ uri: item.logo }} style={styles.poster} contentFit="cover" />
            </View>
          ) : (
            <View style={[styles.posterWrap, styles.posterPlaceholder, { backgroundColor: colors.secondary }]}>
              <Feather name="film" size={28} color={colors.mutedForeground} />
            </View>
          )}

          {/* Info column */}
          <View style={styles.bannerInfo}>
            <Text style={styles.bannerTitle} numberOfLines={2}>{item.name}</Text>

            {/* Badges row: year · IMDb · age */}
            <View style={styles.badgeRow}>
              {yearStr ? (
                <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>{yearStr}</Text>
                </View>
              ) : null}
              {hasRating ? (
                <View style={[styles.badge, { backgroundColor: "#f5c51820" }]}>
                  <Feather name="star" size={9} color="#f5c518" />
                  <Text style={[styles.badgeText, { color: "#f5c518" }]}>{item.rating} IMDb</Text>
                </View>
              ) : null}
              {item.age ? (
                <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>{item.age}</Text>
                </View>
              ) : null}
            </View>

            {/* Genres */}
            {item.genres ? (
              <Text style={[styles.genresText, { color: colors.primary }]} numberOfLines={1}>
                {item.genres}
              </Text>
            ) : item.category ? (
              <Text style={[styles.genresText, { color: colors.primary }]} numberOfLines={1}>
                {item.category}
              </Text>
            ) : null}

            {/* Action buttons */}
            <View style={styles.bannerActions}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onPlay();
                }}
                style={[styles.playBtn, { backgroundColor: colors.foreground }]}
                activeOpacity={0.85}
              >
                <Feather name="play" size={15} color={colors.background} />
                <Text style={[styles.playBtnText, { color: colors.background }]}>Play</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); onToggleFav(); }}
                style={[
                  styles.favBtn,
                  {
                    backgroundColor: isFav ? `${colors.primary}22` : colors.secondary,
                    borderColor: isFav ? colors.primary : colors.border,
                  },
                ]}
                activeOpacity={0.8}
              >
                <Feather name="bookmark" size={14} color={isFav ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.favBtnText, { color: isFav ? colors.primary : colors.mutedForeground }]}>
                  {isFav ? "Saved" : "My List"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Metadata rows */}
      <ScrollView
        style={styles.metaScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 8 }}
        nestedScrollEnabled
      >
        {item.description ? (
          <View style={styles.metaBlock}>
            <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>SYNOPSIS</Text>
            <Text style={[styles.metaValue, { color: colors.foreground }]}>{item.description}</Text>
          </View>
        ) : null}

        {item.director && item.director !== "N/A" ? (
          <View style={[styles.metaRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.metaRowLabel, { color: colors.mutedForeground }]}>Director</Text>
            <Text style={[styles.metaRowValue, { color: colors.foreground }]} numberOfLines={2}>
              {item.director}
            </Text>
          </View>
        ) : null}

        {item.actors && item.actors !== "N/A" ? (
          <View style={[styles.metaRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.metaRowLabel, { color: colors.mutedForeground }]}>Cast</Text>
            <Text style={[styles.metaRowValue, { color: colors.foreground }]} numberOfLines={3}>
              {item.actors}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ─── Poster card ──────────────────────────────────────────────────────────────

function PosterCard({
  item,
  selected,
  onPress,
}: {
  item: VODItem;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.posterCard,
        selected && { borderColor: colors.primary, borderWidth: 2 },
      ]}
    >
      {item.logo ? (
        <Image
          source={{ uri: item.logo }}
          style={styles.posterImg}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.posterPlaceholderCard, { backgroundColor: colors.secondary }]}>
          <Feather name="film" size={28} color={colors.mutedForeground} />
        </View>
      )}
      {selected && (
        <View style={[styles.selectedOverlay, { backgroundColor: `${colors.primary}30` }]} />
      )}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.85)"]}
        style={styles.posterGradient}
      />
      <Text style={styles.posterTitle} numberOfLines={2}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Full-screen category view (TiviMate style) ──────────────────────────────

const FS_POSTER_W = 100;
const FS_POSTER_H = 148;

function CategoryFullScreenView({
  category,
  movies,
  selectedMovie,
  selectedIdx,
  onSelectMovie,
  onBack,
  onPlay,
  onToggleFav,
  isFav,
  colors,
  topPad,
  bottomPad,
}: {
  category: string;
  movies: VODItem[];
  selectedMovie: VODItem | null;
  selectedIdx: number;
  onSelectMovie: (movie: VODItem) => void;
  onBack: () => void;
  onPlay: (movie: VODItem) => void;
  onToggleFav: (id: string) => void;
  isFav: (id: string) => boolean;
  colors: ReturnType<typeof useColors>;
  topPad: number;
  bottomPad: number;
}) {
  const m = selectedMovie;
  const yearStr = m?.year ? m.year.slice(0, 4) : null;
  const ratingVal = m?.rating ? parseFloat(m.rating) : null;
  const hasRating = ratingVal !== null && !isNaN(ratingVal);
  const hasFav = m ? isFav(m.id) : false;

  return (
    <View style={[fsStyles.container, { backgroundColor: "#000" }]}>
      {/* Backdrop */}
      {m?.logo ? (
        <Image
          source={{ uri: m.logo }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          blurRadius={Platform.OS === "web" ? 2 : 10}
        />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#111" }]} />
      )}
      <LinearGradient
        colors={["rgba(0,0,0,0.45)", "rgba(8,8,8,0.96)"]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Top bar */}
      <View style={[fsStyles.topBar, { paddingTop: topPad + 6 }]}>
        <TouchableOpacity onPress={onBack} style={fsStyles.topIconBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={fsStyles.topTitle} numberOfLines={1}>{category}</Text>
        <View style={fsStyles.topActions}>
          <TouchableOpacity style={fsStyles.topIconBtn} activeOpacity={0.7}>
            <Feather name="search" size={19} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={fsStyles.topIconBtn} activeOpacity={0.7}>
            <Feather name="sliders" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Movie info overlay */}
      {m && (
        <View style={fsStyles.infoArea}>
          <Text style={fsStyles.infoTitle} numberOfLines={2}>{m.name}</Text>
          <View style={fsStyles.infoMeta}>
            {hasRating && (
              <View style={[fsStyles.ratingBadge, { backgroundColor: colors.primary }]}>
                <Text style={fsStyles.ratingText}>{ratingVal!.toFixed(1)}</Text>
              </View>
            )}
            {yearStr ? <Text style={fsStyles.metaText}>{yearStr}</Text> : null}
            {(m.genres || m.category) ? (
              <Text style={[fsStyles.metaText, { color: colors.primary }]}>
                · {m.genres ?? m.category}
              </Text>
            ) : null}
          </View>
          {m.actors && m.actors !== "N/A" && (
            <Text style={fsStyles.castRow} numberOfLines={1}>
              <Text style={fsStyles.castLabel}>Cast:  </Text>{m.actors}
            </Text>
          )}
          {m.director && m.director !== "N/A" && (
            <Text style={fsStyles.castRow} numberOfLines={1}>
              <Text style={fsStyles.castLabel}>Director:  </Text>{m.director}
            </Text>
          )}
          {m.description ? (
            <Text style={fsStyles.desc} numberOfLines={4}>{m.description}</Text>
          ) : null}
          <View style={fsStyles.actionRow}>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onPlay(m); }}
              style={[fsStyles.playBtn, { backgroundColor: "#fff" }]}
              activeOpacity={0.85}
            >
              <Feather name="play" size={14} color="#000" />
              <Text style={[fsStyles.playBtnText, { color: "#000" }]}>Play</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync(); onToggleFav(m.id); }}
              style={[fsStyles.outlineBtn, { borderColor: hasFav ? colors.primary : "rgba(255,255,255,0.45)" }]}
              activeOpacity={0.8}
            >
              <Feather name="bookmark" size={14} color={hasFav ? colors.primary : "rgba(255,255,255,0.8)"} />
              <Text style={[fsStyles.outlineBtnText, { color: hasFav ? colors.primary : "rgba(255,255,255,0.8)" }]}>
                {hasFav ? "Saved" : "My List"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Bottom poster strip */}
      <View style={[fsStyles.bottomStrip, { paddingBottom: bottomPad + 10 }]}>
        <View style={fsStyles.stripHeader}>
          <Text style={fsStyles.stripCatLabel}>{category}</Text>
          <Text style={fsStyles.stripCount}>
            {selectedIdx + 1} / {movies.length}
          </Text>
        </View>
        <FlatList
          data={movies}
          horizontal
          keyExtractor={(mv) => mv.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
          initialScrollIndex={Math.max(0, selectedIdx - 2)}
          getItemLayout={(_, index) => ({
            length: FS_POSTER_W + 8,
            offset: (FS_POSTER_W + 8) * index,
            index,
          })}
          renderItem={({ item: mv }) => (
            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync(); onSelectMovie(mv); }}
              activeOpacity={0.8}
              style={[
                fsStyles.stripPoster,
                selectedMovie?.id === mv.id && { borderColor: colors.primary, borderWidth: 2 },
              ]}
            >
              {mv.logo ? (
                <Image source={{ uri: mv.logo }} style={fsStyles.stripPosterImg} contentFit="cover" />
              ) : (
                <View style={[fsStyles.stripPosterImg, { backgroundColor: "#222", justifyContent: "center", alignItems: "center" }]}>
                  <Feather name="film" size={18} color="#555" />
                </View>
              )}
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.82)"]}
                style={fsStyles.stripPosterGrad}
              />
              {mv.rating && parseFloat(mv.rating) > 0 && (
                <View style={[fsStyles.stripRatingBadge, { backgroundColor: colors.primary }]}>
                  <Text style={fsStyles.stripRatingText}>{parseFloat(mv.rating).toFixed(1)}</Text>
                </View>
              )}
              <Text style={fsStyles.stripPosterName} numberOfLines={2}>{mv.name}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );
}

const fsStyles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 10,
  },
  topIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  topTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.3,
  },
  topActions: { flexDirection: "row", gap: 8 },
  infoArea: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 12,
    maxWidth: 560,
  },
  infoTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    marginBottom: 10,
    lineHeight: 34,
  },
  infoMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  ratingBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  ratingText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  metaText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  castLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  castRow: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
    lineHeight: 18,
  },
  desc: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    marginTop: 8,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 6,
  },
  playBtnText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 6,
    borderWidth: 1,
  },
  outlineBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  bottomStrip: {
    paddingTop: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  stripHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  stripCatLabel: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  stripCount: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.45)",
  },
  stripPoster: {
    width: FS_POSTER_W,
    height: FS_POSTER_H,
    borderRadius: 6,
    overflow: "hidden",
    position: "relative",
  },
  stripPosterImg: {
    width: FS_POSTER_W,
    height: FS_POSTER_H,
  },
  stripPosterGrad: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 65,
  },
  stripRatingBadge: {
    position: "absolute",
    bottom: 22,
    left: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  stripRatingText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
  },
  stripPosterName: {
    position: "absolute",
    bottom: 5,
    left: 5,
    right: 5,
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
    lineHeight: 12,
  },
});

// ─── Main MoviesView ──────────────────────────────────────────────────────────

export function MoviesView({ onPlayVOD }: MoviesViewProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { activePlaylist, favorites, toggleFavorite, watchHistory, addToWatchHistory } = useIPTV();

  const movies = activePlaylist?.movies ?? [];

  const categories = useMemo(() => {
    const cats = Array.from(new Set(movies.map((m) => m.category))).sort();
    return [...SPECIAL_CATS, ...cats];
  }, [movies]);

  const [selectedCat, setSelectedCat] = useState<string>("All movies");
  const [selectedMovie, setSelectedMovie] = useState<VODItem | null>(movies[0] ?? null);
  const [query, setQuery] = useState("");
  const [fullScreenMode, setFullScreenMode] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return movies.filter((m) => m.name.toLowerCase().includes(q));
  }, [query, movies]);

  const { width: screenWidth } = useWindowDimensions();
  const isNarrow = screenWidth < 700;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const filteredMovies = useMemo(() => {
    if (selectedCat === "All movies") return movies;
    if (selectedCat === "My list") return movies.filter((m) => favorites.includes(m.id));
    if (selectedCat === "History") {
      const historyIds = new Set(watchHistory.map((h) => h.channelId));
      return movies.filter((m) => historyIds.has(m.id));
    }
    return movies.filter((m) => m.category === selectedCat);
  }, [selectedCat, movies, favorites, watchHistory]);

  const catGroups = useMemo(() => {
    if (selectedCat !== "All movies") return null;
    const map: Record<string, VODItem[]> = {};
    for (const m of movies) {
      if (!map[m.category]) map[m.category] = [];
      map[m.category].push(m);
    }
    return map;
  }, [selectedCat, movies]);

  const groupedCats = catGroups ? Object.keys(catGroups).sort() : null;

  if (movies.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.background }]}>
        <Feather name="film" size={52} color={colors.mutedForeground} style={{ marginBottom: 14 }} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No movies available</Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          Movies from your playlist will appear here
        </Text>
      </View>
    );
  }

  if (fullScreenMode && !SPECIAL_CATS.includes(selectedCat)) {
    const selIdx = selectedMovie
      ? filteredMovies.findIndex((mv) => mv.id === selectedMovie.id)
      : 0;
    return (
      <CategoryFullScreenView
        category={selectedCat}
        movies={filteredMovies}
        selectedMovie={selectedMovie ?? filteredMovies[0] ?? null}
        selectedIdx={Math.max(0, selIdx)}
        onSelectMovie={setSelectedMovie}
        onBack={() => setFullScreenMode(false)}
        onPlay={(movie) => {
          addToWatchHistory({
            channelId: movie.id,
            channelName: movie.name,
            channelGroup: movie.category,
            channelLogo: movie.logo,
            channelUrl: movie.url,
            type: "movie",
          });
          onPlayVOD(movie.url, movie.name);
        }}
        onToggleFav={toggleFavorite}
        isFav={(id) => favorites.includes(id)}
        colors={colors}
        topPad={topPad}
        bottomPad={bottomPad}
      />
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Left category sidebar — hidden on narrow screens */}
      {!isNarrow && (
        <View
          style={[
            styles.catSidebar,
            { backgroundColor: colors.sidebar, borderRightColor: colors.border, paddingTop: topPad + 8 },
          ]}
        >
          <Text style={[styles.catHeader, { color: colors.mutedForeground }]}>MOVIES</Text>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: bottomPad + 16 }}
          >
            {categories.map((cat) => {
              const active = cat === selectedCat;
              const isSpecial = SPECIAL_CATS.includes(cat);
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedCat(cat);
                    if (!SPECIAL_CATS.includes(cat)) {
                      const catMovies = movies.filter((mv) => mv.category === cat);
                      setSelectedMovie(catMovies[0] ?? null);
                      setFullScreenMode(true);
                    } else {
                      setSelectedMovie(null);
                      setFullScreenMode(false);
                    }
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
                  {active && (
                    <View style={[styles.catActiveBar, { backgroundColor: colors.primary }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Right content */}
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
                    if (!SPECIAL_CATS.includes(cat)) {
                      const catMovies = movies.filter((mv) => mv.category === cat);
                      setSelectedMovie(catMovies[0] ?? null);
                      setFullScreenMode(true);
                    } else {
                      setSelectedMovie(null);
                      setFullScreenMode(false);
                    }
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
        {/* Rich detail pane for selected movie */}
        {selectedMovie && (
          <MovieDetailPane
            item={selectedMovie}
            isFav={favorites.includes(selectedMovie.id)}
            onPlay={() => {
              addToWatchHistory({
                channelId: selectedMovie.id,
                channelName: selectedMovie.name,
                channelGroup: selectedMovie.category,
                channelLogo: selectedMovie.logo,
                channelUrl: selectedMovie.url,
                type: "movie",
              });
              onPlayVOD(selectedMovie.url, selectedMovie.name);
            }}
            onToggleFav={() => toggleFavorite(selectedMovie.id)}
          />
        )}

        {/* Search bar */}
        <View style={[styles.searchBar, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="search" size={14} color={colors.mutedForeground} />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search movies…"
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

        {/* Movie grid */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomPad + 16, paddingTop: 8 }}
        >
          {searchResults !== null ? (
            /* ── Search results ── */
            <View style={styles.flatGrid}>
              {searchResults.length === 0 ? (
                <View style={styles.emptyFilter}>
                  <Feather name="search" size={36} color={colors.mutedForeground} style={{ marginBottom: 10 }} />
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No results</Text>
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    No movies match "{query}"
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.searchCount, { color: colors.mutedForeground }]}>
                    {searchResults.length} {searchResults.length === 1 ? "result" : "results"}
                  </Text>
                  <View style={styles.posterGrid}>
                    {searchResults.map((item) => (
                      <PosterCard
                        key={item.id}
                        item={item}
                        selected={selectedMovie?.id === item.id}
                        onPress={() => { Haptics.selectionAsync(); setSelectedMovie(item); }}
                      />
                    ))}
                  </View>
                </>
              )}
            </View>
          ) : groupedCats ? (
            /* ── Grouped "All movies" view ── */
            groupedCats.map((cat) => (
              <View key={cat} style={styles.catGroup}>
                <View style={styles.catGroupHeader}>
                  <Text style={[styles.catGroupLabel, { color: colors.foreground }]}>{cat}</Text>
                  <Text style={[styles.catGroupCount, { color: colors.mutedForeground }]}>
                    {catGroups![cat].length}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedCat(cat);
                      setSelectedMovie(catGroups![cat][0] ?? null);
                      setFullScreenMode(true);
                    }}
                    style={styles.seeAll}
                  >
                    <Text style={[styles.seeAllText, { color: colors.primary }]}>See all</Text>
                    <Feather name="chevron-right" size={13} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
                >
                  {catGroups![cat].slice(0, 20).map((item) => (
                    <PosterCard
                      key={item.id}
                      item={item}
                      selected={selectedMovie?.id === item.id}
                      onPress={() => { Haptics.selectionAsync(); setSelectedMovie(item); }}
                    />
                  ))}
                </ScrollView>
              </View>
            ))
          ) : (
            /* ── Category filtered view ── */
            <View style={styles.flatGrid}>
              {filteredMovies.length === 0 ? (
                <View style={styles.emptyFilter}>
                  <Feather name="film" size={36} color={colors.mutedForeground} style={{ marginBottom: 10 }} />
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No movies here</Text>
                </View>
              ) : (
                <View style={styles.posterGrid}>
                  {filteredMovies.map((item) => (
                    <PosterCard
                      key={item.id}
                      item={item}
                      selected={selectedMovie?.id === item.id}
                      onPress={() => { Haptics.selectionAsync(); setSelectedMovie(item); }}
                    />
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

// ─── Dimensions ───────────────────────────────────────────────────────────────

const POSTER_W = 110;
const POSTER_H = 160;
const BANNER_POSTER_W = 76;
const BANNER_POSTER_H = 108;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: "row",
  },

  // ── Category sidebar ──────────────────────────────────────────────────────
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

  // ── Right content ─────────────────────────────────────────────────────────
  content: {
    flex: 1,
  },

  // ── Rich detail pane ──────────────────────────────────────────────────────
  detailRoot: {
    maxHeight: 340,
    overflow: "hidden",
  },
  detailBanner: {
    height: 200,
    position: "relative",
    overflow: "hidden",
  },
  bannerLayout: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 12,
  },
  posterWrap: {
    width: BANNER_POSTER_W,
    height: BANNER_POSTER_H,
    borderRadius: 6,
    overflow: "hidden",
    flexShrink: 0,
  },
  poster: {
    width: BANNER_POSTER_W,
    height: BANNER_POSTER_H,
  },
  posterPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  bannerInfo: {
    flex: 1,
    paddingBottom: 2,
  },
  bannerTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    marginBottom: 5,
    lineHeight: 22,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginBottom: 5,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  genresText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginBottom: 8,
  },
  bannerActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
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

  // ── Metadata rows ─────────────────────────────────────────────────────────
  metaScroll: {
    maxHeight: 140,
  },
  metaBlock: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
  },
  metaLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  metaRowLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    width: 56,
    flexShrink: 0,
    paddingTop: 1,
  },
  metaRowValue: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 17,
  },

  // ── Search bar ────────────────────────────────────────────────────────────
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
  searchCount: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 12,
    paddingBottom: 6,
  },

  // ── Poster grid ────────────────────────────────────────────────────────────
  catGroup: {
    marginBottom: 20,
  },
  catGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 6,
  },
  catGroupLabel: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    flex: 1,
  },
  catGroupCount: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  seeAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  seeAllText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  flatGrid: {
    flex: 1,
  },
  posterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 8,
    gap: 8,
  },
  posterCard: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: 6,
    overflow: "hidden",
    position: "relative",
  },
  posterImg: {
    width: POSTER_W,
    height: POSTER_H,
  },
  posterPlaceholderCard: {
    width: POSTER_W,
    height: POSTER_H,
    justifyContent: "center",
    alignItems: "center",
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  posterGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 70,
  },
  posterTitle: {
    position: "absolute",
    bottom: 6,
    left: 6,
    right: 6,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
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

  // ── Empty states ──────────────────────────────────────────────────────────
  emptyFilter: {
    paddingVertical: 60,
    alignItems: "center",
  },
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
