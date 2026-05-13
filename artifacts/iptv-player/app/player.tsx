import { Feather } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useIPTV } from "@/context/IPTVContext";
import { usePiP } from "@/context/PiPContext";
import { formatBytes, formatElapsed } from "@/hooks/useDeviceRecording";
import { useDeviceRecordingCtx } from "@/context/DeviceRecordingContext";
import { MultiviewScreen } from "@/components/MultiviewScreen";
import { EpgOverlay } from "@/components/EpgOverlay";
import { PlayerInfoBar } from "@/components/PlayerInfoBar";

function fmtHHMM(ms: number) {
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatTime(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function Scrubber({
  position,
  duration,
  onSeek,
  colors,
}: {
  position: number;
  duration: number;
  onSeek: (pct: number) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;

  return (
    <View style={scrubStyles.container}>
      <Text style={[scrubStyles.time, { color: "rgba(255,255,255,0.8)" }]}>
        {formatTime(position)}
      </Text>
      <View style={[scrubStyles.track, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
        <View
          style={[
            scrubStyles.fill,
            { width: `${progress * 100}%` as any, backgroundColor: colors.primary },
          ]}
        />
        <View
          style={[
            scrubStyles.thumb,
            { left: `${progress * 100}%` as any, backgroundColor: colors.primary },
          ]}
        />
      </View>
      <Text style={[scrubStyles.time, { color: "rgba(255,255,255,0.8)" }]}>
        {duration > 0 ? formatTime(duration) : "–:––"}
      </Text>
    </View>
  );
}

const scrubStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  track: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: "visible",
    position: "relative",
  },
  fill: {
    height: 4,
    borderRadius: 2,
  },
  thumb: {
    position: "absolute",
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
  },
  time: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    minWidth: 40,
    textAlign: "center",
  },
});

const SLEEP_OPTIONS = [
  { label: "Off", minutes: 0 },
  { label: "15 minutes", minutes: 15 },
  { label: "30 minutes", minutes: 30 },
  { label: "60 minutes", minutes: 60 },
  { label: "90 minutes", minutes: 90 },
  { label: "2 hours", minutes: 120 },
];

function SleepTimerModal({
  visible,
  activeMinutes,
  onSelect,
  onClose,
  colors,
}: {
  visible: boolean;
  activeMinutes: number;
  onSelect: (minutes: number) => void;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={stStyles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[stStyles.sheet, { backgroundColor: "#1e1e1e" }]}>
              <View style={stStyles.header}>
                <Feather name="moon" size={18} color={colors.primary} />
                <Text style={[stStyles.title, { color: colors.primary }]}>Sleep Timer</Text>
              </View>
              {SLEEP_OPTIONS.map((opt) => {
                const isActive = opt.minutes === activeMinutes;
                return (
                  <TouchableOpacity
                    key={opt.label}
                    style={[
                      stStyles.row,
                      { borderBottomColor: "rgba(255,255,255,0.08)" },
                      isActive && { backgroundColor: "rgba(33,150,243,0.12)" },
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      onSelect(opt.minutes);
                    }}
                  >
                    <Text style={[stStyles.optLabel, { color: isActive ? colors.primary : "#fff" }]}>
                      {opt.label}
                    </Text>
                    {isActive && <Feather name="check" size={18} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const stStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 14,
    paddingBottom: 36,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 4,
    borderRadius: 6,
  },
  optLabel: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
});

interface ToolbarItem {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  active?: boolean;
  activeColor?: string;
}

function PlayerToolbar({
  channelId,
  onClose,
  onMultiview,
  onPiP,
  onSleepTimer,
  onEpg,
  onRecording,
  isRecording,
  sleepActive,
  colors,
  bottomPad,
}: {
  channelId?: string;
  onClose: () => void;
  onMultiview: () => void;
  onPiP: () => void;
  onSleepTimer: () => void;
  onEpg: () => void;
  onRecording: () => void;
  isRecording: boolean;
  sleepActive: boolean;
  colors: ReturnType<typeof useColors>;
  bottomPad: number;
}) {
  const { favorites, toggleFavorite } = useIPTV();
  const [showChannelOptions, setShowChannelOptions] = useState(false);
  const isFav = channelId ? favorites.includes(channelId) : false;

  const row1: ToolbarItem[] = [
    { icon: "search", label: "Search" },
    { icon: "list", label: "Channels list" },
    { icon: "calendar", label: "TV guide", onPress: onEpg },
    {
      icon: "circle",
      label: isRecording ? "Stop REC" : "Record",
      onPress: onRecording,
      active: isRecording,
      activeColor: "#e53935",
    },
    { icon: "layout", label: "Multiview", onPress: onMultiview },
    { icon: "maximize", label: "Picture-in-picture", onPress: onPiP },
    {
      icon: "moon",
      label: "Sleep timer",
      onPress: onSleepTimer,
      active: sleepActive,
      activeColor: "#9C27B0",
    },
    { icon: "monitor", label: "1280 × 720" },
  ];

  const row2: ToolbarItem[] = [
    {
      icon: "volume-2",
      label: "Audio track",
      onPress: () => setShowChannelOptions(true),
    },
    { icon: "clock", label: "0 ms" },
    { icon: "align-left", label: "Off" },
    { icon: "crop", label: "Normal" },
    { icon: "wifi-off", label: "Off" },
    {
      icon: isFav ? "star" : "star",
      label: isFav ? "Remove from\nFavorites" : "Add to\nFavorites",
      onPress: () => channelId && toggleFavorite(channelId),
      active: isFav,
      activeColor: "#FFC107",
    },
    { icon: "settings", label: "Channel options", onPress: () => setShowChannelOptions(true) },
    { icon: "sliders", label: "Settings" },
  ];

  return (
    <>
      <View style={[tbStyles.container, { paddingBottom: bottomPad, backgroundColor: "rgba(0,0,0,0.85)" }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tbStyles.row}>
          {row1.map((item) => (
            <TouchableOpacity
              key={item.label}
              onPress={item.onPress}
              style={tbStyles.item}
              activeOpacity={0.7}
            >
              <Feather name={item.icon} size={20} color={item.active ? (item.activeColor ?? colors.primary) : "rgba(255,255,255,0.85)"} />
              <Text style={[tbStyles.label, { color: "rgba(255,255,255,0.6)" }]} numberOfLines={2}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={[tbStyles.divider, { backgroundColor: "rgba(255,255,255,0.1)" }]} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tbStyles.row}>
          {row2.map((item) => (
            <TouchableOpacity
              key={item.label}
              onPress={item.onPress}
              style={tbStyles.item}
              activeOpacity={0.7}
            >
              <View style={[
                tbStyles.iconWrap,
                item.active && { backgroundColor: item.activeColor ?? colors.primary, borderRadius: 20 },
              ]}>
                <Feather
                  name={item.icon}
                  size={20}
                  color={item.active ? "#fff" : "rgba(255,255,255,0.85)"}
                />
              </View>
              <Text style={[tbStyles.label, { color: "rgba(255,255,255,0.6)" }]} numberOfLines={2}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <Modal visible={showChannelOptions} transparent animationType="fade" onRequestClose={() => setShowChannelOptions(false)}>
        <TouchableWithoutFeedback onPress={() => setShowChannelOptions(false)}>
          <View style={tbStyles.optOverlay}>
            <TouchableWithoutFeedback>
              <View style={[tbStyles.optSheet, { backgroundColor: "#1e1e1e" }]}>
                <Text style={[tbStyles.optTitle, { color: colors.primary }]}>Channel Options</Text>
                {["Audio track", "Subtitle track", "Video track", "Aspect ratio", "Deinterlace"].map((opt) => (
                  <TouchableOpacity key={opt} style={tbStyles.optRow} onPress={() => setShowChannelOptions(false)}>
                    <Text style={[tbStyles.optLabel, { color: "#fff" }]}>{opt}</Text>
                    <Feather name="chevron-right" size={16} color="#808080" />
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const tbStyles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  row: {
    flexDirection: "row",
    paddingHorizontal: 4,
    paddingVertical: 6,
    gap: 0,
  },
  item: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
    minWidth: 72,
  },
  iconWrap: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 13,
  },
  divider: {
    height: 1,
    marginHorizontal: 8,
  },
  optOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  optSheet: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingTop: 14,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  optTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    marginBottom: 10,
  },
  optRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  optLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});

export default function PlayerScreen() {
  const { url, name, catchUpStart, catchUpEnd, channelId, nextUrl, nextName } = useLocalSearchParams<{
    url: string;
    name: string;
    catchUpStart?: string;
    catchUpEnd?: string;
    channelId?: string;
    nextUrl?: string;
    nextName?: string;
  }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const videoRef = useRef<Video>(null);

  const isCatchUp = !!catchUpStart;
  const catchUpStartMs = catchUpStart ? parseInt(catchUpStart, 10) : undefined;
  const catchUpEndMs = catchUpEnd ? parseInt(catchUpEnd, 10) : undefined;

  const streamUrl = isCatchUp && catchUpStartMs
    ? (() => {
        const startSec = Math.floor(catchUpStartMs / 1000);
        const endSec = catchUpEndMs ? Math.floor(catchUpEndMs / 1000) : startSec + 3600;
        const durationSec = endSec - startSec;
        const separator = url?.includes("?") ? "&" : "?";
        return `${url}${separator}utc=${startSec}&lutc=${endSec}&duration=${durationSec}`;
      })()
    : url;

  const { startPiP } = usePiP();
  const { activePlaylist, watchHistory, stalkerEpgData, resolveStalkerStreamUrl, addToWatchHistory, clearWatchHistory, removeFromWatchHistory, recordingSettings } = useIPTV();

  const deviceRecording = useDeviceRecordingCtx();

  const channelEpg = useMemo(() => {
    if (!channelId || !activePlaylist) return undefined;
    return activePlaylist.channels.find((c) => c.id === channelId)?.epg;
  }, [channelId, activePlaylist]);

  const [epgNow, setEpgNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setEpgNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  const epgPrograms = useMemo(() => {
    if (!channelId) return undefined;
    if (channelEpg && channelEpg.length > 0) return channelEpg;
    if (stalkerEpgData[channelId]) return stalkerEpgData[channelId];
    return undefined;
  }, [channelId, channelEpg, stalkerEpgData]);

  const currentEpgProg = useMemo(() => {
    if (!epgPrograms) return undefined;
    return epgPrograms.find((p) => p.startTime <= epgNow && p.endTime > epgNow);
  }, [epgPrograms, epgNow]);

  const nextEpgProg = useMemo(() => {
    if (!epgPrograms || !currentEpgProg) return undefined;
    const idx = epgPrograms.indexOf(currentEpgProg);
    return idx >= 0 ? epgPrograms[idx + 1] : undefined;
  }, [epgPrograms, currentEpgProg]);

  const epgProgress = useMemo(() => {
    if (!currentEpgProg) return 0;
    const total = currentEpgProg.endTime - currentEpgProg.startTime;
    return total > 0 ? Math.min(1, (epgNow - currentEpgProg.startTime) / total) : 0;
  }, [currentEpgProg, epgNow]);

  const [status, setStatus] = useState<any>({});
  const [showControls, setShowControls] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [showBufferingOverlay, setShowBufferingOverlay] = useState(true);
  const hasEverPlayed = useRef(false);
  const bufferingDelayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showMultiview, setShowMultiview] = useState(false);
  const [showEpg, setShowEpg] = useState(false);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sleepTimerEnd, setSleepTimerEnd] = useState<number | null>(null);
  const [sleepSecondsLeft, setSleepSecondsLeft] = useState<number | null>(null);
  const [sleepActiveMinutes, setSleepActiveMinutes] = useState(0);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [showNextEpOverlay, setShowNextEpOverlay] = useState(false);
  const [nextEpCountdown, setNextEpCountdown] = useState(10);
  const nextEpTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!showNextEpOverlay || !nextUrl) {
      if (nextEpTimerRef.current) { clearInterval(nextEpTimerRef.current); nextEpTimerRef.current = null; }
      return;
    }
    setNextEpCountdown(10);
    nextEpTimerRef.current = setInterval(() => {
      setNextEpCountdown((c) => {
        if (c <= 1) {
          clearInterval(nextEpTimerRef.current!);
          nextEpTimerRef.current = null;
          setShowNextEpOverlay(false);
          router.replace({ pathname: "/player", params: { url: nextUrl, name: nextName ?? "", channelId } });
          return 10;
        }
        return c - 1;
      });
    }, 1000);
    return () => {
      if (nextEpTimerRef.current) { clearInterval(nextEpTimerRef.current); nextEpTimerRef.current = null; }
    };
  }, [showNextEpOverlay, nextUrl]);

  useEffect(() => {
    if (sleepTimerEnd === null) {
      setSleepSecondsLeft(null);
      return;
    }
    const tick = () => {
      const remaining = Math.ceil((sleepTimerEnd - Date.now()) / 1000);
      if (remaining <= 0) {
        setSleepTimerEnd(null);
        setSleepSecondsLeft(null);
        setSleepActiveMinutes(0);
        videoRef.current?.pauseAsync();
        router.back();
      } else {
        setSleepSecondsLeft(remaining);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sleepTimerEnd]);

  const position: number = status?.positionMillis ?? 0;
  const duration: number = status?.durationMillis ?? 0;
  const isPlaying: boolean = status?.isPlaying ?? false;

  const hideControls = useCallback(() => {
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => {
      setShowControls(false);
      setShowToolbar(false);
    }, 2000);
  }, []);

  const handleTap = useCallback(() => {
    setShowControls(true);
    setShowToolbar(false);
    hideControls();
  }, [hideControls]);

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowControls(true);
    setShowToolbar(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => {
      setShowControls(false);
      setShowToolbar(false);
    }, 2000);
  }, []);

  const togglePlay = useCallback(async () => {
    Haptics.selectionAsync();
    if (!videoRef.current) return;
    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
  }, [isPlaying]);

  const seekBackward = useCallback(async () => {
    if (!videoRef.current || !isCatchUp) return;
    Haptics.selectionAsync();
    const newPos = Math.max(0, position - 30000);
    await videoRef.current.setPositionAsync(newPos);
  }, [position, isCatchUp]);

  const seekForward = useCallback(async () => {
    if (!videoRef.current || !isCatchUp) return;
    Haptics.selectionAsync();
    const newPos = Math.min(duration || position + 30000, position + 30000);
    await videoRef.current.setPositionAsync(newPos);
  }, [position, duration, isCatchUp]);

  // ── TV Remote / Channel Navigation ──────────────────────────────────────────

  const [channelOsd, setChannelOsd] = useState<{ idx: number; name: string; logo?: string } | null>(null);
  const channelOsdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const channelList = useMemo(() => activePlaylist?.channels ?? [], [activePlaylist]);
  const currentChannelIdx = useMemo(
    () => (channelId ? channelList.findIndex((c) => c.id === channelId) : -1),
    [channelList, channelId]
  );
  const currentChannel = useMemo(
    () => (channelId ? channelList.find((c) => c.id === channelId) : undefined),
    [channelList, channelId]
  );

  const showOsd = useCallback((idx: number, name: string, logo?: string) => {
    if (channelOsdTimer.current) clearTimeout(channelOsdTimer.current);
    setChannelOsd({ idx, name, logo });
    channelOsdTimer.current = setTimeout(() => setChannelOsd(null), 3000);
  }, []);

  const switchChannel = useCallback(
    async (ch: { id: string; name: string; logo?: string; url: string; group: string }, idx: number) => {
      showOsd(idx, ch.name, ch.logo);
      let playUrl = ch.url;
      if (activePlaylist?.type === "StalkerPortal" && ch.url.startsWith("stalker-")) {
        try {
          playUrl = await resolveStalkerStreamUrl(activePlaylist, ch.url);
        } catch {
          return;
        }
      }
      addToWatchHistory({
        channelId: ch.id,
        channelName: ch.name,
        channelGroup: ch.group,
        channelLogo: ch.logo,
        channelUrl: playUrl,
      });
      router.replace({ pathname: "/player", params: { url: playUrl, name: ch.name, channelId: ch.id } });
    },
    [activePlaylist, resolveStalkerStreamUrl, addToWatchHistory, showOsd, router]
  );

  const navigateChannel = useCallback(
    (dir: "prev" | "next") => {
      if (currentChannelIdx < 0 || channelList.length === 0) return;
      const nextIdx =
        dir === "prev"
          ? (currentChannelIdx - 1 + channelList.length) % channelList.length
          : (currentChannelIdx + 1) % channelList.length;
      switchChannel(channelList[nextIdx], nextIdx);
    },
    [currentChannelIdx, channelList, switchChannel]
  );

  // Web keyboard handler — works in browser on Mi Box / Android TV
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onKey = (e: KeyboardEvent) => {
      switch (e.code) {
        case "Space":
        case "MediaPlayPause":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowUp":
          e.preventDefault();
          if (!isCatchUp) navigateChannel("prev");
          break;
        case "ArrowDown":
          e.preventDefault();
          if (!isCatchUp) navigateChannel("next");
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (isCatchUp) seekBackward();
          else {
            setShowControls(true);
            hideControls();
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (isCatchUp) seekForward();
          else {
            setShowControls(true);
            hideControls();
          }
          break;
        case "Escape":
        case "BrowserBack":
          router.back();
          break;
        case "Enter":
        case "NumpadEnter":
          setShowControls((v) => !v);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, navigateChannel, seekBackward, seekForward, isCatchUp, router, hideControls]);

  // Android hardware back button (Mi Box remote Back key)
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      router.back();
      return true;
    });
    return () => sub.remove();
  }, [router]);

  // Native TV remote events — Android TV (Mi Box) + Apple TV
  useEffect(() => {
    if (Platform.OS === "web") return;
    let tvHandler: any = null;
    try {
      const RN = require("react-native");
      if (RN.TVEventHandler) {
        tvHandler = new RN.TVEventHandler();
        tvHandler.enable(null, (_cmp: any, evt: any) => {
          if (!evt) return;
          switch (evt.eventType) {
            case "playPause":
              togglePlay();
              break;
            case "up":
              if (!isCatchUp) navigateChannel("prev");
              break;
            case "down":
              if (!isCatchUp) navigateChannel("next");
              break;
            case "left":
              if (isCatchUp) seekBackward();
              break;
            case "right":
              if (isCatchUp) seekForward();
              break;
            case "select":
              setShowControls((v) => !v);
              break;
          }
        });
      }
    } catch {
      /* TVEventHandler not available on this platform */
    }
    return () => {
      try {
        tvHandler?.disable();
      } catch {}
    };
  }, [togglePlay, navigateChannel, seekBackward, seekForward, isCatchUp]);

  // ────────────────────────────────────────────────────────────────────────────

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" hidden />

      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        onPress={handleTap}
        onLongPress={handleLongPress}
        delayLongPress={400}
        activeOpacity={1}
      >
        {streamUrl ? (
          <Video
            ref={videoRef}
            source={{ uri: streamUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
            useNativeControls={false}
            progressUpdateIntervalMillis={500}
            onPlaybackStatusUpdate={(s: any) => {
              setStatus(s);
              if (s.didJustFinish && nextUrl && !showNextEpOverlay) {
                setShowNextEpOverlay(true);
              }
              if (s.isPlaying) {
                hasEverPlayed.current = true;
                if (bufferingDelayTimer.current) {
                  clearTimeout(bufferingDelayTimer.current);
                  bufferingDelayTimer.current = null;
                }
                setShowBufferingOverlay(false);
              } else if (s.isBuffering) {
                if (!hasEverPlayed.current) {
                  setShowBufferingOverlay(true);
                } else if (!bufferingDelayTimer.current) {
                  bufferingDelayTimer.current = setTimeout(() => {
                    bufferingDelayTimer.current = null;
                    setShowBufferingOverlay(true);
                  }, 2000);
                }
              } else {
                if (bufferingDelayTimer.current) {
                  clearTimeout(bufferingDelayTimer.current);
                  bufferingDelayTimer.current = null;
                }
                if (!s.isPlaying) setShowBufferingOverlay(false);
              }
            }}
            onLoad={() => {
              if (bufferingDelayTimer.current) {
                clearTimeout(bufferingDelayTimer.current);
                bufferingDelayTimer.current = null;
              }
              setShowBufferingOverlay(false);
              hideControls();
            }}
            onReadyForDisplay={() => {
              if (bufferingDelayTimer.current) {
                clearTimeout(bufferingDelayTimer.current);
                bufferingDelayTimer.current = null;
              }
              setShowBufferingOverlay(false);
            }}
          />
        ) : (
          <View style={styles.noUrl}>
            <Feather name="alert-circle" size={32} color="#666" />
            <Text style={styles.noUrlText}>No stream URL</Text>
          </View>
        )}

        {showBufferingOverlay && (
          <View style={[
            styles.bufferingOverlay,
            { backgroundColor: hasEverPlayed.current ? "rgba(0,0,0,0.55)" : "#000" },
          ]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.bufferingText}>
              {isCatchUp ? "Loading catch-up..." : hasEverPlayed.current ? "Buffering..." : "Loading..."}
            </Text>
          </View>
        )}

        {/* Channel OSD — shown when navigating with remote Up/Down */}
        {channelOsd && (
          <Animated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(500)}
            style={styles.osdContainer}
            pointerEvents="none"
          >
            {channelOsd.logo ? (
              <Image source={{ uri: channelOsd.logo }} style={styles.osdLogo} contentFit="contain" />
            ) : (
              <View style={styles.osdLogoPlaceholder}>
                <Feather name="tv" size={20} color="rgba(255,255,255,0.5)" />
              </View>
            )}
            <View style={styles.osdInfo}>
              <Text style={[styles.osdChNum, { color: colors.primary }]}>
                CH {channelOsd.idx + 1}
              </Text>
              <Text style={styles.osdChName} numberOfLines={1}>
                {channelOsd.name}
              </Text>
            </View>
            <View style={styles.osdArrows}>
              <Feather name="chevron-up" size={14} color="rgba(255,255,255,0.4)" />
              <Feather name="chevron-down" size={14} color="rgba(255,255,255,0.4)" />
            </View>
          </Animated.View>
        )}
      </TouchableOpacity>

      {/* ── Next episode countdown overlay ────────────────────────────── */}
      {showNextEpOverlay && nextUrl && (
        <Animated.View
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(400)}
          style={styles.nextEpOverlay}
        >
          <View style={styles.nextEpCard}>
            <View style={styles.nextEpTop}>
              <Text style={styles.nextEpLabel}>Épisode suivant</Text>
              <TouchableOpacity
                onPress={() => setShowNextEpOverlay(false)}
                style={styles.nextEpDismiss}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="x" size={16} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
            <Text style={styles.nextEpName} numberOfLines={2}>{nextName ?? "Prochain épisode"}</Text>
            <View style={styles.nextEpActions}>
              <TouchableOpacity
                onPress={() => {
                  if (nextEpTimerRef.current) { clearInterval(nextEpTimerRef.current); nextEpTimerRef.current = null; }
                  setShowNextEpOverlay(false);
                  router.replace({ pathname: "/player", params: { url: nextUrl, name: nextName ?? "", channelId } });
                }}
                style={styles.nextEpPlayBtn}
                activeOpacity={0.85}
              >
                <Feather name="play" size={13} color="#000" />
                <Text style={styles.nextEpPlayText}>Lancer ({nextEpCountdown}s)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowNextEpOverlay(false)}
                style={styles.nextEpCancelBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.nextEpCancelText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}

      {showControls && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(300)}
          style={[styles.controls, StyleSheet.absoluteFill]}
          pointerEvents="box-none"
        >
          {/* Top bar */}
          <View style={[styles.topBar, { paddingTop: topPad + 8, backgroundColor: "rgba(0,0,0,0.65)" }]}>
            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync(); router.back(); }}
              style={styles.iconBtn}
            >
              <Feather name="arrow-left" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={styles.titleArea}>
              <Text style={styles.channelName} numberOfLines={1}>
                {name ?? "Unknown Channel"}
              </Text>
              {isCatchUp && (
                <View style={styles.catchUpBadge}>
                  <Feather name="rotate-ccw" size={10} color="#fff" />
                  <Text style={styles.catchUpBadgeText}>CATCH-UP</Text>
                </View>
              )}
            </View>
            {sleepSecondsLeft !== null && (
              <TouchableOpacity
                style={[styles.sleepBadge, { backgroundColor: "rgba(156,39,176,0.3)" }]}
                onPress={() => setShowSleepTimer(true)}
              >
                <Feather name="moon" size={11} color="#CE93D8" />
                <Text style={styles.sleepBadgeText}>
                  {sleepSecondsLeft >= 3600
                    ? `${Math.floor(sleepSecondsLeft / 3600)}h ${Math.floor((sleepSecondsLeft % 3600) / 60)}m`
                    : sleepSecondsLeft >= 60
                    ? `${Math.floor(sleepSecondsLeft / 60)}m ${sleepSecondsLeft % 60}s`
                    : `${sleepSecondsLeft}s`}
                </Text>
              </TouchableOpacity>
            )}
            {!isCatchUp && sleepSecondsLeft === null && !!channelId && !deviceRecording.isRecording && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
            {/* Device REC badge — shown when recording to device */}
            {(deviceRecording.isRecording || deviceRecording.isSaving) && (
              <TouchableOpacity
                onPress={async () => {
                  if (deviceRecording.isSaving) return;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  const capturedBytes = deviceRecording.bytesWritten;
                  const capturedMs = deviceRecording.elapsedMs;
                  const saved = await deviceRecording.stop();
                  Alert.alert(
                    saved ? "Enregistrement sauvegardé ✓" : "Enregistrement arrêté",
                    saved
                      ? `Sauvegardé dans la galerie\n"IPTV Recordings"\n\n${formatElapsed(capturedMs)} · ${formatBytes(capturedBytes)} capturés`
                      : "L'enregistrement a été arrêté.",
                    [{ text: "OK" }],
                  );
                }}
                style={[styles.liveBadge, { backgroundColor: "rgba(229,57,53,0.25)", borderColor: "#e53935", borderWidth: 1 }]}
              >
                <View style={[styles.liveDot, { backgroundColor: "#e53935" }]} />
                <Text style={[styles.liveText, { color: "#e53935" }]}>
                  {deviceRecording.isSaving
                    ? "SAVING..."
                    : `REC ${formatElapsed(deviceRecording.elapsedMs)} · ${formatBytes(deviceRecording.bytesWritten)}`}
                </Text>
              </TouchableOpacity>
            )}
            {/* Record button — live channels only, not catch-up */}
            {!isCatchUp && !!channelId && !!streamUrl && (
              <TouchableOpacity
                onPress={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  if (deviceRecording.isRecording) {
                    const capturedBytes = deviceRecording.bytesWritten;
                    const capturedMs = deviceRecording.elapsedMs;
                    const saved = await deviceRecording.stop();
                    Alert.alert(
                      saved ? "Enregistrement sauvegardé ✓" : "Enregistrement arrêté",
                      saved
                        ? `Sauvegardé dans la galerie\n"IPTV Recordings"\n\n${formatElapsed(capturedMs)} · ${formatBytes(capturedBytes)} capturés`
                        : "L'enregistrement a été arrêté.",
                      [{ text: "OK" }],
                    );
                  } else {
                    const started = await deviceRecording.start(
                      streamUrl,
                      name ?? "recording",
                      recordingSettings.deviceRecordingsFolder ?? "",
                    );
                    if (!started && deviceRecording.error) {
                      Alert.alert("Impossible d'enregistrer", deviceRecording.error);
                    }
                  }
                }}
                style={[styles.iconBtn, deviceRecording.isRecording && { backgroundColor: "rgba(229,57,53,0.2)", borderRadius: 8 }]}
              >
                <Feather name="circle" size={20} color={deviceRecording.isRecording ? "#e53935" : "#fff"} />
              </TouchableOpacity>
            )}
            {/* Toolbar toggle */}
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                setShowToolbar((v) => !v);
              }}
              style={[styles.iconBtn, showToolbar && { backgroundColor: "rgba(33,150,243,0.3)", borderRadius: 8 }]}
            >
              <Feather name="more-horizontal" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Center controls */}
          <View style={styles.centerControls} pointerEvents="box-none">
            <View style={styles.centerRow}>
              {isCatchUp && (
                <TouchableOpacity
                  onPress={seekBackward}
                  style={[styles.seekBtn, { backgroundColor: "rgba(0,0,0,0.5)" }]}
                >
                  <Feather name="rotate-ccw" size={20} color="#fff" />
                  <Text style={styles.seekLabel}>30s</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={togglePlay}
                style={[styles.playBtn, { backgroundColor: "rgba(0,0,0,0.6)" }]}
              >
                <Feather name={isPlaying ? "pause" : "play"} size={36} color="#fff" />
              </TouchableOpacity>

              {isCatchUp && (
                <TouchableOpacity
                  onPress={seekForward}
                  style={[styles.seekBtn, { backgroundColor: "rgba(0,0,0,0.5)" }]}
                >
                  <Feather name="rotate-cw" size={20} color="#fff" />
                  <Text style={styles.seekLabel}>30s</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Bottom area */}
          <View>
            {/* Scrubber — catch-up and standalone VOD */}
            {(isCatchUp || (!channelId && duration > 0)) && (
              <View style={[styles.bottomBar, { backgroundColor: "rgba(0,0,0,0.65)" }]}>
                <Scrubber
                  position={position}
                  duration={duration}
                  onSeek={async (pct) => {
                    if (videoRef.current && duration > 0) {
                      await videoRef.current.setPositionAsync(pct * duration);
                    }
                  }}
                  colors={colors}
                />
              </View>
            )}

            {/* TiviMate-style info bar — live channels */}
            {!!channelId && !isCatchUp && (
              <PlayerInfoBar
                channelName={name ?? "Unknown"}
                channelLogo={currentChannel?.logo}
                channelNumber={currentChannelIdx >= 0 ? currentChannelIdx + 1 : 0}
                currentProgram={currentEpgProg}
                nextProgram={nextEpgProg}
                epgProgress={epgProgress}
                watchHistory={watchHistory}
                currentChannelId={channelId}
                colors={colors}
                bottomPad={bottomPad}
                isCatchUp={false}
                sleepSecondsLeft={sleepSecondsLeft}
                onGuide={() => {
                  setShowControls(false);
                  setShowEpg(true);
                }}
                onSwitchChannel={(h) => {
                  router.replace({
                    pathname: "/player",
                    params: { url: h.channelUrl, name: h.channelName, channelId: h.channelId },
                  });
                }}
                onClearHistory={clearWatchHistory}
                onDeleteHistoryItem={(id) => removeFromWatchHistory(id)}
                onMore={() => setShowToolbar((v) => !v)}
                onSleepTimer={() => setShowSleepTimer(true)}
              />
            )}

            {/* Quick-action toolbar */}
            {showToolbar && (
              <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)}>
                <PlayerToolbar
                  channelId={channelId}
                  onClose={() => setShowToolbar(false)}
                  onMultiview={() => {
                    setShowToolbar(false);
                    setShowControls(false);
                    setShowMultiview(true);
                  }}
                  onPiP={() => {
                    if (!streamUrl) return;
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    startPiP(streamUrl, name ?? "Unknown", channelId);
                    router.back();
                  }}
                  onSleepTimer={() => {
                    setShowToolbar(false);
                    setShowSleepTimer(true);
                  }}
                  onEpg={() => {
                    setShowToolbar(false);
                    setShowControls(false);
                    setShowEpg(true);
                  }}
                  onRecording={async () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    if (deviceRecording.isRecording) {
                      const capturedBytes = deviceRecording.bytesWritten;
                      const capturedMs = deviceRecording.elapsedMs;
                      setShowToolbar(false);
                      const saved = await deviceRecording.stop();
                      Alert.alert(
                        saved ? "Enregistrement sauvegardé ✓" : "Enregistrement arrêté",
                        saved
                          ? `Sauvegardé dans la galerie\n"IPTV Recordings"\n\n${formatElapsed(capturedMs)} · ${formatBytes(capturedBytes)} capturés`
                          : "L'enregistrement a été arrêté.",
                        [{ text: "OK" }],
                      );
                    } else {
                      const started = await deviceRecording.start(
                        streamUrl ?? "",
                        name ?? "recording",
                        recordingSettings.deviceRecordingsFolder ?? "",
                      );
                      if (!started && deviceRecording.error) {
                        Alert.alert("Impossible d'enregistrer", deviceRecording.error);
                      }
                      setShowToolbar(false);
                    }
                  }}
                  isRecording={deviceRecording.isRecording}
                  sleepActive={sleepActiveMinutes > 0}
                  colors={colors}
                  bottomPad={bottomPad}
                />
              </Animated.View>
            )}
          </View>
        </Animated.View>
      )}

      <MultiviewScreen
        visible={showMultiview}
        initialChannelId={channelId}
        initialChannelName={name ?? undefined}
        initialChannelUrl={url ?? undefined}
        onClose={() => {
          setShowMultiview(false);
          setShowControls(true);
        }}
      />

      <EpgOverlay
        visible={showEpg}
        channelName={name ?? "Unknown"}
        epgData={channelEpg}
        onClose={() => {
          setShowEpg(false);
          setShowControls(true);
        }}
        onCatchUp={(prog) => {
          setShowEpg(false);
          if (streamUrl) {
            router.replace({
              pathname: "/player",
              params: {
                url: streamUrl,
                name: name ?? "",
                channelId: channelId ?? "",
                catchUpStart: String(prog.startTime),
                catchUpEnd: String(prog.endTime),
              },
            });
          }
        }}
      />

      <SleepTimerModal
        visible={showSleepTimer}
        activeMinutes={sleepActiveMinutes}
        colors={colors}
        onClose={() => setShowSleepTimer(false)}
        onSelect={(minutes) => {
          setShowSleepTimer(false);
          setSleepActiveMinutes(minutes);
          if (minutes === 0) {
            setSleepTimerEnd(null);
            setSleepSecondsLeft(null);
          } else {
            setSleepTimerEnd(Date.now() + minutes * 60 * 1000);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  controls: { justifyContent: "space-between" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  titleArea: {
    flex: 1,
    gap: 4,
  },
  channelName: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  catchUpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(33,150,243,0.4)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  catchUpBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  sleepBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  sleepBadgeText: {
    color: "#CE93D8",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(244,67,54,0.3)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#f44336",
  },
  liveText: {
    color: "#f44336",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  centerControls: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  centerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  seekBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  seekLabel: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  bottomBar: {
    paddingTop: 4,
  },
  liveBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  liveBottomText: {
    color: "#f44336",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  streamInfo: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    gap: 12,
  },
  bufferingText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  noUrl: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  noUrlText: {
    color: "#666",
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  epgPanel: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  qualityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  qBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  qBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  liveDotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto",
  },
  liveDotSmall: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  epgPanelTitle: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 3,
  },
  epgTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  epgTimeText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  epgMinsLeft: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginLeft: "auto",
  },
  epgProgTrack: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 4,
  },
  epgProgFill: {
    height: 3,
    borderRadius: 2,
  },
  epgNextText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  historyStrip: {},
  histActionCard: {
    alignItems: "center",
    gap: 4,
    width: 60,
    height: 68,
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
  },
  histActionLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  histSep: {
    width: 1,
    height: 48,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  histChannelCard: {
    alignItems: "center",
    gap: 3,
    width: 60,
    height: 68,
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 8,
    padding: 4,
    borderColor: "transparent",
    borderWidth: 1,
  },
  histChannelLogo: {
    width: 40,
    height: 28,
    borderRadius: 3,
  },
  osdContainer: {
    position: "absolute",
    bottom: 140,
    left: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.88)",
    borderRadius: 14,
    padding: 12,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.15)",
    maxWidth: 280,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  osdLogo: {
    width: 56,
    height: 38,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  osdLogoPlaceholder: {
    width: 56,
    height: 38,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  osdInfo: {
    flex: 1,
    gap: 3,
  },
  osdChNum: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
  },
  osdChName: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  osdArrows: {
    gap: 0,
    alignItems: "center",
  },
  histChannelName: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  nextEpOverlay: {
    position: "absolute",
    bottom: 80,
    right: 20,
    zIndex: 99,
  },
  nextEpCard: {
    backgroundColor: "rgba(10,10,10,0.92)",
    borderRadius: 14,
    padding: 16,
    width: 260,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.15)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 14,
  },
  nextEpTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  nextEpLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  nextEpDismiss: {
    padding: 2,
  },
  nextEpName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
    marginBottom: 14,
    lineHeight: 20,
  },
  nextEpActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  nextEpPlayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
  },
  nextEpPlayText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#000",
  },
  nextEpCancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  nextEpCancelText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
  },
});
