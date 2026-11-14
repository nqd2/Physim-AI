package com.kawaii.studybuddy;

/** Run without an Android SDK; see README.md. Throws on any failed policy check. */
public final class UrlPolicyCheck {
    private static int checks;
    private static void check(boolean actual, boolean expected, String label) {
        checks++;
        if (actual != expected) throw new AssertionError(label);
    }
    public static void main(String[] args) {
        for (String url : new String[]{"https://study.example.com", "https://study.example.com:443/app", "https://192.168.1.2:8443"}) {
            check(UrlPolicy.allowsServer(url, false), true, "release " + url);
            check(UrlPolicy.allowsServer(url, true), true, "debug " + url);
        }
        for (String url : new String[]{"http://192.168.1.20:3000", "http://10.0.2.2:3000", "http://172.16.0.1", "http://172.31.255.255", "http://127.0.0.1", "http://localhost", "http://[::1]"}) {
            check(UrlPolicy.allowsServer(url, true), true, "LAN " + url);
            check(UrlPolicy.allowsServer(url, false), false, "release HTTP " + url);
        }
        for (String url : new String[]{"http://8.8.8.8", "http://example.com", "http://172.15.1.1", "http://172.32.1.1", "http://192.168.1.999", "http://192.168.1.2.attacker.test", "https://user:password@example.com", "https://example.com:99999", "https://example.com:0", "javascript:alert(1)", "file:///etc/hosts", "https://", "not a URL"}) {
            check(UrlPolicy.allowsServer(url, true), false, "blocked " + url);
        }
        check(UrlPolicy.sameOrigin("https://example.com", "https://EXAMPLE.com:443/page#hash"), true, "same default origin");
        check(UrlPolicy.sameOrigin("https://example.com", "http://example.com"), false, "scheme downgrade");
        check(UrlPolicy.sameOrigin("https://example.com", "https://example.com:8443"), false, "different port");
        check(UrlPolicy.sameOrigin("https://example.com", "https://example.com.attacker.test"), false, "host suffix attack");
        check(UrlPolicy.sameOrigin("https://example.com", "https://user@example.com"), false, "credentials");
        check(UrlPolicy.sameOrigin("https://example.com", "content://example.com/photo"), false, "content navigation");
        System.out.println("PASS: " + checks + " URL policy checks");
    }
}
