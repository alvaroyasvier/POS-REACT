import speakeasy from "speakeasy";
import QRCode from "qrcode";

export const generate2FA = async (email) => {
  const secret = speakeasy.generateSecret({
    name: `TuApp (${email})`,
  });

  const qr = await QRCode.toDataURL(secret.otpauth_url);

  return {
    secret: secret.base32, // 🔥 CLAVE
    qr,
  };
};

export const verify2FAToken = (token, secret) => {
  if (!secret) return false;

  return speakeasy.totp({
    secret,
    encoding: "base32", // 🔥 CLAVE
    token,
    window: 1,
  });
};
