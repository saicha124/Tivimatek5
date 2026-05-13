import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import { Platform } from "react-native";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/recordings`
  : "http://localhost:8080/api/recordings";

export interface DeviceRecordingState {
  isRecording: boolean;
  isSaving: boolean;
  channelName: string | null;
  filePath: string | null;
  fileName: string | null;
  bytesWritten: number;
  elapsedMs: number;
  startTime: number | null;
  error: string | null;
}

interface DeviceRecordingContextValue extends DeviceRecordingState {
  start: (streamUrl: string, channelName: string, deviceFolder: string) => Promise<boolean>;
  stop: () => Promise<string | null>;
  clearError: () => void;
}

const INITIAL: DeviceRecordingState = {
  isRecording: false,
  isSaving: false,
  channelName: null,
  filePath: null,
  fileName: null,
  bytesWritten: 0,
  elapsedMs: 0,
  startTime: null,
  error: null,
};

const DeviceRecordingContext = createContext<DeviceRecordingContextValue | null>(null);

const DEFAULT_FOLDER = "/storage/emulated/0/Download/IPTV Recordings";

export function DeviceRecordingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DeviceRecordingState>(INITIAL);
  const downloadRef = useRef<FileSystem.DownloadResumable | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const cacheFilePathRef = useRef<string | null>(null);
  const fileNameRef = useRef<string | null>(null);
  const deviceFolderRef = useRef<string>(DEFAULT_FOLDER);

  const start = useCallback(async (
    streamUrl: string,
    name: string,
    deviceFolder: string,
  ): Promise<boolean> => {
    if (Platform.OS === "web") {
      setState((s) => ({ ...s, error: "L'enregistrement n'est disponible que dans l'application mobile (Expo Go)." }));
      return false;
    }

    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") {
      setState((s) => ({ ...s, error: "Permission requise pour accéder au stockage." }));
      return false;
    }

    if (downloadRef.current) {
      try { await downloadRef.current.pauseAsync(); } catch {}
      downloadRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      const dt = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const dateStr = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
      const timeStr = `${pad(dt.getHours())}${pad(dt.getMinutes())}${pad(dt.getSeconds())}`;
      const safeName = name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
      const fileName = `${dateStr}_${timeStr}_${safeName}.ts`;

      fileNameRef.current = fileName;
      deviceFolderRef.current = deviceFolder?.trim() || DEFAULT_FOLDER;

      const cacheDir = (FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? "") + "rec_tmp/";
      try { await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true }); } catch {}
      const cachePath = cacheDir + fileName;
      cacheFilePathRef.current = cachePath;

      const pipeUrl = `${API_BASE}/pipe?url=${encodeURIComponent(streamUrl)}`;

      const dl = FileSystem.createDownloadResumable(
        pipeUrl,
        cachePath,
        {},
        (progress) => {
          setState((s) => ({ ...s, bytesWritten: progress.totalBytesWritten }));
        },
      );
      downloadRef.current = dl;

      const now = Date.now();
      startTimeRef.current = now;

      setState({
        isRecording: true,
        isSaving: false,
        channelName: name,
        filePath: cachePath,
        fileName,
        bytesWritten: 0,
        elapsedMs: 0,
        startTime: now,
        error: null,
      });

      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          setState((s) => ({ ...s, elapsedMs: Date.now() - startTimeRef.current! }));
        }
      }, 1000);

      dl.downloadAsync().catch(() => {});
      return true;
    } catch (e: any) {
      setState((s) => ({ ...s, error: e?.message ?? "Impossible de démarrer l'enregistrement" }));
      return false;
    }
  }, []);

  const stop = useCallback(async (): Promise<string | null> => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startTimeRef.current = null;
    setState((s) => ({ ...s, isRecording: false, isSaving: true }));

    if (downloadRef.current) {
      try { await downloadRef.current.pauseAsync(); } catch {}
      downloadRef.current = null;
    }

    const cachePath = cacheFilePathRef.current;
    const fileName = fileNameRef.current;
    const targetFolder = deviceFolderRef.current;
    cacheFilePathRef.current = null;
    fileNameRef.current = null;

    let savedUri: string | null = null;

    if (cachePath && fileName) {
      try {
        const info = await FileSystem.getInfoAsync(cachePath);
        if (!info.exists || (info as any).size === 0) {
          setState((s) => ({ ...s, isSaving: false, error: "Le fichier est vide — le flux n'a peut-être pas démarré." }));
          return null;
        }

        let saved = false;

        if (Platform.OS === "android" && targetFolder) {
          try {
            const folderUri = "file://" + (targetFolder.endsWith("/") ? targetFolder : targetFolder + "/");
            await FileSystem.makeDirectoryAsync(folderUri, { intermediates: true });
            const destUri = folderUri + fileName;
            await FileSystem.copyAsync({ from: cachePath, to: destUri });
            savedUri = destUri;
            saved = true;
          } catch {
            saved = false;
          }
        }

        if (!saved) {
          const asset = await MediaLibrary.createAssetAsync(cachePath);
          try {
            let album = await MediaLibrary.getAlbumAsync("IPTV Recordings");
            if (!album) {
              album = await MediaLibrary.createAlbumAsync("IPTV Recordings", asset, false);
            } else {
              await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
            }
          } catch {}
          savedUri = asset.uri;
        }
      } catch (e: any) {
        setState((s) => ({ ...s, isSaving: false, error: e?.message ?? "Impossible de sauvegarder l'enregistrement" }));
        return null;
      } finally {
        try { await FileSystem.deleteAsync(cachePath, { idempotent: true }); } catch {}
      }
    }

    setState((s) => ({
      ...s,
      isSaving: false,
      filePath: null,
      fileName: null,
      bytesWritten: 0,
      elapsedMs: 0,
    }));
    return savedUri;
  }, []);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (downloadRef.current) {
        downloadRef.current.pauseAsync().catch(() => {});
        downloadRef.current = null;
      }
    };
  }, []);

  return (
    <DeviceRecordingContext.Provider value={{ ...state, start, stop, clearError }}>
      {children}
    </DeviceRecordingContext.Provider>
  );
}

export function useDeviceRecordingCtx() {
  const ctx = useContext(DeviceRecordingContext);
  if (!ctx) throw new Error("useDeviceRecordingCtx must be used within DeviceRecordingProvider");
  return ctx;
}
