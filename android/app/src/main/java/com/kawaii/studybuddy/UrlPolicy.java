package com.kawaii.studybuddy;

import java.net.URI;
import java.util.Locale;

/** Kept Android-independent so URL restrictions can be verified on a plain JDK. */
final class UrlPolicy {
    private UrlPolicy() { }

    static boolean allowsServer(String value, boolean debug) {
        try {
            URI uri = new URI(value);
            if (uri.getHost() == null || uri.getUserInfo() != null || uri.getPort() > 65535 || uri.getPort() == 0) return false;
            if ("https".equalsIgnoreCase(uri.getScheme())) return true;
            if (!debug || !"http".equalsIgnoreCase(uri.getScheme())) return false;
            String host = uri.getHost().toLowerCase(Locale.ROOT);
            if (host.equals("localhost") || host.equals("[::1]") || host.equals("::1")) return true;
            String[] parts = host.split("\\.");
            if (parts.length != 4) return false;
            int[] octets = new int[4];
            for (int i = 0; i < 4; i++) {
                if (!parts[i].matches("[0-9]{1,3}")) return false;
                octets[i] = Integer.parseInt(parts[i]);
                if (octets[i] > 255) return false;
            }
            return octets[0] == 10 || octets[0] == 127
                || (octets[0] == 192 && octets[1] == 168)
                || (octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31);
        } catch (Exception ignored) { return false; }
    }

    static boolean sameOrigin(String base, String target) {
        try {
            URI left = new URI(base);
            URI right = new URI(target);
            return left.getScheme().equalsIgnoreCase(right.getScheme())
                && left.getHost().equalsIgnoreCase(right.getHost())
                && effectivePort(left) == effectivePort(right) && right.getUserInfo() == null;
        } catch (Exception ignored) { return false; }
    }

    private static int effectivePort(URI uri) {
        return uri.getPort() >= 0 ? uri.getPort() : ("https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80);
    }
}
