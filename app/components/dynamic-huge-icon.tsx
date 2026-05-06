"use client";

import { createElement, useEffect, useState, useSyncExternalStore, type SVGProps } from "react";

type HugeIconName =
  | "AiChat01Icon"
  | "ArrowLeft01Icon"
  | "ArrowRight01Icon"
  | "ArrowUpRight01Icon"
  | "Cancel01Icon"
  | "CallIcon"
  | "Add01Icon"
  | "Remove01Icon"
  | "FavouriteIcon"
  | "Facebook01Icon"
  | "Home01Icon"
  | "InstagramIcon"
  | "MailSend01Icon"
  | "Mail01Icon"
  | "Moon01Icon"
  | "Notification01Icon"
  | "NextIcon"
  | "PreviousIcon"
  | "FilterHorizontalIcon"
  | "Search01Icon"
  | "ShoppingBag01Icon"
  | "ShoppingCart01Icon"
  | "ShoppingCart02Icon"
  | "Share01Icon"
  | "StarIcon"
  | "StarHalfIcon"
  | "Sun01Icon"
  | "UserIcon"
  | "WhatsappIcon";

type HugeIconNode = [tagName: string, attrs: Record<string, string | number>];
type HugeIconData = HugeIconNode[];

const iconLoaders: Record<HugeIconName, () => Promise<{ default: HugeIconData }>> = {
  AiChat01Icon: () => import("@hugeicons/core-free-icons/ChatBotIcon"),
  Add01Icon: () => import("@hugeicons/core-free-icons/Add01Icon"),
  ArrowLeft01Icon: () => import("@hugeicons/core-free-icons/ArrowLeft01Icon"),
  ArrowRight01Icon: () => import("@hugeicons/core-free-icons/ArrowRight01Icon"),
  ArrowUpRight01Icon: () => import("@hugeicons/core-free-icons/ArrowUpRight01Icon"),
  Cancel01Icon: () => import("@hugeicons/core-free-icons/Cancel01Icon"),
  CallIcon: () => import("@hugeicons/core-free-icons/CallIcon"),
  FavouriteIcon: () => import("@hugeicons/core-free-icons/FavouriteIcon"),
  Facebook01Icon: () => import("@hugeicons/core-free-icons/Facebook01Icon"),
  FilterHorizontalIcon: () => import("@hugeicons/core-free-icons/FilterHorizontalIcon"),
  Home01Icon: () => import("@hugeicons/core-free-icons/Home01Icon"),
  InstagramIcon: () => import("@hugeicons/core-free-icons/InstagramIcon"),
  MailSend01Icon: () => import("@hugeicons/core-free-icons/MailSend01Icon"),
  Mail01Icon: () => import("@hugeicons/core-free-icons/Mail01Icon"),
  Moon01Icon: () => import("@hugeicons/core-free-icons/Moon01Icon"),
  Notification01Icon: () => import("@hugeicons/core-free-icons/Notification01Icon"),
  NextIcon: () => import("@hugeicons/core-free-icons/ArrowRight01Icon"),
  PreviousIcon: () => import("@hugeicons/core-free-icons/ArrowLeft01Icon"),
  Remove01Icon: () => import("@hugeicons/core-free-icons/Remove01Icon"),
  Search01Icon: () => import("@hugeicons/core-free-icons/Search01Icon"),
  ShoppingBag01Icon: () => import("@hugeicons/core-free-icons/ShoppingBag01Icon"),
  ShoppingCart01Icon: () => import("@hugeicons/core-free-icons/ShoppingCart01Icon"),
  ShoppingCart02Icon: () => import("@hugeicons/core-free-icons/ShoppingCart02Icon"),
  Share01Icon: () => import("@hugeicons/core-free-icons/Share08Icon"),
  StarIcon: () => import("@hugeicons/core-free-icons/StarIcon"),
  StarHalfIcon: () => import("@hugeicons/core-free-icons/StarHalfIcon"),
  Sun01Icon: () => import("@hugeicons/core-free-icons/Sun01Icon"),
  UserIcon: () => import("@hugeicons/core-free-icons/UserIcon"),
  WhatsappIcon: () => import("@hugeicons/core-free-icons/WhatsappIcon"),
};

const iconCache = new Map<HugeIconName, HugeIconData>();
const iconPromiseCache = new Map<HugeIconName, Promise<HugeIconData>>();

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
  const hasMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const resolvedIconData = hasMounted ? iconCache.get(name) ?? iconData : null;

  useEffect(() => {
    let mountedLocal = true;

    if (iconCache.has(name)) {
      return () => {
        mountedLocal = false;
      };
    }

    const existingPromise = iconPromiseCache.get(name);
    const loadPromise =
      existingPromise ??
      iconLoaders[name]()
        .then((module) => {
          iconCache.set(name, module.default);
          return module.default;
        })
        .finally(() => {
          iconPromiseCache.delete(name);
        });

    if (!existingPromise) {
      iconPromiseCache.set(name, loadPromise);
    }

    loadPromise
      .then((data) => {
        if (mountedLocal) {
          setIconData(data);
        }
      })
      .catch(() => {
        if (mountedLocal) {
          setIconData(null);
        }
      });

    return () => {
      mountedLocal = false;
    };
  }, [name]);

  if (!resolvedIconData) {
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
      {resolvedIconData.map(([tagName, attrs], index) => {
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
