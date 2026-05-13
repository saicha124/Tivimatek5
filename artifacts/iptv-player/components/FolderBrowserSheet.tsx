import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

interface FolderBrowserSheetProps {
  visible: boolean;
  initialPath?: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

interface DirEntry {
  name: string;
  path: string;
}

const QUICK_ACCESS = [
  { label: "Internal Storage", icon: "smartphone" as const, path: "/storage/emulated/0/" },
  { label: "Download", icon: "download" as const, path: "/storage/emulated/0/Download/" },
  { label: "Movies", icon: "film" as const, path: "/storage/emulated/0/Movies/" },
  { label: "Music", icon: "music" as const, path: "/storage/emulated/0/Music/" },
  { label: "Pictures", icon: "image" as const, path: "/storage/emulated/0/Pictures/" },
  { label: "DCIM", icon: "camera" as const, path: "/storage/emulated/0/DCIM/" },
];

function normalizePath(p: string): string {
  return p.endsWith("/") ? p : p + "/";
}

function parentOf(p: string): string {
  const clean = p.replace(/\/$/, "");
  const idx = clean.lastIndexOf("/");
  if (idx <= 0) return "/";
  return clean.slice(0, idx + 1);
}

function breadcrumbSegments(path: string): { label: string; path: string }[] {
  const clean = path.replace(/\/$/, "");
  const parts = clean.split("/").filter(Boolean);
  const result: { label: string; path: string }[] = [];
  let accumulated = "";
  for (const part of parts) {
    accumulated += "/" + part;
    result.push({ label: part, path: accumulated + "/" });
  }
  return result;
}

export function FolderBrowserSheet({
  visible,
  initialPath,
  onSelect,
  onClose,
}: FolderBrowserSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const defaultStart =
    Platform.OS === "android"
      ? "/storage/emulated/0/"
      : FileSystem.documentDirectory ?? "/";

  const [currentPath, setCurrentPath] = useState(defaultStart);
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    if (visible) {
      const start = initialPath ? normalizePath(initialPath) : defaultStart;
      setCurrentPath(start);
      setEntries([]);
      setError(null);
    }
  }, [visible]);

  const loadDirectory = useCallback(async (path: string) => {
    abortRef.current = true;
    const token = {};
    abortRef.current = false;
    setLoading(true);
    setError(null);
    setEntries([]);

    try {
      const names = await FileSystem.readDirectoryAsync(path);
      const dirs: DirEntry[] = [];
      const BATCH = 30;
      for (let i = 0; i < names.length; i += BATCH) {
        if (abortRef.current) return;
        const batch = names.slice(i, i + BATCH);
        const results = await Promise.all(
          batch.map(async (name) => {
            const full = path.endsWith("/") ? path + name : path + "/" + name;
            try {
              const info = await FileSystem.getInfoAsync(full);
              return { name, path: full, isDir: info.isDirectory ?? false };
            } catch {
              return { name, path: full, isDir: false };
            }
          })
        );
        for (const r of results) {
          if (r.isDir && !r.name.startsWith(".")) {
            dirs.push({ name: r.name, path: r.path });
          }
        }
      }
      dirs.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
      if (!abortRef.current) {
        setEntries(dirs);
      }
    } catch (e: any) {
      if (!abortRef.current) {
        setError(e?.message ?? "Cannot read this folder");
      }
    } finally {
      if (!abortRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    loadDirectory(currentPath);
    return () => { abortRef.current = true; };
  }, [currentPath, visible]);

  const navigate = useCallback((path: string) => {
    Haptics.selectionAsync();
    setCurrentPath(normalizePath(path));
  }, []);

  const goUp = useCallback(() => {
    Haptics.selectionAsync();
    setCurrentPath(parentOf(currentPath));
  }, [currentPath]);

  const handleSelect = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelect(normalizePath(currentPath));
    onClose();
  }, [currentPath, onSelect, onClose]);

  const segments = breadcrumbSegments(currentPath);
  const canGoUp = currentPath !== "/" && currentPath !== defaultStart;

  if (Platform.OS === "web") {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>

          {/* ── Header ───────────────────────────────────────────── */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={20} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Browse Folders</Text>
            <TouchableOpacity onPress={handleSelect} activeOpacity={0.75}>
              <Text style={[styles.selectLabel, { color: colors.primary }]}>Use This</Text>
            </TouchableOpacity>
          </View>

          {/* ── Breadcrumb ───────────────────────────────────────── */}
          <View style={styles.breadcrumbBar}>
            {canGoUp && (
              <TouchableOpacity onPress={goUp} style={styles.upBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="arrow-left" size={16} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            )}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.breadcrumbContent}
            >
              {segments.map((seg, i) => (
                <React.Fragment key={seg.path}>
                  {i > 0 && (
                    <Feather name="chevron-right" size={12} color="rgba(255,255,255,0.25)" style={{ marginHorizontal: 2 }} />
                  )}
                  <TouchableOpacity onPress={() => navigate(seg.path)}>
                    <Text
                      style={[
                        styles.breadcrumbSeg,
                        i === segments.length - 1 && { color: "#fff", fontFamily: "Inter_600SemiBold" },
                      ]}
                    >
                      {seg.label}
                    </Text>
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </ScrollView>
          </View>

          {/* ── "Select this folder" sticky bar ─────────────────── */}
          <TouchableOpacity
            style={[styles.selectThisBar, { borderColor: colors.primary, backgroundColor: colors.primary + "18" }]}
            onPress={handleSelect}
            activeOpacity={0.8}
          >
            <Feather name="check-circle" size={15} color={colors.primary} />
            <Text style={[styles.selectThisText, { color: colors.primary }]} numberOfLines={1}>
              {currentPath}
            </Text>
          </TouchableOpacity>

          {/* ── Quick access (only at root-ish level) ─────────── */}
          {!loading && error === null && currentPath === defaultStart && (
            <View style={styles.quickAccess}>
              <Text style={styles.sectionLabel}>QUICK ACCESS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
                {QUICK_ACCESS.map((qa) => (
                  <TouchableOpacity
                    key={qa.path}
                    style={[styles.qaChip, { borderColor: currentPath === qa.path ? colors.primary : "rgba(255,255,255,0.15)" }]}
                    onPress={() => navigate(qa.path)}
                    activeOpacity={0.75}
                  >
                    <Feather name={qa.icon} size={13} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.qaLabel}>{qa.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Directory list ───────────────────────────────────── */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.centerText}>Loading folders...</Text>
            </View>
          ) : error !== null ? (
            <View style={styles.center}>
              <Feather name="alert-circle" size={36} color="rgba(255,255,255,0.2)" />
              <Text style={styles.centerText}>Cannot open this folder</Text>
              <Text style={styles.centerSub}>{error}</Text>
              {canGoUp && (
                <TouchableOpacity style={[styles.goUpBtn, { borderColor: colors.primary }]} onPress={goUp}>
                  <Feather name="arrow-left" size={14} color={colors.primary} />
                  <Text style={[styles.goUpText, { color: colors.primary }]}>Go back</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : entries.length === 0 ? (
            <View style={styles.center}>
              <Feather name="folder" size={36} color="rgba(255,255,255,0.15)" />
              <Text style={styles.centerText}>No subfolders here</Text>
              <Text style={styles.centerSub}>You can still select this folder</Text>
            </View>
          ) : (
            <FlatList
              data={entries}
              keyExtractor={(item) => item.path}
              style={styles.list}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.entry}
                  onPress={() => navigate(item.path)}
                  activeOpacity={0.7}
                >
                  <Feather name="folder" size={19} color="#f5c842" style={styles.entryIcon} />
                  <Text style={styles.entryName} numberOfLines={1}>{item.name}</Text>
                  <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.25)" />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    backgroundColor: "#1c1c1e",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "85%",
    minHeight: 300,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  selectLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  breadcrumbBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.07)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  upBtn: {
    marginRight: 8,
    padding: 4,
  },
  breadcrumbContent: {
    alignItems: "center",
    flexGrow: 1,
  },
  breadcrumbSeg: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.45)",
  },
  selectThisBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 14,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectThisText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  quickAccess: {
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.3)",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  quickRow: {
    gap: 8,
    paddingBottom: 2,
  },
  qaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  qaLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
  },
  list: {
    flex: 1,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginLeft: 52,
  },
  entry: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  entryIcon: {
    marginRight: 12,
  },
  entryName: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.9)",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    paddingVertical: 40,
  },
  centerText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.4)",
  },
  centerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.25)",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  goUpBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  goUpText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
});
