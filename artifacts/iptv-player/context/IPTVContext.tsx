import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";

export type PlaylistType = "M3U" | "XtreamCodes" | "StalkerPortal";

export interface EPGProgram {
  title: string;
  description?: string;
  startTime: number;
  endTime: number;
}

export interface Channel {
  id: string;
  name: string;
  group: string;
  logo?: string;
  url: string;
  tvgId?: string;
  epg?: EPGProgram[];
}

export interface VODItem {
  id: string;
  name: string;
  category: string;
  logo?: string;
  url: string;
  description?: string;
  director?: string;
  actors?: string;
  year?: string;
  rating?: string;
  genres?: string;
  age?: string;
}

export interface Playlist {
  id: string;
  name: string;
  type: PlaylistType;
  url?: string;
  username?: string;
  password?: string;
  serverAddress?: string;
  macAddress?: string;
  stalkerToken?: string;
  channels: Channel[];
  movies: VODItem[];
  shows: VODItem[];
  lastUpdated: number;
}

export type Section = "TV" | "Movies" | "Shows" | "My List" | "Recordings" | "Search";

export type GroupSortOrder = "playlist" | "name-asc" | "name-desc";

export interface ReminderSettings {
  remindBeforeMinutes: number;
  popupTimeoutSecs: number;
  defaultAction: "watch" | "dismiss";
  wakeFromSleep: boolean;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  remindBeforeMinutes: 1,
  popupTimeoutSecs: 10,
  defaultAction: "watch",
  wakeFromSleep: false,
};

export interface RecordingSettings {
  recordingsFolder: string;
  deviceRecordingsFolder: string;
  startBeforeMinutes: number;
  stopAfterMinutes: number;
}

export const DEFAULT_RECORDING_SETTINGS: RecordingSettings = {
  recordingsFolder: "/storage/emulated/0/Download/TiviMate/Recordings",
  deviceRecordingsFolder: "",
  startBeforeMinutes: 0,
  stopAfterMinutes: 0,
};

export interface Recording {
  id: string;
  channelId: string;
  channelName: string;
  channelLogo?: string;
  channelGroup?: string;
  programTitle: string;
  programDescription?: string;
  startTime: number;
  endTime: number;
  url: string;
  createdAt: number;
}

export interface ScheduledCustomRecording {
  id: string;
  channelId: string;
  channelName: string;
  channelLogo?: string;
  startDate: string;
  startTime: string;
  durationHours: number;
  durationMinutes: number;
  repeat: "off" | "daily" | "weekly";
  name: string;
  createdAt: number;
}

export interface ProgramReminder {
  id: string;
  channelId: string;
  channelName: string;
  channelLogo?: string;
  programTitle: string;
  programDescription?: string;
  startTime: number;
  endTime: number;
  createdAt: number;
}

export interface WatchHistoryItem {
  channelId: string;
  channelName: string;
  channelGroup: string;
  channelLogo?: string;
  channelUrl: string;
  watchedAt: number;
  type?: "channel" | "movie" | "show";
}

interface IPTVContextValue {
  playlists: Playlist[];
  activePlaylist: Playlist | null;
  setActivePlaylist: (playlist: Playlist | null) => void;
  currentSection: Section;
  setCurrentSection: (section: Section) => void;
  selectedGroup: string | null;
  setSelectedGroup: (group: string | null) => void;
  selectedChannel: Channel | null;
  setSelectedChannel: (channel: Channel | null) => void;
  favorites: string[];
  toggleFavorite: (channelId: string) => void;
  blockedChannels: string[];
  toggleBlockChannel: (channelId: string) => void;
  hiddenChannels: string[];
  toggleHideChannel: (channelId: string) => void;
  hiddenGroups: string[];
  toggleHideGroup: (group: string) => void;
  favoritesOnlyGroups: string[];
  toggleFavoritesOnlyGroup: (group: string) => void;
  groupSortOrders: Record<string, GroupSortOrder>;
  setGroupSortOrder: (group: string, order: GroupSortOrder) => void;
  groupEpgOffsets: Record<string, number>;
  setGroupEpgOffset: (group: string, offset: number) => void;
  groupExternalPlayer: string[];
  toggleGroupExternalPlayer: (group: string) => void;
  reminderSettings: ReminderSettings;
  updateReminderSettings: (patch: Partial<ReminderSettings>) => void;
  recordingSettings: RecordingSettings;
  updateRecordingSettings: (patch: Partial<RecordingSettings>) => void;
  recordings: Recording[];
  scheduleRecording: (recording: Omit<Recording, "id" | "createdAt">) => void;
  cancelRecording: (id: string) => void;
  scheduledCustomRecordings: ScheduledCustomRecording[];
  addScheduledCustomRecording: (r: Omit<ScheduledCustomRecording, "id" | "createdAt">) => void;
  removeScheduledCustomRecording: (id: string) => void;
  programReminders: ProgramReminder[];
  addProgramReminder: (reminder: Omit<ProgramReminder, "id" | "createdAt">) => void;
  removeProgramReminder: (id: string) => void;
  watchHistory: WatchHistoryItem[];
  addToWatchHistory: (item: Omit<WatchHistoryItem, "watchedAt">) => void;
  clearWatchHistory: () => void;
  removeFromWatchHistory: (channelId: string) => void;
  addPlaylist: (playlist: Omit<Playlist, "id" | "channels" | "movies" | "shows" | "lastUpdated">) => Promise<void>;
  removePlaylist: (id: string) => void;
  resolveStalkerStreamUrl: (playlist: Playlist, stalkerUrl: string) => Promise<string>;
  stalkerEpgData: Record<string, EPGProgram[]>;
  stalkerEpgLoading: boolean;
  loadStalkerEPG: (playlist: Playlist) => Promise<void>;
  isLoading: boolean;
  loadingMessage: string;
  customProxyUrl: string;
  setCustomProxyUrl: (url: string) => void;
}

const IPTVContext = createContext<IPTVContextValue | null>(null);

function parseM3U(text: string): { channels: Channel[]; movies: VODItem[]; shows: VODItem[] } {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const channels: Channel[] = [];
  const movies: VODItem[] = [];
  const shows: VODItem[] = [];

  let currentMeta: Record<string, string> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("#EXTINF")) {
      currentMeta = {};
      const nameMatch = line.match(/,(.+)$/);
      if (nameMatch) currentMeta.name = nameMatch[1].trim();
      const groupMatch = line.match(/group-title="([^"]*)"/);
      if (groupMatch) currentMeta.group = groupMatch[1];
      const logoMatch = line.match(/tvg-logo="([^"]*)"/);
      if (logoMatch) currentMeta.logo = logoMatch[1];
      const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
      if (tvgIdMatch) currentMeta.tvgId = tvgIdMatch[1];
    } else if (line.startsWith("http") || line.startsWith("rtmp") || line.startsWith("rtsp")) {
      const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      const name = currentMeta.name || "Unknown";
      const group = currentMeta.group || "General";
      const url = line;

      const groupLower = group.toLowerCase();
      if (
        groupLower.includes("movie") ||
        groupLower.includes("film") ||
        groupLower.includes("vod")
      ) {
        movies.push({ id, name, category: group, logo: currentMeta.logo, url });
      } else if (
        groupLower.includes("serie") ||
        groupLower.includes("show") ||
        groupLower.includes("episode")
      ) {
        shows.push({ id, name, category: group, logo: currentMeta.logo, url });
      } else {
        channels.push({ id, name, group, logo: currentMeta.logo, url, tvgId: currentMeta.tvgId });
      }
      currentMeta = {};
    }
  }

  return { channels, movies, shows };
}

async function fetchXtreamCodes(
  serverAddress: string,
  username: string,
  password: string
): Promise<{ channels: Channel[]; movies: VODItem[]; shows: VODItem[] }> {
  const base = serverAddress.replace(/\/$/, "");
  const m3uUrl = `${base}/get.php?username=${username}&password=${password}&type=m3u_plus&output=ts`;
  let text: string;
  if (Platform.OS === "web") {
    const resp = await fetch(`${getProxyBase()}/m3u/proxy?url=${encodeURIComponent(m3uUrl)}`);
    if (!resp.ok) throw new Error(`Failed to fetch Xtream Codes playlist (${resp.status})`);
    text = await resp.text();
  } else {
    const response = await fetch(m3uUrl);
    if (!response.ok) throw new Error("Failed to fetch Xtream Codes playlist");
    text = await response.text();
  }
  return parseM3U(text);
}

function buildStalkerDirectUrl(portal: string, params: Record<string, string>): string {
  const base = portal.replace(/\/+$/, "");
  const qs = new URLSearchParams({ ...params, JsHttpRequest: "1-xml" });
  return `${base}/server/load.php?${qs}`;
}

function stalkerMagHeaders(mac: string, token?: string): Record<string, string> {
  const h: Record<string, string> = {
    Cookie: `mac=${mac}; stb_lang=en; timezone=America%2FNew_York`,
    "X-User-Agent": "Model: MAG250; Link: WiFi",
    "User-Agent": "Mozilla/5.0 (QtEmbedded; U; Linux; C)",
    Accept: "application/json",
  };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

// Module-level proxy base — updated from AsyncStorage on app load and from settings.
// Using a module-level mutable means all callers (stalkerCall, addPlaylist, etc.)
// automatically pick up the user's custom URL without needing context threading.
let _proxyBaseOverride: string | null = null;

export function setGlobalProxyBase(url: string | null) {
  _proxyBaseOverride = url && url.trim() ? url.trim().replace(/\/+$/, "") : null;
}

export function getGlobalProxyBase(): string {
  if (_proxyBaseOverride) return _proxyBaseOverride;
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}/api` : "/api";
}

function getProxyBase(): string {
  return getGlobalProxyBase();
}

async function stalkerCall(
  portal: string,
  mac: string,
  token: string | undefined,
  params: Record<string, string>
): Promise<any> {
  if (Platform.OS !== "web") {
    // On native (Android/iOS) there is no CORS restriction — call the portal directly
    // with the proper MAG STB headers, exactly as the Express proxy does.
    const url = buildStalkerDirectUrl(portal, params);
    const resp = await fetch(url, {
      headers: stalkerMagHeaders(mac, token),
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) throw new Error(`Stalker portal error: ${resp.status}`);
    const text = await resp.text();
    if (!text.trim()) return { js: null };
    try {
      return JSON.parse(text);
    } catch {
      return { js: null };
    }
  }

  // On web, CORS blocks direct portal calls — route through the Express proxy.
  const qs = new URLSearchParams({ portal, mac, ...(token ? { token } : {}), ...params });
  const resp = await fetch(`${getProxyBase()}/stalker/proxy?${qs}`);
  if (!resp.ok) throw new Error(`Stalker proxy error: ${resp.status}`);
  return resp.json();
}

async function fetchStalkerPortal(
  portal: string,
  mac: string,
  onProgress: (msg: string) => void
): Promise<{ channels: Channel[]; movies: VODItem[]; shows: VODItem[]; token: string }> {
  const BATCH = 15;

  onProgress("Authenticating with portal...");
  const hsData = await stalkerCall(portal, mac, undefined, { type: "stb", action: "handshake" });
  const token: string = hsData?.js?.token;
  if (!token) throw new Error("Handshake failed — could not get token from portal");

  const call = (params: Record<string, string>) => stalkerCall(portal, mac, token, params);

  onProgress("Fetching channel categories...");
  const genresData = await call({ type: "itv", action: "get_genres" });
  const genres: Array<{ id: string; title: string }> = genresData?.js || [];
  const genreMap: Record<string, string> = {};
  for (const g of genres) genreMap[g.id] = g.title;

  onProgress("Fetching channels...");
  const firstChPage = await call({ type: "itv", action: "get_ordered_list", genre: "*", sortby: "number", p: "1" });
  const totalChannels = parseInt(firstChPage?.js?.total_items || "0", 10);
  const chPerPage = (firstChPage?.js?.data || []).length || 14;
  const totalChPages = Math.ceil(totalChannels / chPerPage);

  let allChRaw: any[] = [...(firstChPage?.js?.data || [])];

  for (let b = 2; b <= totalChPages; b += BATCH) {
    const end = Math.min(b + BATCH - 1, totalChPages);
    onProgress(`Loading channels (${allChRaw.length}/${totalChannels})...`);
    const pages = await Promise.all(
      Array.from({ length: end - b + 1 }, (_, i) =>
        call({ type: "itv", action: "get_ordered_list", genre: "*", sortby: "number", p: String(b + i) })
          .then((r: any) => r?.js?.data || [])
          .catch(() => [])
      )
    );
    for (const p of pages) allChRaw = allChRaw.concat(p);
  }

  const channels: Channel[] = allChRaw.map((ch: any) => {
    const rawCmd: string = ch?.cmds?.[0]?.url || ch?.cmd || "";
    return {
      id: String(ch.id),
      name: ch.name || "Unknown",
      group: genreMap[ch.tv_genre_id] || "General",
      logo: ch.logo || undefined,
      url: `stalker-cmd:${rawCmd}`,
      tvgId: ch.xmltv_id || undefined,
    };
  });

  onProgress("Fetching movies...");
  const vodCatsData = await call({ type: "vod", action: "get_categories" });
  const vodCats: Array<{ id: string; title: string }> = (vodCatsData?.js || []).filter((c: any) => c.id !== "*");
  const vodCatMap: Record<string, string> = {};
  for (const c of vodCats) vodCatMap[c.id] = c.title;

  const vodPage1 = await call({ type: "vod", action: "get_ordered_list", sortby: "name", p: "1", category: "*" });
  const totalVod = parseInt(vodPage1?.js?.total_items || "0", 10);
  const vodPerPage = (vodPage1?.js?.data || []).length || 14;
  const totalVodPages = Math.min(Math.ceil(totalVod / vodPerPage), 50);

  let allVodRaw: any[] = [...(vodPage1?.js?.data || [])];
  for (let b = 2; b <= totalVodPages; b += BATCH) {
    const end = Math.min(b + BATCH - 1, totalVodPages);
    onProgress(`Loading movies (${allVodRaw.length}/${totalVod})...`);
    const pages = await Promise.all(
      Array.from({ length: end - b + 1 }, (_, i) =>
        call({ type: "vod", action: "get_ordered_list", sortby: "name", p: String(b + i), category: "*" })
          .then((r: any) => r?.js?.data || [])
          .catch(() => [])
      )
    );
    for (const p of pages) allVodRaw = allVodRaw.concat(p);
  }

  const movies: VODItem[] = allVodRaw.map((v: any) => ({
    id: String(v.id),
    name: v.name || v.o_name || "Unknown",
    category: vodCatMap[String(v.category_id)] || "General",
    logo: v.screenshot_uri || v.cover || v.pic || undefined,
    url: `stalker-vod:${v.id}`,
    description: v.description || undefined,
    director: v.director || undefined,
    actors: v.actors || undefined,
    year: v.year ? String(v.year).slice(0, 4) : undefined,
    rating: v.rating_imdb && v.rating_imdb !== "N/A" ? String(v.rating_imdb) : undefined,
    genres: v.genres_str || undefined,
    age: v.age || undefined,
  }));

  onProgress("Fetching series...");
  const serCatsData = await call({ type: "series", action: "get_categories" });
  const serCats: Array<{ id: string; title: string }> = (serCatsData?.js || []).filter((c: any) => c.id !== "*");
  const serCatMap: Record<string, string> = {};
  for (const c of serCats) serCatMap[c.id] = c.title;

  const serPage1 = await call({ type: "series", action: "get_ordered_list", sortby: "name", p: "1", category: "*" });
  const totalSer = parseInt(serPage1?.js?.total_items || "0", 10);
  const serPerPage = (serPage1?.js?.data || []).length || 14;
  const totalSerPages = Math.min(Math.ceil(totalSer / serPerPage), 30);

  let allSerRaw: any[] = [...(serPage1?.js?.data || [])];
  for (let b = 2; b <= totalSerPages; b += BATCH) {
    const end = Math.min(b + BATCH - 1, totalSerPages);
    onProgress(`Loading series (${allSerRaw.length}/${totalSer})...`);
    const pages = await Promise.all(
      Array.from({ length: end - b + 1 }, (_, i) =>
        call({ type: "series", action: "get_ordered_list", sortby: "name", p: String(b + i), category: "*" })
          .then((r: any) => r?.js?.data || [])
          .catch(() => [])
      )
    );
    for (const p of pages) allSerRaw = allSerRaw.concat(p);
  }

  const shows: VODItem[] = allSerRaw.map((s: any) => ({
    id: String(s.id),
    name: s.name || s.o_name || "Unknown",
    category: serCatMap[String(s.category_id)] || "General",
    logo: s.screenshot_uri || s.cover || s.poster || undefined,
    url: `stalker-series:${s.id}`,
    description: s.description || undefined,
    director: s.director || undefined,
    actors: s.actors || undefined,
    year: s.year ? String(s.year).slice(0, 4) : undefined,
    rating: s.rating_imdb && s.rating_imdb !== "N/A" ? String(s.rating_imdb) : undefined,
    genres: s.genres_str || undefined,
    age: s.age || undefined,
  }));

  return { channels, movies, shows, token };
}

export function IPTVProvider({ children }: { children: React.ReactNode }) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activePlaylist, setActivePlaylistState] = useState<Playlist | null>(null);
  const [currentSection, setCurrentSection] = useState<Section>("TV");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [blockedChannels, setBlockedChannels] = useState<string[]>([]);
  const [hiddenChannels, setHiddenChannels] = useState<string[]>([]);
  const [hiddenGroups, setHiddenGroups] = useState<string[]>([]);
  const [favoritesOnlyGroups, setFavoritesOnlyGroups] = useState<string[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [scheduledCustomRecordings, setScheduledCustomRecordings] = useState<ScheduledCustomRecording[]>([]);
  const [programReminders, setProgramReminders] = useState<ProgramReminder[]>([]);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>([]);
  const [groupSortOrders, setGroupSortOrdersState] = useState<Record<string, GroupSortOrder>>({});
  const [groupEpgOffsets, setGroupEpgOffsetsState] = useState<Record<string, number>>({});
  const [groupExternalPlayer, setGroupExternalPlayer] = useState<string[]>([]);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
  const [recordingSettings, setRecordingSettings] = useState<RecordingSettings>(DEFAULT_RECORDING_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [customProxyUrl, setCustomProxyUrlState] = useState("");
  const [stalkerEpgData, setStalkerEpgData] = useState<Record<string, EPGProgram[]>>({});
  const [stalkerEpgLoading, setStalkerEpgLoading] = useState(false);
  const stalkerEpgPlaylistId = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem("playlists");
        if (stored) {
          const parsed = JSON.parse(stored) as Playlist[];
          setPlaylists(parsed);
          if (parsed.length > 0) setActivePlaylistState(parsed[0]);
        }
        const favs = await AsyncStorage.getItem("favorites");
        if (favs) setFavorites(JSON.parse(favs));
        const blocked = await AsyncStorage.getItem("blockedChannels");
        if (blocked) setBlockedChannels(JSON.parse(blocked));
        const hidden = await AsyncStorage.getItem("hiddenChannels");
        if (hidden) setHiddenChannels(JSON.parse(hidden));
        const hiddenGrps = await AsyncStorage.getItem("hiddenGroups");
        if (hiddenGrps) setHiddenGroups(JSON.parse(hiddenGrps));
        const favOnly = await AsyncStorage.getItem("favoritesOnlyGroups");
        if (favOnly) setFavoritesOnlyGroups(JSON.parse(favOnly));
        const recs = await AsyncStorage.getItem("recordings");
        if (recs) setRecordings(JSON.parse(recs));
        const schedRecs = await AsyncStorage.getItem("scheduledCustomRecordings");
        if (schedRecs) setScheduledCustomRecordings(JSON.parse(schedRecs));
        const progRems = await AsyncStorage.getItem("programReminders");
        if (progRems) setProgramReminders(JSON.parse(progRems));
        const hist = await AsyncStorage.getItem("watchHistory");
        if (hist) setWatchHistory(JSON.parse(hist));
        const sortOrders = await AsyncStorage.getItem("groupSortOrders");
        if (sortOrders) setGroupSortOrdersState(JSON.parse(sortOrders));
        const epgOffsets = await AsyncStorage.getItem("groupEpgOffsets");
        if (epgOffsets) setGroupEpgOffsetsState(JSON.parse(epgOffsets));
        const extPlayer = await AsyncStorage.getItem("groupExternalPlayer");
        if (extPlayer) setGroupExternalPlayer(JSON.parse(extPlayer));
        const remSettings = await AsyncStorage.getItem("reminderSettings");
        if (remSettings) setReminderSettings({ ...DEFAULT_REMINDER_SETTINGS, ...JSON.parse(remSettings) });
        const recSettings = await AsyncStorage.getItem("recordingSettings");
        if (recSettings) setRecordingSettings({ ...DEFAULT_RECORDING_SETTINGS, ...JSON.parse(recSettings) });
        const proxyUrl = await AsyncStorage.getItem("customProxyUrl");
        if (proxyUrl) {
          setCustomProxyUrlState(proxyUrl);
          setGlobalProxyBase(proxyUrl);
        }
      } catch {}
    })();
  }, []);

  const setCustomProxyUrl = useCallback((url: string) => {
    const trimmed = url.trim();
    setCustomProxyUrlState(trimmed);
    setGlobalProxyBase(trimmed || null);
    AsyncStorage.setItem("customProxyUrl", trimmed);
  }, []);

  const setActivePlaylist = useCallback((playlist: Playlist | null) => {
    setActivePlaylistState(playlist);
    setSelectedGroup(null);
    setSelectedChannel(null);
  }, []);

  const toggleFavorite = useCallback(async (channelId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId];
      AsyncStorage.setItem("favorites", JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleBlockChannel = useCallback(async (channelId: string) => {
    setBlockedChannels((prev) => {
      const next = prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId];
      AsyncStorage.setItem("blockedChannels", JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleHideChannel = useCallback(async (channelId: string) => {
    setHiddenChannels((prev) => {
      const next = prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId];
      AsyncStorage.setItem("hiddenChannels", JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleHideGroup = useCallback(async (group: string) => {
    setHiddenGroups((prev) => {
      const next = prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group];
      AsyncStorage.setItem("hiddenGroups", JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleFavoritesOnlyGroup = useCallback(async (group: string) => {
    setFavoritesOnlyGroups((prev) => {
      const next = prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group];
      AsyncStorage.setItem("favoritesOnlyGroups", JSON.stringify(next));
      return next;
    });
  }, []);

  const setGroupSortOrder = useCallback((group: string, order: GroupSortOrder) => {
    setGroupSortOrdersState((prev) => {
      const next = { ...prev, [group]: order };
      AsyncStorage.setItem("groupSortOrders", JSON.stringify(next));
      return next;
    });
  }, []);

  const setGroupEpgOffset = useCallback((group: string, offset: number) => {
    setGroupEpgOffsetsState((prev) => {
      const next = { ...prev, [group]: offset };
      AsyncStorage.setItem("groupEpgOffsets", JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleGroupExternalPlayer = useCallback((group: string) => {
    setGroupExternalPlayer((prev) => {
      const next = prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group];
      AsyncStorage.setItem("groupExternalPlayer", JSON.stringify(next));
      return next;
    });
  }, []);

  const updateReminderSettings = useCallback((patch: Partial<ReminderSettings>) => {
    setReminderSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem("reminderSettings", JSON.stringify(next));
      return next;
    });
  }, []);

  const updateRecordingSettings = useCallback((patch: Partial<RecordingSettings>) => {
    setRecordingSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem("recordingSettings", JSON.stringify(next));
      return next;
    });
  }, []);

  const scheduleRecording = useCallback((recording: Omit<Recording, "id" | "createdAt">) => {
    setRecordings((prev) => {
      const next = [
        ...prev,
        { ...recording, id: Date.now().toString() + Math.random().toString(36).substr(2, 6), createdAt: Date.now() },
      ];
      AsyncStorage.setItem("recordings", JSON.stringify(next));
      return next;
    });
  }, []);

  const cancelRecording = useCallback((id: string) => {
    setRecordings((prev) => {
      const next = prev.filter((r) => r.id !== id);
      AsyncStorage.setItem("recordings", JSON.stringify(next));
      return next;
    });
  }, []);

  const addScheduledCustomRecording = useCallback((r: Omit<ScheduledCustomRecording, "id" | "createdAt">) => {
    setScheduledCustomRecordings((prev) => {
      const next = [
        ...prev,
        { ...r, id: Date.now().toString() + Math.random().toString(36).substr(2, 6), createdAt: Date.now() },
      ];
      AsyncStorage.setItem("scheduledCustomRecordings", JSON.stringify(next));
      return next;
    });
  }, []);

  const removeScheduledCustomRecording = useCallback((id: string) => {
    setScheduledCustomRecordings((prev) => {
      const next = prev.filter((r) => r.id !== id);
      AsyncStorage.setItem("scheduledCustomRecordings", JSON.stringify(next));
      return next;
    });
  }, []);

  const addProgramReminder = useCallback((reminder: Omit<ProgramReminder, "id" | "createdAt">) => {
    setProgramReminders((prev) => {
      const exists = prev.some((r) => r.channelId === reminder.channelId && r.startTime === reminder.startTime);
      if (exists) return prev;
      const next = [
        ...prev,
        { ...reminder, id: Date.now().toString() + Math.random().toString(36).substr(2, 6), createdAt: Date.now() },
      ];
      AsyncStorage.setItem("programReminders", JSON.stringify(next));
      return next;
    });
  }, []);

  const removeProgramReminder = useCallback((id: string) => {
    setProgramReminders((prev) => {
      const next = prev.filter((r) => r.id !== id);
      AsyncStorage.setItem("programReminders", JSON.stringify(next));
      return next;
    });
  }, []);

  const addToWatchHistory = useCallback((item: Omit<WatchHistoryItem, "watchedAt">) => {
    setWatchHistory((prev) => {
      const filtered = prev.filter((h) => h.channelId !== item.channelId);
      const next = [{ ...item, watchedAt: Date.now() }, ...filtered].slice(0, 50);
      AsyncStorage.setItem("watchHistory", JSON.stringify(next));
      return next;
    });
  }, []);

  const clearWatchHistory = useCallback(() => {
    setWatchHistory([]);
    AsyncStorage.removeItem("watchHistory");
  }, []);

  const removeFromWatchHistory = useCallback((channelId: string) => {
    setWatchHistory((prev) => {
      const next = prev.filter((h) => h.channelId !== channelId);
      AsyncStorage.setItem("watchHistory", JSON.stringify(next));
      return next;
    });
  }, []);

  const resolveStalkerStreamUrl = useCallback(async (playlist: Playlist, stalkerUrl: string): Promise<string> => {
    if (!playlist.serverAddress || !playlist.macAddress) {
      throw new Error("Invalid Stalker playlist configuration");
    }

    let token = playlist.stalkerToken;
    if (!token) {
      const hsData = await stalkerCall(playlist.serverAddress, playlist.macAddress, undefined, {
        type: "stb",
        action: "handshake",
      });
      token = hsData?.js?.token;
      if (!token) throw new Error("Could not authenticate with Stalker portal");
      setPlaylists((prev) => {
        const next = prev.map((p) => (p.id === playlist.id ? { ...p, stalkerToken: token } : p));
        AsyncStorage.setItem("playlists", JSON.stringify(next));
        return next;
      });
    }

    const call = (params: Record<string, string>) =>
      stalkerCall(playlist.serverAddress!, playlist.macAddress!, token, params);

    if (stalkerUrl.startsWith("stalker-cmd:")) {
      const cmd = stalkerUrl.replace("stalker-cmd:", "");
      const resp = await call({
        type: "itv",
        action: "create_link",
        cmd,
        forced_storage: "undefined",
        disable_ad: "0",
        download: "0",
      });
      const resultCmd: string = resp?.js?.cmd || "";
      const streamUrl = resultCmd.replace(/^ffmpeg\s+/, "").trim();
      if (!streamUrl) throw new Error("Portal returned no stream URL");
      return streamUrl;
    }

    if (stalkerUrl.startsWith("stalker-vod:")) {
      const movieId = stalkerUrl.replace("stalker-vod:", "");
      const resp = await call({
        type: "vod",
        action: "create_link",
        cmd: "ffmpeg ",
        series: "",
        forced_storage: "",
        download: "0",
        movie_id: movieId,
      });
      const resultCmd: string = resp?.js?.cmd || "";
      const streamUrl = resultCmd.replace(/^ffmpeg\s+/, "").trim();
      if (!streamUrl) throw new Error("Portal returned no VOD stream URL");
      return streamUrl;
    }

    if (stalkerUrl.startsWith("stalker-series:")) {
      // Series IDs are stored as "38:38" — VOD create_link needs just the numeric part
      const rawId = stalkerUrl.replace("stalker-series:", "").split(":")[0];
      const resp = await call({
        type: "vod",
        action: "create_link",
        cmd: "ffmpeg ",
        series: "",
        forced_storage: "",
        download: "0",
        movie_id: rawId,
      });
      const resultCmd: string = resp?.js?.cmd || "";
      const streamUrl = resultCmd.replace(/^ffmpeg\s+/, "").trim();
      if (!streamUrl) throw new Error("Portal returned no series stream URL");
      return streamUrl;
    }

    if (stalkerUrl.startsWith("stalker-episode:")) {
      // Format: stalker-episode:{seriesId}:{episodeSeq}
      const rest = stalkerUrl.replace("stalker-episode:", "");
      const colonIdx = rest.indexOf(":");
      const seriesId = colonIdx >= 0 ? rest.slice(0, colonIdx) : rest;
      const episodeSeq = colonIdx >= 0 ? rest.slice(colonIdx + 1) : "1";
      const resp = await call({
        type: "vod",
        action: "create_link",
        cmd: "ffmpeg ",
        series: episodeSeq,
        forced_storage: "",
        download: "0",
        movie_id: seriesId,
      });
      const resultCmd: string = resp?.js?.cmd || "";
      const streamUrl = resultCmd.replace(/^ffmpeg\s+/, "").trim();
      if (!streamUrl) throw new Error("Portal returned no episode stream URL");
      return streamUrl;
    }

    throw new Error(`Unknown Stalker URL scheme: ${stalkerUrl}`);
  }, []);

  const loadStalkerEPG = useCallback(async (playlist: Playlist) => {
    if (!playlist.serverAddress || !playlist.macAddress) return;
    if (stalkerEpgPlaylistId.current === playlist.id && !stalkerEpgLoading) return;
    if (stalkerEpgLoading) return;

    stalkerEpgPlaylistId.current = playlist.id;
    setStalkerEpgLoading(true);

    try {
      let token = playlist.stalkerToken;
      if (!token) {
        const hsData = await stalkerCall(playlist.serverAddress, playlist.macAddress, undefined, {
          type: "stb",
          action: "handshake",
        });
        token = hsData?.js?.token;
        if (!token) return;
      }

      const call = (params: Record<string, string>) =>
        stalkerCall(playlist.serverAddress!, playlist.macAddress!, token, params);

      // Fetch EPG for all 6 day offsets: [-2,-1, today, +1, +2, +3]
      // Stalker period: 1=today, 2=tomorrow, -1=yesterday, etc.
      const periods = [-2, -1, 1, 2, 3, 4];
      const results = await Promise.allSettled(
        periods.map((p) =>
          call({ type: "itv", action: "get_epg_info", period: String(p), ch_id: "0" })
        )
      );

      const merged: Record<string, EPGProgram[]> = {};
      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        const data: Record<string, any[]> = result.value?.js?.data || {};
        for (const [chId, programs] of Object.entries(data)) {
          if (!merged[chId]) merged[chId] = [];
          for (const p of programs as any[]) {
            if (!p.start_timestamp || !p.stop_timestamp) continue;
            merged[chId].push({
              title: p.name || "Unknown",
              description: p.descr || undefined,
              startTime: p.start_timestamp * 1000,
              endTime: p.stop_timestamp * 1000,
            });
          }
        }
      }

      // Deduplicate and sort each channel's programs by start time
      for (const chId of Object.keys(merged)) {
        const seen = new Set<number>();
        merged[chId] = merged[chId]
          .filter((p) => {
            if (seen.has(p.startTime)) return false;
            seen.add(p.startTime);
            return true;
          })
          .sort((a, b) => a.startTime - b.startTime);
      }

      setStalkerEpgData(merged);
    } catch {
      // EPG is non-critical; silently fail
    } finally {
      setStalkerEpgLoading(false);
    }
  }, [stalkerEpgLoading]);

  const addPlaylist = useCallback(
    async (data: Omit<Playlist, "id" | "channels" | "movies" | "shows" | "lastUpdated">) => {
      setIsLoading(true);
      setLoadingMessage("Connecting to server...");
      try {
        let channels: Channel[] = [];
        let movies: VODItem[] = [];
        let shows: VODItem[] = [];
        let stalkerToken: string | undefined;

        if (data.type === "M3U") {
          setLoadingMessage("Fetching playlist...");
          let m3uText: string;
          if (Platform.OS === "web") {
            const resp = await fetch(`${getProxyBase()}/m3u/proxy?url=${encodeURIComponent(data.url!)}`);
            if (!resp.ok) throw new Error(`Failed to fetch M3U playlist (${resp.status})`);
            m3uText = await resp.text();
          } else {
            const response = await fetch(data.url!);
            if (!response.ok) throw new Error("Failed to fetch M3U");
            m3uText = await response.text();
          }
          setLoadingMessage("Processing channels...");
          const parsed = parseM3U(m3uText);
          channels = parsed.channels;
          movies = parsed.movies;
          shows = parsed.shows;
        } else if (data.type === "XtreamCodes") {
          setLoadingMessage("Fetching channels...");
          const parsed = await fetchXtreamCodes(data.serverAddress!, data.username!, data.password!);
          channels = parsed.channels;
          movies = parsed.movies;
          shows = parsed.shows;
        } else if (data.type === "StalkerPortal") {
          const result = await fetchStalkerPortal(
            data.serverAddress!,
            data.macAddress!,
            (msg) => setLoadingMessage(msg)
          );
          channels = result.channels;
          movies = result.movies;
          shows = result.shows;
          stalkerToken = result.token;
        }

        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        const playlist: Playlist = {
          ...data,
          id,
          channels,
          movies,
          shows,
          stalkerToken,
          lastUpdated: Date.now(),
        };

        setPlaylists((prev) => {
          const next = [...prev, playlist];
          AsyncStorage.setItem("playlists", JSON.stringify(next));
          return next;
        });
        setActivePlaylistState(playlist);
        setSelectedGroup(null);
        setSelectedChannel(null);
      } finally {
        setIsLoading(false);
        setLoadingMessage("");
      }
    },
    []
  );

  const removePlaylist = useCallback((id: string) => {
    setPlaylists((prev) => {
      const next = prev.filter((p) => p.id !== id);
      AsyncStorage.setItem("playlists", JSON.stringify(next));
      if (activePlaylist?.id === id) {
        setActivePlaylistState(next[0] ?? null);
      }
      return next;
    });
  }, [activePlaylist]);

  return (
    <IPTVContext.Provider
      value={{
        playlists,
        activePlaylist,
        setActivePlaylist,
        currentSection,
        setCurrentSection,
        selectedGroup,
        setSelectedGroup,
        selectedChannel,
        setSelectedChannel,
        favorites,
        toggleFavorite,
        blockedChannels,
        toggleBlockChannel,
        hiddenChannels,
        toggleHideChannel,
        hiddenGroups,
        toggleHideGroup,
        favoritesOnlyGroups,
        toggleFavoritesOnlyGroup,
        groupSortOrders,
        setGroupSortOrder,
        groupEpgOffsets,
        setGroupEpgOffset,
        groupExternalPlayer,
        toggleGroupExternalPlayer,
        reminderSettings,
        updateReminderSettings,
        recordingSettings,
        updateRecordingSettings,
        recordings,
        scheduleRecording,
        cancelRecording,
        scheduledCustomRecordings,
        addScheduledCustomRecording,
        removeScheduledCustomRecording,
        programReminders,
        addProgramReminder,
        removeProgramReminder,
        watchHistory,
        addToWatchHistory,
        clearWatchHistory,
        removeFromWatchHistory,
        addPlaylist,
        removePlaylist,
        resolveStalkerStreamUrl,
        stalkerEpgData,
        stalkerEpgLoading,
        loadStalkerEPG,
        isLoading,
        loadingMessage,
        customProxyUrl,
        setCustomProxyUrl,
      }}
    >
      {children}
    </IPTVContext.Provider>
  );
}

export function useIPTV() {
  const ctx = useContext(IPTVContext);
  if (!ctx) throw new Error("useIPTV must be used within IPTVProvider");
  return ctx;
}
