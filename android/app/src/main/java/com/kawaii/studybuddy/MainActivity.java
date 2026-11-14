package com.kawaii.studybuddy;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.Gravity;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import java.io.File;

/** Native shell only: all app UI, API requests and data live on the server. */
public final class MainActivity extends Activity {
    private static final int FILE_REQUEST = 100;
    private static final int PINK = Color.rgb(255, 234, 245);
    private static final int INK = Color.rgb(59, 40, 73);
    private SharedPreferences preferences;
    private FrameLayout root;
    private WebView webView;
    private ProgressBar progress;
    private View errorPanel;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;
    private File cameraFile;
    private String serverUrl;
    private boolean mainLoadFailed;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        preferences = getSharedPreferences("server", MODE_PRIVATE);
        // No file input survives a new Activity process; remove photos left by an interrupted upload.
        File[] oldPhotos = new File(getCacheDir(), "camera").listFiles();
        if (oldPhotos != null) {
            for (File photo : oldPhotos) {
                if (photo.getName().matches("capture-[0-9]+\\.jpg")) photo.delete();
            }
        }
        root = new FrameLayout(this);
        root.setBackgroundColor(PINK);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        setContentView(root);
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::onBackPressed);
        }
        String saved = preferences.getString("url", "");
        if (isAllowedServer(saved)) openServer(saved);
        else showServerSettings();
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    private TextView label(String value, int size) {
        TextView text = new TextView(this);
        text.setText(value);
        text.setTextColor(INK);
        text.setTextSize(size);
        text.setPadding(0, dp(8), 0, dp(8));
        return text;
    }

    private Button button(String value, View.OnClickListener action) {
        Button button = new Button(this);
        button.setText(value);
        button.setAllCaps(false);
        button.setTextColor(INK);
        button.setOnClickListener(action);
        return button;
    }

    private LinearLayout panel() {
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER_VERTICAL);
        panel.setPadding(dp(28), dp(24), dp(28), dp(24));
        panel.setBackgroundColor(PINK);
        return panel;
    }

    private ScrollView scrollable(LinearLayout panel) {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(PINK);
        scroll.addView(panel, new ScrollView.LayoutParams(-1, -2));
        scroll.setLayoutParams(new FrameLayout.LayoutParams(-1, -1));
        return scroll;
    }

    private void showServerSettings() {
        disposeWebView();
        root.removeAllViews();
        LinearLayout panel = panel();
        panel.addView(label("Study Buddy", 32));
        panel.addView(label("Kết nối với server của bạn", 20));
        panel.addView(label("Nhập URL server Express đang phục vụ giao diện. App sẽ ghi nhớ địa chỉ này.", 16));
        EditText address = new EditText(this);
        address.setSingleLine(true);
        address.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        address.setHint(BuildConfig.DEBUG ? "http://192.168.1.10:3000" : "https://study.example.com");
        address.setText(preferences.getString("url", ""));
        address.setTextColor(INK);
        panel.addView(address, new LinearLayout.LayoutParams(-1, dp(58)));
        panel.addView(button("Kết nối", view -> {
            String value = address.getText().toString().trim();
            if (!isAllowedServer(value)) {
                address.setError(BuildConfig.DEBUG
                    ? "Dùng HTTPS hoặc HTTP với IP mạng nội bộ (bản debug)."
                    : "Dùng URL HTTPS hợp lệ với chứng chỉ được tin cậy.");
                return;
            }
            boolean changed = !value.equals(preferences.getString("url", ""));
            preferences.edit().putString("url", value).apply();
            ((android.view.inputmethod.InputMethodManager)getSystemService(INPUT_METHOD_SERVICE))
                .hideSoftInputFromWindow(address.getWindowToken(), 0);
            if (changed) {
                android.webkit.WebStorage.getInstance().deleteAllData();
                CookieManager.getInstance().removeAllCookies(removed -> openServer(value));
            } else { openServer(value); }
        }));
        panel.addView(label(BuildConfig.DEBUG
            ? "Điện thoại thật: dùng IP LAN của máy host, cùng mạng Wi-Fi. Android Emulator: dùng 10.0.2.2."
            : "Giao diện và dữ liệu được tải trực tiếp từ server qua HTTPS.", 14));
        root.addView(scrollable(panel));
    }

    private void openServer(String url) {
        disposeWebView();
        serverUrl = url;
        root.removeAllViews();
        webView = new WebView(this);
        webView.setBackgroundColor(PINK);
        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        root.addView(progress, new FrameLayout.LayoutParams(-1, dp(3), Gravity.TOP));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true); // Required for Android's photo picker upload URIs.
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSafeBrowsingEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);

        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri target = request.getUrl();
                // POST form navigations do not pass through shouldOverrideUrlLoading.
                if (request.isForMainFrame() && !sameOrigin(serverUrl, target.toString())) {
                    return new WebResourceResponse("text/plain", "UTF-8", 403, "Origin not allowed",
                        java.util.Collections.emptyMap(), new java.io.ByteArrayInputStream(new byte[0]));
                }
                if ("http".equalsIgnoreCase(target.getScheme()) && !isAllowedServer(target.toString())) {
                    return new WebResourceResponse("text/plain", "UTF-8", 403, "HTTPS required",
                        java.util.Collections.emptyMap(), new java.io.ByteArrayInputStream(new byte[0]));
                }
                return null;
            }

            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri target = request.getUrl();
                if (sameOrigin(serverUrl, target.toString())) return false;
                if (request.isForMainFrame() && request.hasGesture()
                        && ("https".equals(target.getScheme()) || "http".equals(target.getScheme()))) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, target)); }
                    catch (ActivityNotFoundException ignored) { toast("Không có trình duyệt để mở liên kết."); }
                }
                return true;
            }

            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                if (!sameOrigin(serverUrl, url)) {
                    view.stopLoading();
                    showConnectionError("Trang đích không thuộc server đã chọn. Hãy kiểm tra URL server.");
                    return;
                }
                mainLoadFailed = false;
                progress.setVisibility(View.VISIBLE);
            }

            @Override public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE);
                if (!mainLoadFailed && errorPanel != null) {
                    root.removeView(errorPanel);
                    errorPanel = null;
                }
            }

            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showConnectionError("Không thể kết nối với server. Kiểm tra Wi-Fi, URL và server Express.");
            }

            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame()) showConnectionError("Server trả về lỗi HTTP " + response.getStatusCode() + ".");
            }

            @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel();
                showConnectionError("Chứng chỉ HTTPS của server không hợp lệ. Hãy kiểm tra cấu hình chứng chỉ.");
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int value) { progress.setProgress(value); }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                return choosePhoto(callback, params.isCaptureEnabled());
            }
        });
        webView.loadUrl(serverUrl);
    }

    private void showConnectionError(String message) {
        mainLoadFailed = true;
        if (progress != null) progress.setVisibility(View.GONE);
        if (errorPanel != null) root.removeView(errorPanel);
        LinearLayout panel = panel();
        panel.addView(label("Chưa kết nối được", 26));
        panel.addView(label(message, 16));
        panel.addView(label(serverUrl, 14));
        panel.addView(button("Thử lại", view -> {
            root.removeView(errorPanel);
            errorPanel = null;
            webView.loadUrl(serverUrl);
        }));
        panel.addView(button("Đổi địa chỉ server", view -> showServerSettings()));
        errorPanel = scrollable(panel);
        root.addView(errorPanel);
    }

    private boolean choosePhoto(ValueCallback<Uri[]> callback, boolean capture) {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        fileCallback = callback;
        if (cameraFile != null) cameraFile.delete();
        cameraFile = null;
        cameraUri = null;
        Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (camera.resolveActivity(getPackageManager()) != null) {
            try {
                File directory = new File(getCacheDir(), "camera");
                if (!directory.exists() && !directory.mkdirs()) throw new java.io.IOException("Camera cache unavailable");
                cameraFile = File.createTempFile("capture-", ".jpg", directory);
                cameraUri = Uri.parse("content://" + getPackageName() + ".camera/" + cameraFile.getName());
                camera.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
                camera.setClipData(ClipData.newRawUri("Photo", cameraUri));
                camera.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            } catch (java.io.IOException ignored) { camera = null; }
        } else { camera = null; }
        Intent picker = new Intent(Intent.ACTION_GET_CONTENT);
        picker.addCategory(Intent.CATEGORY_OPENABLE);
        picker.setType("image/*");
        Intent choice = Intent.createChooser(picker, "Chọn ảnh bài học");
        if (camera != null) choice.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camera});
        try { startActivityForResult(capture && camera != null ? camera : choice, FILE_REQUEST); }
        catch (ActivityNotFoundException | SecurityException ignored) {
            fileCallback.onReceiveValue(null);
            fileCallback = null;
            toast("Không mở được camera hoặc trình chọn ảnh.");
        }
        return true;
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_REQUEST || fileCallback == null) return;
        Uri selected = null;
        if (resultCode == RESULT_OK) {
            selected = data == null ? null : data.getData();
            if (selected == null && cameraFile != null && cameraFile.length() > 0) selected = cameraUri;
            try {
                // Never accept a picker-supplied file:// URL or arbitrary non-image content.
                String type = selected == null ? null : getContentResolver().getType(selected);
                if (selected != null && (!"content".equals(selected.getScheme()) || type == null || !type.startsWith("image/"))) selected = null;
            } catch (RuntimeException ignored) { selected = null; }
        }
        fileCallback.onReceiveValue(selected == null ? null : new Uri[]{selected});
        fileCallback = null;
        if (cameraUri != null) revokeUriPermission(cameraUri,
            Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
    }

    private void toast(String message) { Toast.makeText(this, message, Toast.LENGTH_LONG).show(); }

    static boolean isAllowedServer(String value) {
        return UrlPolicy.allowsServer(value, BuildConfig.DEBUG);
    }

    static boolean sameOrigin(String base, String target) {
        return UrlPolicy.sameOrigin(base, target);
    }

    @Override public void onBackPressed() {
        if (webView != null && errorPanel == null && webView.canGoBack()) {
            webView.goBack();
        } else if (webView != null) {
            new AlertDialog.Builder(this).setTitle("Study Buddy")
                .setItems(new String[]{"Tiếp tục học", "Đổi địa chỉ server", "Đóng app"}, (dialog, which) -> {
                    if (which == 1) showServerSettings();
                    if (which == 2) finish();
                }).show();
        } else { super.onBackPressed(); }
    }

    @Override protected void onPause() {
        if (webView != null) webView.onPause();
        CookieManager.getInstance().flush();
        super.onPause();
    }

    @Override protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    private void disposeWebView() {
        if (fileCallback != null) { fileCallback.onReceiveValue(null); fileCallback = null; }
        if (webView != null) {
            root.removeView(webView);
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(new WebViewClient());
            webView.destroy();
            webView = null;
        }
        if (cameraUri != null) revokeUriPermission(cameraUri,
            Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        if (cameraFile != null) cameraFile.delete();
        cameraUri = null;
        cameraFile = null;
        errorPanel = null;
    }

    @Override protected void onDestroy() {
        disposeWebView();
        super.onDestroy();
    }
}
