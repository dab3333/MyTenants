import { UserIcon } from "../icons";

const SIZES = {
  sm: { box: "h-8 w-8", text: "text-xs", icon: "h-4 w-4", px: 32 },
  md: { box: "h-12 w-12", text: "text-sm", icon: "h-6 w-6", px: 48 },
  lg: { box: "h-20 w-20", text: "text-2xl", icon: "h-9 w-9", px: 80 },
} as const;

function initials(firstName: string, lastName: string): string {
  return `${firstName.trim()[0] ?? ""}${lastName.trim()[0] ?? ""}`.toUpperCase();
}

export function TenantAvatar({
  photoUrl,
  firstName,
  lastName,
  size = "md",
}: {
  photoUrl: string | null;
  firstName: string;
  lastName: string;
  size?: keyof typeof SIZES;
}) {
  const { box, text, icon, px } = SIZES[size];

  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={photoUrl}
        alt=""
        width={px}
        height={px}
        className={`${box} shrink-0 rounded-full object-cover`}
      />
    );
  }

  const initialsText = initials(firstName, lastName);

  return (
    <div
      aria-hidden
      className={`${box} ${text} flex shrink-0 items-center justify-center rounded-full bg-clay-100 font-semibold text-clay-700`}
    >
      {initialsText || <UserIcon className={`${icon} text-clay-300`} />}
    </div>
  );
}
