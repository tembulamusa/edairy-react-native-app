import React, { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

const ConnectivityDebugger: React.FC = () => {
  useEffect(() => {
    console.log('🔍 Connectivity Debugger Started');
    
    // Listen to all network changes
    const unsubscribe = NetInfo.addEventListener(state => {
      console.log('🌐 Network State Changed:', {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
        details: state.details,
        timestamp: new Date().toISOString()
      });
    });

    // Also check connectivity every 5 seconds for debugging
    const interval = setInterval(async () => {
      try {
        const state = await NetInfo.fetch();
        console.log('⏰ Periodic Check:', {
          isConnected: state.isConnected,
          isInternetReachable: state.isInternetReachable,
          type: state.type
        });
      } catch (error) {
        console.error('❌ Connectivity check failed:', error);
      }
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
      console.log('🔍 Connectivity Debugger Stopped');
    };
  }, []);

  return null; // This component doesn't render anything
};

export default ConnectivityDebugger;
