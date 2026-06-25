import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import QRCode from "qrcode";
import React, { useEffect, useMemo, useState } from "react";

type VCardQrCodeProps = {
    comment?: string;
    idNumber?: string;
    name: string;
    personalNumber?: string;
    phone: string;
}

export function VCardQrCode({
    comment,
    idNumber,
    name,
    personalNumber,
    phone,
}: VCardQrCodeProps) {
    const [qrCodeUrl, setQrCodeUrl] = useState("");

    const vCardString = useMemo(() => {
        if (!name || !phone) return "";
        const notes: Array<string> = [];
        if (personalNumber?.trim()) {
            notes.push(`מ.א.: ${personalNumber.trim()}`);
        }
        if (idNumber?.trim()) {
            notes.push(`ת.ז.: ${idNumber.trim()}`);
        }
        if (comment?.trim()) {
            notes.push(`הערה: ${comment.trim()}`);
        }
        const noteValue = notes.join("\\n");
        return [
            "BEGIN:VCARD",
            "VERSION:3.0",
            `FN:${name.trim()}`,
            `N:;${name.trim()};;;`,
            `TEL;TYPE=CELL:${phone.trim()}`,
            noteValue ? `NOTE:${noteValue}` : "",
            "END:VCARD",
        ]
            .filter(Boolean)
            .join("\r\n");
    }, [name, phone, personalNumber, idNumber, comment]);

    useEffect(() => {
        let active = true;
        if (!vCardString) {
            void Promise.resolve().then(() => {
                if (active) setQrCodeUrl("");
            });
            return;
        }
        void QRCode.toDataURL(vCardString, {
            width: 160,
            margin: 1,
            errorCorrectionLevel: "M",
        })
            .then((url) => {
                if (active) setQrCodeUrl(url);
            })
            .catch((err) => {
                console.error("Failed to generate QR code", err);
            });
        return () => {
            active = false;
        };
    }, [vCardString]);

    if (!qrCodeUrl) return null;

    return (
        <Tooltip arrow title="סרוק לשמירת איש הקשר בטלפון">
            <Box
                sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: "12px",
                    p: 0.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "white",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    transition: "transform 0.2s",
                    "&:hover": {
                        transform: "scale(1.05)",
                    },
                }}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    alt="vCard QR Code"
                    src={qrCodeUrl}
                    style={{
                        width: 64,
                        height: 64,
                        display: "block",
                    }}
                />
            </Box>
        </Tooltip>
    );
}
