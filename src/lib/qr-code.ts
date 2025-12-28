/**
 * QR Code Generator for Payment Links
 * Generates QR codes for easy mobile payment access
 */

import QRCode from 'qrcode';

export interface QRCodeOptions {
  size?: number;
  format?: 'png' | 'svg' | 'dataurl';
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}

/**
 * Generates payment link URL from short code
 * @param shortCode 8-character unique identifier
 * @param baseUrl Base application URL (defaults to env var)
 * @returns Full payment link URL
 */
export const getPaymentLinkUrl = (shortCode: string, baseUrl?: string): string => {
  const appUrl = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${appUrl}/pay/${shortCode}`;
};

/**
 * Generates a QR code as a data URL (base64)
 * @param shortCode Payment link short code
 * @param options QR code generation options
 * @returns Promise<string> Data URL of QR code image
 */
export const generateQRCodeDataUrl = async (
  shortCode: string,
  options: QRCodeOptions = {}
): Promise<string> => {
  const url = getPaymentLinkUrl(shortCode);
  
  const qrOptions = {
    errorCorrectionLevel: options.errorCorrectionLevel || 'M',
    type: 'image/png' as const,
    quality: 1,
    margin: options.margin || 1,
    width: options.size || 300,
    color: {
      dark: options.color?.dark || '#000000',
      light: options.color?.light || '#FFFFFF',
    },
  };
  
  return await QRCode.toDataURL(url, qrOptions);
};

/**
 * Generates a QR code as PNG buffer
 * @param shortCode Payment link short code
 * @param options QR code generation options
 * @returns Promise<Buffer> PNG image buffer
 */
export const generateQRCodeBuffer = async (
  shortCode: string,
  options: QRCodeOptions = {}
): Promise<Buffer> => {
  const url = getPaymentLinkUrl(shortCode);
  
  const qrOptions = {
    errorCorrectionLevel: options.errorCorrectionLevel || 'M',
    margin: options.margin || 1,
    width: options.size || 300,
    color: {
      dark: options.color?.dark || '#000000',
      light: options.color?.light || '#FFFFFF',
    },
  };
  
  return await QRCode.toBuffer(url, qrOptions);
};

/**
 * Generates a QR code as SVG string
 * @param shortCode Payment link short code
 * @param options QR code generation options
 * @returns Promise<string> SVG markup
 */
export const generateQRCodeSVG = async (
  shortCode: string,
  options: QRCodeOptions = {}
): Promise<string> => {
  const url = getPaymentLinkUrl(shortCode);
  
  const qrOptions = {
    errorCorrectionLevel: options.errorCorrectionLevel || 'M',
    margin: options.margin || 1,
    width: options.size || 300,
    color: {
      dark: options.color?.dark || '#000000',
      light: options.color?.light || '#FFFFFF',
    },
  };
  
  return await QRCode.toString(url, { ...qrOptions, type: 'svg' });
};

/**
 * Generates multiple QR code formats for a payment link
 * @param shortCode Payment link short code
 * @returns Promise with data URL, SVG, and buffer
 */
export const generateAllQRCodeFormats = async (shortCode: string) => {
  const [dataUrl, svg, buffer] = await Promise.all([
    generateQRCodeDataUrl(shortCode),
    generateQRCodeSVG(shortCode),
    generateQRCodeBuffer(shortCode),
  ]);
  
  return {
    dataUrl,
    svg,
    buffer,
    url: getPaymentLinkUrl(shortCode),
  };
};

/**
 * QR code download helper - generates download filename
 * @param shortCode Payment link short code
 * @param invoiceReference Optional invoice reference
 * @returns Filename for QR code download
 */
export const getQRCodeFilename = (
  shortCode: string,
  invoiceReference?: string | null
): string => {
  const prefix = invoiceReference
    ? `qr-${invoiceReference}-${shortCode}`
    : `qr-${shortCode}`;
  return `${prefix}.png`;
};













