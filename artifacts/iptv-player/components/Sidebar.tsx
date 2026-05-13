import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Section, useIPTV } from "@/context/IPTVContext";
import { useColors } from "@/hooks/useColors";

interface SidebarItem {
  section: Section;
  icon: keyof typeof Feather.glyphMap;
  label: string;
}

const ITEMS: SidebarItem[] = [
  { section: "TV", icon: "tv", label: "Live TV" },
  { section: "Movies", icon: "film", label: "Movies" },
  { section: "Shows", icon: "grid", label: "Shows" },
  { section: "Search", icon: "search", label: "Search" },
  { section: "Recordings", icon: "hard-drive", label: "Recordings" },
  { section: "My List", icon: "bookmark", label: "My List" },
];

interface SidebarProps {
  onSettings: () => void;
  onSwitchPlaylist: () => void;
}

function getRecordingStatus(startTime: number, endTime: number, now: number) {
  if (endTime < now) return "completed";
  if (startTime <= now) return "recording";
  return "scheduled";
}

export function Sidebar({ onSettings, onSwitchPlaylist }: SidebarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentSection, setCurrentSection, activePlaylist, playlists, recordings } = useIPTV();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const now = Date.now();

  const { activeCount, scheduledCount } = useMemo(() => {
    let activeCount = 0;
    let scheduledCount = 0;
    for (const r of recordings) {
      const s = getRecordingStatus(r.startTime, r.endTime, now);
      if (s === "recording") activeCount++;
      else if (s === "scheduled") scheduledCount++;
    }
    return { activeCount, scheduledCount };
  }, [recordings, now]);

  const recordingsBadge = activeCount > 0 ? activeCount : scheduledCount > 0 ? scheduledCount : 0;
  const recordingsBadgeColor = activeCount > 0 ? "#ef4444" : colors.primary;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.sidebar,
          paddingTop: topPad + 6,
          paddingBottom: bottomPad + 6,
          borderRightColor: colors.border,
        },
      ]}
    >
      {/* Logo */}
      <View style={styles.logoRow}>
        <View style={[styles.logoIcon, { backgroundColor: colors.primary }]}>
          <Feather name="tv" size={13} color="#fff" />
        </View>
        <View style={styles.logoText}>
          <Text style={[styles.logoBlue, { color: colors.primary }]}>tivi</Text>
          <Text style={[styles.logoWhite, { color: colors.foreground }]}>mate</Text>
        </View>
      </View>

      {/* Active playlist badge */}
      <TouchableOpacity
        onPress={() => {
          Haptics.selectionAsync();
          onSwitchPlaylist();
        }}
        style={[styles.playlistBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}
        activeOpacity={0.75}
      >
        <View style={[styles.playlistDot, { backgroundColor: activePlaylist ? "#4ade80" : colors.mutedForeground }]} />
        <Text
          style={[styles.playlistName, { color: activePlaylist ? colors.foreground : colors.mutedForeground }]}
          numberOfLines={1}
        >
          {activePlaylist?.name ?? "No playlist"}
        </Text>
        <Feather name="chevron-down" size={11} color={colors.mutedForeground} />
      </TouchableOpacity>

      {playlists.length > 1 && (
        <Text style={[styles.playlistCount, { color: colors.mutedForeground }]}>
          {playlists.length} playlists
        </Text>
      )}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Nav items */}
      <View style={styles.navItems}>
        {ITEMS.map((item) => {
          const active = item.section === currentSection;
          const isRecordings = item.section === "Recordings";
          const badge = isRecordings ? recordingsBadge : 0;

          return (
            <TouchableOpacity
              key={item.section}
              onPress={() => {
                Haptics.selectionAsync();
                setCurrentSection(item.section);
              }}
              activeOpacity={0.7}
              style={[
                styles.itemWrap,
                active && { backgroundColor: `${colors.primary}22` },
              ]}
            >
              {active && (
                <View style={[styles.activeStripe, { backgroundColor: colors.primary }]} />
              )}
              <View style={[styles.iconWrap, active && { backgroundColor: `${colors.primary}28` }]}>
                <Feather
                  name={item.icon}
                  size={17}
                  color={active ? colors.primary : colors.mutedForeground}
                />
                {badge > 0 && (
                  <View style={[styles.badge, { backgroundColor: recordingsBadgeColor }]}>
                    <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
                  </View>
                )}
              </View>
              <Text
                style={[
                  styles.itemLabel,
                  {
                    color: active ? colors.primary : colors.mutedForeground,
                    fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
                  },
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            onSettings();
          }}
          style={styles.itemWrap}
          activeOpacity={0.7}
        >
          <View style={styles.iconWrap}>
            <Feather name="settings" size={17} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.itemLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 148,
    borderRightWidth: StyleSheet.hairlineWidth,
    flexDirection: "column",
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  logoIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  logoText: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoBlue: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  logoWhite: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  playlistBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 8,
    marginBottom: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  playlistDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  playlistName: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  playlistCount: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
    marginBottom: 8,
    marginTop: 6,
  },
  navItems: {
    flex: 1,
    gap: 2,
  },
  itemWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginHorizontal: 4,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  activeStripe: {
    position: "absolute",
    left: 4,
    top: 7,
    bottom: 7,
    width: 3,
    borderRadius: 2,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  itemLabel: {
    fontSize: 12,
    flex: 1,
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  badgeText: {
    color: "#fff",
    fontSize: 8,
    fontFamily: "Inter_700Bold",
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    marginTop: 4,
  },
});
