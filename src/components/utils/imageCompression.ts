import ImageResizer from '@bam.tech/react-native-image-resizer';
import { Asset } from 'react-native-image-picker';

const MAX_FILE_SIZE_KB = 500;
const JPEG_QUALITY = 80;

/**
 * Compresses an image asset to ensure it stays under 500KB while maintaining aspect ratio
 * @param asset - The image asset from react-native-image-picker
 * @returns Promise<Asset> - The compressed image asset with updated uri, fileSize, etc.
 */
export const compressImageForID = async (asset: Asset): Promise<Asset> => {
  try {
    // Skip compression if file size is already under 500KB
    const currentSizeKB = asset.fileSize ? asset.fileSize / 1024 : 0;
    if (currentSizeKB > 0 && currentSizeKB <= MAX_FILE_SIZE_KB) {
      console.log(`Image already under ${MAX_FILE_SIZE_KB}KB (${currentSizeKB.toFixed(2)}KB), skipping compression`);
      return asset;
    }

    console.log(`Compressing image from ${currentSizeKB.toFixed(2)}KB to under ${MAX_FILE_SIZE_KB}KB`);

    // Calculate target dimensions while maintaining aspect ratio
    // We'll use a maximum width/height approach with iterative compression
    let targetWidth = asset.width || 1200;
    let targetHeight = asset.height || 800;

    // First, try resizing to a reasonable maximum dimension
    const maxDimension = 600;
    if (targetWidth > maxDimension || targetHeight > maxDimension) {
      const aspectRatio = targetWidth / targetHeight;
      if (targetWidth > targetHeight) {
        targetWidth = maxDimension;
        targetHeight = maxDimension / aspectRatio;
      } else {
        targetHeight = maxDimension;
        targetWidth = maxDimension * aspectRatio;
      }
    }

    let quality = JPEG_QUALITY;
    let compressedUri = asset.uri!;
    let compressedSize = currentSizeKB;

    // Iteratively reduce quality until under 500KB or quality is too low
    while (compressedSize > MAX_FILE_SIZE_KB && quality >= 30) {
      console.log(`Attempting compression with quality: ${quality}%`);

      const result = await ImageResizer.createResizedImage(
        compressedUri,
        Math.round(targetWidth),
        Math.round(targetHeight),
        'JPEG',
        quality,
        0, // rotation
        undefined, // outputPath
        false, // keep metadata
        { mode: 'contain', onlyScaleDown: false } // maintain aspect ratio
      );

      compressedUri = result.uri;
      compressedSize = result.size / 1024; // Convert to KB

      console.log(`Compressed size: ${compressedSize.toFixed(2)}KB with quality ${quality}%`);

      // Reduce quality for next iteration if still too large
      if (compressedSize > MAX_FILE_SIZE_KB) {
        quality -= 10;
      }
    }

    // If still over 500KB after minimum quality, reduce dimensions further
    if (compressedSize > MAX_FILE_SIZE_KB) {
      console.log('Reducing dimensions further to meet size requirement');

      const furtherReduction = 0.8; // Reduce by 20%
      targetWidth *= furtherReduction;
      targetHeight *= furtherReduction;

      const finalResult = await ImageResizer.createResizedImage(
        asset.uri!,
        Math.round(targetWidth),
        Math.round(targetHeight),
        'JPEG',
        30, // minimum quality
        0,
        undefined,
        false,
        { mode: 'contain', onlyScaleDown: false }
      );

      compressedUri = finalResult.uri;
      compressedSize = finalResult.size / 1024;

      console.log(`Final compressed size: ${compressedSize.toFixed(2)}KB`);
    }

    // Return updated asset with compressed image details
    return {
      ...asset,
      uri: compressedUri,
      fileSize: compressedSize * 1024, // Convert back to bytes
      width: Math.round(targetWidth),
      height: Math.round(targetHeight),
      type: 'image/jpeg', // Ensure JPEG format
    };
  } catch (error) {
    console.error('Error compressing image:', error);
    // Return original asset if compression fails
    return asset;
  }
};

/**
 * Validates that an image asset meets the size requirements
 * @param asset - The image asset to validate
 * @returns boolean - True if the image is under 500KB
 */
export const validateImageSize = (asset: Asset): boolean => {
  if (!asset.fileSize) return true; // If no fileSize info, assume valid
  const sizeKB = asset.fileSize / 1024;
  return sizeKB <= MAX_FILE_SIZE_KB;
};