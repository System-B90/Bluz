import { LogoGraphic } from "@/components/header/logo/LogoGraphic";

export function Logo({
  width,
  height,
}: {
  width: number | string;
  height: number | string;
}) {
  return (
    <svg
      fill="none"
      height={height}
      viewBox="0 0 2026 2026"
      width={width}
      xmlns="http://www.w3.org/2000/svg"
    >
      <LogoGraphic />
    </svg>
  );
}
