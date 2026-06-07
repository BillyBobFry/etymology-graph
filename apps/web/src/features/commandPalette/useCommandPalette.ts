import { onBeforeUnmount, onMounted, ref } from "vue";

/** Owns the global Cmd/Ctrl+K shortcut without spreading document listeners through the app. */
export const useCommandPalette = () => {
  const isCommandPaletteOpen = ref(false);

  /** Opens the palette from visible controls or the global shortcut. */
  const openCommandPalette = (): void => {
    isCommandPaletteOpen.value = true;
  };

  /** Closes the palette after selection, escape, or backdrop interaction. */
  const closeCommandPalette = (): void => {
    isCommandPaletteOpen.value = false;
  };

  /** Keeps external v-model usage aligned with the global shortcut state. */
  const setCommandPaletteOpen = (isOpen: boolean): void => {
    isCommandPaletteOpen.value = isOpen;
  };

  /** Maps the common command-menu shortcut while leaving normal typing alone. */
  const handleGlobalKeydown = (event: KeyboardEvent): void => {
    const isPaletteShortcut = event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);

    if (!isPaletteShortcut || event.repeat) {
      return;
    }

    event.preventDefault();
    isCommandPaletteOpen.value = !isCommandPaletteOpen.value;
  };

  onMounted(() => {
    window.addEventListener("keydown", handleGlobalKeydown);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("keydown", handleGlobalKeydown);
  });

  return {
    isCommandPaletteOpen,
    openCommandPalette,
    closeCommandPalette,
    setCommandPaletteOpen
  };
};
