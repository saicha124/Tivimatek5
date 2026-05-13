import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";

import type { WatchHistoryItem } from "@/context/IPTVContext";
import type { useColors } from "@/hooks/useColors";

interface EpgProg {
  title: string;
  startTime: number;
  endTime: number;
}

interface Props {
  channelName: string;
  channelLogo?: string;
  channelNumber: number;
  currentProgram?: EpgProg;
  nextProgram?: EpgProg;
  epgProgress: number;
  watchHistory: WatchHistoryItem[];
  currentChannelId?: string;
  colors: ReturnType<typeof useColors>;
  bottomPad: number;
  isCatchUp: boolean;
  sleepSecondsLeft: number | null;
  onGuide: () => void;
  onSwitchChannel: (h: WatchHistoryItem) => void;
  onClearHistory: () => void;
  onDeleteHistoryItem?: (channelId: string) => void;
  onMore: () => void;
  onSleepTimer: () => void;
}

function fmtHM(ms: number) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function PlayerInfoBar({
  channelName,
  channelLogo,
  channelNumber,
  currentProgram,
  nextProgram,
  epgProgress,
  watchHistory,
  currentChannelId,
  colors,
  bottomPad,
  isCatchUp,
  sleepSecondsLeft,
  onGuide,
  onSwitchChannel,
  onClearHistory,
  onDeleteHistoryItem,
  onMore,
  onSleepTimer,
}: Props) {
  const [longPressedId, setLongPressedId] = useState<string | null>(null);

  const progDurationMin = currentProgram
    ? Math.round((currentProgram.endTime - currentProgram.startTime) / 60000)
    : null;

  const channelHistory = watchHistory
    .filter((h) => (h.type === "channel" || !h.type) && h.channelUrl)
    .slice(0, 10);

  return (
    <Animated.View
      entering={SlideInDown.duration(280).damping(18)}
      exiting={SlideOutDown.duration(200)}
      style={[styles.container, { paddingBottom: Math.max(bottomPad, 10) }]}
    >
      {/* ── INFO SECTION ────────────────────────────────────────── */}
      <View style={styles.infoSection}>
        {/* Channel logo */}
        <View style={styles.logoWrap}>
          {channelLogo ? (
            <Image source={{ uri: channelLogo }} style={styles.logo} contentFit="contain" />
          ) : (
            <View style={[styles.logo, styles.logoPlaceholder]}>
              <Feather name="tv" size={26} color="rgba(255,255,255,0.3)" />
            </View>
          )}
        </View>

        {/* Program details */}
        <View style={styles.programInfo}>
          {/* Channel name + badges row */}
          <View style={styles.nameBadgeRow}>
            <Text style={styles.channelName} numberOfLines={1}>
              {channelName}
            </Text>
            {!isCatchUp && (
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
            {isCatchUp && (
              <View style={[styles.livePill, { backgroundColor: "rgba(33,150,243,0.3)" }]}>
                <Feather name="rotate-ccw" size={9} color="#2196f3" />
                <Text style={[styles.liveText, { color: "#2196f3" }]}>CATCH-UP</Text>
              </View>
            )}
            {sleepSecondsLeft !== null && (
              <TouchableOpacity onPress={onSleepTimer} style={styles.sleepPill}>
                <Feather name="moon" size={9} color="#CE93D8" />
                <Text style={styles.sleepText}>
                  {sleepSecondsLeft >= 60
                    ? `${Math.floor(sleepSecondsLeft / 60)}m`
                    : `${sleepSecondsLeft}s`}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Time / quality row */}
          <View style={styles.timeRow}>
            {currentProgram ? (
              <>
                <Text style={styles.timeText}>
                  {fmtHM(currentProgram.startTime)} — {fmtHM(currentProgram.endTime)}
                </Text>
                <View style={styles.timeDash} />
                {progDurationMin !== null && (
                  <Text style={styles.durationText}>{progDurationMin} min</Text>
                )}
                {channelNumber > 0 && (
                  <Text style={styles.chNumText}>
                    {"  "}{channelNumber}{" "}
                    <Text style={styles.chSep}>|</Text>
                    {"  "}<Text style={styles.chNameSmall}>{channelName}</Text>
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.timeText}>Live TV</Text>
            )}
            <View style={styles.qualityBadges}>
              <View style={[styles.qBadge, { backgroundColor: `${colors.primary}40` }]}>
                <Text style={[styles.qText, { color: colors.primary }]}>HD</Text>
              </View>
              <View style={[styles.qBadge, { backgroundColor: "rgba(255,255,255,0.14)" }]}>
                <Text style={styles.qTextMuted}>25 FPS</Text>
              </View>
              <View style={[styles.qBadge, { backgroundColor: "rgba(255,255,255,0.14)" }]}>
                <Text style={styles.qTextMuted}>STEREO</Text>
              </View>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(1, epgProgress) * 100}%` as any,
                  backgroundColor: colors.primary,
                },
              ]}
            />
          </View>

          {/* Next program */}
          {nextProgram ? (
            <Text style={styles.nextProg} numberOfLines={1}>
              {fmtHM(nextProgram.startTime)} — {fmtHM(nextProgram.endTime)}
              {"   "}
              {nextProgram.title}
            </Text>
          ) : (
            <Text style={styles.nextProg} numberOfLines={1}>No upcoming program info</Text>
          )}
        </View>

        {/* More / settings button */}
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            onMore();
          }}
          style={styles.moreBtn}
        >
          <Feather name="more-vertical" size={20} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
      </View>

      {/* ── PRIMARY COLOR RULE ──────────────────────────────────── */}
      <View style={[styles.rule, { backgroundColor: colors.primary }]} />

      {/* ── ACTION STRIP ────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.actionStrip}
      >
        {/* TV Guide */}
        <TouchableOpacity
          style={styles.actionTile}
          onPress={() => {
            Haptics.selectionAsync();
            onGuide();
          }}
        >
          <View style={[styles.tileIcon, { backgroundColor: `${colors.primary}28` }]}>
            <Feather name="grid" size={24} color={colors.primary} />
          </View>
          <Text style={styles.tileLabel}>TV Guide</Text>
        </TouchableOpacity>

        <View style={styles.stripSep} />

        {/* Recent channel cards from watch history */}
        {channelHistory.map((h) => {
          const isCurrent = h.channelId === currentChannelId;
          const isLongPressed = h.channelId === longPressedId;
          return (
            <TouchableOpacity
              key={`${h.channelId}-${h.watchedAt}`}
              style={styles.actionTile}
              onPress={() => {
                if (isLongPressed) {
                  setLongPressedId(null);
                  return;
                }
                if (!isCurrent) {
                  Haptics.selectionAsync();
                  onSwitchChannel(h);
                }
              }}
              onLongPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setLongPressedId(isLongPressed ? null : h.channelId);
              }}
              delayLongPress={400}
            >
              <View
                style={[
                  styles.tileIcon,
                  { backgroundColor: "rgba(255,255,255,0.07)" },
                  isCurrent && { borderColor: colors.primary, borderWidth: 2 },
                  isLongPressed && { backgroundColor: "rgba(244,67,54,0.18)", borderColor: "#f44336", borderWidth: 1.5 },
                ]}
              >
                {isLongPressed ? (
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                      setLongPressedId(null);
                      onDeleteHistoryItem?.(h.channelId);
                    }}
                    style={styles.deleteOverlay}
                  >
                    <Feather name="trash-2" size={20} color="#f44336" />
                    <Text style={styles.deleteLabel}>Supprimer</Text>
                  </TouchableOpacity>
                ) : h.channelLogo ? (
                  <Image
                    source={{ uri: h.channelLogo }}
                    style={styles.tileLogo}
                    contentFit="contain"
                  />
                ) : (
                  <Feather name="tv" size={20} color="rgba(255,255,255,0.35)" />
                )}
              </View>
              {!isLongPressed && (
                <Text style={styles.tileLabel} numberOfLines={2}>
                  {h.channelName}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}

        {/* Clear history */}
        {channelHistory.length > 0 && (
          <>
            <View style={styles.stripSep} />
            <TouchableOpacity
              style={styles.actionTile}
              onPress={() => {
                Haptics.selectionAsync();
                setLongPressedId(null);
                onClearHistory();
              }}
            >
              <View style={[styles.tileIcon, { backgroundColor: "rgba(244,67,54,0.14)" }]}>
                <Feather name="trash-2" size={22} color="#f44336" />
              </View>
              <Text style={[styles.tileLabel, { color: "#f44336" }]}>Clear</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(0,0,0,0.92)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
  },

  /* INFO SECTION */
  infoSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 14,
  },
  logoWrap: {
    paddingTop: 2,
  },
  logo: {
    width: 80,
    height: 56,
    borderRadius: 8,
  },
  logoPlaceholder: {
    backgroundColor: "rgba(255,255,255,0.07)",
    justifyContent: "center",
    alignItems: "center",
  },
  programInfo: {
    flex: 1,
    gap: 5,
  },
  nameBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  channelName: {
    color: "#fff",
    fontSize: 19,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(244,67,54,0.28)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#f44336",
  },
  liveText: {
    color: "#f44336",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  sleepPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(156,39,176,0.28)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  sleepText: {
    color: "#CE93D8",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  timeText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  timeDash: {
    width: 18,
    height: 1.5,
    backgroundColor: "rgba(255,255,255,0.35)",
    borderRadius: 1,
  },
  durationText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  chNumText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  chSep: {
    color: "rgba(255,255,255,0.25)",
  },
  chNameSmall: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  qualityBadges: {
    flexDirection: "row",
    gap: 4,
    marginLeft: "auto",
  },
  qBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  qText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  qTextMuted: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  progressTrack: {
    height: 2.5,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    overflow: "hidden",
    marginVertical: 2,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  nextProg: {
    color: "rgba(255,255,255,0.42)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  moreBtn: {
    paddingTop: 4,
    paddingLeft: 4,
    width: 32,
    height: 40,
    justifyContent: "flex-start",
    alignItems: "center",
  },

  /* SEPARATOR */
  rule: {
    height: 2,
    marginHorizontal: 0,
  },

  /* ACTION STRIP */
  actionStrip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    alignItems: "flex-start",
  },
  stripSep: {
    width: 1,
    height: 64,
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  actionTile: {
    alignItems: "center",
    gap: 5,
    width: 72,
  },
  tileIcon: {
    width: 72,
    height: 52,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  tileLogo: {
    width: 68,
    height: 48,
    borderRadius: 6,
  },
  tileLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  deleteOverlay: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    gap: 3,
  },
  deleteLabel: {
    color: "#f44336",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
});
