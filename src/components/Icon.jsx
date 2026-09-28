import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Home01Icon, PackageIcon, ShoppingCart01Icon, ShoppingBag01Icon, PackageReceiveIcon,
  Ticket01Icon, Wallet01Icon, Analytics01Icon, Invoice01Icon, Store01Icon, MailSend01Icon,
  Message01Icon, Upload04Icon, DatabaseSync01Icon, Cancel01Icon, Menu01Icon,
  ArrowLeft01Icon, ArrowRight01Icon, ArrowUp01Icon, ArrowDown01Icon, Download04Icon,
  Alert02Icon, PencilEdit01Icon, Delete02Icon, Archive02Icon, Call02Icon, Location01Icon,
  Note01Icon, Tick02Icon, RefreshIcon, Search01Icon, Add01Icon, Layers01Icon, Camera01Icon,
  Undo02Icon, Logout01Icon, GiftIcon, Image01Icon, CheckmarkCircle02Icon, StarIcon
} from '@hugeicons/core-free-icons';

// One place to see (and change) every icon in the app.
// Browse alternatives at https://hugeicons.com and swap the import above.
const ICONS = {
  home: Home01Icon, package: PackageIcon, cart: ShoppingCart01Icon, shopbag: ShoppingBag01Icon,
  orders: PackageReceiveIcon, convention: Ticket01Icon, expenses: Wallet01Icon,
  reports: Analytics01Icon, breakdown: Invoice01Icon, store: Store01Icon, invite: MailSend01Icon,
  feedback: Message01Icon, import: Upload04Icon, backup: DatabaseSync01Icon,
  close: Cancel01Icon, menu: Menu01Icon, back: ArrowLeft01Icon, forward: ArrowRight01Icon,
  up: ArrowUp01Icon, down: ArrowDown01Icon, download: Download04Icon, warning: Alert02Icon,
  edit: PencilEdit01Icon, trash: Delete02Icon, archive: Archive02Icon, phone: Call02Icon,
  pin: Location01Icon, note: Note01Icon, check: Tick02Icon, refresh: RefreshIcon,
  search: Search01Icon, add: Add01Icon, layers: Layers01Icon, camera: Camera01Icon,
  undo: Undo02Icon, logout: Logout01Icon, gift: GiftIcon, image: Image01Icon,
  success: CheckmarkCircle02Icon, star: StarIcon
};

export default function Icon({ name, size = 18, className = '', ...rest }) {
  const icon = ICONS[name];
  if (!icon) return null;
  return <HugeiconsIcon icon={icon} size={size} strokeWidth={1.8} className={('hi ' + className).trim()} {...rest} />;
}
