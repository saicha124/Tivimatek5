import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AddPlaylistWizard } from "@/components/AddPlaylistWizard";
import { ChannelList } from "@/components/ChannelList";
import { EPGGrid } from "@/components/EPGGrid";
import { GroupList } from "@/components/GroupList";
import { MiniPlayer } from "@/components/MiniPlayer";
import { MoviesView } from "@/components/MoviesView";
import { MyListView } from "@/components/MyListView";
import { PlaylistSwitcher } from "@/components/PlaylistSwitcher";
import { NowNextBar } from "@/components/NowNextBar";
import { RecordingsList } from "@/components/RecordingsList";
import { SearchView } from "@/components/SearchView";
import { ShowsView } from "@/components/ShowsView";
import { Sidebar } from "@/components/Sidebar";
import { Channel, EPGProgram, useIPTV } from "@/context/IPTVContext";
import { useColors } from "@/hooks/useColors";

type ViewMode = "list" | "epg";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activePlaylist, selectedChannel, currentSection, setCurrentSection, addToWatchHistory, resolveStalkerStreamUrl } = useIPTV();

  const [showAddPlaylist, setShowAddPlaylist] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [manageFavoritesMode, setManageFavoritesMode] = useState(false);
  const [resolvingStream, setResolvingStream] = useState(false);

  const handlePlayChannel = async (channel: Channel) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let playUrl = channel.url;

    if (activePlaylist?.type === "StalkerPortal" && channel.url.startsWith("stalker-")) {
      setResolvingStream(true);
      try {
        playUrl = await resolveStalkerStreamUrl(activePlaylist, channel.url);
      } catch (e: any) {
        setResolvingStream(false);
        return;
      }
      setResolvingStream(false);
    }

    addToWatchHistory({
      channelId: channel.id,
      channelName: channel.name,
      channelGroup: channel.group,
      channelLogo: channel.logo,
      channelUrl: playUrl,
    });
    router.push({ pathname: "/player", params: { url: playUrl, name: channel.name, channelId: channel.id } });
  };

  const handleCatchUp = (channel: Channel, program: EPGProgram) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: "/player",
      params: {
        url: channel.url,
        name: channel.name,
        catchUpStart: String(program.startTime),
        catchUpEnd: String(program.endTime),
      },
    });
  };

  const handleSettings = () => {
    router.push("/settings");
  };

  const toggleView = () => {
    Haptics.selectionAsync();
    setViewMode((v) => (v === "list" ? "epg" : "list"));
  };

  if (!activePlaylist) {
    return (
      <View style={[styles.emptyState, { backgroundColor: colors.background }]}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <LinearGradient
          colors={["#0d1b2a", "#111111"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.emptyContent}>
          <View style={[styles.emptyIconBg, { backgroundColor: colors.secondary }]}>
            <Feather name="tv" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            No playlist added
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            TiviMate doesn't provide any sources of TV channels.
            {"\n"}To watch TV channels, please add a playlist provided by your IPTV service.
          </Text>
          <View style={styles.emptyButtons}>
            <TouchableOpacity
              onPress={() => setShowAddPlaylist(true)}
              style={[styles.primaryBtn, { backgroundColor: colors.foreground }]}
              activeOpacity={0.85}
            >
              <Text style={[styles.primaryBtnText, { color: colors.background }]}>
                Add playlist
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSettings}
              style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.secondary }]}
              activeOpacity={0.85}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>
                Settings
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <AddPlaylistWizard
          visible={showAddPlaylist}
          onClose={() => setShowAddPlaylist(false)}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <View style={styles.mainLayout}>
        <Sidebar onSettings={handleSettings} onSwitchPlaylist={() => setShowSwitcher(true)} />

        {/* Right content area */}
        <View style={styles.contentArea}>
          {/* Top bar with view toggle */}
          <TopBar
            viewMode={viewMode}
            onToggleView={toggleView}
            onAddPlaylist={() => setShowAddPlaylist(true)}
            showEPGToggle={currentSection === "TV"}
          />

          {currentSection === "Search" ? (
            /* Global search */
            <SearchView
              onPlayChannel={handlePlayChannel}
              onPlayVOD={async (url, name) => {
                let playUrl = url;
                if (activePlaylist?.type === "StalkerPortal" && url.startsWith("stalker-")) {
                  setResolvingStream(true);
                  try { playUrl = await resolveStalkerStreamUrl(activePlaylist, url); } catch { setResolvingStream(false); return; }
                  setResolvingStream(false);
                }
                router.push({ pathname: "/player", params: { url: playUrl, name } });
              }}
            />
          ) : currentSection === "Recordings" ? (
            /* Recordings view */
            <View style={styles.recordingsContainer}>
              <RecordingsList onPlay={(url, name) => {
                router.push({ pathname: "/player", params: { url, name } });
              }} />
            </View>
          ) : currentSection === "My List" ? (
            /* My List view with subsections */
            <MyListView
              onPlayChannel={handlePlayChannel}
              onPlayVOD={(url, name) => router.push({ pathname: "/player", params: { url, name } })}
            />
          ) : currentSection === "Movies" ? (
            /* Movies VOD browser */
            <MoviesView
              onPlayVOD={async (url, name) => {
                let playUrl = url;
                if (activePlaylist?.type === "StalkerPortal" && url.startsWith("stalker-")) {
                  setResolvingStream(true);
                  try { playUrl = await resolveStalkerStreamUrl(activePlaylist, url); } catch { setResolvingStream(false); return; }
                  setResolvingStream(false);
                }
                router.push({ pathname: "/player", params: { url: playUrl, name } });
              }}
            />
          ) : currentSection === "Shows" ? (
            /* Shows / Series browser */
            <ShowsView
              onPlayVOD={async (url, name, nextUrl, nextName) => {
                let playUrl = url;
                if (activePlaylist?.type === "StalkerPortal" && url.startsWith("stalker-")) {
                  setResolvingStream(true);
                  try { playUrl = await resolveStalkerStreamUrl(activePlaylist, url); } catch { setResolvingStream(false); return; }
                  setResolvingStream(false);
                }
                const extraParams: Record<string, string> = {};
                if (nextUrl) extraParams.nextUrl = nextUrl;
                if (nextName) extraParams.nextName = nextName;
                router.push({ pathname: "/player", params: { url: playUrl, name, ...extraParams } });
              }}
            />
          ) : viewMode === "epg" && currentSection === "TV" ? (
            /* EPG Grid view */
            <View style={styles.epgContainer}>
              <GroupList onManageFavorites={() => {
                setManageFavoritesMode(true);
                setViewMode("list");
              }} />
              <EPGGrid
                onPlayChannel={handlePlayChannel}
                onCatchUp={handleCatchUp}
                onGoToRecordings={() => { setCurrentSection("Recordings"); setViewMode("list"); }}
              />
            </View>
          ) : (
            /* List view */
            <View style={styles.listContainer}>
              <GroupList onManageFavorites={() => setManageFavoritesMode(true)} />
              <View style={styles.channelArea}>
                {selectedChannel && !manageFavoritesMode && (
                  <MiniPlayer onFullscreen={handlePlayChannel} />
                )}
                <ChannelList
                  onPlayChannel={handlePlayChannel}
                  onCatchUp={handleCatchUp}
                  manageFavoritesMode={manageFavoritesMode}
                  onExitManageFavorites={() => setManageFavoritesMode(false)}
                />
                {selectedChannel && !manageFavoritesMode && (
                  <NowNextBar onPlay={() => handlePlayChannel(selectedChannel)} />
                )}
              </View>
            </View>
          )}
        </View>
      </View>

      {/* FAB to add playlist */}
      <TouchableOpacity
        onPress={() => setShowAddPlaylist(true)}
        style={[
          styles.fab,
          {
            backgroundColor: colors.primary,
            bottom: (Platform.OS === "web" ? 34 : insets.bottom) + 16,
          },
        ]}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={24} color="#fff" />
      </TouchableOpacity>

      <AddPlaylistWizard
        visible={showAddPlaylist}
        onClose={() => setShowAddPlaylist(false)}
      />
      <PlaylistSwitcher
        visible={showSwitcher}
        onClose={() => setShowSwitcher(false)}
        onAddPlaylist={() => { setShowSwitcher(false); setShowAddPlaylist(true); }}
      />

      {resolvingStream && (
        <View style={styles.resolvingOverlay}>
          <View style={[styles.resolvingBox, { backgroundColor: colors.card }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.resolvingText, { color: colors.foreground }]}>
              Getting stream URL...
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

function TopBar({
  viewMode,
  onToggleView,
  onAddPlaylist,
  showEPGToggle,
}: {
  viewMode: ViewMode;
  onToggleView: () => void;
  onAddPlaylist: () => void;
  showEPGToggle: boolean;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View
      style={[
        styles.topBar,
        {
          paddingTop: topPad + 4,
          backgroundColor: colors.sidebar,
          borderBottomColor: colors.border,
        },
      ]}
    >
      {showEPGToggle && (
        <View style={[styles.viewToggle, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <TouchableOpacity
            onPress={viewMode === "epg" ? onToggleView : undefined}
            style={[
              styles.toggleBtn,
              viewMode === "list" && { backgroundColor: colors.primary },
            ]}
            activeOpacity={0.7}
          >
            <Feather
              name="list"
              size={14}
              color={viewMode === "list" ? "#fff" : colors.mutedForeground}
            />
            <Text
              style={[
                styles.toggleLabel,
                { color: viewMode === "list" ? "#fff" : colors.mutedForeground },
              ]}
            >
              List
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={viewMode === "list" ? onToggleView : undefined}
            style={[
              styles.toggleBtn,
              viewMode === "epg" && { backgroundColor: colors.primary },
            ]}
            activeOpacity={0.7}
          >
            <Feather
              name="grid"
              size={14}
              color={viewMode === "epg" ? "#fff" : colors.mutedForeground}
            />
            <Text
              style={[
                styles.toggleLabel,
                { color: viewMode === "epg" ? "#fff" : colors.mutedForeground },
              ]}
            >
              Guide
            </Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={{ flex: 1 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainLayout: {
    flex: 1,
    flexDirection: "row",
  },
  contentArea: {
    flex: 1,
    flexDirection: "column",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  viewToggle: {
    flexDirection: "row",
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    gap: 2,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  toggleLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  recordingsContainer: {
    flex: 1,
  },
  epgContainer: {
    flex: 1,
    flexDirection: "row",
  },
  listContainer: {
    flex: 1,
    flexDirection: "row",
  },
  channelArea: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContent: {
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  emptyIconBg: {
    width: 96,
    height: 96,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  emptyButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  primaryBtn: {
    height: 44,
    paddingHorizontal: 24,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  secondaryBtn: {
    height: 44,
    paddingHorizontal: 24,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  resolvingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  resolvingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  resolvingText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
