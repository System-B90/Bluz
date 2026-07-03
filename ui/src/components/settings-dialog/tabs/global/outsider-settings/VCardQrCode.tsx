import CloseIcon from "@mui/icons-material/Close";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import QRCode from "qrcode";
import React, { useEffect, useMemo, useState } from "react";

import { formatPhoneNumber } from "@/components/base/utils/phone-numbers";

type VCardQrCodeProps = {
    comment?: string;
    idNumber?: string;
    name: string;
    personalNumber?: string;
    phone: string;
};

export function VCardQrCode({
    comment,
    idNumber,
    name,
    personalNumber,
    phone,
}: VCardQrCodeProps) {
    const [qrCodeUrl, setQrCodeUrl] = useState("");
    const [highResQrCodeUrl, setHighResQrCodeUrl] = useState("");
    const [open, setOpen] = useState(false);

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
                if (active) {
                    setQrCodeUrl("");
                    setHighResQrCodeUrl("");
                }
            });
            return;
        }
        void Promise.all([
            QRCode.toDataURL(vCardString, {
                width: 160,
                margin: 1,
                errorCorrectionLevel: "M",
            }),
            QRCode.toDataURL(vCardString, {
                width: 600,
                margin: 1,
                errorCorrectionLevel: "M",
            }),
        ])
            .then(([url, highResUrl]) => {
                if (active) {
                    setQrCodeUrl(url);
                    setHighResQrCodeUrl(highResUrl);
                }
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
        <>
            <Tooltip arrow title="לחיצה כפולה להגדלה / סריקה לשמירה בטלפון">
                <Box
                    onDoubleClick={() => setOpen(true)}
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
                        cursor: "pointer",
                        "&:hover": {
                            transform: "scale(1.05)",
                        },
                    }}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element -- QR code is a data URL; next/image doesn't support data URIs */}
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

            <Dialog
                fullWidth
                maxWidth="xs"
                onClose={() => setOpen(false)}
                open={open}
                PaperProps={{
                    sx: {
                        borderRadius: "20px",
                        p: 1,
                        textAlign: "center",
                        overflow: "hidden",
                    },
                }}
            >
                <DialogTitle
                    sx={{
                        m: 0,
                        p: 2,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}
                >
                    <Typography component="span" fontWeight="bold" variant="h6">
                        כרטיס איש קשר (QR)
                    </Typography>
                    <IconButton
                        aria-label="close"
                        onClick={() => setOpen(false)}
                        sx={{
                            color: (theme) => theme.palette.grey[500],
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        pb: 4,
                    }}
                >
                    <Typography component="div" fontWeight="800" sx={{ mt: 1 }} variant="h5">
                        {name}
                    </Typography>
                    {phone ? <Typography color="text.secondary" sx={{ mt: 0.5, direction: "ltr" }} variant="body1">
                        {formatPhoneNumber(phone)}
                    </Typography> : null}
                    <Box
                        sx={{
                            border: "2px solid",
                            borderColor: "divider",
                            borderRadius: "24px",
                            p: 3,
                            mt: 3,
                            bgcolor: "white",
                            boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "transform 0.3s",
                            "&:hover": {
                                transform: "scale(1.02)",
                            },
                        }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element -- High-res QR code is a data URL */}
                        <img
                            alt={`vCard QR Code for ${name}`}
                            src={highResQrCodeUrl || qrCodeUrl}
                            style={{
                                width: 360,
                                height: 360,
                                display: "block",
                            }}
                        />
                    </Box>
                </DialogContent>
            </Dialog>
        </>
    );
}
