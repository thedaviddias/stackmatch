# Stackmatch Design System: Neon & Ghost Mode

This document outlines the design tokens, component patterns, and aesthetic principles for Stackmatch.

## 1. Aesthetic: Ghost Mode
Ghost Mode is our signature aesthetic: high-density, technical, light, and fast.

- **Whitespace > Borders**: Use negative space for grouping. Borders should be `border-white/5` or `border-neutral-800`.
- **Glassmorphism**: Use the `.glass-panel` class for elevated surfaces.
- **Subtle Feedback**: Use `group-hover:shadow-[0_8px_30px_rgba(var(--theme-hover-glow),0.15)]` for interactive elements.

## 2. Color Palette & Themes
Stackmatch supports multiple themes, with **Neon** being the default.

### Neon (Default)
- **Accent 1 (Pink/Red)**: `#FF4B4B` | `bg-th-accent-1` | `text-th-accent-1-text`
- **Accent 2 (Purple)**: `#A855F7` | `bg-th-accent-2` | `text-th-accent-2-text`
- **Accent 3 (Indigo)**: `#6366F1` | `bg-th-accent-3`

### Tokens Usage
Always use theme tokens instead of hardcoded hex values to ensure theme compatibility:
- `bg-th-accent-1`: Primary action/status color.
- `bg-th-gradient-from` / `via` / `to`: For theme-aware gradients.
- `var(--theme-hover-border)`: For hover states.

## 3. Typography
- **Headings**: `font-black tracking-tighter` (Weight 900).
- **Labels/Caps**: `font-black uppercase tracking-widest text-[9px]` (The "Ghost Label" pattern).
- **Body**: `font-medium` (Geist Sans).

## 4. Component Patterns

### The "Ghost Card"
```tsx
<div className="group relative overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950/50 backdrop-blur-xl transition-all hover:border-[var(--theme-hover-border)] hover:bg-neutral-900/80">
  {/* Content */}
</div>
```

### The "Neon Gradient Text"
```tsx
<h3 className="transition-colors group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-th-gradient-from group-hover:to-th-gradient-via">
  {title}
</h3>
```

### Stat Badges
- Small, high-contrast badges for technical data.
- Use `tabular-nums` for numbers.
