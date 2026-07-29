export interface AvatarOption {
  id: string;
  label: string;
  emoji: string;
  bg: string;
}

export const AVATARS: AvatarOption[] = [
  { id: "avatar1", label: "Fox", emoji: "🦊", bg: "#FF6B35" },
  { id: "avatar2", label: "Bear", emoji: "🐻", bg: "#8B6F47" },
  { id: "avatar3", label: "Owl", emoji: "🦉", bg: "#4A4E69" },
  { id: "avatar4", label: "Cat", emoji: "🐱", bg: "#F72585" },
  { id: "avatar5", label: "Wolf", emoji: "🐺", bg: "#560BAD" },
  { id: "avatar6", label: "Hawk", emoji: "🦅", bg: "#023E8A" },
  { id: "avatar7", label: "Panda", emoji: "🐼", bg: "#2D6A4F" },
  { id: "avatar8", label: "Lion", emoji: "🦁", bg: "#D4A017" },
  { id: "avatar9", label: "Dragon", emoji: "🐉", bg: "#C1121F" },
  { id: "avatar10", label: "Phoenix", emoji: "🦅", bg: "#E85D04" },
  { id: "avatar11", label: "Shark", emoji: "🦈", bg: "#0077B6" },
  { id: "avatar12", label: "Tiger", emoji: "🐯", bg: "#F77F00" },
];

export function getAvatar(id: string): AvatarOption {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}