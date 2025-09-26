import {Dimensions, PixelRatio, Platform} from 'react-native';

// Get screen dimensions
export const screenWidth = Dimensions.get('window').width;
export const screenHeight = Dimensions.get('window').height;

// Base dimensions for scaling calculations
const baseWidth = 375; // iPhone 8 width
const baseHeight = 667; // iPhone 8 height

// Scale factor for width-based scaling
const widthScaleFactor = screenWidth / baseWidth;
// Scale factor for height-based scaling
const heightScaleFactor = screenHeight / baseHeight;

/**
 * Moderately scales a size based on the device's screen width
 * This is useful for padding, margins, and other layout properties
 * @param {number} size - Size to scale
 * @return {number} - Scaled size
 */
export const moderateScale = (size) => {
  // Use a factor of 0.5 to moderate the scaling effect
  const factor = 0.5;
  return size + (widthScaleFactor - 1) * size * factor;
};

/**
 * Scales a size based on the device's screen width
 * This is useful for responsive layouts
 * @param {number} size - Size to scale
 * @return {number} - Scaled size
 */
export const horizontalScale = (size) => {
  return size * widthScaleFactor;
};

/**
 * Scales a size based on the device's screen height
 * This is useful for responsive layouts
 * @param {number} size - Size to scale
 * @return {number} - Scaled size
 */
export const verticalScale = (size) => {
  return size * heightScaleFactor;
};

/**
 * Scales a font size based on the device's screen width
 * This is useful for responsive typography
 * @param {number} size - Font size to scale
 * @return {number} - Scaled font size
 */
export const fontScale = (size) => {
  // Use a factor of 0.3 to moderate the scaling effect for fonts
  const factor = 0.3;
  const scaledSize = size + (widthScaleFactor - 1) * size * factor;
  
  // Ensure minimum font size for readability
  return Math.max(scaledSize, size * 0.8);
};

/**
 * Converts dp to px
 * @param {number} dp - DP value to convert
 * @return {number} - Equivalent px value
 */
export const dpToPx = (dp) => {
  return PixelRatio.getPixelSizeForLayoutSize(dp);
};

/**
 * Converts px to dp
 * @param {number} px - PX value to convert
 * @return {number} - Equivalent dp value
 */
export const pxToDp = (px) => {
  return px / PixelRatio.get();
};

/**
 * Returns true if the device is a tablet
 * @return {boolean} - True if tablet, false otherwise
 */
export const isTablet = () => {
  // Use a combination of screen size and pixel density to determine if device is a tablet
  const pixelDensity = PixelRatio.get();
  const adjustedWidth = screenWidth * pixelDensity;
  const adjustedHeight = screenHeight * pixelDensity;
  
  return (
    Math.sqrt(Math.pow(adjustedWidth, 2) + Math.pow(adjustedHeight, 2)) >= 1000
  );
};

/**
 * Returns appropriate size based on whether the device is a tablet or phone
 * @param {number} phone - Size for phones
 * @param {number} tablet - Size for tablets
 * @return {number} - Appropriate size
 */
export const deviceBasedDynamicDimension = (phone, tablet) => {
  return isTablet() ? tablet : phone;
};

/**
 * Returns the appropriate padding for the current device to account for notches and home indicators
 * @return {object} - Object containing top, bottom, left, and right padding
 */
export const getSafeAreaPadding = () => {
  // Default safe area padding
  const defaultPadding = {
    top: Platform.OS === 'ios' ? 44 : 0,
    bottom: Platform.OS === 'ios' ? 34 : 0,
    left: 0,
    right: 0,
  };
  
  return defaultPadding;
};

/**
 * Width percentage
 * Converts percentage to width dimension
 * @param {number} percentage - Percentage of screen width
 * @return {number} - Width dimension
 */
export const wp = (percentage) => {
  return (screenWidth * percentage) / 100;
};

/**
 * Height percentage
 * Converts percentage to height dimension
 * @param {number} percentage - Percentage of screen height
 * @return {number} - Height dimension
 */
export const hp = (percentage) => {
  return (screenHeight * percentage) / 100;
};

export default {
  moderateScale,
  horizontalScale,
  verticalScale,
  fontScale,
  dpToPx,
  pxToDp,
  isTablet,
  deviceBasedDynamicDimension,
  getSafeAreaPadding,
  screenWidth,
  screenHeight,
  wp,
  hp,
};
