export default filterBluetoothDevices = async (
    devices = [], deviceType = 'scale'
) => {

    const scale = () => {
        const scaleKeywords = [
            'scale', 'weight', 'balance', 'gram', 'kg', 'lb',
            'digital', 'precision', 'measure', 'weigh',
            'hc-05', 'hc-06', 'hc05', 'hc06',  // Common Bluetooth modules used in scales
            'esp32', 'arduino', 'at-', 'linvor',
            'jdy', 'zs-040'  // Other common modules used in scales
        ];

        return devices.filter(device => {
            const deviceName = (device.name || '').toLowerCase();
            const deviceAddress = (device.address || '').toLowerCase();

            // Check if device name contains scale-related keywords
            const nameMatch = scaleKeywords.some(keyword =>
                deviceName.includes(keyword)
            );

            // Check for HC-05/HC-06 pattern in address or name (common in scales)
            const hcModulePattern = /^(hc-?05|hc-?06)/i;
            const addressMatch = hcModulePattern.test(deviceAddress) || hcModulePattern.test(deviceName);

            // Include devices with specific address patterns common in scale modules
            const commonScalePatterns = [
                /^00:18:/,  // Common HC-05 prefix
                /^00:20:/,  // Common HC-06 prefix  
                /^20:15:/,  // Another common pattern
                /^98:D3:/,  // ESP32 common pattern
                /^00:23:/,  // Another HC-06 pattern (like the user's 00:23:04:00:23:7B)
            ];

            const patternMatch = commonScalePatterns.some(pattern =>
                pattern.test(deviceAddress)
            );

            // For unnamed devices, only include if they match known scale address patterns
            // This is more restrictive than before - unnamed devices need to match a pattern
            const unnamedWithScalePattern = (!device.name || device.name.trim() === '' ||
                device.name.includes('Unknown') ||
                device.name.includes('N/A')) && patternMatch;

            // Check if device is manually approved as scale
            const manuallyApproved = this.isApprovedScale(device.address);

            const shouldInclude = nameMatch || addressMatch || unnamedWithScalePattern || manuallyApproved;

            if (shouldInclude) {
                const reasons = [];
                if (nameMatch) reasons.push('Name');
                if (addressMatch) reasons.push('HC-Module');
                if (unnamedWithScalePattern) reasons.push('Pattern');
                if (manuallyApproved) reasons.push('Manual');
                console.log(`✅ Including scale device: ${device.name || 'Unnamed'} (${device.address}) - ${reasons.join(', ')}`);
            } else {
                console.log(`❌ Excluding non-scale device: ${device.name || 'Unnamed'} (${device.address})`);
            }

            return shouldInclude;
        });
    }
}