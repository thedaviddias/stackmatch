import { Button } from "@react-email/components";
import { EMAIL_BRAND } from "../../keys";

type ButtonChildren = NonNullable<Parameters<typeof Button>[0]>["children"];
type ButtonStyle = NonNullable<Parameters<typeof Button>[0]>["style"];

interface ActionButtonProps {
  href: string;
  children: ButtonChildren;
  style?: ButtonStyle;
}

export function ActionButton({ href, children, style }: ActionButtonProps) {
  return (
    <Button
      href={href}
      style={{
        ...buttonStyle,
        ...style,
      }}
    >
      {children}
    </Button>
  );
}

const buttonStyle = {
  backgroundColor: EMAIL_BRAND.primary,
  borderRadius: "6px",
  color: EMAIL_BRAND.white,
  fontSize: "14px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 20px",
  lineHeight: "100%",
  maxWidth: "100%",
};
