const filterBluetoothDevices = async (
    devices: any[] = [], deviceType: 'scale' | 'printer' = 'scale'
) => {
    if (deviceType === 'printer') {
        // Printer filtering - prioritize InnerPrinter
        return devices.filter(device => {
            const deviceName = (device.name || '').toLowerCase();
            
            // Prioritize InnerPrinter devices
            if (deviceName.includes('innerprinter') || deviceName.includes('inner')) {
                console.log(`✅✓✓✓ Including InnerPrinter device: ${device.name || 'Unnamed'} (${device.address})`);
                return true;
            }
            
            // Other printer keywords
            const printerKeywords = [
                'printer', 'print', 'pt', 'zjiang', 'czt', 'gp', 'cenxun',
                'pos', 'thermal', 'xp', 'zt', 'rongta', 'ez', 't9', 'xprinter', 'star'
            ];
            const nameMatch = printerKeywords.some(keyword => deviceName.includes(keyword));
            if (nameMatch) {
                console.log(`✅ Including printer device: ${device.name || 'Unnamed'} (${device.address})`);
            } else {
                console.log(`❌ Excluding non-printer device: ${device.name || 'Unnamed'} (${device.address})`);
            }
            return nameMatch;
        });
    }

    // Scale filtering (safe baseline without manual approval dependency)
    const scaleKeywords = [
        'scale', 'weight', 'weigh', 'weighing', 'balance', 'gram', 'kg', 'lb',
        'digital', 'precision', 'measure',
        // Common crane scale identifiers/brands
        'crane', 'hanging', 'hook', 'ocs', 'ocs-', 'dyna', 'dynamometer', 'kern', 'sf-', 'yh', 'yw',
        // Common BT modules
        'hc-05', 'hc-06', 'hc05', 'hc06', 'esp32', 'arduino', 'at-', 'linvor', 'jdy', 'zs-040'
    ];

    const hcModulePattern = /^(hc-?05|hc-?06)/i;
    const commonScalePatterns = [
        /^00:18:/,  // HC-05 prefix
        /^00:20:/,  // HC-06 prefix
        /^20:15:/,
        /^98:D3:/,  // ESP32 pattern
        /^00:23:/,
    ];

    const filtered = devices.filter(device => {
        const deviceName = (device.name || '').toLowerCase();
        const deviceAddress = (device.address || '').toLowerCase();

        const nameMatch = scaleKeywords.some(keyword => deviceName.includes(keyword));
        const addressMatch = hcModulePattern.test(deviceAddress) || hcModulePattern.test(deviceName);
        const patternMatch = commonScalePatterns.some(pattern => pattern.test(deviceAddress));

        // Include XH-series scales like "xh2507024006"
        const xhSeriesMatch = /^xh[0-9]+/i.test(device.name || '') || /^xh[0-9]+/i.test(deviceAddress || '');
        // OCS series often start with OCS- or OCS
        const ocsSeriesMatch = /^(ocs-?|oc-)/i.test(device.name || '') || /^(ocs-?|oc-)/i.test(deviceAddress || '');

        const unnamedWithScalePattern = (!device.name || device.name.trim() === '' ||
            device.name.includes('Unknown') || device.name.includes('N/A')) && patternMatch;

        const shouldInclude = nameMatch || addressMatch || unnamedWithScalePattern || xhSeriesMatch || ocsSeriesMatch;

        if (shouldInclude) {
            const reasons: string[] = [];
            if (nameMatch) reasons.push('Name');
            if (addressMatch) reasons.push('HC-Module');
            if (unnamedWithScalePattern) reasons.push('Pattern');
            if (xhSeriesMatch) reasons.push('XH-ID');
            if (ocsSeriesMatch) reasons.push('OCS-ID');
            console.log(`✅ Including scale device: ${device.name || 'Unnamed'} (${device.address}) - ${reasons.join(', ')}`);
        } else {
            console.log(`❌ Excluding non-scale device: ${device.name || 'Unnamed'} (${device.address})`);
        }

        return shouldInclude;
    });

    return filtered;
};

export default filterBluetoothDevices;