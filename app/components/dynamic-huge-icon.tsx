"use client";

import { createElement, useEffect, useState, type SVGProps } from "react";

type HugeIconName =
  | "AiChat01Icon"
  | "ArrowLeft01Icon"
  | "ArrowRight01Icon"
  | "Cancel01Icon"
  | "CallIcon"
  | "Facebook01Icon"
  | "InstagramIcon"
  | "MailSend01Icon"
  | "Mail01Icon"
  | "NextIcon"
  | "PreviousIcon"
  | "UserIcon"
  | "WhatsappIcon";

type HugeIconNode = [tagName: string, attrs: Record<string, string | number>];
type HugeIconData = HugeIconNode[];

const iconLoaders: Record<HugeIconName, () => Promise<{ default: HugeIconData }>> = {
  AiChat01Icon: () => import("@hugeicons/core-free-icons/ChatBotIcon"),
  ArrowLeft01Icon: () => import("@hugeicons/core-free-icons/ArrowLeft01Icon"),
  ArrowRight01Icon: () => import("@hugeicons/core-free-icons/ArrowRight01Icon"),
  Cancel01Icon: () => import("@hugeicons/core-free-icons/Cancel01Icon"),
  CallIcon: () => import("@hugeicons/core-free-icons/CallIcon"),
  Facebook01Icon: () => import("@hugeicons/core-free-icons/Facebook01Icon"),
  InstagramIcon: () => import("@hugeicons/core-free-icons/InstagramIcon"),
  MailSend01Icon: () => import("@hugeicons/core-free-icons/MailSend01Icon"),
  Mail01Icon: () => import("@hugeicons/core-free-icons/Mail01Icon"),
  NextIcon: () => import("@hugeicons/core-free-icons/ArrowRight01Icon"),
  PreviousIcon: () => import("@hugeicons/core-free-icons/ArrowLeft01Icon"),
  UserIcon: () => import("@hugeicons/core-free-icons/UserIcon"),
  WhatsappIcon: () => import("@hugeicons/core-free-icons/WhatsappIcon"),
};

type DynamicHugeIconProps = Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: HugeIconName;
  iconStrokeWidth?: number;
};

export function DynamicHugeIcon({
  name,
  className,
  viewBox = "0 0 24 24",
  fill = "none",
  stroke = "currentColor",
  iconStrokeWidth,
  "aria-hidden": ariaHidden = true,
  ...rest
}: DynamicHugeIconProps) {
  const [iconData, setIconData] = useState<HugeIconData | null>(null);

  useEffect(() => {
    let mounted = true;

    iconLoaders[name]()
      .then((module) => {
        if (mounted) {
          setIconData(module.default);
        }
      })
      .catch(() => {
        if (mounted) {
          setIconData(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, [name]);

  if (!iconData) {
    return <span className={className} aria-hidden={ariaHidden} />;
  }

  return (
    <svg
      viewBox={viewBox}
      fill={fill}
      stroke={stroke}
      className={className}
      aria-hidden={ariaHidden}
      {...rest}
    >
      {iconData.map(([tagName, attrs], index) => {
        const iconKey = typeof attrs.key === "string" ? attrs.key : `${tagName}-${index}`;
        const mergedAttrs =
          iconStrokeWidth && Object.prototype.hasOwnProperty.call(attrs, "strokeWidth")
            ? { ...attrs, strokeWidth: iconStrokeWidth }
            : attrs;
        return createElement(tagName, { ...mergedAttrs, key: iconKey });
      })}
    </svg>
  );
}