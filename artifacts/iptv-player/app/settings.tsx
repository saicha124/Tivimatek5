import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AddPlaylistWizard } from "@/components/AddPlaylistWizard";
import { GroupLockModal } from "@/components/GroupLockModal";
import { PinPad } from "@/components/PinPad";
import { Playlist, useIPTV } from "@/context/IPTVContext";
import { useParental } from "@/context/ParentalContext";
import { useColors } from "@/hooks/useColors";

type SettingsPage =
  | "main"
  | "general"
  | "playlists"
  | "epg"
  | "appearance"
  | "playback"
  | "remote_control"
  | "parental"
  | "other"
  | "reminders"
  | "recording"
  | "vod"
  | "about";

type PinFlow =
  | "setup-new"
  | "setup-confirm"
  | "disable"
  | "change-old"
  | "change-new"
  | "lock-groups"
  | null;

function SettingRow({
  label,
  value,
  onPress,
  rightEl,
  last,
  destructive,
  accent,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  rightEl?: React.ReactNode;
  last?: boolean;
  destructive?: boolean;
  accent?: boolean;
}) {
  const colors = useColors();
  const content = (
    <View
      style={[
        rowStyles.row,
        {
          borderBottomColor: "rgba(255,255,255,0.06)",
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={rowStyles.info}>
        <Text
          style={[
            rowStyles.label,
            {
              color: destructive
                ? "#f44336"
                : accent
                ? colors.primary
                : "#fff",
            },
          ]}
        >
          {label}
        </Text>
        {value !== undefined && (
          <Text style={[rowStyles.value, { color: "rgba(255,255,255,0.45)" }]}>
            {value}
          </Text>
        )}
      </View>
      {rightEl !== undefined
        ? rightEl
        : onPress
        ? (
          <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.3)" />
        )
        : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    gap: 12,
  },
  info: { flex: 1 },
  label: { fontSize: 15, fontFamily: "Inter_400Regular" },
  value: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
});

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={shStyles.wrap}>
      <Text style={shStyles.text}>{title}</Text>
    </View>
  );
}
const shStyles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 10 },
  text: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
});

function Divider() {
  return (
    <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.06)" }} />
  );
}

function SwitchRow({
  label,
  sub,
  value,
  onValueChange,
  last,
  colors,
}: {
  label: string;
  sub?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  last?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={[
        rowStyles.row,
        {
          borderBottomColor: "rgba(255,255,255,0.06)",
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontFamily: "Inter_400Regular", color: "#fff" }}>
          {label}
        </Text>
        {sub && (
          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
            {sub}
          </Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => { Haptics.selectionAsync(); onValueChange(v); }}
        trackColor={{ false: "rgba(255,255,255,0.15)", true: `${colors.primary}90` }}
        thumbColor={value ? colors.primary : "#888"}
        ios_backgroundColor="rgba(255,255,255,0.15)"
      />
    </View>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    playlists,
    activePlaylist,
    setActivePlaylist,
    removePlaylist,
    reminderSettings,
    updateReminderSettings,
    recordingSettings,
    updateRecordingSettings,
    customProxyUrl,
    setCustomProxyUrl,
  } = useIPTV();
  const { isEnabled, hasPin, lockedGroups, enableControls, disableControls, changePin, verifyPin, lockAllSession } = useParental();

  const [page, setPage] = useState<SettingsPage>("main");
  const [showAddPlaylist, setShowAddPlaylist] = useState(false);
  const [showGroupLock, setShowGroupLock] = useState(false);
  const [pinFlow, setPinFlow] = useState<PinFlow>(null);
  const [newPinBuffer, setNewPinBuffer] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [generalSettings, setGeneralSettings] = useState({
    autoStartOnBoot: false,
    autoStartOnWake: false,
    turnOnLastChannel: true,
    switchToPiPOnHome: false,
    confirmExitOnBack: false,
  });

  const [epgSettings, setEpgSettings] = useState({
    pastDays: 7,
    storeDescriptions: true,
    updateIntervalHours: 24,
    updateOnStart: false,
    updateOnPlaylistChange: false,
  });

  const [appearanceSettings, setAppearanceSettings] = useState({
    language: "System",
    fontSize: "Medium",
    colorTheme: "Dark · Blue",
    transparency: 50,
  });

  const [isUpdatingEpg, setIsUpdatingEpg] = useState(false);

  const [folderEditing, setFolderEditing] = useState(false);
  const [folderDraft, setFolderDraft] = useState(recordingSettings.recordingsFolder ?? "/tmp/iptv-recordings");
  const folderInputRef = useRef<any>(null);
  const [activeRecCount, setActiveRecCount] = useState(0);
  const [serverTotalMB, setServerTotalMB] = useState(0);

  const [deviceFolderEditing, setDeviceFolderEditing] = useState(false);
  const [deviceFolderDraft, setDeviceFolderDraft] = useState(
    recordingSettings.deviceRecordingsFolder ?? "/storage/emulated/0/Download/IPTV Recordings"
  );
  const deviceFolderInputRef = useRef<any>(null);

  const [proxyUrlDraft, setProxyUrlDraft] = useState(customProxyUrl);
  const [proxyUrlEditing, setProxyUrlEditing] = useState(false);
  const proxyUrlInputRef = useRef<any>(null);

  const getEffectiveApiBase = () => {
    if (customProxyUrl.trim()) return customProxyUrl.trim().replace(/\/+$/, "");
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    return domain ? `https://${domain}/api` : "/api";
  };

  useEffect(() => {
    if (page !== "recording") return;
    const fetchActive = async () => {
      try {
        const base = getEffectiveApiBase();
        const r = await fetch(`${base}/recordings/active`);
        if (!r.ok) return;
        const data: { id: string; channelName: string; filePath: string; startedAt: number; fileSize: number }[] = await r.json();
        setActiveRecCount(data.length);
        setServerTotalMB(data.reduce((s, d) => s + (d.fileSize ?? 0), 0) / (1024 * 1024));
      } catch {}
    };
    fetchActive();
    const t = setInterval(fetchActive, 5000);
    return () => clearInterval(t);
  }, [page, customProxyUrl]);

  const updateGeneral = (patch: Partial<typeof generalSettings>) =>
    setGeneralSettings((prev) => ({ ...prev, ...patch }));

  const handleRemove = (playlist: Playlist) => {
    Alert.alert("Remove Playlist", `Are you sure you want to remove "${playlist.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          removePlaylist(playlist.id);
        },
      },
    ]);
  };

  const pinTitle = () => {
    if (pinFlow === "setup-new") return "Set Parental PIN";
    if (pinFlow === "setup-confirm") return "Confirm PIN";
    if (pinFlow === "disable") return "Enter PIN to Disable";
    if (pinFlow === "change-old") return "Enter Current PIN";
    if (pinFlow === "change-new") return "Enter New PIN";
    if (pinFlow === "lock-groups") return "Enter PIN";
    return "";
  };

  const pinSubtitle = () => {
    if (pinFlow === "setup-new") return "Choose a 4-digit PIN";
    if (pinFlow === "setup-confirm") return "Enter the same PIN again to confirm";
    if (pinFlow === "disable") return "Enter your current PIN to disable parental controls";
    if (pinFlow === "change-old") return "Enter your current PIN first";
    if (pinFlow === "change-new") return "Now enter your new PIN";
    if (pinFlow === "lock-groups") return "Verify your PIN to manage locked groups";
    return "";
  };

  const handlePinVerify = async (pin: string): Promise<boolean> => {
    if (pinFlow === "setup-new") { setNewPinBuffer(pin); setPinFlow("setup-confirm"); return true; }
    if (pinFlow === "setup-confirm") {
      if (pin === newPinBuffer) return true;
      setNewPinBuffer(""); setPinFlow("setup-new"); return false;
    }
    if (pinFlow === "disable") return disableControls(pin);
    if (pinFlow === "change-old") {
      const ok = await verifyPin(pin);
      if (ok) { setNewPinBuffer(pin); setPinFlow("change-new"); return true; }
      return false;
    }
    if (pinFlow === "change-new") { await changePin(newPinBuffer, pin); return true; }
    if (pinFlow === "lock-groups") return verifyPin(pin);
    return false;
  };

  const handlePinSuccess = async () => {
    if (pinFlow === "setup-confirm") {
      await enableControls(newPinBuffer);
      setNewPinBuffer(""); setPinFlow(null);
      Alert.alert("Parental Controls Enabled", "Your PIN has been set.");
    } else if (pinFlow === "change-new") {
      setNewPinBuffer(""); setPinFlow(null);
      Alert.alert("PIN Changed", "Your parental control PIN has been updated.");
    } else if (pinFlow === "lock-groups") {
      setPinFlow(null); setShowGroupLock(true);
    } else {
      setPinFlow(null);
    }
  };

  const goBack = () => {
    Haptics.selectionAsync();
    if (page === "reminders" || page === "recording" || page === "vod") setPage("other");
    else if (page !== "main") setPage("main");
    else router.back();
  };

  const pageTitle = () => {
    const titles: Record<SettingsPage, string> = {
      main: "Settings",
      general: "General",
      playlists: "Playlists",
      epg: "EPG",
      appearance: "Appearance",
      playback: "Playback",
      remote_control: "Remote control",
      parental: "Parental controls",
      other: "Other",
      reminders: "Reminders",
      recording: "Recording",
      vod: "VOD",
      about: "About",
    };
    return titles[page];
  };

  const nav = (p: SettingsPage) => { Haptics.selectionAsync(); setPage(p); };

  const renderMain = () => (
    <ScrollView contentContainerStyle={{ paddingBottom: bottomPad + 24 }}>
      <View style={styles.card}>
        <SettingRow label="General" onPress={() => nav("general")} />
        <Divider />
        <SettingRow label="Playlists" onPress={() => nav("playlists")} />
        <Divider />
        <SettingRow label="EPG" onPress={() => nav("epg")} />
        <Divider />
        <SettingRow label="Appearance" onPress={() => nav("appearance")} />
        <Divider />
        <SettingRow label="Playback" onPress={() => nav("playback")} />
        <Divider />
        <SettingRow label="Remote control" onPress={() => nav("remote_control")} />
        <Divider />
        <SettingRow label="Parental controls" onPress={() => nav("parental")} />
        <Divider />
        <SettingRow label="Other" onPress={() => nav("other")} />
        <Divider />
        <SettingRow label="About" onPress={() => nav("about")} last />
      </View>
    </ScrollView>
  );

  const renderGeneral = () => (
    <ScrollView contentContainerStyle={{ paddingBottom: bottomPad + 24 }}>
      <View style={styles.card}>
        <SwitchRow
          label="Auto start app on boot"
          value={generalSettings.autoStartOnBoot}
          onValueChange={(v) => updateGeneral({ autoStartOnBoot: v })}
          colors={colors}
        />
        <Divider />
        <SwitchRow
          label="Auto start app on wake up from sleep mode"
          sub="May not work on all devices"
          value={generalSettings.autoStartOnWake}
          onValueChange={(v) => updateGeneral({ autoStartOnWake: v })}
          colors={colors}
        />
        <Divider />
        <SwitchRow
          label="Turn on last channel on app start"
          value={generalSettings.turnOnLastChannel}
          onValueChange={(v) => updateGeneral({ turnOnLastChannel: v })}
          colors={colors}
        />
        <Divider />
        <SwitchRow
          label="Switch to picture-in-picture mode on press Home"
          value={generalSettings.switchToPiPOnHome}
          onValueChange={(v) => updateGeneral({ switchToPiPOnHome: v })}
          colors={colors}
        />
        <Divider />
        <SwitchRow
          label="Confirm exit by second press Back"
          value={generalSettings.confirmExitOnBack}
          onValueChange={(v) => updateGeneral({ confirmExitOnBack: v })}
          colors={colors}
          last
        />
      </View>

      <View style={[styles.card, { marginTop: 1 }]}>
        <SettingRow label="User-Agent" value="Not set" onPress={() => {}} />
        <Divider />
        <SettingRow label="UDP proxy (address:port)" value="Not set" onPress={() => {}} />
      </View>

      <View style={[styles.card, { marginTop: 1 }]}>
        <SettingRow label="Back up data" onPress={() => Alert.alert("Backup", "Backup will be saved to device storage.")} />
        <Divider />
        <SettingRow label="Restore data" onPress={() => Alert.alert("Restore", "Select a backup file to restore.")} last />
      </View>

      {/* Server / Proxy URL */}
      <View style={styles.accentHeader}>
        <Text style={[styles.accentHeaderText, { color: colors.primary }]}>Network</Text>
      </View>
      <View style={styles.card}>
        <View style={rowStyles.row}>
          <Feather name="server" size={16} color="rgba(255,255,255,0.45)" style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontFamily: "Inter_400Regular", color: "#fff" }}>
              API Server URL
            </Text>
            {proxyUrlEditing ? (
              <TextInput
                ref={proxyUrlInputRef}
                value={proxyUrlDraft}
                onChangeText={setProxyUrlDraft}
                onSubmitEditing={() => {
                  setCustomProxyUrl(proxyUrlDraft);
                  setProxyUrlEditing(false);
                }}
                onBlur={() => {
                  setCustomProxyUrl(proxyUrlDraft);
                  setProxyUrlEditing(false);
                }}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="e.g. https://your-domain.replit.app/api"
                placeholderTextColor="rgba(255,255,255,0.25)"
                style={{
                  fontSize: 12,
                  fontFamily: "Inter_400Regular",
                  color: colors.primary,
                  marginTop: 4,
                  paddingVertical: 0,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.primary,
                }}
              />
            ) : (
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2, fontFamily: "Inter_400Regular" }} numberOfLines={1}>
                {customProxyUrl.trim() ? customProxyUrl.trim() : (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api` : "Auto-detect")}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() => {
              if (proxyUrlEditing) {
                setCustomProxyUrl(proxyUrlDraft);
                setProxyUrlEditing(false);
              } else {
                setProxyUrlDraft(customProxyUrl);
                setProxyUrlEditing(true);
              }
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather
              name={proxyUrlEditing ? "check" : "edit-2"}
              size={16}
              color={proxyUrlEditing ? colors.primary : "rgba(255,255,255,0.4)"}
            />
          </TouchableOpacity>
        </View>
        {customProxyUrl.trim() ? (
          <View style={[rowStyles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.06)" }]}>
            <View style={{ flex: 1 }}>
              <TouchableOpacity onPress={() => { setCustomProxyUrl(""); setProxyUrlDraft(""); }}>
                <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "#f44336" }}>Clear custom URL</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>
      <Text style={[styles.footerNote, { color: "rgba(255,255,255,0.35)" }]}>
        Set this when using the app on a phone or Android TV outside of Replit. Enter the full URL of your API server (e.g. https://your-app.replit.app/api).
      </Text>
    </ScrollView>
  );

  const renderPlaylists = () => (
    <ScrollView contentContainerStyle={{ paddingBottom: bottomPad + 24 }}>
      {playlists.map((playlist) => {
        const isActive = activePlaylist?.id === playlist.id;
        return (
          <TouchableOpacity
            key={playlist.id}
            style={[styles.playlistRow, isActive && { backgroundColor: "rgba(255,255,255,0.05)" }]}
            onPress={() => setActivePlaylist(playlist)}
            activeOpacity={0.7}
          >
            <View style={[styles.playlistCheck, { borderColor: isActive ? colors.primary : "transparent", backgroundColor: isActive ? colors.primary : "rgba(255,255,255,0.1)" }]}>
              {isActive && <Feather name="check" size={14} color="#fff" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.playlistName, { color: "#fff" }]} numberOfLines={1}>
                {playlist.name}
              </Text>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2, fontFamily: "Inter_400Regular" }}>
                Channels: {playlist.channels.length}, movies: {playlist.movies.length}, shows: {playlist.shows.length}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleRemove(playlist)} style={styles.deleteBtn}>
              <Feather name="trash-2" size={17} color="#f44336" />
            </TouchableOpacity>
          </TouchableOpacity>
        );
      })}

      <View style={[styles.card, { marginTop: 12 }]}>
        <SettingRow label="Playlists sorting" value="By name" onPress={() => {}} />
        <Divider />
        <SettingRow label="Add playlist" onPress={() => setShowAddPlaylist(true)} />
        <Divider />
        <SettingRow
          label="Update all playlists"
          onPress={() => Alert.alert("Update", "Updating all playlists...")}
          last
        />
      </View>
    </ScrollView>
  );

  const renderEpg = () => (
    <ScrollView contentContainerStyle={{ paddingBottom: bottomPad + 24 }}>
      <View style={styles.card}>
        <SettingRow label="EPG sources" onPress={() => {}} />
        <Divider />
        <SettingRow
          label="Past days to keep EPG"
          value={String(epgSettings.pastDays)}
          onPress={() => {}}
        />
        <Divider />
        <SwitchRow
          label="Store program descriptions"
          value={epgSettings.storeDescriptions}
          onValueChange={(v) => setEpgSettings((p) => ({ ...p, storeDescriptions: v }))}
          colors={colors}
          last
        />
      </View>

      <View style={styles.accentHeader}>
        <Text style={[styles.accentHeaderText, { color: colors.primary }]}>Update options</Text>
      </View>

      <View style={styles.card}>
        <SettingRow
          label="Update interval, hours"
          value={String(epgSettings.updateIntervalHours)}
          onPress={() => {}}
        />
        <Divider />
        <SwitchRow
          label="Update on app start"
          value={epgSettings.updateOnStart}
          onValueChange={(v) => setEpgSettings((p) => ({ ...p, updateOnStart: v }))}
          colors={colors}
        />
        <Divider />
        <SwitchRow
          label="Update on playlists change"
          value={epgSettings.updateOnPlaylistChange}
          onValueChange={(v) => setEpgSettings((p) => ({ ...p, updateOnPlaylistChange: v }))}
          colors={colors}
          last
        />
      </View>

      <View style={[styles.card, { marginTop: 1 }]}>
        <TouchableOpacity
          style={[rowStyles.row, { borderBottomColor: "rgba(255,255,255,0.06)", borderBottomWidth: StyleSheet.hairlineWidth }]}
          onPress={async () => {
            Haptics.selectionAsync();
            setIsUpdatingEpg(true);
            await new Promise((r) => setTimeout(r, 2500));
            setIsUpdatingEpg(false);
            Alert.alert("EPG Updated", "All EPG data has been refreshed.");
          }}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontFamily: "Inter_400Regular", color: "#fff" }}>Update EPG</Text>
          </View>
          {isUpdatingEpg && <ActivityIndicator size="small" color={colors.primary} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={rowStyles.row}
          onPress={() => {
            Haptics.selectionAsync();
            Alert.alert("Clear EPG", "This will remove all stored EPG data.", [
              { text: "Cancel", style: "cancel" },
              { text: "Clear", style: "destructive", onPress: () => {} },
            ]);
          }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 15, fontFamily: "Inter_400Regular", color: "#fff" }}>Clear EPG</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.footerNote, { color: "rgba(255,255,255,0.3)" }]}>
        Latest update status: Not updated
      </Text>
    </ScrollView>
  );

  const renderAppearance = () => (
    <ScrollView contentContainerStyle={{ paddingBottom: bottomPad + 24 }}>
      <View style={styles.card}>
        <SettingRow label="TV guide" onPress={() => {}} />
        <Divider />
        <SettingRow label="Player" onPress={() => {}} />
        <Divider />
        <SettingRow label="Groups" onPress={() => {}} />
        <Divider />
        <SettingRow label="Logos" onPress={() => {}} last />
      </View>
      <View style={[styles.card, { marginTop: 12 }]}>
        <SettingRow label="Language" value={appearanceSettings.language} onPress={() => {}} />
        <Divider />
        <SettingRow label="Font size" value={appearanceSettings.fontSize} onPress={() => {}} />
        <Divider />
        <SettingRow label="Color theme" value={appearanceSettings.colorTheme} onPress={() => {}} />
        <Divider />
        <SettingRow
          label="User interface transparency, %"
          value={String(appearanceSettings.transparency)}
          onPress={() => {}}
          last
        />
      </View>
    </ScrollView>
  );

  const renderPlayback = () => (
    <ScrollView contentContainerStyle={{ paddingBottom: bottomPad + 24 }}>
      <View style={styles.card}>
        <SettingRow label="Video decoder" value="Auto" onPress={() => {}} />
        <Divider />
        <SettingRow label="Hardware acceleration" value="Auto" onPress={() => {}} />
        <Divider />
        <SettingRow label="Aspect ratio" value="Auto fit" onPress={() => {}} />
        <Divider />
        <SettingRow label="Audio track" value="Default" onPress={() => {}} />
        <Divider />
        <SettingRow label="Audio boost" value="Off" onPress={() => {}} />
        <Divider />
        <SettingRow label="Subtitle track" value="None" onPress={() => {}} />
        <Divider />
        <SettingRow label="Subtitle size" value="Medium" onPress={() => {}} last />
      </View>
    </ScrollView>
  );

  const [remoteSettings, setRemoteSettings] = useState({
    rwffPauseForCatchup: true,
    rwForLiveStream: false,
    leftRightForCatchup: false,
    leftForLiveStream: false,
    downUpForCatchup: false,
    downForLiveStream: false,
  });

  const renderRemoteControl = () => (
    <ScrollView contentContainerStyle={{ paddingBottom: bottomPad + 24 }}>
      <View style={styles.card}>
        <SettingRow label="TV guide" onPress={() => {}} />
        <Divider />
        <SettingRow label="Player" onPress={() => {}} last />
      </View>

      <View style={styles.accentHeader}>
        <Text style={[styles.accentHeaderText, { color: colors.primary }]}>Seeking options</Text>
      </View>

      <View style={styles.card}>
        <SwitchRow
          label="Use RW/FF/Pause for seeking/pause while watching catch-up"
          value={remoteSettings.rwffPauseForCatchup}
          onValueChange={(v) => setRemoteSettings((p) => ({ ...p, rwffPauseForCatchup: v }))}
          colors={colors}
        />
        <Divider />
        <SwitchRow
          label="Use RW to rewind live stream with catch-up"
          value={remoteSettings.rwForLiveStream}
          onValueChange={(v) => setRemoteSettings((p) => ({ ...p, rwForLiveStream: v }))}
          colors={colors}
        />
        <Divider />
        <SwitchRow
          label="Use Left/Right for seeking while watching catch-up"
          value={remoteSettings.leftRightForCatchup}
          onValueChange={(v) => setRemoteSettings((p) => ({ ...p, leftRightForCatchup: v }))}
          colors={colors}
        />
        <Divider />
        <SwitchRow
          label="Use Left to rewind live stream with catch-up"
          value={remoteSettings.leftForLiveStream}
          onValueChange={(v) => setRemoteSettings((p) => ({ ...p, leftForLiveStream: v }))}
          colors={colors}
        />
        <Divider />
        <SwitchRow
          label="Use Down/Up for seeking while watching catch-up"
          value={remoteSettings.downUpForCatchup}
          onValueChange={(v) => setRemoteSettings((p) => ({ ...p, downUpForCatchup: v }))}
          colors={colors}
          last
        />
      </View>
    </ScrollView>
  );

  const renderParental = () => (
    <ScrollView contentContainerStyle={{ paddingBottom: bottomPad + 24 }}>
      <View style={styles.card}>
        <SwitchRow
          label="Off"
          value={!isEnabled}
          onValueChange={(v) => {
            if (v) {
              if (isEnabled) setPinFlow("disable");
            } else {
              if (!isEnabled) setPinFlow("setup-new");
            }
          }}
          colors={colors}
        />
        <Divider />
        <SettingRow label="Change PIN" onPress={() => { Haptics.selectionAsync(); setPinFlow("change-old"); }} />
        <Divider />
        <SettingRow label="PIN input method" value="Picker" onPress={() => {}} />
        <Divider />
        <SettingRow label="Don't require PIN after unlocking" value="Always require" onPress={() => {}} />
        <Divider />
        <SwitchRow
          label="Don't require for channels only"
          value={false}
          onValueChange={() => {}}
          colors={colors}
          last
        />
      </View>

      <View style={styles.accentHeader}>
        <Text style={[styles.accentHeaderText, { color: colors.primary }]}>Require PIN for</Text>
      </View>

      <View style={styles.card}>
        <SwitchRow label="Settings" value={false} onValueChange={() => {}} colors={colors} />
        <Divider />
        <SwitchRow label="Settings | Playlists" value={false} onValueChange={() => {}} colors={colors} />
        <Divider />
        <SwitchRow label="Settings | EPG" value={false} onValueChange={() => {}} colors={colors} />
        <Divider />
        <SwitchRow
          label="Channel options"
          value={false}
          onValueChange={() => {}}
          colors={colors}
          last
        />
      </View>

      {isEnabled && (
        <View style={[styles.card, { marginTop: 12 }]}>
          <SettingRow
            label="Manage locked groups"
            value={`${lockedGroups.length} group${lockedGroups.length !== 1 ? "s" : ""} locked`}
            onPress={() => {
              Haptics.selectionAsync();
              if (hasPin) setPinFlow("lock-groups");
              else setShowGroupLock(true);
            }}
          />
          <Divider />
          <SettingRow
            label="Lock all now"
            destructive
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              lockAllSession();
            }}
            last
          />
        </View>
      )}
    </ScrollView>
  );

  const renderOther = () => (
    <ScrollView contentContainerStyle={{ paddingBottom: bottomPad + 24 }}>
      <View style={styles.card}>
        <SettingRow label="Search" onPress={() => {}} />
        <Divider />
        <SettingRow label="Reminders" onPress={() => nav("reminders")} />
        <Divider />
        <SettingRow label="Recording" onPress={() => nav("recording")} />
        <Divider />
        <SettingRow label="VOD" onPress={() => nav("vod")} last />
      </View>
    </ScrollView>
  );

  const renderReminders = () => (
    <ScrollView contentContainerStyle={{ paddingBottom: bottomPad + 24 }}>
      <View style={styles.card}>
        <View style={[rowStyles.row, { borderBottomColor: "rgba(255,255,255,0.06)", borderBottomWidth: StyleSheet.hairlineWidth }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontFamily: "Inter_400Regular", color: "#fff" }}>Remind before program start, min</Text>
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2, fontFamily: "Inter_400Regular" }}>{reminderSettings.remindBeforeMinutes}</Text>
          </View>
          <View style={styles.stepper}>
            <TouchableOpacity style={[styles.stepBtn, { borderColor: "rgba(255,255,255,0.1)" }]} onPress={() => { Haptics.selectionAsync(); updateReminderSettings({ remindBeforeMinutes: Math.max(1, reminderSettings.remindBeforeMinutes - 1) }); }}>
              <Feather name="minus" size={14} color="#fff" />
            </TouchableOpacity>
            <Text style={[styles.stepValue, { color: "#fff" }]}>{reminderSettings.remindBeforeMinutes}</Text>
            <TouchableOpacity style={[styles.stepBtn, { borderColor: "rgba(255,255,255,0.1)" }]} onPress={() => { Haptics.selectionAsync(); updateReminderSettings({ remindBeforeMinutes: Math.min(60, reminderSettings.remindBeforeMinutes + 1) }); }}>
              <Feather name="plus" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={[rowStyles.row, { borderBottomColor: "rgba(255,255,255,0.06)", borderBottomWidth: StyleSheet.hairlineWidth }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontFamily: "Inter_400Regular", color: "#fff" }}>Popup timeout, sec</Text>
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2, fontFamily: "Inter_400Regular" }}>{reminderSettings.popupTimeoutSecs}</Text>
          </View>
          <View style={styles.stepper}>
            <TouchableOpacity style={[styles.stepBtn, { borderColor: "rgba(255,255,255,0.1)" }]} onPress={() => { Haptics.selectionAsync(); updateReminderSettings({ popupTimeoutSecs: Math.max(5, reminderSettings.popupTimeoutSecs - 5) }); }}>
              <Feather name="minus" size={14} color="#fff" />
            </TouchableOpacity>
            <Text style={[styles.stepValue, { color: "#fff" }]}>{reminderSettings.popupTimeoutSecs}</Text>
            <TouchableOpacity style={[styles.stepBtn, { borderColor: "rgba(255,255,255,0.1)" }]} onPress={() => { Haptics.selectionAsync(); updateReminderSettings({ popupTimeoutSecs: Math.min(60, reminderSettings.popupTimeoutSecs + 5) }); }}>
              <Feather name="plus" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        <SwitchRow
          label="Wake up from sleep mode"
          sub="May not work on all devices"
          value={reminderSettings.wakeFromSleep}
          onValueChange={(v) => updateReminderSettings({ wakeFromSleep: v })}
          colors={colors}
          last
        />
      </View>
    </ScrollView>
  );

  const renderRecording = () => {
    const saveFolderDraft = () => {
      const trimmed = folderDraft.trim() || "/tmp/iptv-recordings";
      setFolderDraft(trimmed);
      updateRecordingSettings({ recordingsFolder: trimmed });
      setFolderEditing(false);
    };

    const saveDeviceFolderDraft = () => {
      const trimmed = deviceFolderDraft.trim();
      setDeviceFolderDraft(trimmed);
      updateRecordingSettings({ deviceRecordingsFolder: trimmed });
      setDeviceFolderEditing(false);
    };

    const deviceFolderPresets = [
      { label: "Download / IPTV Recordings (défaut)", value: "/storage/emulated/0/Download/IPTV Recordings" },
      { label: "Download / IPTV (Android)", value: "/storage/emulated/0/Download/IPTV" },
      { label: "Movies / IPTV (Android)", value: "/storage/emulated/0/Movies/IPTV" },
      { label: "Galerie photo (IPTV Recordings)", value: "" },
    ];

    const effectiveDeviceFolder = recordingSettings.deviceRecordingsFolder?.trim()
      ? recordingSettings.deviceRecordingsFolder.trim()
      : "/storage/emulated/0/Download/IPTV Recordings";

    return (
      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad + 24 }}>

        {/* Device recording card */}
        <View style={[styles.card, { marginTop: 12 }]}>
          <View style={[rowStyles.row, { borderBottomColor: "rgba(255,255,255,0.06)", borderBottomWidth: StyleSheet.hairlineWidth }]}>
            <Feather name="smartphone" size={16} color="rgba(255,255,255,0.45)" style={{ marginRight: 4 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontFamily: "Inter_400Regular", color: "#fff" }}>Device recording</Text>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2, fontFamily: "Inter_400Regular" }}>
                Tap the ● button in the player to record live stream directly to your device
              </Text>
            </View>
          </View>
          <View style={rowStyles.row}>
            <Feather name="folder" size={16} color="rgba(255,255,255,0.45)" style={{ marginRight: 4 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontFamily: "Inter_400Regular", color: "#fff" }}>Save folder</Text>
              {deviceFolderEditing ? (
                <TextInput
                  ref={deviceFolderInputRef}
                  value={deviceFolderDraft}
                  onChangeText={setDeviceFolderDraft}
                  onSubmitEditing={saveDeviceFolderDraft}
                  onBlur={saveDeviceFolderDraft}
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="/storage/emulated/0/Download/IPTV Recordings"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  style={{
                    fontSize: 12,
                    fontFamily: "Inter_400Regular",
                    color: colors.primary,
                    marginTop: 4,
                    paddingVertical: 0,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.primary,
                  }}
                />
              ) : (
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2, fontFamily: "Inter_400Regular" }}>
                  {effectiveDeviceFolder}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => {
                if (deviceFolderEditing) {
                  saveDeviceFolderDraft();
                } else {
                  setDeviceFolderDraft(recordingSettings.deviceRecordingsFolder ?? "/storage/emulated/0/Download/IPTV Recordings");
                  setDeviceFolderEditing(true);
                }
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather
                name={deviceFolderEditing ? "check" : "edit-2"}
                size={16}
                color={deviceFolderEditing ? colors.primary : "rgba(255,255,255,0.4)"}
              />
            </TouchableOpacity>
          </View>
          {/* Preset paths */}
          {!deviceFolderEditing && (
            <View style={{ paddingTop: 8, paddingBottom: 4 }}>
              <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "Inter_400Regular", marginBottom: 6 }}>
                QUICK PRESETS
              </Text>
              {deviceFolderPresets.map((p) => (
                <TouchableOpacity
                  key={p.value}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setDeviceFolderDraft(p.value);
                    updateRecordingSettings({ deviceRecordingsFolder: p.value });
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 6,
                  }}
                >
                  <View style={{
                    width: 16, height: 16, borderRadius: 8, borderWidth: 1.5,
                    borderColor: (recordingSettings.deviceRecordingsFolder ?? "") === p.value ? colors.primary : "rgba(255,255,255,0.3)",
                    backgroundColor: (recordingSettings.deviceRecordingsFolder ?? "") === p.value ? colors.primary : "transparent",
                    marginRight: 10,
                    alignItems: "center", justifyContent: "center",
                  }}>
                    {(recordingSettings.deviceRecordingsFolder ?? "") === p.value && (
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" }} />
                    )}
                  </View>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", flex: 1 }}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <Text style={[styles.footerNote, { color: "rgba(255,255,255,0.35)", marginBottom: 12 }]}>
          L'enregistrement sauvegarde le flux directement dans ce dossier en tant que fichier .ts. Appuie sur ● dans le lecteur pour démarrer, rappuie ou appuie sur le badge REC pour arrêter. Le fichier apparaîtra dans ton gestionnaire de fichiers (Downloads → IPTV Recordings).
        </Text>

        {/* Server status card */}
        <View style={[styles.card, { marginTop: 12 }]}>
          <View style={[rowStyles.row, { borderBottomColor: "rgba(255,255,255,0.06)", borderBottomWidth: StyleSheet.hairlineWidth }]}>
            <Feather name="server" size={16} color="rgba(255,255,255,0.45)" style={{ marginRight: 4 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontFamily: "Inter_400Regular", color: "#fff" }}>Server recordings</Text>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2, fontFamily: "Inter_400Regular" }}>
                Recorded via FFmpeg on the API server
              </Text>
            </View>
            {activeRecCount > 0 ? (
              <View style={{ backgroundColor: "#e53935", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
                  {activeRecCount} active
                </Text>
              </View>
            ) : (
              <View style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontFamily: "Inter_400Regular" }}>
                  idle
                </Text>
              </View>
            )}
          </View>
          {activeRecCount > 0 && (
            <View style={[rowStyles.row, { borderBottomColor: "rgba(255,255,255,0.06)", borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <Feather name="hard-drive" size={16} color="rgba(255,255,255,0.45)" style={{ marginRight: 4 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)" }}>
                  Currently writing
                </Text>
              </View>
              <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" }}>
                {serverTotalMB >= 1024
                  ? `${(serverTotalMB / 1024).toFixed(1)} GB`
                  : `${serverTotalMB.toFixed(0)} MB`}
              </Text>
            </View>
          )}
          <View style={rowStyles.row}>
            <Feather name="folder" size={16} color="rgba(255,255,255,0.45)" style={{ marginRight: 4 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontFamily: "Inter_400Regular", color: "#fff" }}>Output folder</Text>
              {folderEditing ? (
                <TextInput
                  ref={folderInputRef}
                  value={folderDraft}
                  onChangeText={setFolderDraft}
                  onSubmitEditing={saveFolderDraft}
                  onBlur={saveFolderDraft}
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    fontSize: 12,
                    fontFamily: "Inter_400Regular",
                    color: colors.primary,
                    marginTop: 4,
                    paddingVertical: 0,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.primary,
                  }}
                />
              ) : (
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2, fontFamily: "Inter_400Regular" }}>
                  {recordingSettings.recordingsFolder ?? "/tmp/iptv-recordings"}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => {
                if (folderEditing) {
                  saveFolderDraft();
                } else {
                  setFolderDraft(recordingSettings.recordingsFolder ?? "/tmp/iptv-recordings");
                  setFolderEditing(true);
                }
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather
                name={folderEditing ? "check" : "edit-2"}
                size={16}
                color={folderEditing ? colors.primary : "rgba(255,255,255,0.4)"}
              />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.footerNote, { color: "rgba(255,255,255,0.35)", marginBottom: 4 }]}>
          Recordings are captured via FFmpeg on the API server. After a recording completes, open it in the Recordings tab and tap "Save to device" to download the .ts file to your phone or Android TV.{"\n"}For this to work on a phone or Android TV, make sure the API Server URL is set correctly in Settings › General › Network.
        </Text>

        {/* Padding card */}
        <View style={[styles.card, { marginTop: 16 }]}>
          <View style={[rowStyles.row, { borderBottomColor: "rgba(255,255,255,0.06)", borderBottomWidth: StyleSheet.hairlineWidth }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontFamily: "Inter_400Regular", color: "#fff" }}>Start early</Text>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2, fontFamily: "Inter_400Regular" }}>
                Begin recording this many minutes before program start
              </Text>
            </View>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={[styles.stepBtn, { borderColor: "rgba(255,255,255,0.1)" }]}
                onPress={() => { Haptics.selectionAsync(); updateRecordingSettings({ startBeforeMinutes: Math.max(0, recordingSettings.startBeforeMinutes - 1) }); }}
              >
                <Feather name="minus" size={14} color="#fff" />
              </TouchableOpacity>
              <Text style={[styles.stepValue, { color: "#fff" }]}>{recordingSettings.startBeforeMinutes}</Text>
              <TouchableOpacity
                style={[styles.stepBtn, { borderColor: "rgba(255,255,255,0.1)" }]}
                onPress={() => { Haptics.selectionAsync(); updateRecordingSettings({ startBeforeMinutes: Math.min(60, recordingSettings.startBeforeMinutes + 1) }); }}
              >
                <Feather name="plus" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={rowStyles.row}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontFamily: "Inter_400Regular", color: "#fff" }}>Stop late</Text>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2, fontFamily: "Inter_400Regular" }}>
                Continue recording this many minutes after program end
              </Text>
            </View>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={[styles.stepBtn, { borderColor: "rgba(255,255,255,0.1)" }]}
                onPress={() => { Haptics.selectionAsync(); updateRecordingSettings({ stopAfterMinutes: Math.max(0, recordingSettings.stopAfterMinutes - 1) }); }}
              >
                <Feather name="minus" size={14} color="#fff" />
              </TouchableOpacity>
              <Text style={[styles.stepValue, { color: "#fff" }]}>{recordingSettings.stopAfterMinutes}</Text>
              <TouchableOpacity
                style={[styles.stepBtn, { borderColor: "rgba(255,255,255,0.1)" }]}
                onPress={() => { Haptics.selectionAsync(); updateRecordingSettings({ stopAfterMinutes: Math.min(60, recordingSettings.stopAfterMinutes + 1) }); }}
              >
                <Feather name="plus" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Text style={[styles.footerNote, { color: "rgba(255,255,255,0.35)" }]}>
          Minutes: 0 = record exactly as scheduled. Up to 60 min early start or late stop.
        </Text>
      </ScrollView>
    );
  };

  const renderVOD = () => (
    <ScrollView contentContainerStyle={{ paddingBottom: bottomPad + 24 }}>
      <View style={styles.card}>
        <SettingRow label="Default quality" value="Auto" onPress={() => {}} />
        <Divider />
        <SettingRow label="Download location" value="Default" onPress={() => {}} />
        <Divider />
        <SwitchRow label="Stream over Wi-Fi only" value={false} onValueChange={() => {}} colors={colors} last />
      </View>
    </ScrollView>
  );

  const renderAbout = () => (
    <ScrollView contentContainerStyle={{ paddingBottom: bottomPad + 24 }}>
      <View style={styles.card}>
        <SettingRow label="App version" value="1.0.0" />
        <Divider />
        <SettingRow label="Build" value="2026.05.10" />
        <Divider />
        <SettingRow label="Supported formats" value="M3U, Xtream Codes, Stalker Portal" />
        <Divider />
        <SettingRow label="Website" value="tivimate.com" last />
      </View>
    </ScrollView>
  );

  const renderPage = () => {
    if (page === "main") return renderMain();
    if (page === "general") return renderGeneral();
    if (page === "playlists") return renderPlaylists();
    if (page === "epg") return renderEpg();
    if (page === "appearance") return renderAppearance();
    if (page === "playback") return renderPlayback();
    if (page === "remote_control") return renderRemoteControl();
    if (page === "parental") return renderParental();
    if (page === "other") return renderOther();
    if (page === "reminders") return renderReminders();
    if (page === "recording") return renderRecording();
    if (page === "vod") return renderVOD();
    if (page === "about") return renderAbout();
    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: "#0d0d0f" }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0d0d0f" />

      <View
        style={[
          styles.header,
          { paddingTop: topPad + 4, backgroundColor: "#161618", borderBottomColor: "rgba(255,255,255,0.07)" },
        ]}
      >
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: "#fff" }]}>{pageTitle()}</Text>
        <View style={{ width: 36 }} />
      </View>

      {renderPage()}

      <AddPlaylistWizard visible={showAddPlaylist} onClose={() => setShowAddPlaylist(false)} />
      <GroupLockModal visible={showGroupLock} onClose={() => setShowGroupLock(false)} />
      <PinPad
        visible={!!pinFlow}
        title={pinTitle()}
        subtitle={pinSubtitle()}
        onSuccess={handlePinSuccess}
        onCancel={() => { setPinFlow(null); setNewPinBuffer(""); }}
        onVerify={handlePinVerify}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  card: {
    backgroundColor: "#1a1b1e",
    marginHorizontal: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.07)",
    marginTop: 12,
  },
  accentHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 6,
  },
  accentHeaderText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  footerNote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  playlistRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  playlistCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  playlistName: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  deleteBtn: {
    padding: 6,
  },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  stepValue: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    minWidth: 28,
    textAlign: "center",
  },
});
