/**
 * @stackmatch/ui — shared UI primitives
 *
 * Generic, reusable components with zero app-specific dependencies.
 * Feature-specific components (StarButton, PrivateRepoCard, etc.) stay
 * in the app's components/ directory.
 */

export { Badge } from "./badge";
export { ButtonCustom } from "./button-custom";
export { buttonCustomVariants } from "./button-custom-variants";
export {
  DropdownMenu as RadixDropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu";
export { LinkCustom } from "./link-custom";
export { ConfirmModal } from "./overlay/confirm-modal";
export { NotificationModal } from "./overlay/notification-modal";
export {
  DropdownMenu,
  StatBadge,
  Tooltip as SimpleTooltip,
} from "./profile-elements";
export { SectionGrid } from "./section-grid";
export { SectionTitle } from "./section-title";
export { SegmentedControl, type SegmentedControlOption } from "./segmented-control";

export { ThemedToaster } from "./themed-toaster";
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";
