import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { usePiP } from "@/context/PiPContext";
import { useColors } from "@/hooks/useColors";

const PIP_W = 200;
const PIP_H = 120;
const MARGIN = 12;

export function FloatingPiPPlayer() {
  const { pip, stopPiP } = usePiP();
  const colors = useColors();
  const router = useRouter();

  const { width: screenW, height: screenH } = Dimensions.get("window");

  const initX = screenW - PIP_W - MARGIN;
  const initY = MARGIN + (Platform.OS === "web" ? 72 : 80);

  const posRef = useRef({ x: initX, y: initY });
  const [pos, setPos] = useState({ x: initX, y: initY });
  const isDragging = useRef(false);

  const player = useVideoPlayer(
    pip ? { uri: pip.url } : null,
    (p) => { p.play(); }
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4,
      onPanResponderGrant: () => {
        isDragging.current = false;
      },
      onPanResponderMove: (_, gs) => {
        if (Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4) {
          isDragging.current = true;
        }
        const newX = Math.max(0, Math.min(screenW - PIP_W, posRef.current.x + gs.dx));
        const newY = Math.max(0, Math.min(screenH - PIP_H - 40, posRef.current.y + gs.dy));
        setPos({ x: newX, y: newY });
      },
      onPanResponderRelease: (_, gs) => {
        const finalX = Math.max(0, Math.min(screenW - PIP_W, posRef.current.x + gs.dx));
        const finalY = Math.max(0, Math.min(screenH - PIP_H - 40, posRef.current.y + gs.dy));

        if (!isDragging.current) {
          return;
        }
        posRef.current = { x: finalX, y: finalY };
        setPos({ x: finalX, y: finalY });
      },
    })
  ).current;

  if (!pip) return null;

  const handleTap = () => {
    if (isDragging.current) return;
    Haptics.selectionAsync();
    stopPiP();
    router.push({
      pathname: "/player",
      params: { url: pip.url, name: pip.name, channelId: pip.channelId ?? "" },
    });
  };

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      exiting={FadeOut.duration(200)}
      style={[
        styles.container,
        {
          left: pos.x,
          top: pos.y,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.5,
          shadowRadius: 10,
          elevation: 20,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        onPress={handleTap}
        activeOpacity={0.9}
      >
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
        />

        <View style={styles.bottomOverlay}>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveTxt}>LIVE</Text>
          </View>
          <Text style={styles.channelName} numberOfLines={1}>
            {pip.name}
          </Text>
        </View>

        <View style={styles.expandHint}>
          <Feather name="maximize-2" size={12} color="rgba(255,255,255,0.7)" />
        </View>
      </TouchableOpacity>

      <View style={styles.topBar} pointerEvents="none">
        <View style={styles.dragHandle} />
      </View>

      <TouchableOpacity
        style={[styles.closeBtn, { backgroundColor: "rgba(0,0,0,0.75)" }]}
        onPress={() => {
          Haptics.selectionAsync();
          stopPiP();
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Feather name="x" size={12} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    width: PIP_W,
    height: PIP_H,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#000",
    zIndex: 9999,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  dragHandle: {
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.35)",
    marginTop: 4,
  },
  bottomOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 1,
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#f44336",
  },
  liveTxt: {
    color: "#f44336",
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  channelName: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  expandHint: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 4,
    padding: 3,
  },
  closeBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
});
