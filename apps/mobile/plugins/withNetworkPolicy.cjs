const { withAndroidManifest, withInfoPlist } = require('expo/config-plugins');

// Local pilot builds reach an Express server over Wi-Fi. Production builds use HTTPS.
module.exports = function withNetworkPolicy(config) {
  const allowLocalDevelopment = process.env.APP_VARIANT !== 'production';
  config = withAndroidManifest(config, current => {
    const application = current.modResults.manifest.application?.[0];
    if (application) application.$['android:usesCleartextTraffic'] = String(allowLocalDevelopment);
    return current;
  });
  return withInfoPlist(config, current => {
    current.modResults.NSAppTransportSecurity = {
      ...(current.modResults.NSAppTransportSecurity || {}),
      NSAllowsLocalNetworking: allowLocalDevelopment,
      NSAllowsArbitraryLoads: allowLocalDevelopment,
    };
    current.modResults.NSLocalNetworkUsageDescription = 'Kết nối với server học tập của bạn trong cùng mạng Wi-Fi.';
    return current;
  });
};
