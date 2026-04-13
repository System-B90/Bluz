import { LogoGraphic } from "@/components/header/logo/LogoGraphic";

export default function Logo({ width, height }: { width: number | string; height: number | string; })
{
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 2026 2026"
            width={ width }
            height={ height }
        >
            <LogoGraphic />
        </svg>
    );
}
